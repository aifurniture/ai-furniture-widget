// src/ui/widgetButton.js
import { debugLog } from '../debug.js';
import { isFurnitureProductPage } from '../detection.js';
import { getConfig, getSessionId } from '../state.js';
import { openFurnitureModal, displayGeneratedImages } from './modal.js';

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

    const BASE_BOTTOM = 24; // px
    const BASE_RIGHT  = 24; // px

    Object.assign(button.style, {
        position: 'fixed',
        bottom: BASE_BOTTOM + 'px',
        right: BASE_RIGHT + 'px',
        zIndex: '999998', // stay above in stacking order
        border: 'none',
        background: 'transparent',
        padding: '0',
        cursor: 'pointer',
        margin: '0',
        lineHeight: '0'
    });

    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'Open AI furniture assistant');

    button.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #166534, #15803d); /* forest green gradient */
        color: #f9fafb;
        border-radius: 999px;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 8px 22px rgba(22, 101, 52, 0.45);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        white-space: nowrap;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 7a3 3 0 0 1 3-3h2l1-1h4l1 1h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7zm8 2.5A4.5 4.5 0 1 0 16.5 14 4.5 4.5 0 0 0 12 9.5zm0 2A2.5 2.5 0 1 1 9.5 14 2.5 2.5 0 0 1 12 11.5z" />
        </svg>
        <span>See this sofa in your room</span>
      </div>
    `;

    const bubble = button.firstElementChild;

    // Hover effects on the bubble
    button.addEventListener('mouseenter', () => {
        bubble.style.transform = 'translateY(-2px)';
        bubble.style.boxShadow = '0 12px 28px rgba(22, 101, 52, 0.55)';
    });

    button.addEventListener('mouseleave', () => {
        bubble.style.transform = 'translateY(0)';
        bubble.style.boxShadow = '0 8px 22px rgba(22, 101, 52, 0.45)';
    });

    // Click → open modal
    button.addEventListener('click', () => handleWidgetClick());

    document.body.appendChild(button);
    debugLog('Widget button added to body (floating bottom-right)');

    // --- Avoid overlapping other corner widgets (x/y stacking) ---
    function repositionAboveOtherWidgets() {
        const GAP = 12; // gap above the highest widget
        let extraBottom = 0;

        // Heuristic: look for other fixed widgets living bottom-right-ish
        const candidates = document.querySelectorAll(
            'iframe, [class*="chat"], [id*="chat"], [class*="widget"], [id*="widget"], [data-widget], [data-chat]'
        );

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        candidates.forEach(el => {
            if (el === button) return;

            const style = window.getComputedStyle(el);
            if (style.position !== 'fixed') return;

            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const bottomDistance = viewportH - rect.bottom;
            const rightDistance  = viewportW - rect.right;

            // Consider things that are reasonably bottom-right
            const isBottomRightish =
                bottomDistance >= 0 && bottomDistance < 200 &&
                rightDistance  >= 0 && rightDistance  < 260;

            if (!isBottomRightish) return;

            const requiredExtra = rect.height + GAP;
            if (requiredExtra > extraBottom) {
                extraBottom = requiredExtra;
            }
        });

        const newBottom = BASE_BOTTOM + extraBottom;
        button.style.bottom = newBottom + 'px';
        debugLog(`Widget repositioned to bottom: ${newBottom}px to sit above other widgets`);
    }

    // Run once after a short delay to let other widgets mount
    setTimeout(repositionAboveOtherWidgets, 500);
    // Re-run on resize in case layout/viewport changes
    window.addEventListener('resize', () => {
        repositionAboveOtherWidgets();
    });
}

export function handleWidgetClick() {
    const config = getConfig();
    const sessionId = getSessionId();

    debugLog('Widget clicked');

    // Check if there are existing generated images
    const storedImages = sessionStorage.getItem('ai_furniture_generated_images');
    if (storedImages) {
        try {
            const images = JSON.parse(storedImages);
            if (images && images.length > 0) {
                // Display existing images
                displayGeneratedImages(images);
                return; // Don't open modal if images exist
            }
        } catch (e) {
            console.warn('Failed to parse stored images:', e);
        }
    }

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
