// src/ui/widgetButton.js
import { debugLog } from '../debug.js';
import { isFurnitureProductPage } from '../detection.js';
import { getConfig, getSessionId } from '../state.js';
import { openFurnitureModal } from './modal.js';

export function createWidgetButton() {
    if (document.querySelector('#ai-furniture-widget')) return;

    if (!isFurnitureProductPage()) {
        debugLog('Not a furniture product page, skipping widget');
        return;
    }

    const config = getConfig();
    debugLog('Creating AI Furniture widget');

    const button = document.createElement('button');
    button.id = 'ai-furniture-widget';
    button.innerHTML = `... your existing innerHTML ...`;

    // ⬇️ Paste your existing hover + click handlers here,
    // but for click you call handleWidgetClick()

    button.addEventListener('click', () => handleWidgetClick());

    const productContainer =
        document.querySelector('.product-details') ||
        document.querySelector('.product-info') ||
        document.querySelector('.product-description') ||
        document.querySelector('[class*="product"]') ||
        document.querySelector('main') ||
        document.querySelector('#main') ||
        document.body;

    if (productContainer) {
        productContainer.appendChild(button);
        debugLog('Widget button added to page');
    }
}

export function handleWidgetClick() {
    const config = getConfig();
    const sessionId = getSessionId();

    debugLog('Widget clicked');

    sessionStorage.setItem('ai_furniture_original_url', window.location.href);

    const productInfo = {
        url: window.location.href,
        title: document.title,
        domain: config.domain,
        sessionId,
        referrer: document.referrer
    };

    const aiFurnitureUrl = new URL(config.widgetEndpoint);
    aiFurnitureUrl.searchParams.set('ref', config.domain);
    aiFurnitureUrl.searchParams.set('product_url', encodeURIComponent(productInfo.url));
    aiFurnitureUrl.searchParams.set('product_title', encodeURIComponent(productInfo.title));
    aiFurnitureUrl.searchParams.set('session_id', sessionId);

    openFurnitureModal(aiFurnitureUrl.toString(), sessionId, config);
}
