import { store, actions, QUEUE_STATUS } from '../state/store.js';
import { trackEvent } from '../tracking.js';
import {
    postWidgetGeneration,
    getStorefrontDomain,
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
    if (isPageUnloading) return true;
    return error?.name === 'AbortError';
}

function getApiEndpoint(mergedConfig) {
    if (mergedConfig?.apiEndpoint) return mergedConfig.apiEndpoint;
    const isLocalMode =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '0.0.0.0');
    return isLocalMode
        ? 'http://localhost:3000/api'
        : 'https://ai-furniture-backend.vercel.app/api';
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
        backendJobSubmitted: false,
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
    const apiEndpoint = mergedConfig?.apiEndpoint || getApiEndpoint(mergedConfig);
    const { productUrl } = item;
    const { furnitureWidthCm } = item;

    if (generatedImageUrl && (emailOk || anonKey) && apiEndpoint) {
        const domainForHistory = getDomainForApi(mergedConfig);
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

async function pollAsyncJobUntilComplete(id, item, apiEndpoint, domainForApi, uploaded, mergedConfig) {
    if (pollingItems.has(id)) return false;
    pollingItems.add(id);
    processingItems.add(id);

    const startedAt = item.startedAt || Date.now();
    const deadline = startedAt + MAX_POLL_MS;

    try {
        while (!isPageUnloading && Date.now() < deadline) {
            let statusPayload;
            try {
                statusPayload = await fetchWidgetGenerationStatus(apiEndpoint, {
                    queueId: id,
                    domain: domainForApi
                });
            } catch (e) {
                if (e?.status === 404) return false;
                await sleep(POLL_INTERVAL_MS);
                continue;
            }

            if (statusPayload.status === BACKEND_JOB_STATUS.COMPLETED && statusPayload.result) {
                applyCompletedResult(id, item, statusPayload, uploaded, mergedConfig);
                return true;
            }
            if (statusPayload.status === BACKEND_JOB_STATUS.FAILED) {
                return false;
            }
            await sleep(POLL_INTERVAL_MS);
        }
        return false;
    } finally {
        pollingItems.delete(id);
        processingItems.delete(id);
    }
}

async function runSyncGenerate(id, item, apiEndpoint, domainForApi, sessionIdForApi, uploaded, imageToUse) {
    const formData = new FormData();
    formData.append('productUrl', item.productUrl);
    formData.append('model', 'slow');
    formData.append('domain', domainForApi);
    if (sessionIdForApi) formData.append('sessionId', sessionIdForApi);
    if (uploaded?.s3Key) {
        formData.append('imageS3Key', uploaded.s3Key);
    } else if (imageToUse) {
        formData.append('image', imageToUse);
    }
    if (
        typeof item.furnitureWidthCm === 'number' &&
        Number.isFinite(item.furnitureWidthCm) &&
        item.furnitureWidthCm > 0
    ) {
        formData.append('furnitureWidthCm', String(item.furnitureWidthCm));
    }

    debugLog(`POST /generate for ${id.slice(0, 8)}`);
    const response = await fetch(`${apiEndpoint}/generate`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
        credentials: 'omit'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(result.error || `generate HTTP ${response.status}`);
    }
    return result;
}

export function initQueueProcessor() {
    if (queueProcessorInitialized) {
        const currentState = store.getState();
        if (currentState.queue?.length > 0) resumePendingItems(currentState);
        return;
    }

    queueProcessorInitialized = true;
    store.subscribe((state) => checkQueue(state));

    const initialState = store.getState();
    checkQueue(initialState);
    resumePendingItems(initialState);
}

function checkQueue(state) {
    state.queue
        .filter(
            (item) =>
                (item.status === QUEUE_STATUS.PENDING ||
                    (item.status === QUEUE_STATUS.PROCESSING &&
                        !item.backendJobSubmitted &&
                        !processingItems.has(item.id) &&
                        !pollingItems.has(item.id))) &&
                !processingItems.has(item.id)
        )
        .forEach((item) => processQueueItem(item));
}

function resumePendingItems(state) {
    state.queue
        .filter(
            (item) =>
                (item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING) &&
                !processingItems.has(item.id)
        )
        .forEach((item) => {
            if (
                item.status !== QUEUE_STATUS.PENDING &&
                item.startedAt &&
                Date.now() - item.startedAt > MAX_POLL_MS
            ) {
                actions.updateQueueItem(item.id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Generation timed out - please retry'
                });
                return;
            }

            if (!item.userImage && !item.userImageDataUrl && !item.imageS3Key) {
                actions.updateQueueItem(item.id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Image data lost - please re-upload'
                });
                return;
            }

            if (item.userImageDataUrl && !item.userImage && !item.imageS3Key) {
                const blob = dataURLToBlob(item.userImageDataUrl);
                if (blob) {
                    item.userImage = blob;
                } else {
                    actions.updateQueueItem(item.id, {
                        status: QUEUE_STATUS.ERROR,
                        completedAt: Date.now(),
                        error: 'Failed to restore image - please re-upload'
                    });
                    return;
                }
            }

            processQueueItem(item);
        });
}

async function processQueueItem(item) {
    const { id, userImage, userImageDataUrl, imageS3Key } = item;
    const mergedConfig = { ...(store.getState().config || {}), ...(item.config || {}) };

    if (processingItems.has(id) || pollingItems.has(id)) return;

    let imageToUse = null;
    if (!imageS3Key) {
        imageToUse = userImage;
        if (!imageToUse || !(imageToUse instanceof File || imageToUse instanceof Blob)) {
            if (userImageDataUrl) {
                imageToUse = dataURLToBlob(userImageDataUrl);
                if (imageToUse) actions.updateQueueItem(id, { userImage: imageToUse });
            }
            if (!imageToUse) {
                actions.updateQueueItem(id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Image data lost - please re-upload'
                });
                return;
            }
        }
    }

    const apiEndpoint = getApiEndpoint(mergedConfig);
    const domainForApi = getDomainForApi(mergedConfig);
    const sessionIdForApi = getSessionIdForApi(mergedConfig);

    try {
        processingItems.add(id);
        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.PROCESSING,
            startedAt: item.startedAt || Date.now(),
            error: null
        });

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

        // Recover result from a prior async job if one exists
        if (item.backendJobSubmitted) {
            const recovered = await pollAsyncJobUntilComplete(
                id,
                item,
                apiEndpoint,
                domainForApi,
                uploaded,
                mergedConfig
            );
            if (recovered) return;
        }

        const result = await runSyncGenerate(
            id,
            item,
            apiEndpoint,
            domainForApi,
            sessionIdForApi,
            uploaded,
            imageToUse
        );
        applyCompletedResult(id, item, { result }, uploaded, mergedConfig);
    } catch (error) {
        if (isNavigationAbort(error)) {
            debugLog(`Generation interrupted for ${id.slice(0, 8)} — will resume on next page`);
            return;
        }
        console.error(`Generation failed for ${id.slice(0, 8)}:`, error);
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
