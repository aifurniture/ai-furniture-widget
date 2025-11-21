// src/tracking.js
import { getConfig, getSessionId, setSessionId } from './state.js';
import { debugLog } from './debug.js';
import { isFurnitureProductPage } from './detection.js';

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

    console.log('📡 TRACK EVENT CALLED:', {
        eventType,
        currentUrl: window.location.href,
        currentPage: window.location.pathname + window.location.search
    });

    const trackingDisconnected = sessionStorage.getItem('tracking_disconnected') === 'true';

    console.log('🔍 TRACKING STATUS CHECK:', {
        trackingDisconnected,
        eventType,
        willSendEvent: !trackingDisconnected
    });

    if (trackingDisconnected) {
        console.log('❌ Tracking already disconnected - skipping event:', eventType);
        debugLog('Skipping tracking - session has timed out and tracking disconnected');
        return;
    }

    const params = new URLSearchParams({
        sessionId,
        domain: config.domain,
        eventType,
        page: window.location.pathname + window.location.search,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        title: document.title,
        url: window.location.href
    });

    for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
            params.append(
                `data_${key}`,
                typeof value === 'object' ? JSON.stringify(value) : String(value)
            );
        }
    }

    // Ensure apiEndpoint is defined - use fallback if missing
    let apiEndpoint = config.apiEndpoint;
    if (!apiEndpoint) {
        // Fallback to default production endpoint if config is missing
        const isLocalMode = typeof window !== 'undefined' && 
                           (window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' || 
                            window.location.hostname === '0.0.0.0');
        apiEndpoint = isLocalMode 
            ? 'http://localhost:3000/api' 
            : 'https://ai-furniture-backend.vercel.app/api';
        console.warn('⚠️ apiEndpoint was undefined in tracking, using fallback:', apiEndpoint);
    }

    // Validate apiEndpoint is a valid URL
    if (!apiEndpoint || typeof apiEndpoint !== 'string') {
        console.error('❌ Invalid API endpoint, cannot send tracking event');
        return;
    }

    const pixelUrl = `${apiEndpoint}?${params.toString()}`;

    console.log('📤 SENDING PIXEL REQUEST TO BACKEND:', {
        url: pixelUrl,
        eventType,
        paramsCount: params.toString().split('&').length
    });

    debugLog('Pixel tracking URL', pixelUrl);

    const img = new Image();

    img.onload = function () {
        debugLog('Pixel loaded successfully', { eventType });
        console.log('Pixel tracking successful:', eventType);
        // (keep your special order-confirmation logic here if you want – you can paste it from your original img.onload)
    };

    img.onerror = function () {
        debugLog('Pixel failed to load', { eventType });
        console.error('Pixel tracking failed:', eventType);
    };

    img.src = pixelUrl;
}

// ---- order completion + disconnect logic ----

export function trackOrderCompletion(orderData) {
    debugLog('Order completion tracked', orderData);

    const sessionId = getSessionId();
    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';
    if (!isAIFurnitureUser) {
        console.log('❌ Skipping order completion tracking - user has not used AI Furniture');
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
    console.log('🔌 DISCONNECTING ALL TRACKING - ORDER COMPLETED!');
    debugLog('Disconnecting all tracking - order completed');

    sessionStorage.setItem('tracking_disconnected', 'true');
    sessionStorage.setItem('order_completed_at', new Date().toISOString());
    sessionStorage.setItem('order_completion_reason', 'order_placed');
    console.log('✅ Tracking marked as disconnected in sessionStorage');

    setTimeout(() => {
        resetWidget();
    }, 2000);
}

export function resetWidget() {
    console.log('🔄 RESETTING WIDGET - CLEARING ALL TRACKING STATE!');
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
        console.log('🗑️ Removed existing widget button');
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
            console.log('🔄 Widget button recreated for new session');
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
    console.log('🎉 ORDER CONFIRMED IN DATABASE - disconnecting tracking immediately', orderData);
    debugLog('Order successfully added to database - disconnecting tracking immediately', orderData);
    disconnectAllTracking();
}
