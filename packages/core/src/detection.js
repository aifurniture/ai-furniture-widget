// src/detection.js
import { debugLog } from './debug.js';
import { trackEvent, trackOrderCompletion, disconnectAllTracking } from './tracking.js';

export function isFurnitureProductPage() {
    // ⬇️ Paste your full original isFurnitureProductPage() body here
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = document.body.textContent.toLowerCase();

    const furnitureKeywords = [
        'sofa', 'couch', 'chair', 'table', 'bed', 'desk', 'cabinet', 'shelf',
        'dresser', 'nightstand', 'wardrobe', 'ottoman', 'bench', 'stool',
        'armchair', 'dining', 'bedroom', 'living', 'furniture', 'product'
    ];

    const hasProductIndicators =
        document.querySelector('[data-product-id]') ||
        document.querySelector('.product') ||
        document.querySelector('#product') ||
        document.querySelector('[class*="product"]') ||
        document.querySelector('[id*="product"]');

    const hasPrice =
        document.querySelector('[class*="price"]') ||
        document.querySelector('[id*="price"]') ||
        /\$[\d,]+/.test(bodyText) ||
        /£[\d,]+/.test(bodyText) ||
        /€[\d,]+/.test(bodyText);

    const hasFurnitureKeywords = furnitureKeywords.some(keyword =>
        url.includes(keyword) || title.includes(keyword) || bodyText.includes(keyword)
    );

    return hasProductIndicators && hasPrice && hasFurnitureKeywords;
}

// export function detectCartAndOrderPages() { ... paste from original ... }
// export function checkForOrderCompletion() { ... paste from original ... }
// export function trackOrderConfirmationPage() { ... paste from original ... }
