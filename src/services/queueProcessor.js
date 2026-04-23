import { store, actions, QUEUE_STATUS } from '../state/store.js';
import { trackEvent } from '../tracking.js';
import { postWidgetGeneration, getStorefrontDomain } from '../utils/widgetShopperApi.js';
import { debugLog } from '../debug.js';

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
        // stable URL (per your backend contract); may be undefined if backend didn't include it
        imageUrl: data.imageUrl || null
    };
}

// Track items currently being processed
const processingItems = new Set();

// Track if queue processor has been initialized to prevent duplicates
let queueProcessorInitialized = false;

// Helper to convert data URL back to Blob
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

export function initQueueProcessor() {
    // Prevent multiple initializations (script might reload on page navigation)
    if (queueProcessorInitialized) {
        debugLog('Queue Processor already initialized, skipping...');
        // Still check for pending items in case script was reloaded
        const currentState = store.getState();
        if (currentState.queue && currentState.queue.length > 0) {
            debugLog('Checking queue after script reload...');
            resumePendingItems(currentState);
        }
        return;
    }
    
    queueProcessorInitialized = true;
    
    // Subscribe to queue changes (only once)
    store.subscribe((state) => {
        checkQueue(state);
    });

    // Initial check - resume any pending/processing items
    const initialState = store.getState();
    debugLog('Queue Processor initialized. Checking for pending items...', {
        queueLength: initialState.queue.length,
        pending: initialState.queue.filter(i => i.status === QUEUE_STATUS.PENDING).length,
        processing: initialState.queue.filter(i => i.status === QUEUE_STATUS.PROCESSING).length
    });

    checkQueue(initialState);
    resumePendingItems(initialState);
}

function checkQueue(state) {
    // No polling needed - we do direct generation
    // Just check if we need to resume any pending items
    const pendingItems = state.queue.filter(
        item => item.status === QUEUE_STATUS.PENDING && !processingItems.has(item.id)
    );

    if (pendingItems.length > 0) {
        debugLog(`Found ${pendingItems.length} pending items, processing...`);
        pendingItems.forEach(item => {
            processQueueItem(item);
        });
    }
}

/**
 * Resume processing for any PENDING items that aren't being processed yet
 */
function resumePendingItems(state) {
    const pendingItems = state.queue.filter(
        item => item.status === QUEUE_STATUS.PENDING && !processingItems.has(item.id)
    );

    if (pendingItems.length > 0) {
        debugLog(`Found ${pendingItems.length} pending items...`);
        pendingItems.forEach(item => {
            // Check if item has valid userImage (File/Blob) or data URL
            if (!item.userImage && !item.userImageDataUrl) {
                console.warn(`⚠️ Item ${item.id.slice(0, 8)} lost image data (page reload), marking as error`);
                actions.updateQueueItem(item.id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Image data lost after page reload - please add to queue again'
                });
            } else {
                // If we have data URL but no Blob, convert it
                if (item.userImageDataUrl && !item.userImage) {
                    const blob = dataURLToBlob(item.userImageDataUrl);
                    if (blob) {
                        item.userImage = blob;
                        debugLog(`Restored image from data URL for item ${item.id.slice(0, 8)}`);
                    } else {
                        console.warn(`⚠️ Failed to restore image from data URL for item ${item.id.slice(0, 8)}`);
                        actions.updateQueueItem(item.id, {
                            status: QUEUE_STATUS.ERROR,
                            completedAt: Date.now(),
                            error: 'Failed to restore image data - please re-upload'
                        });
                        return;
                    }
                }
                debugLog(`Resuming item ${item.id.slice(0, 8)}...`);
                processQueueItem(item);
            }
        });
    }

    // Also check for PROCESSING items that might have been interrupted
    // When navigating between pages, these should be reset to PENDING to resume
    const processingItemsList = state.queue.filter(
        item => item.status === QUEUE_STATUS.PROCESSING && !processingItems.has(item.id)
    );

    if (processingItemsList.length > 0) {
        debugLog(
            `Found ${processingItemsList.length} processing items from previous page, resetting to PENDING to resume...`
        );
        processingItemsList.forEach(item => {
            // Check if the item has been processing for too long (more than 5 minutes)
            // If so, mark as error. Otherwise, reset to PENDING to resume
            const processingTime = item.startedAt ? Date.now() - item.startedAt : 0;
            const maxProcessingTime = 5 * 60 * 1000; // 5 minutes
            
            if (processingTime > maxProcessingTime) {
                // Item has been processing too long, likely failed
                console.warn(`⚠️ Item ${item.id.slice(0, 8)} has been processing for too long (${Math.floor(processingTime / 1000)}s), marking as error`);
                actions.updateQueueItem(item.id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Generation timed out - please retry'
                });
            } else {
                // Reset to PENDING so it can resume processing
                // First, ensure image is restored if needed
                let imageRestored = false;
                if (!item.userImage && item.userImageDataUrl) {
                    const blob = dataURLToBlob(item.userImageDataUrl);
                    if (blob) {
                        item.userImage = blob;
                        imageRestored = true;
                        debugLog(`Restored image from data URL for item ${item.id.slice(0, 8)}`);
                    }
                }
                
                debugLog(`Resetting item ${item.id.slice(0, 8)} to PENDING to resume processing`);
                const updates = {
                    status: QUEUE_STATUS.PENDING,
                    startedAt: null // Clear startedAt so it gets a fresh start
                };
                
                // If we restored the image, include it in the update
                if (imageRestored) {
                    updates.userImage = item.userImage;
                }
                
                actions.updateQueueItem(item.id, updates);
            }
        });
    }
}

/**
 * Process a queue item - upload image and start generation
 */
async function processQueueItem(item) {
    const { id, userImage, productUrl, selectedModel, config, userImageDataUrl } = item;
    // Merge store config (restored after navigation) with per-item config from when queued
    const mergedConfig = {
        ...(store.getState().config || {}),
        ...(config || {})
    };

    if (processingItems.has(id)) {
        debugLog(`Item ${id.slice(0, 8)} already being processed, skipping...`);
        return;
    }

    // Check if userImage is valid - try to restore from data URL if needed
    let imageToUse = userImage;
    if (!imageToUse || !(imageToUse instanceof File || imageToUse instanceof Blob)) {
        // Try to restore from data URL
        if (userImageDataUrl) {
            const restoredBlob = dataURLToBlob(userImageDataUrl);
            if (restoredBlob) {
                imageToUse = restoredBlob;
                // Update the item with restored blob
                actions.updateQueueItem(id, { userImage: restoredBlob });
                debugLog(`Restored image from data URL for processing ${id.slice(0, 8)}`);
            } else {
                console.error(`❌ Item ${id.slice(0, 8)} has invalid userImage and failed to restore from data URL, marking as error`);
                actions.updateQueueItem(id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Image data lost - please re-upload and try again'
                });
                return;
            }
        } else {
            console.error(`❌ Item ${id.slice(0, 8)} has invalid userImage (lost after page reload), marking as error`);
            actions.updateQueueItem(id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: 'Image data lost - please re-upload and try again'
            });
            return;
        }
    }

    try {
        processingItems.add(id);

        // Mark as processing
        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.PROCESSING,
            startedAt: Date.now()
        });

        // Get API endpoint
        let apiEndpoint = mergedConfig?.apiEndpoint;
        if (!apiEndpoint) {
            const isLocalMode = typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '0.0.0.0');
            apiEndpoint = isLocalMode
                ? 'http://localhost:3000/api'
                : 'https://ai-furniture-backend.vercel.app/api';
        }

        debugLog(`Starting generation for ${id.slice(0, 8)} with ${selectedModel} model`);

        const domainForApi = mergedConfig?.domain || window.location.hostname;
        const sessionIdForApi = getSessionIdForApi(mergedConfig);

        // New flow: get presigned PUT, upload directly to S3, then call /generate with imageS3Key.
        // Fallback: old flow (send image file directly) if anything fails.
        let uploaded = null;
        try {
            uploaded = await uploadImageToS3ViaBackend({
                apiEndpoint,
                domain: domainForApi,
                sessionId: sessionIdForApi,
                fileOrBlob: imageToUse
            });
        } catch (e) {
            debugLog('Direct-to-S3 upload failed; falling back to direct image upload', e?.message || e);
        }

        // Create form data for /generate
        const formData = new FormData();
        formData.append('productUrl', productUrl);
        formData.append('model', 'slow'); // Always use high quality model
        formData.append('domain', domainForApi);
        if (sessionIdForApi) formData.append('sessionId', sessionIdForApi);

        if (uploaded?.s3Key) {
            formData.append('imageS3Key', uploaded.s3Key);
        } else {
            formData.append('image', imageToUse);
        }

        // Call API - direct generation (not job-based)
        const response = await fetch(`${apiEndpoint}/generate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
            },
            body: formData,
            credentials: 'omit', // Don't send cookies for CORS
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate images');
        }

        const result = await response.json();
        debugLog(`Generation complete for ${id.slice(0, 8)}`, {
            ok: true
        });

        // Update queue item with result
        // Store S3 URLs for both generated and original images
        const originalImageUrl = result.generatedImages?.[0]?.originalImageUrl || uploaded?.imageUrl || null;
        const generatedImageUrl = result.generatedImages?.[0]?.url;
        
        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.COMPLETED,
            completedAt: Date.now(),
            // Store the S3 URL of the user's uploaded image for display
            userImageUrl: originalImageUrl || item.userImageUrl,
            result: {
                generatedImageUrl: generatedImageUrl,
                originalImageUrl: originalImageUrl, // S3 URL for original image
                model: selectedModel,
                generationTime: result.timings?.total?.durationSeconds,
                timestamp: new Date().toISOString(),
                productData: result.productData,
                // Store aspect ratio data for proper display
                originalAspectRatio: result.originalImageDimensions?.aspectRatio || 
                                    (result.generatedImages?.[0]?.originalAspectRatio),
                originalWidth: result.originalImageDimensions?.width || 
                              result.generatedImages?.[0]?.originalWidth,
                originalHeight: result.originalImageDimensions?.height || 
                               result.generatedImages?.[0]?.originalHeight
            }
        });

        // Track AI generation completed
        trackEvent('ai_generation_completed', {
            queueId: id,
            productUrl: productUrl,
            productName: item.productName || document.title,
            model: selectedModel,
            generationTime: result.timings?.total?.durationSeconds,
            hasResult: !!generatedImageUrl,
            generatedImageUrl: generatedImageUrl
        });

        const userEmail = (store.getState().userEmail || '').trim().toLowerCase();
        if (userEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) && generatedImageUrl) {
            const domainForHistory = mergedConfig?.domain || getStorefrontDomain();
            postWidgetGeneration(apiEndpoint, {
                email: userEmail,
                domain: domainForHistory,
                productUrl,
                productName: (item.productName || document.title || '').slice(0, 500),
                previewImageUrl: generatedImageUrl,
                originalImageUrl: originalImageUrl || null,
                metadata: {
                    queueId: id,
                    imageS3Key: uploaded?.s3Key || null,
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
            })
                .then((saved) => {
                    // Important: generatedImageUrl may be a short-lived signed URL.
                    // If the backend returns a durable URL, update the queue item to use it.
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

        processingItems.delete(id);

    } catch (error) {
        console.error(`❌ Generation failed for ${id.slice(0, 8)}:`, error);

        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.ERROR,
            completedAt: Date.now(),
            error: error.message || 'Generation failed'
        });

        processingItems.delete(id);
    }
}

// Clean up on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        processingItems.clear();
    });
}

// Export for use in UploadView
export { processQueueItem };
