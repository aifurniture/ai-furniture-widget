// src/detection.js
import { debugLog } from './debug.js';
import { trackEvent, trackOrderCompletion, disconnectAllTracking } from './tracking.js';

const NON_PRODUCT_SHOPIFY_PAGE_TYPES = new Set([
    'index',
    'home',
    'collection',
    'list-collections',
    'cart',
    'checkout',
    'search',
    'page',
    'blog',
    'article',
    '404',
    'password',
    'gift_card',
    'customers/account',
    'customers/login',
    'customers/register'
]);

function getShopifyPageType() {
    try {
        return String(
            window.ShopifyAnalytics?.meta?.page?.pageType ||
                window.meta?.page?.pageType ||
                window.Shopify?.Analytics?.meta?.page?.pageType ||
                ''
        ).toLowerCase();
    } catch {
        return '';
    }
}

function isCatalogPath(pathname) {
    const path = (pathname || '').toLowerCase();

    if (!path || path === '/') return true;

    // Locale-only home paths, e.g. /en or /en-gb
    if (/^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(path)) return true;

    const catalogMarkers = [
        '/collections',
        '/catalog',
        '/category',
        '/categories',
        '/shop',
        '/search',
        '/cart',
        '/checkout',
        '/account',
        '/pages/',
        '/blog',
        '/blogs/',
        '/about',
        '/contact',
        '/home',
        '/index',
        '/brands',
        '/sale',
        '/deals',
        '/tag/',
        '/tags/',
        '/vendor',
        '/vendors',
        '/browse',
        '/store',
        '/listing',
        '/all-products'
    ];

    if (catalogMarkers.some((marker) => path.includes(marker))) return true;
    if (/^\/products\/?$/i.test(path)) return true;

    return false;
}

function isProductDetailPath(pathname) {
    const path = (pathname || '').toLowerCase();
    return (
        /\/products\/[^/?#]+/i.test(path) ||
        /\/product\/[^/?#]+/i.test(path) ||
        /\/p\/[^/?#]+/i.test(path) ||
        /\/item\/[^/?#]+/i.test(path)
    );
}

function hasShopifyProductMeta() {
    return getShopifyPageType() === 'product';
}

function hasJsonLdProduct() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
        try {
            const parsed = JSON.parse(script.textContent || '');
            const nodes = Array.isArray(parsed) ? parsed : [parsed];
            for (const node of nodes) {
                if (!node || typeof node !== 'object') continue;
                const type = node['@type'];
                if (type === 'Product') return true;
                if (Array.isArray(type) && type.includes('Product')) return true;
                if (Array.isArray(node['@graph'])) {
                    if (node['@graph'].some((g) => g && g['@type'] === 'Product')) return true;
                }
            }
        } catch {
            /* ignore invalid JSON-LD */
        }
    }
    return false;
}

function hasOpenGraphProduct() {
    const ogType = document
        .querySelector('meta[property="og:type"]')
        ?.getAttribute('content')
        ?.toLowerCase();
    return ogType === 'product';
}

function hasSingleProductDetailSignals() {
    const detailRoot =
        document.querySelector(
            '[data-product-id], [data-product-handle], .product-single, .product-detail, #product-detail, .productView, .product-page'
        ) || document.querySelector('main .product, #product');

    if (!detailRoot) return false;

    const addToCart =
        detailRoot.querySelector(
            'form[action*="/cart/add"], form[action*="add-to-cart"], [data-add-to-cart], button[name="add"], input[name="add"]'
        ) ||
        document.querySelector('form[action*="/cart/add"], form[action*="add-to-cart"]');

    if (!addToCart) return false;

    const inListing = addToCart.closest(
        '[class*="collection"], [class*="grid"], [class*="carousel"], [class*="slider"], [class*="listing"], [class*="catalog"]'
    );
    return !inListing;
}

export function isFurnitureProductPage() {
    const path = window.location.pathname;
    const shopifyPageType = getShopifyPageType();

    if (shopifyPageType === 'product') return true;
    if (shopifyPageType && NON_PRODUCT_SHOPIFY_PAGE_TYPES.has(shopifyPageType)) {
        return false;
    }

    if (isCatalogPath(path)) return false;
    if (isProductDetailPath(path)) return true;

    if (hasOpenGraphProduct()) return true;

    if (hasJsonLdProduct() && hasSingleProductDetailSignals()) {
        return true;
    }

    return false;
}

/**
 * Detect cart and order pages for AI Furniture users
 */
export function detectCartAndOrderPages() {
    // Only track if user has used AI Furniture
    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';
    if (!isAIFurnitureUser) {
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

    // If we're clearly on a product page, only trust strong URL/path matches for cart/checkout.
    const looksLikeProductPage =
        isFurnitureProductPage() || currentPath.startsWith('/products/') || currentPath.includes('/product');

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

    const strongCartMatch =
        /(^|\/)cart(\/|$)/i.test(currentPath) || /\/checkout\/cart(\/|$)/i.test(currentPath);
    const strongOrderMatch =
        /(^|\/)checkout(\/|$)/i.test(currentPath) ||
        /(^|\/)order(\/|$)/i.test(currentPath) ||
        /(^|\/)payment(\/|$)/i.test(currentPath);

    const weakCartMatch = cartPatterns.some(
        (pattern) => pattern.test(pageTitle) || pattern.test(bodyText) || pattern.test(currentUrl)
    );
    const weakOrderMatch = orderPatterns.some(
        (pattern) => pattern.test(pageTitle) || pattern.test(bodyText) || pattern.test(currentUrl)
    );

    const isCartPage = looksLikeProductPage ? strongCartMatch : strongCartMatch || weakCartMatch;
    const isOrderPage = looksLikeProductPage ? strongOrderMatch : strongOrderMatch || weakOrderMatch;

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

    const orderConfirmationPatterns = [
        /\/confirmation\?order=[A-Z0-9-]+/i,
        /\/success\?order=[A-Z0-9-]+/i,
        /\/thank-you\?order=[A-Z0-9-]+/i,
        /\/order-confirmation\?order=[A-Z0-9-]+/i,
        /\/checkout\/success\?order=[A-Z0-9-]+/i,
        /\/order\/success\?order=[A-Z0-9-]+/i,
        /\/payment\/success\?order=[A-Z0-9-]+/i
    ];

    const isOrderConfirmation = orderConfirmationPatterns.some(pattern =>
        pattern.test(currentPage)
    );

    if (isOrderConfirmation) {
        const orderMatch = currentPage.match(/[?&]order[=_-]([A-Z0-9-]+)/i);
        const orderId = orderMatch ? orderMatch[1] : null;

        if (orderId) {
            sessionStorage.removeItem('tracking_disconnected');
            sessionStorage.removeItem('order_completed_at');
            sessionStorage.removeItem('order_completion_reason');

            trackEvent('order_confirmation_detected', {
                orderId: orderId,
                confirmationPage: currentPage,
                isOrderConfirmation: true
            });

            trackEvent('order_page_visit', {
                orderId: orderId,
                page: currentPage,
                isOrderConfirmation: true
            });
            setTimeout(() => {
                disconnectAllTracking();
            }, 10000);

            return true;
        }
    }

    return false;
}
