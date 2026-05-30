import { store, actions, QUEUE_STATUS } from '../state/store.js';
import { trackEvent } from '../tracking.js';
import {
    postWidgetGeneration,
    getStorefrontDomain,
    startWidgetGeneration,
    fetchWidgetGenerationStatus
} from '../utils/widgetShopperApi.js';
import { getWidgetAnonymousClientId } from '../utils/persistStorage.js';
import { debugLog } from '../debug.js';

const BACKEND_JOB_STATUS = {
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
};

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_MS = 5 * 60 * 1000;

function pickStablePreviewUrl(savedResponse, fallbackUrl) {
    const candidate =
        savedResponse?.generation?.previewImageUrl ||
        savedResponse?.previewImageUrl ||
        savedResponse?.generation?.url ||
        savedResponse?.url ||
        fallbackUrl;
    if (typeof candidate !== 'string') return fallbackUrl;
    return candidate;
}

function getDomainForApi(mergedConfig) {
    const raw = mergedConfig?.domain || getStorefrontDomain();
    if (!raw) return getStorefrontDomain();
    return String(raw)
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .toLowerCase()
        .trim();
}

function getSessionIdForApi(mergedConfig) {
    try {
        return (
            mergedConfig?.sessionId ||
            (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ai_furniture_session_id')) ||
            null
        );
    } catch {
        return mergedConfig?.sessionId || null;
    }
}

function isNavigationAbort(error) {
    if (!error) return false;
    if (error.name === 'AbortError') return true;
    const msg = String(error.message || '').toLowerCase();
    return (
        msg.includes('abort') ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('load failed')
    );
}

async function uploadImageToS3ViaBackend({ apiEndpoint, domain, sessionId, fileOrBlob }) {
    if (!fileOrBlob) throw new Error('Missing image');
    const contentType = fileOrBlob.type || 'image/jpeg';

    const r = await fetch(`${apiEndpoint}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            domain,
            ...(sessionId ? { sessionId } : {}),
            contentType
        }),
        credentials: 'omit'
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `upload-url HTTP ${r.status}`);
    if (!data.uploadUrl || !data.s3Key) throw new Error('upload-url missing uploadUrl/s3Key');

    const putRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: fileOrBlob
    });
    if (!putRes.ok) throw new Error(`S3 PUT HTTP ${putRes.status}`);

    return {
        s3Key: data.s3Key,
        imageUrl: data.imageUrl || null
    };
}

const processingItems = new Set();
const pollingItems = new Set();
let queueProcessorInitialized = false;
let isPageUnloading = false;

const dataURLToBlob = (dataURL) => {
    if (!dataURL) return null;
    try {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.warn('Failed to convert data URL to blob', e);
        return null;
    }
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyCompletedResult(id, item, resultPayload, uploaded, mergedConfig) {
    const result = resultPayload?.result || resultPayload;
    const originalImageUrl =
        result.generatedImages?.[0]?.originalImageUrl || uploaded?.imageUrl || item.userImageUrl || null;
    const generatedImageUrl = result.generatedImages?.[0]?.url;

    actions.updateQueueItem(id, {
        status: QUEUE_STATUS.COMPLETED,
        completedAt: Date.now(),
        imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
        userImageUrl: originalImageUrl || item.userImageUrl,
        backendJobSubmitted: true,
        result: {
            generatedImageUrl,
            originalImageUrl,
            imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
            furnitureWidthCm:
                typeof item.furnitureWidthCm === 'number' &&
                Number.isFinite(item.furnitureWidthCm) &&
                item.furnitureWidthCm > 0
                    ? item.furnitureWidthCm
                    : null,
            model: item.selectedModel,
            generationTime: result.timings?.total?.durationSeconds,
            timestamp: new Date().toISOString(),
            productData: result.productData,
            originalAspectRatio:
                result.originalImageDimensions?.aspectRatio ||
                result.generatedImages?.[0]?.originalAspectRatio,
            originalWidth:
                result.originalImageDimensions?.width || result.generatedImages?.[0]?.originalWidth,
            originalHeight:
                result.originalImageDimensions?.height || result.generatedImages?.[0]?.originalHeight
        }
    });

    trackEvent('ai_generation_completed', {
        queueId: id,
        productUrl: item.productUrl,
        productName: item.productName || document.title,
        model: item.selectedModel,
        generationTime: result.timings?.total?.durationSeconds,
        hasResult: !!generatedImageUrl,
        generatedImageUrl
    });

    const userEmail = (store.getState().userEmail || '').trim().toLowerCase();
    const emailOk = !!userEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail);
    const anonKey = emailOk ? '' : getWidgetAnonymousClientId();
    const apiEndpoint = mergedConfig?.apiEndpoint;
    const { productUrl } = item;
    const { furnitureWidthCm } = item;

    if (generatedImageUrl && (emailOk || anonKey) && apiEndpoint) {
        const domainForHistory = mergedConfig?.domain || getStorefrontDomain();
        const payload = {
            domain: domainForHistory,
            productUrl,
            productName: (item.productName || document.title || '').slice(0, 500),
            previewImageUrl: generatedImageUrl,
            originalImageUrl: originalImageUrl || null,
            metadata: {
                queueId: id,
                imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
                ...(typeof furnitureWidthCm === 'number' &&
                Number.isFinite(furnitureWidthCm) &&
                furnitureWidthCm > 0
                    ? { furnitureWidthCm }
                    : {}),
                originalAspectRatio:
                    result.originalImageDimensions?.aspectRatio ||
                    result.generatedImages?.[0]?.originalAspectRatio,
                originalWidth:
                    result.originalImageDimensions?.width ||
                    result.generatedImages?.[0]?.originalWidth,
                originalHeight:
                    result.originalImageDimensions?.height ||
                    result.generatedImages?.[0]?.originalHeight
            }
        };
        if (emailOk) {
            payload.email = userEmail;
        } else {
            payload.anonymousClientKey = anonKey;
        }
        postWidgetGeneration(apiEndpoint, payload)
            .then((saved) => {
                const stablePreviewUrl = pickStablePreviewUrl(saved, generatedImageUrl);
                if (stablePreviewUrl && stablePreviewUrl !== generatedImageUrl) {
                    actions.updateQueueItem(id, {
                        result: {
                            ...(store.getState().queue.find((q) => q.id === id)?.result || {}),
                            generatedImageUrl: stablePreviewUrl
                        }
                    });
                }
                actions.syncShopperGenerations();
            })
            .catch((e) => debugLog('Could not save preview to history', e?.message || e));
    }
}

async function pollUntilComplete(id, item, apiEndpoint, domainForApi, uploaded, mergedConfig) {
    if (pollingItems.has(id)) return false;
    pollingItems.add(id);
    processingItems.add(id);

    const startedAt = item.startedAt || Date.now();
    const deadline = startedAt + MAX_POLL_MS;
    let completed = false;

    try {
        while (!isPageUnloading && Date.now() < deadline) {
            let statusPayload;
            try {
                statusPayload = await fetchWidgetGenerationStatus(apiEndpoint, {
                    queueId: id,
                    domain: domainForApi
                });
            } catch (e) {
                if (e?.status === 404) {
                    debugLog(`Job ${id.slice(0, 8)} not found on server yet`);
                    return false;
                }
                debugLog('Poll failed, retrying…', e?.message || e);
                await sleep(POLL_INTERVAL_MS);
                continue;
            }

            if (statusPayload.status === BACKEND_JOB_STATUS.COMPLETED && statusPayload.result) {
                applyCompletedResult(id, item, statusPayload, uploaded, mergedConfig);
                completed = true;
                return true;
            }

            if (statusPayload.status === BACKEND_JOB_STATUS.FAILED) {
                throw new Error(statusPayload.error || 'Generation failed');
            }

            await sleep(POLL_INTERVAL_MS);
        }

        if (!isPageUnloading && Date.now() >= deadline) {
            throw new Error('Generation timed out - please retry');
        }

        return false;
    } finally {
        pollingItems.delete(id);
        if (!completed) {
            processingItems.delete(id);
        } else {
            processingItems.delete(id);
        }
    }
}

async function submitAsyncGeneration(id, item, apiEndpoint, domainForApi, sessionIdForApi, uploaded) {
    const formData = new FormData();
    formData.append('queueId', id);
    formData.append('productUrl', item.productUrl);
    formData.append('model', 'slow');
    formData.append('domain', domainForApi);
    if (sessionIdForApi) formData.append('sessionId', sessionIdForApi);
    if (item.productName) formData.append('productName', item.productName);
    formData.append('imageS3Key', uploaded.s3Key);
    if (
        typeof item.furnitureWidthCm === 'number' &&
        Number.isFinite(item.furnitureWidthCm) &&
        item.furnitureWidthCm > 0
    ) {
        formData.append('furnitureWidthCm', String(item.furnitureWidthCm));
    }

    await startWidgetGeneration(apiEndpoint, formData);
    actions.updateQueueItem(id, {
        backendJobSubmitted: true,
        generationSubmittedAt: Date.now(),
        imageS3Key: uploaded.s3Key,
        userImageUrl: uploaded.imageUrl || item.userImageUrl || null
    });
}

export function initQueueProcessor() {
    if (queueProcessorInitialized) {
        debugLog('Queue Processor already initialized, skipping...');
        const currentState = store.getState();
        if (currentState.queue && currentState.queue.length > 0) {
            debugLog('Checking queue after script reload...');
            resumePendingItems(currentState);
        }
        return;
    }

    queueProcessorInitialized = true;

    store.subscribe((state) => {
        checkQueue(state);
    });

    const initialState = store.getState();
    debugLog('Queue Processor initialized. Checking for pending items...', {
        queueLength: initialState.queue.length,
        pending: initialState.queue.filter((i) => i.status === QUEUE_STATUS.PENDING).length,
        processing: initialState.queue.filter((i) => i.status === QUEUE_STATUS.PROCESSING).length
    });

    checkQueue(initialState);
    resumePendingItems(initialState);
}

function checkQueue(state) {
    const pendingItems = state.queue.filter(
        (item) => item.status === QUEUE_STATUS.PENDING && !processingItems.has(item.id)
    );

    if (pendingItems.length > 0) {
        debugLog(`Found ${pendingItems.length} pending items, processing...`);
        pendingItems.forEach((item) => {
            processQueueItem(item);
        });
    }
}

function resumePendingItems(state) {
    const pendingItems = state.queue.filter(
        (item) => item.status === QUEUE_STATUS.PENDING && !processingItems.has(item.id)
    );

    pendingItems.forEach((item) => {
        if (!item.userImage && !item.userImageDataUrl && !item.imageS3Key) {
            console.warn(`⚠️ Item ${item.id.slice(0, 8)} lost image data (page reload), marking as error`);
            actions.updateQueueItem(item.id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: 'Image data lost after page reload - please add to queue again'
            });
            return;
        }

        if (item.userImageDataUrl && !item.userImage && !item.imageS3Key) {
            const blob = dataURLToBlob(item.userImageDataUrl);
            if (blob) {
                item.userImage = blob;
                debugLog(`Restored image from data URL for item ${item.id.slice(0, 8)}`);
            } else {
                actions.updateQueueItem(item.id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Failed to restore image data - please re-upload'
                });
                return;
            }
        }

        debugLog(`Resuming pending item ${item.id.slice(0, 8)}...`);
        processQueueItem(item);
    });

    const interruptedItems = state.queue.filter(
        (item) => item.status === QUEUE_STATUS.PROCESSING && !processingItems.has(item.id)
    );

    if (interruptedItems.length > 0) {
        debugLog(
            `Found ${interruptedItems.length} in-flight items from previous page — polling backend instead of restarting…`
        );
        interruptedItems.forEach((item) => {
            const processingTime = item.startedAt ? Date.now() - item.startedAt : 0;
            if (processingTime > MAX_POLL_MS) {
                actions.updateQueueItem(item.id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Generation timed out - please retry'
                });
                return;
            }

            resumeInterruptedItem(item);
        });
    }
}

async function resumeInterruptedItem(item) {
    const mergedConfig = {
        ...(store.getState().config || {}),
        ...(item.config || {})
    };
    let apiEndpoint = mergedConfig?.apiEndpoint;
    if (!apiEndpoint) {
        const isLocalMode =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '0.0.0.0');
        apiEndpoint = isLocalMode
            ? 'http://localhost:3000/api'
            : 'https://ai-furniture-backend.vercel.app/api';
    }

    const domainForApi = getDomainForApi(mergedConfig);
    const uploaded = item.imageS3Key
        ? { s3Key: item.imageS3Key, imageUrl: item.userImageUrl || null }
        : null;

    if (item.backendJobSubmitted || item.generationSubmittedAt || item.imageS3Key) {
        const done = await pollUntilComplete(item.id, item, apiEndpoint, domainForApi, uploaded, mergedConfig);
        if (done) return;

        const latest = store.getState().queue.find((q) => q.id === item.id);
        if (latest?.status === QUEUE_STATUS.COMPLETED || latest?.status === QUEUE_STATUS.ERROR) {
            return;
        }
    }

    debugLog(`No backend job found for ${item.id.slice(0, 8)}, resubmitting…`);
    actions.updateQueueItem(item.id, { status: QUEUE_STATUS.PENDING, error: null });
    processQueueItem(item);
}

async function processQueueItem(item) {
    const { id, userImage, productUrl, selectedModel, config, userImageDataUrl, imageS3Key, furnitureWidthCm } =
        item;
    const mergedConfig = {
        ...(store.getState().config || {}),
        ...(config || {})
    };

    if (processingItems.has(id) || pollingItems.has(id)) {
        debugLog(`Item ${id.slice(0, 8)} already being processed, skipping...`);
        return;
    }

    let imageToUse = null;
    if (!imageS3Key) {
        imageToUse = userImage;
        if (!imageToUse || !(imageToUse instanceof File || imageToUse instanceof Blob)) {
            if (userImageDataUrl) {
                const restoredBlob = dataURLToBlob(userImageDataUrl);
                if (restoredBlob) {
                    imageToUse = restoredBlob;
                    actions.updateQueueItem(id, { userImage: restoredBlob });
                    debugLog(`Restored image from data URL for processing ${id.slice(0, 8)}`);
                } else {
                    actions.updateQueueItem(id, {
                        status: QUEUE_STATUS.ERROR,
                        completedAt: Date.now(),
                        error: 'Image data lost - please re-upload and try again'
                    });
                    return;
                }
            } else {
                actions.updateQueueItem(id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Image data lost - please re-upload and try again'
                });
                return;
            }
        }
    }

    try {
        processingItems.add(id);

        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.PROCESSING,
            startedAt: item.startedAt || Date.now()
        });

        let apiEndpoint = mergedConfig?.apiEndpoint;
        if (!apiEndpoint) {
            const isLocalMode =
                typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '0.0.0.0');
            apiEndpoint = isLocalMode
                ? 'http://localhost:3000/api'
                : 'https://ai-furniture-backend.vercel.app/api';
        }

        debugLog(`Starting async generation for ${id.slice(0, 8)} with ${selectedModel} model`);

        const domainForApi = getDomainForApi(mergedConfig);
        const sessionIdForApi = getSessionIdForApi(mergedConfig);

        let uploaded = imageS3Key ? { s3Key: imageS3Key, imageUrl: item.userImageUrl || null } : null;
        if (!uploaded?.s3Key) {
            uploaded = await uploadImageToS3ViaBackend({
                apiEndpoint,
                domain: domainForApi,
                sessionId: sessionIdForApi,
                fileOrBlob: imageToUse
            });
            actions.updateQueueItem(id, {
                imageS3Key: uploaded.s3Key,
                userImageUrl: uploaded.imageUrl || item.userImageUrl || null
            });
        }

        if (item.backendJobSubmitted || item.generationSubmittedAt) {
            const done = await pollUntilComplete(id, item, apiEndpoint, domainForApi, uploaded, mergedConfig);
            if (done) return;
        }

        await submitAsyncGeneration(id, item, apiEndpoint, domainForApi, sessionIdForApi, uploaded);
        const finished = await pollUntilComplete(id, item, apiEndpoint, domainForApi, uploaded, mergedConfig);
        if (!finished) {
            throw new Error('Generation did not complete - please retry');
        }
    } catch (error) {
        if (isPageUnloading || isNavigationAbort(error)) {
            debugLog(`Generation for ${id.slice(0, 8)} interrupted by navigation — will resume via polling`);
            return;
        }

        console.error(`❌ Generation failed for ${id.slice(0, 8)}:`, error);
        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.ERROR,
            completedAt: Date.now(),
            error: error.message || 'Generation failed'
        });
    } finally {
        processingItems.delete(id);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        isPageUnloading = true;
        processingItems.clear();
    });
}

export { processQueueItem };
