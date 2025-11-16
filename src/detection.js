// src/detection.js
import { debugLog } from './debug.js';
import { trackEvent, trackOrderCompletion, disconnectAllTracking } from './tracking.js';

export function isFurnitureProductPage() {
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

/**
 * Detect cart and order pages for AI Furniture users
 */
export function detectCartAndOrderPages() {
    // Only track if user has used AI Furniture
    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';
    if (!isAIFurnitureUser) {
        console.log('❌ Skipping cart/order page detection - user has not used AI Furniture');
        debugLog('Skipping cart/order page detection - user has not used AI Furniture');
        return {
            isCartPage: false,
            isOrderPage: false,
            pageType: 'product'
        };
    }

    const currentUrl = window.location.href.toLowerCase();
    const currentPath = window.location.pathname.toLowerCase();
    const pageTitle = document.title.toLowerCase();
    const bodyText = document.body.textContent.toLowerCase();

    // Cart page detection patterns
    const cartPatterns = [
        // URL patterns
        /\/cart/,
        /\/basket/,
        /\/shopping-cart/,
        /\/checkout\/cart/,
        /\/cart\.html/,
        /\/basket\.html/,
        /\/shopping-cart\.html/,
        // Query parameters
        /[?&]cart/,
        /[?&]basket/,
        /[?&]add-to-cart/,
        // Page title patterns
        /cart/,
        /basket/,
        /shopping cart/,
        /your cart/,
        /shopping bag/,
        // Body text patterns
        /cart total/,
        /basket total/,
        /shopping cart/,
        /proceed to checkout/,
        /update cart/,
        /remove from cart/,
        /empty cart/,
        /cart is empty/
    ];

    // Order/checkout page detection patterns
    const orderPatterns = [
        // URL patterns
        /\/checkout/,
        /\/order/,
        /\/payment/,
        /\/billing/,
        /\/shipping/,
        /\/review/,
        /\/confirm/,
        /\/success/,
        /\/thank-you/,
        /\/order-confirmation/,
        /\/checkout\/success/,
        /\/order\/success/,
        /\/payment\/success/,
        /\/checkout\.html/,
        /\/order\.html/,
        /\/payment\.html/,
        /\/success\.html/,
        /\/thank-you\.html/,
        // Query parameters
        /[?&]checkout/,
        /[?&]order/,
        /[?&]payment/,
        /[?&]success/,
        /[?&]order_id/,
        /[?&]transaction_id/,
        // Page title patterns
        /checkout/,
        /order/,
        /payment/,
        /billing/,
        /shipping/,
        /review order/,
        /order confirmation/,
        /payment confirmation/,
        /thank you/,
        /order successful/,
        /payment successful/,
        // Body text patterns
        /billing information/,
        /shipping information/,
        /payment method/,
        /order summary/,
        /total amount/,
        /place order/,
        /complete purchase/,
        /order confirmed/,
        /payment successful/,
        /thank you for your order/,
        /order number/,
        /confirmation number/,
        /transaction id/
    ];

    const isCartPage = cartPatterns.some(pattern =>
        pattern.test(currentUrl) ||
        pattern.test(currentPath) ||
        pattern.test(pageTitle) ||
        pattern.test(bodyText)
    );

    const isOrderPage = orderPatterns.some(pattern =>
        pattern.test(currentUrl) ||
        pattern.test(currentPath) ||
        pattern.test(pageTitle) ||
        pattern.test(bodyText)
    );

    let pageType = 'product';
    if (isCartPage) {
        pageType = 'cart';
    } else if (isOrderPage) {
        pageType = 'order';
    }

    if (isCartPage || isOrderPage) {
        const eventData = {
            pageType,
            url: window.location.href,
            title: document.title,
            detectedBy: 'generalized_detection'
        };

        const aiFurnitureSessionId = sessionStorage.getItem('ai_furniture_session_id');
        eventData.aiFurnitureUser = true;
        eventData.aiFurnitureSessionId = aiFurnitureSessionId;
        eventData.eventType = `ai_furniture_user_${pageType}_page_visit`;

        trackEvent(`${pageType}_page_visit`, eventData);

        debugLog(`${pageType} page detected:`, {
            url: window.location.href,
            title: document.title,
            pageType,
            aiFurnitureUser: isAIFurnitureUser
        });

        if (
            isOrderPage &&
            (currentUrl.includes('success') ||
                currentUrl.includes('thank') ||
                currentUrl.includes('confirmation') ||
                currentUrl.includes('complete'))
        ) {
            debugLog(
                'Order confirmation page detected - continuing to track until order confirmed in database'
            );
        }
    }

    return {
        isCartPage,
        isOrderPage,
        pageType
    };
}

/**
 * Check URL query params for AI Furniture return and order completion
 */
export function checkForOrderCompletion() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderAmount = urlParams.get('order_amount');
    const orderId = urlParams.get('order_id');
    const currency = urlParams.get('currency');
    const productUrl = urlParams.get('product_url');
    const aiFurnitureReturned = urlParams.get('ai_furniture_returned');
    const aiFurnitureSession = urlParams.get('ai_furniture_session');

    // Track return from AI Furniture - THIS IS WHERE TRACKING STARTS
    if (aiFurnitureReturned === 'true' && aiFurnitureSession) {
        debugLog('User returned from AI Furniture - starting tracking');

        // Mark this session as having used AI Furniture
        sessionStorage.setItem('ai_furniture_user', 'true');
        sessionStorage.setItem('ai_furniture_session_id', aiFurnitureSession);

        // First tracking event
        trackEvent('ai_furniture_return', {
            sessionId: aiFurnitureSession,
            returnTimestamp: urlParams.get('ai_furniture_timestamp'),
            productUrl: window.location.href,
            sourceDomain: window.location.hostname
        });

        // Clean up AI Furniture tracking parameters
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('ai_furniture_returned');
        newUrl.searchParams.delete('ai_furniture_session');
        newUrl.searchParams.delete('ai_furniture_timestamp');
        window.history.replaceState({}, '', newUrl.toString());
    }

    // Track order completion
    if (orderAmount && orderId) {
        trackOrderCompletion({
            amount: parseFloat(orderAmount),
            orderId: orderId,
            currency: currency || 'USD',
            productUrl: productUrl
        });

        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('order_amount');
        newUrl.searchParams.delete('order_id');
        newUrl.searchParams.delete('currency');
        newUrl.searchParams.delete('product_url');
        window.history.replaceState({}, '', newUrl.toString());
    }
}

/**
 * Detect hard order confirmation URLs with ?order=... and send explicit events
 */
export function trackOrderConfirmationPage() {
    const currentPage = window.location.pathname + window.location.search;
    const fullUrl = window.location.href;

    console.log('🔍 CHECKING FOR ORDER CONFIRMATION PAGE:', {
        currentPage: currentPage,
        fullUrl: fullUrl,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
    });

    const orderConfirmationPatterns = [
        /\/confirmation\?order=[A-Z0-9-]+/i,
        /\/success\?order=[A-Z0-9-]+/i,
        /\/thank-you\?order=[A-Z0-9-]+/i,
        /\/order-confirmation\?order=[A-Z0-9-]+/i,
        /\/checkout\/success\?order=[A-Z0-9-]+/i,
        /\/order\/success\?order=[A-Z0-9-]+/i,
        /\/payment\/success\?order=[A-Z0-9-]+/i
    ];

    console.log('🔍 TESTING ORDER CONFIRMATION PATTERNS:', {
        patterns: orderConfirmationPatterns.map(p => p.toString()),
        currentPage: currentPage
    });

    const isOrderConfirmation = orderConfirmationPatterns.some(pattern =>
        pattern.test(currentPage)
    );

    console.log('🔍 ORDER CONFIRMATION CHECK RESULT:', {
        isOrderConfirmation,
        currentPage
    });

    if (isOrderConfirmation) {
        const orderMatch = currentPage.match(/[?&]order[=_-]([A-Z0-9-]+)/i);
        const orderId = orderMatch ? orderMatch[1] : null;

        if (orderId) {
            console.log('🎯 ORDER CONFIRMATION PAGE DETECTED - SENDING TO BACKEND!', {
                page: currentPage,
                orderId: orderId
            });

            console.log('🔓 CLEARING TRACKING DISCONNECTED FLAG TO ALLOW ORDER EVENTS');
            sessionStorage.removeItem('tracking_disconnected');
            sessionStorage.removeItem('order_completed_at');
            sessionStorage.removeItem('order_completion_reason');

            console.log('📤 SENDING ORDER CONFIRMATION EVENT TO BACKEND...');
            trackEvent('order_confirmation_detected', {
                orderId: orderId,
                confirmationPage: currentPage,
                isOrderConfirmation: true
            });

            console.log('📤 SENDING ORDER PAGE VISIT EVENT TO BACKEND...');
            trackEvent('order_page_visit', {
                orderId: orderId,
                page: currentPage,
                isOrderConfirmation: true
            });

            console.log(
                '✅ BOTH ORDER EVENTS SENT TO BACKEND - waiting for backend processing...'
            );

            console.log(
                '⏰ Delaying tracking disconnection by 10 seconds to allow order processing...'
            );
            setTimeout(() => {
                console.log('🔌 Now disconnecting tracking after order processing delay');
                disconnectAllTracking();
            }, 10000);

            return true;
        }
    }

    return false;
}
