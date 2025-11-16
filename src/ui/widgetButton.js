// src/ui/widgetButton.js
import { debugLog } from '../debug.js';
import { isFurnitureProductPage } from '../detection.js';
import { getConfig, getSessionId } from '../state.js';
import { openFurnitureModal } from './modal.js';

export function createWidgetButton() {
    // Avoid duplicates
    if (document.querySelector('#ai-furniture-widget')) return;

    // Re-enable this when you only want it on furniture product pages
    // if (!isFurnitureProductPage()) {
    //     debugLog('Not a furniture product page, skipping widget');
    //     return;
    // }

    const config = getConfig();
    debugLog('Creating AI Furniture widget');

    const button = document.createElement('button');
    button.id = 'ai-furniture-widget';
    button.style.border = 'none';
    button.style.background = 'transparent';
    button.style.padding = '0';
    button.style.cursor = 'pointer';

    button.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #f59e0b, #ea580c);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 12px 20px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        See in Your Room
      </div>
    `;

    // Hover effects
    button.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
    });

    button.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
    });

    // Click → open modal
    button.addEventListener('click', () => handleWidgetClick());

    // Try to find a sensible product container, fall back to body
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
    } else {
        debugLog('No suitable product container found; appended widget to body');
        document.body.appendChild(button);
    }
}

export function handleWidgetClick() {
    const config = getConfig();
    const sessionId = getSessionId();

    debugLog('Widget clicked');

    // Store original product URL for return tracking
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
