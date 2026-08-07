import { buildShopifyPreScrapedPayload } from './shopifyProductImages.js';
import { exportTrainingPair } from './trainingDataApi.js';
import { debugLog } from '../debug.js';
import { actions, store } from '../state/store.js';

export function isTrainingReviewEnabled(config) {
    if (!config) return false;
    if (config.trainingReview === true) return true;
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('aif_training') === '1') return true;
    }
    return false;
}

export function collectProductImageUrls(mergedConfig, result) {
    const urls = [];
    const seen = new Set();

    const preScraped = buildShopifyPreScrapedPayload(mergedConfig);
    if (preScraped?.images?.length) {
        for (const img of preScraped.images) {
            const url = img?.url;
            if (url && !seen.has(url)) {
                seen.add(url);
                urls.push(url);
            }
        }
    }

    const cfgImages = mergedConfig?.productImages;
    if (Array.isArray(cfgImages)) {
        for (const entry of cfgImages) {
            const url = typeof entry === 'string' ? entry : entry?.url || entry?.src;
            if (url && !seen.has(url)) {
                seen.add(url);
                urls.push(url);
            }
        }
    }

    const scraped = result?.sourceImages?.productUrls;
    if (Array.isArray(scraped)) {
        for (const url of scraped) {
            if (url && !seen.has(url)) {
                seen.add(url);
                urls.push(url);
            }
        }
    }

    return urls.slice(0, 4);
}

/**
 * Upload before/after/product refs to training/raw_data/item_XXXX (non-blocking).
 */
export function scheduleTrainingPairExport({
    queueId,
    item,
    result,
    uploaded,
    mergedConfig,
    apiEndpoint,
    domain,
    originalImageUrl,
    generatedImageUrl,
}) {
    if (!apiEndpoint || !originalImageUrl || !generatedImageUrl) return;

    const roomBefore =
        uploaded?.s3Key || item.imageS3Key || originalImageUrl;
    const generated = result?.generatedImages?.[0];
    const roomAfter = generated?.s3Key || generatedImageUrl;

    const payload = {
        roomBefore,
        roomAfter,
        productImages: collectProductImageUrls(mergedConfig, result),
        productUrl: item.productUrl,
        domain,
        requestId: result?.requestId || null,
        metadata: {
            queueId,
            productName: item.productName || null,
            model: item.selectedModel || 'slow',
            imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
        },
    };

    exportTrainingPair(apiEndpoint, payload)
        .then((saved) => {
            const trainingItemNumber = saved.itemNumber;
            const trainingFolderName = saved.folderName;
            if (!trainingItemNumber) return;

            const current = store.getState().queue.find((q) => q.id === queueId);
            actions.updateQueueItem(queueId, {
                result: {
                    ...(current?.result || {}),
                    trainingItemNumber,
                    trainingFolderName,
                    trainingRejected: false,
                },
            });

            const { generatedImages } = store.getState();
            if (generatedImages?.length) {
                actions.setGenerationResults(
                    generatedImages.map((img, index) =>
                        index === 0
                            ? {
                                  ...img,
                                  queueId,
                                  trainingItemNumber,
                                  trainingFolderName,
                                  trainingRejected: false,
                              }
                            : img
                    )
                );
            }

            debugLog('Training pair exported', {
                itemNumber: trainingItemNumber,
                folderName: trainingFolderName,
            });
        })
        .catch((e) => debugLog('Training export failed (non-blocking)', e?.message || e));
}
