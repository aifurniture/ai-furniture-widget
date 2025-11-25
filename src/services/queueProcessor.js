import { store, actions, QUEUE_STATUS } from '../state/store.js';

// Track items currently being processed
const processingItems = new Set();

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
    // Subscribe to queue changes
    store.subscribe((state) => {
        checkQueue(state);
    });

    // Initial check - resume any pending/processing items
    const initialState = store.getState();
    console.log('🔄 Queue Processor initialized. Checking for pending items...', {
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
        console.log(`🔄 Found ${pendingItems.length} pending items, processing...`);
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
        console.log(`🔄 Found ${pendingItems.length} pending items...`);
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
                        console.log(`🔄 Restored image from data URL for item ${item.id.slice(0, 8)}`);
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
                console.log(`🚀 Resuming item ${item.id.slice(0, 8)}...`);
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
        console.log(`🔄 Found ${processingItemsList.length} processing items from previous page, resetting to PENDING to resume...`);
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
                        console.log(`🔄 Restored image from data URL for item ${item.id.slice(0, 8)}`);
                    }
                }
                
                console.log(`🔄 Resetting item ${item.id.slice(0, 8)} to PENDING to resume processing`);
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

    if (processingItems.has(id)) {
        console.log(`⏭️ Item ${id.slice(0, 8)} already being processed, skipping...`);
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
                console.log(`🔄 Restored image from data URL for processing ${id.slice(0, 8)}`);
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
        let apiEndpoint = config?.apiEndpoint;
        if (!apiEndpoint) {
            const isLocalMode = typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '0.0.0.0');
            apiEndpoint = isLocalMode
                ? 'http://localhost:3000/api'
                : 'https://ai-furniture-backend.vercel.app/api';
        }

        console.log(`🚀 Starting generation for ${id.slice(0, 8)} with ${selectedModel} model`);

        // Create form data
        const formData = new FormData();
        formData.append('image', imageToUse);
        formData.append('productUrl', productUrl);
        formData.append('model', selectedModel || 'fast');
        formData.append('domain', config?.domain || window.location.hostname);

        if (config?.sessionId) {
            formData.append('sessionId', config.sessionId);
        }

        // Call API - direct generation (not job-based)
        const response = await fetch(`${apiEndpoint}/generate`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate images');
        }

        const result = await response.json();
        console.log(`✅ Generation complete for ${id.slice(0, 8)}:`, result);

        // Update queue item with result
        // Store S3 URLs for both generated and original images
        const originalImageUrl = result.generatedImages?.[0]?.originalImageUrl;
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
                productData: result.productData
            }
        });

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
