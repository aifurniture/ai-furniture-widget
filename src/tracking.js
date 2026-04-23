// src/tracking.js
import { getConfig, getSessionId, setSessionId } from './state.js';
import { debugLog } from './debug.js';
import { isFurnitureProductPage } from './detection.js';

function truncateString(v, maxLen) {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : String(v);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen);
}

function safeJsonStringify(v, maxLen) {
    try {
        return truncateString(JSON.stringify(v), maxLen);
    } catch {
        return '';
    }
}

// This will be set from init so tracking can recreate the widget
let recreateWidgetButtonFn = null;

export function setRecreateWidgetButton(fn) {
    recreateWidgetButtonFn = fn;
}

export function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export function initSession() {
    let sessionId = sessionStorage.getItem('ai_furniture_session_id');
    if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem('ai_furniture_session_id', sessionId);
    }
    setSessionId(sessionId);
    const config = getConfig();
    debugLog('Widget script loaded', { domain: config.domain, sessionId });
}

export function trackEvent(eventType, data = {}) {
    const config = getConfig();
    const sessionId = getSessionId();

    const trackingDisconnected = sessionStorage.getItem('tracking_disconnected') === 'true';

    if (trackingDisconnected) {
        debugLog('Skipping tracking - session has timed out and tracking disconnected');
        return;
    }

    const params = new URLSearchParams({
        sessionId: truncateString(sessionId, 120),
        domain: truncateString(config.domain, 200),
        ...(config.domainId ? { domainId: truncateString(config.domainId, 64) } : {}),
        eventType: truncateString(eventType, 80),
        page: truncateString(window.location.pathname + window.location.search, 500),
        timestamp: new Date().toISOString(),
        userAgent: truncateString(navigator.userAgent, 300),
        referrer: truncateString(document.referrer, 500),
        title: truncateString(document.title, 300),
        url: truncateString(window.location.href, 800)
    });

    for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
            params.append(
                `data_${truncateString(key, 60)}`,
                typeof value === 'object' ? safeJsonStringify(value, 800) : truncateString(value, 800)
            );
        }
    }

    // Prefer dedicated trackingEndpoint. Fallback: derive from apiEndpoint.
    let trackingEndpoint = config.trackingEndpoint;
    if (!trackingEndpoint) {
        const apiEndpoint = config.apiEndpoint;
        if (typeof apiEndpoint === 'string' && apiEndpoint.length > 0) {
            trackingEndpoint = apiEndpoint.replace(/\/$/, '') + '/tracking/pixel';
            console.warn(
                '⚠️ trackingEndpoint was undefined in tracking, derived from apiEndpoint:',
                trackingEndpoint
            );
        } else {
            // Final fallback to default production/local endpoints
            const isLocalMode =
                typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '0.0.0.0');
            trackingEndpoint = isLocalMode
                ? 'http://localhost:3000/api/tracking/pixel'
                : 'https://ai-furniture-backend.vercel.app/api/tracking/pixel';
            console.warn('⚠️ trackingEndpoint was undefined in config, using fallback:', trackingEndpoint);
        }
    }

    if (typeof trackingEndpoint !== 'string' || trackingEndpoint.length === 0) {
        console.error('❌ Invalid tracking endpoint, cannot send tracking event');
        return;
    }

    const pixelUrl = `${trackingEndpoint}?${params.toString()}`;

    debugLog('Pixel tracking URL', pixelUrl);

    const img = new Image();

    img.onload = function () {
        debugLog('Pixel loaded successfully', { eventType });
        // (keep your special order-confirmation logic here if you want – you can paste it from your original img.onload)
    };

    img.onerror = function () {
        debugLog('Pixel failed to load', { eventType });
    };

    img.src = pixelUrl;
}

// ---- order completion + disconnect logic ----

export function trackOrderCompletion(orderData) {
    debugLog('Order completion tracked', orderData);

    const sessionId = getSessionId();
    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';
    if (!isAIFurnitureUser) {
        debugLog('Skipping order completion tracking - user has not used AI Furniture');
        return;
    }

    const aiFurnitureSessionId = sessionStorage.getItem('ai_furniture_session_id');

    const eventData = {
        orderAmount: orderData.amount,
        orderId: orderData.orderId,
        currency: orderData.currency || 'USD',
        productUrl: orderData.productUrl,
        sessionId,
        aiFurnitureUser: true,
        aiFurnitureSessionId,
        eventType: 'ai_furniture_user_order_completed'
    };

    trackEvent('order_completed', eventData);

    debugLog('Order completion tracked - continuing to track until order confirmed in database');
}

export function disconnectAllTracking() {
    debugLog('Disconnecting all tracking - order completed');

    sessionStorage.setItem('tracking_disconnected', 'true');
    sessionStorage.setItem('order_completed_at', new Date().toISOString());
    sessionStorage.setItem('order_completion_reason', 'order_placed');
    setTimeout(() => {
        resetWidget();
    }, 2000);
}

export function resetWidget() {
    debugLog('Resetting widget - clearing all tracking state');

    sessionStorage.removeItem('ai_furniture_user');
    sessionStorage.removeItem('ai_furniture_session_id');
    sessionStorage.removeItem('aifurniture_session_id');
    sessionStorage.removeItem('tracking_disconnected');
    sessionStorage.removeItem('order_completed_at');
    sessionStorage.removeItem('order_completion_reason');
    sessionStorage.removeItem('session_ended_at');
    sessionStorage.removeItem('ai_furniture_original_url');

    const existingWidget = document.querySelector('#ai-furniture-widget');
    if (existingWidget) {
        existingWidget.remove();
    }

    const newSessionId = generateSessionId();
    sessionStorage.setItem('ai_furniture_session_id', newSessionId);
    setSessionId(newSessionId);

    debugLog('Widget reset complete - user can now use AI Furniture widget again', {
        newSessionId
    });

    showResetMessage();

    if (typeof recreateWidgetButtonFn === 'function' && isFurnitureProductPage()) {
        setTimeout(() => {
            recreateWidgetButtonFn();
        }, 1000);
    }
}

export function showResetMessage() {
    const message = document.createElement('div');
    message.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: slideIn 0.3s ease-out;
      ">
        ✅ Order completed! AI Furniture widget refreshed for new session
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(message);

    setTimeout(() => {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    }, 4000);
}

// called by backend
export function onOrderAddedToDatabase(orderData) {
    debugLog('Order successfully added to database - disconnecting tracking immediately', orderData);
    disconnectAllTracking();
}
