import { store, actions, QUEUE_STATUS, VIEWS, flushSessionSnapshot, fileToDataURL } from '../state/store.js';
import { trackEvent } from '../tracking.js';
import {
    postWidgetGeneration,
    getStorefrontDomain,
    fetchWidgetGenerationStatus,
    startWidgetGeneration
} from '../utils/widgetShopperApi.js';
import { getWidgetAnonymousClientId } from '../utils/persistStorage.js';
import { compressRoomImage } from '../utils/compressRoomImage.js';
import { debugLog } from '../debug.js';

const BACKEND_JOB_STATUS = {
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
};

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_MS = 5 * 60 * 1000;
const MAX_MISSING_STATUS_POLLS = 20;

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

function getDomainForItem(item, mergedConfig) {
    return item?.jobDomain || getDomainForApi(mergedConfig);
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

function isTransientFetchError(error) {
    if (!error) return false;
    if (isPageUnloading) return true;
    if (error.name === 'AbortError') return true;
    const msg = String(error.message || error).toLowerCase();
    return (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('load failed') ||
        msg.includes('the operation was aborted')
    );
}

function isNavigationAbort(error) {
    return isTransientFetchError(error);
}

let queueRetryTimer = null;

function scheduleQueueRetry(delayMs = 800) {
    if (isPageUnloading) return;
    if (queueRetryTimer) clearTimeout(queueRetryTimer);
    queueRetryTimer = setTimeout(() => {
        queueRetryTimer = null;
        if (!isPageUnloading) {
            scheduleQueueWork(store.getState());
        }
    }, delayMs);
}

function persistQueueProgress(id, updates) {
    actions.updateQueueItem(id, updates);
    flushSessionSnapshot();
}

function handleMissingJobStatus(id, item) {
    const misses = (item.pollMissCount || 0) + 1;
    if (misses >= MAX_MISSING_STATUS_POLLS) {
        actions.updateQueueItem(id, {
            pollMissCount: misses,
            status: QUEUE_STATUS.ERROR,
            completedAt: Date.now(),
            error: 'Preview timed out — tap Try again'
        });
        return 'failed';
    }
    persistQueueProgress(id, { pollMissCount: misses });
    scheduleQueueRetry(1500);
    return 'missing';
}

export function resumeQueueAfterNavigation() {
    isPageUnloading = false;
    if (queueRetryTimer) {
        clearTimeout(queueRetryTimer);
        queueRetryTimer = null;
    }
    processingItems.clear();
    pollingItems.clear();
    inFlightById.clear();

    store.getState().queue.forEach((item) => {
        if (
            (item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING) &&
            (item.backendJobSubmitted || item.imageS3Key)
        ) {
            actions.updateQueueItem(item.id, { pollMissCount: 0, error: null });
        }
    });

    flushSessionSnapshot();
    scheduleQueueWork(store.getState());
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

function getDomainIdForApi(mergedConfig) {
    const id = mergedConfig?.domainId;
    return id ? String(id).trim() : '';
}

async function uploadImageViaBackend({ apiEndpoint, domain, domainId, sessionId, fileOrBlob }) {
    const compressed = await compressRoomImage(fileOrBlob);
    const formData = new FormData();
    formData.append('image', compressed, compressed.name || 'room.jpg');
    formData.append('domain', domain);
    if (domainId) formData.append('domainId', domainId);
    if (sessionId) formData.append('sessionId', sessionId);

    const r = await fetch(`${apiEndpoint}/upload`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
        credentials: 'omit'
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 413) {
        throw new Error('Photo is too large — try a smaller image or retake the photo');
    }
    if (!r.ok) throw new Error(data.error || `upload HTTP ${r.status}`);
    if (!data.s3Key) throw new Error('upload missing s3Key');
    return { s3Key: data.s3Key, imageUrl: data.imageUrl || null };
}

const processingItems = new Set();
const pollingItems = new Set();
const inFlightById = new Map();
let queueProcessorInitialized = false;
let isPageUnloading = false;

function tryClaimQueueItem(id) {
    if (inFlightById.has(id) || processingItems.has(id) || pollingItems.has(id)) {
        return false;
    }
    processingItems.add(id);
    return true;
}

function releaseQueueItem(id) {
    processingItems.delete(id);
    pollingItems.delete(id);
    inFlightById.delete(id);
}

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
        pollMissCount: 0,
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

    if (generatedImageUrl) {
        actions.setGenerationResults([
            {
                url: generatedImageUrl,
                originalImageUrl: originalImageUrl || '',
                originalAspectRatio:
                    result.originalImageDimensions?.aspectRatio ||
                    result.generatedImages?.[0]?.originalAspectRatio,
                originalWidth:
                    result.originalImageDimensions?.width ||
                    result.generatedImages?.[0]?.originalWidth,
                originalHeight:
                    result.originalImageDimensions?.height ||
                    result.generatedImages?.[0]?.originalHeight,
                imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
                furnitureWidthCm:
                    typeof item.furnitureWidthCm === 'number' &&
                    Number.isFinite(item.furnitureWidthCm) &&
                    item.furnitureWidthCm > 0
                        ? item.furnitureWidthCm
                        : null
            }
        ]);
        actions.setView(VIEWS.RESULTS);
    }
}

function handleAsyncJobStatus(id, item, statusPayload, uploaded, mergedConfig) {
    if (statusPayload.status === BACKEND_JOB_STATUS.COMPLETED && statusPayload.result) {
        applyCompletedResult(id, item, statusPayload, uploaded, mergedConfig);
        return 'completed';
    }
    if (statusPayload.status === BACKEND_JOB_STATUS.FAILED) {
        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.ERROR,
            completedAt: Date.now(),
            error: statusPayload.error || 'Generation failed',
            backendJobSubmitted: false
        });
        return 'failed';
    }
    if (statusPayload.status === BACKEND_JOB_STATUS.PROCESSING) {
        return 'processing';
    }
    return 'unknown';
}

async function pollAsyncJobUntilComplete(id, item, apiEndpoint, domainForApi, domainIdForApi, uploaded, mergedConfig) {
    if (pollingItems.has(id)) return 'polling';
    pollingItems.add(id);

    const startedAt = item.startedAt || Date.now();
    const deadline = startedAt + MAX_POLL_MS;

    try {
        while (!isPageUnloading && Date.now() < deadline) {
            let statusPayload;
            try {
                statusPayload = await fetchWidgetGenerationStatus(apiEndpoint, {
                    queueId: id,
                    domain: domainForApi,
                    domainId: domainIdForApi
                });
            } catch (e) {
                if (e?.status === 404) return 'missing';
                if (isTransientFetchError(e)) {
                    if (isPageUnloading) return 'interrupted';
                    await sleep(POLL_INTERVAL_MS);
                    continue;
                }
                await sleep(POLL_INTERVAL_MS);
                continue;
            }

            const outcome = handleAsyncJobStatus(id, item, statusPayload, uploaded, mergedConfig);
            if (outcome === 'completed' || outcome === 'failed') return outcome;
            await sleep(POLL_INTERVAL_MS);
        }
        return isPageUnloading ? 'interrupted' : 'timeout';
    } finally {
        pollingItems.delete(id);
    }
}

async function fetchAsyncJobStatusOnce(id, apiEndpoint, domainForApi, domainIdForApi) {
    try {
        return await fetchWidgetGenerationStatus(apiEndpoint, {
            queueId: id,
            domain: domainForApi,
            domainId: domainIdForApi
        });
    } catch (e) {
        if (e?.status === 404) return null;
        if (isTransientFetchError(e)) return null;
        throw e;
    }
}

async function submitAsyncJob(id, item, apiEndpoint, domainForApi, domainIdForApi, sessionIdForApi, uploaded) {
    if (!uploaded?.s3Key) {
        throw new Error('imageS3Key required for async generation');
    }

    const formData = new FormData();
    formData.append('queueId', id);
    formData.append('productUrl', item.productUrl);
    formData.append('productName', (item.productName || document.title || '').slice(0, 500));
    formData.append('model', 'slow');
    formData.append('domain', domainForApi);
    if (domainIdForApi) formData.append('domainId', domainIdForApi);
    formData.append('imageS3Key', uploaded.s3Key);
    if (sessionIdForApi) formData.append('sessionId', sessionIdForApi);
    if (
        typeof item.furnitureWidthCm === 'number' &&
        Number.isFinite(item.furnitureWidthCm) &&
        item.furnitureWidthCm > 0
    ) {
        formData.append('furnitureWidthCm', String(item.furnitureWidthCm));
    }

    debugLog(`POST /widget/generate for ${id.slice(0, 8)}`);
    await startWidgetGeneration(apiEndpoint, formData);
    persistQueueProgress(id, {
        backendJobSubmitted: true,
        pollMissCount: 0,
        jobDomain: domainForApi
    });
}

async function runSyncGenerate(id, item, apiEndpoint, domainForApi, domainIdForApi, sessionIdForApi, uploaded, imageToUse) {
    const formData = new FormData();
    formData.append('productUrl', item.productUrl);
    formData.append('model', 'slow');
    formData.append('domain', domainForApi);
    if (domainIdForApi) formData.append('domainId', domainIdForApi);
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

let queueWatchdogStarted = false;

function startQueueWatchdog() {
    if (queueWatchdogStarted || typeof window === 'undefined') return;
    queueWatchdogStarted = true;
    window.setInterval(() => {
        if (isPageUnloading) return;
        const { queue } = store.getState();
        const needsWork = queue.some(
            (item) =>
                (item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING) &&
                !inFlightById.has(item.id) &&
                !pollingItems.has(item.id)
        );
        if (needsWork) {
            scheduleQueueWork(store.getState());
        }
    }, 5000);
}

export function initQueueProcessor() {
    if (queueProcessorInitialized) {
        scheduleQueueWork(store.getState());
        return;
    }

    queueProcessorInitialized = true;
    store.subscribe((state) => scheduleQueueWork(state));
    startQueueWatchdog();
    scheduleQueueWork(store.getState());
}

function getFreshQueueItem(id) {
    return store.getState().queue.find((q) => q.id === id) || null;
}

function prepareQueueItemForProcessing(item) {
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
        return null;
    }

    if (!item.userImage && !item.userImageDataUrl && !item.imageS3Key) {
        actions.updateQueueItem(item.id, {
            status: QUEUE_STATUS.ERROR,
            completedAt: Date.now(),
            error: 'Image data lost - please re-upload'
        });
        return null;
    }

    const prepared = { ...item };
    if (prepared.userImageDataUrl && !prepared.userImage && !prepared.imageS3Key) {
        const blob = dataURLToBlob(prepared.userImageDataUrl);
        if (!blob) {
            actions.updateQueueItem(item.id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: 'Failed to restore image - please re-upload'
            });
            return null;
        }
        prepared.userImage = blob;
    }

    return prepared;
}

function isRecoverableNetworkErrorMessage(error) {
    if (!error || typeof error !== 'string') return false;
    const msg = error.toLowerCase();
    return (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('load failed')
    );
}

function scheduleQueueWork(state) {
    state.queue
        .filter(
            (item) =>
                item.status === QUEUE_STATUS.ERROR &&
                isRecoverableNetworkErrorMessage(item.error) &&
                (item.backendJobSubmitted || item.imageS3Key || item.userImageDataUrl)
        )
        .forEach((item) => {
            actions.updateQueueItem(item.id, {
                status: QUEUE_STATUS.PROCESSING,
                error: null
            });
        });

    const activeState = store.getState();
    activeState.queue
        .filter(
            (item) =>
                item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING
        )
        .forEach((item) => {
            processQueueItem(item);
        });
}

async function processQueueItem(item) {
    const id = item.id;
    if (inFlightById.has(id)) return inFlightById.get(id);

    const prepared = prepareQueueItemForProcessing(item);
    if (!prepared) return;

    if (!tryClaimQueueItem(id)) return;

    const work = runQueueItemWork(prepared);
    inFlightById.set(id, work);
    try {
        await work;
    } finally {
        releaseQueueItem(id);
    }
}

async function runQueueItemWork(item) {
    const id = item.id;
    const mergedConfig = { ...(store.getState().config || {}), ...(item.config || {}) };
    const { userImage, userImageDataUrl, imageS3Key } = item;

    let imageToUse = null;
    if (!imageS3Key || !item.userImageUrl) {
        imageToUse = userImage;
        if (!imageToUse || !(imageToUse instanceof File || imageToUse instanceof Blob)) {
            if (userImageDataUrl) {
                imageToUse = dataURLToBlob(userImageDataUrl);
                if (imageToUse) actions.updateQueueItem(id, { userImage: imageToUse });
            }
        }
    }
    if (!imageS3Key && !imageToUse) {
        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.ERROR,
            completedAt: Date.now(),
            error: 'Image data lost - please re-upload'
        });
        return;
    }

    if (imageToUse && !userImageDataUrl && !imageS3Key) {
        try {
            const dataUrl = await fileToDataURL(imageToUse);
            persistQueueProgress(id, { userImageDataUrl: dataUrl });
        } catch (e) {
            debugLog('Could not persist room photo before upload', e?.message || e);
        }
    }

    const apiEndpoint = getApiEndpoint(mergedConfig);
    const domainForApi = getDomainForItem(item, mergedConfig);
    const domainIdForApi = getDomainIdForApi(mergedConfig);
    const sessionIdForApi = getSessionIdForApi(mergedConfig);

    try {
        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.PROCESSING,
            startedAt: item.startedAt || Date.now(),
            error: null
        });

        let uploaded = imageS3Key ? { s3Key: imageS3Key, imageUrl: item.userImageUrl || null } : null;

        if (!uploaded?.s3Key && imageToUse) {
            debugLog(`Uploading via backend /upload for ${id.slice(0, 8)}`);
            try {
                uploaded = await uploadImageViaBackend({
                    apiEndpoint,
                    domain: domainForApi,
                    domainId: domainIdForApi,
                    sessionId: sessionIdForApi,
                    fileOrBlob: imageToUse
                });
                persistQueueProgress(id, {
                    imageS3Key: uploaded.s3Key,
                    userImageUrl: uploaded.imageUrl || item.userImageUrl || null,
                    jobDomain: domainForApi
                });
            } catch (uploadErr) {
                if (isTransientFetchError(uploadErr)) {
                    debugLog(`Upload interrupted for ${id.slice(0, 8)} — will resume`, uploadErr?.message || uploadErr);
                    scheduleQueueRetry();
                    return;
                }
                debugLog('Backend /upload failed, sending image with /generate', uploadErr?.message || uploadErr);
            }
        }

        const latest = getFreshQueueItem(id) || item;
        const pollDomain = getDomainForItem(latest, mergedConfig);

        // Resume: poll an already-submitted backend job (safe across page navigation).
        if (latest.backendJobSubmitted) {
            const pollOutcome = await pollAsyncJobUntilComplete(
                id,
                latest,
                apiEndpoint,
                pollDomain,
                domainIdForApi,
                uploaded,
                mergedConfig
            );
            if (pollOutcome === 'completed' || pollOutcome === 'failed') return;
            if (pollOutcome === 'interrupted' || pollOutcome === 'polling') {
                scheduleQueueRetry(600);
                return;
            }
            if (pollOutcome === 'missing') {
                if (latest.backendJobSubmitted) {
                    handleMissingJobStatus(id, getFreshQueueItem(id) || latest);
                    return;
                }
            }
        } else if (uploaded?.s3Key || latest.imageS3Key) {
            // Another tab/page may have submitted while we were uploading — check once before creating a job.
            const existingStatus = await fetchAsyncJobStatusOnce(id, apiEndpoint, pollDomain, domainIdForApi);
            if (existingStatus) {
                const existingOutcome = handleAsyncJobStatus(
                    id,
                    latest,
                    existingStatus,
                    uploaded,
                    mergedConfig
                );
                if (existingOutcome === 'completed' || existingOutcome === 'failed') return;
                if (existingStatus.status === BACKEND_JOB_STATUS.PROCESSING) {
                    persistQueueProgress(id, {
                        backendJobSubmitted: true,
                        pollMissCount: 0,
                        jobDomain: pollDomain
                    });
                    const pollOutcome = await pollAsyncJobUntilComplete(
                        id,
                        getFreshQueueItem(id) || latest,
                        apiEndpoint,
                        pollDomain,
                        domainIdForApi,
                        uploaded,
                        mergedConfig
                    );
                    if (pollOutcome === 'completed' || pollOutcome === 'failed') return;
                    if (pollOutcome === 'interrupted' || pollOutcome === 'polling') {
                        scheduleQueueRetry(600);
                        return;
                    }
                    if (pollOutcome === 'missing') {
                        handleMissingJobStatus(id, getFreshQueueItem(id) || latest);
                        return;
                    }
                }
            }
        }

        if (!uploaded?.s3Key) {
            const imageForGenerate = imageToUse ? await compressRoomImage(imageToUse) : null;
            const result = await runSyncGenerate(
                id,
                latest,
                apiEndpoint,
                domainForApi,
                domainIdForApi,
                sessionIdForApi,
                uploaded,
                imageForGenerate
            );
            applyCompletedResult(id, latest, { result }, uploaded, mergedConfig);
            return;
        }

        const beforeSubmit = getFreshQueueItem(id) || latest;
        const submitDomain = getDomainForItem(beforeSubmit, mergedConfig);
        if (!beforeSubmit.backendJobSubmitted) {
            await submitAsyncJob(id, beforeSubmit, apiEndpoint, submitDomain, domainIdForApi, sessionIdForApi, uploaded);
        }

        const finalOutcome = await pollAsyncJobUntilComplete(
            id,
            getFreshQueueItem(id) || beforeSubmit,
            apiEndpoint,
            submitDomain,
            domainIdForApi,
            uploaded,
            mergedConfig
        );
        if (finalOutcome === 'completed' || finalOutcome === 'failed') return;
        if (finalOutcome === 'interrupted' || finalOutcome === 'polling' || finalOutcome === 'timeout') {
            scheduleQueueRetry(finalOutcome === 'timeout' ? 2000 : 600);
            return;
        }
        if (finalOutcome === 'missing') {
            handleMissingJobStatus(id, getFreshQueueItem(id) || beforeSubmit);
            return;
        }

        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.ERROR,
            completedAt: Date.now(),
            error: 'Generation failed - please retry'
        });
    } catch (error) {
        if (isTransientFetchError(error)) {
            debugLog(`Generation interrupted for ${id.slice(0, 8)} — will resume`, error?.message || error);
            scheduleQueueRetry();
            return;
        }
        console.error(`Generation failed for ${id.slice(0, 8)}:`, error);
        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.ERROR,
            completedAt: Date.now(),
            error: error.message || 'Generation failed'
        });
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        isPageUnloading = true;
        processingItems.clear();
        pollingItems.clear();
        inFlightById.clear();
    });

    window.addEventListener('pageshow', () => {
        resumeQueueAfterNavigation();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            resumeQueueAfterNavigation();
        }
    });
}

export { processQueueItem };
