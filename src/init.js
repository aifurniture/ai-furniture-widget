// src/init.js
import { verifyDomain, verifyDomainWithServer } from './domainVerification.js';
import { debugLog } from './debug.js';
import { initSession, trackEvent, onOrderAddedToDatabase, resetWidget, disconnectAllTracking, setRecreateWidgetButton } from './tracking.js';
import { createWidgetButton } from './ui/widgetButton.js';
import { isFurnitureProductPage, detectCartAndOrderPages, checkForOrderCompletion, trackOrderConfirmationPage } from './detection.js';

// Track if widget has been initialized in this session
let widgetInitialized = false;

export async function initializeWidget(isInitialLoad = false) {
    console.log('🚀 INITIALIZING WIDGET:', {
        isInitialLoad,
        currentUrl: window.location.href,
        currentPage: window.location.pathname + window.location.search,
        alreadyInitialized: widgetInitialized
    });

    // If already initialized and not initial load, just update page tracking
    if (widgetInitialized && !isInitialLoad) {
        console.log('✅ Widget already initialized, updating page tracking only');
        updatePageTracking();
        return;
    }

    debugLog('Initializing AI Furniture widget', { isInitialLoad });

    if (!verifyDomain()) return;

    const serverVerification = await verifyDomainWithServer();
    if (!serverVerification) {
        console.error('🚫 AI Furniture Widget: Server verification failed. Widget will not initialize.');
        return;
    }
    console.log('init widget')
    initSession();

    const trackingDisconnected = sessionStorage.getItem('tracking_disconnected') === 'true';
    const orderCompletedAt = sessionStorage.getItem('order_completed_at');

    if (trackingDisconnected && orderCompletedAt) {
        console.log('🔌 Tracking disconnected due to completed order - checking if should re-enable');
        const isFurniturePage = isFurnitureProductPage();
        if (isFurniturePage) {
            console.log('🔄 PRODUCT PAGE DETECTED - re-enabling tracking for new session');
            debugLog('Product page detected after order completion - re-enabling tracking');
            resetWidget();
            widgetInitialized = false; // Allow reinitialization
        } else {
            console.log('❌ Non-product page after order completion - keeping tracking disabled');
            debugLog('Non-product page after order completion - keeping tracking disabled');
            return;
        }
    } else if (trackingDisconnected) {
        console.log('🔌 Tracking already disconnected - skipping widget initialization');
        debugLog('Tracking already disconnected - skipping widget initialization');
        return;
    }

    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';

    if (isAIFurnitureUser) {
        console.log('🔍 CALLING trackOrderConfirmationPage()...');
        const orderConfirmed = trackOrderConfirmationPage();

        console.log('🔍 trackOrderConfirmationPage() RESULT:', {
            orderConfirmed,
            willStopWidget: orderConfirmed
        });

        if (orderConfirmed) {
            console.log('🎯 Order confirmed - stopping widget initialization');
            return;
        }
    } else {
        console.log('❌ Skipping order confirmation check - user has not used AI Furniture');
        debugLog('Skipping order confirmation check - user has not used AI Furniture');
    }

    createWidgetButton();

    if (isAIFurnitureUser) {
        trackEvent('page_view', {
            title: document.title,
            url: window.location.href,
            isProductPage: isFurnitureProductPage(),
            aiFurnitureUser: true
        });

        detectCartAndOrderPages();
    } else {
        debugLog('First time visitor - no tracking until AI Furniture usage');
    }

    // allow tracking module to recreate widget after reset
    setRecreateWidgetButton(createWidgetButton);

    // expose backend hook
    window.onOrderAddedToDatabase = onOrderAddedToDatabase;

    // Mark as initialized
    widgetInitialized = true;
    console.log('✅ Widget fully initialized');
}

/**
 * Update page tracking without reinitializing entire widget
 */
function updatePageTracking() {
    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';

    if (isAIFurnitureUser) {
        console.log('📄 Updating page tracking for new URL');
        trackEvent('page_view', {
            title: document.title,
            url: window.location.href,
            isProductPage: isFurnitureProductPage(),
            aiFurnitureUser: true
        });

        detectCartAndOrderPages();
    }
}

export function attachDomListeners() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initializeWidget(true));
    } else {
        initializeWidget(true);
    }

    // Track URL changes for SPA navigation
    let lastUrl = window.location.href;
    
    // Use both MutationObserver and popstate for better SPA support
    const urlChangeHandler = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            console.log('🔄 URL changed, updating widget...', { from: lastUrl, to: currentUrl });
            setTimeout(() => initializeWidget(false), 100);
        }
    };

    // Watch for DOM changes (for SPAs that don't use pushState)
    new MutationObserver(() => {
        urlChangeHandler();
    }).observe(document, { subtree: true, childList: true });

    // Watch for pushState/replaceState (for SPAs)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
        originalPushState.apply(history, args);
        setTimeout(urlChangeHandler, 0);
    };
    
    history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        setTimeout(urlChangeHandler, 0);
    };

    // Also listen to popstate (back/forward)
    window.addEventListener('popstate', urlChangeHandler);

    debugLog('AI Furniture widget initialized successfully');
}
