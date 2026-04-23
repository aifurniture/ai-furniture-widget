// src/init.js
import { actions } from './state/store.js';
import { verifyDomain, verifyDomainWithServer } from './domainVerification.js';
import { debugLog } from './debug.js';
import { initSession, trackEvent, onOrderAddedToDatabase, resetWidget, disconnectAllTracking, setRecreateWidgetButton } from './tracking.js';
import { createWidgetButton } from './ui/widgetButton.js';
import { isFurnitureProductPage, detectCartAndOrderPages, checkForOrderCompletion, trackOrderConfirmationPage } from './detection.js';

// Track if widget has been initialized - use sessionStorage to persist across script reloads
function getWidgetInitKey() {
    try {
        const config = window.__AIFurnitureConfig || {};
        return 'aif_widget_init_' + (config.domain || 'default');
    } catch {
        return 'aif_widget_init_default';
    }
}

function isWidgetInitialized() {
    try {
        // Check if widget button exists in DOM - most reliable check
        const widgetButton = document.getElementById('ai-furniture-trigger-btn');
        if (widgetButton) {
            return true;
        }
        // Fallback to sessionStorage check
        return sessionStorage.getItem(getWidgetInitKey()) === 'true';
    } catch {
        return false;
    }
}

function setWidgetInitialized(value) {
    try {
        if (value) {
            sessionStorage.setItem(getWidgetInitKey(), 'true');
        } else {
            sessionStorage.removeItem(getWidgetInitKey());
        }
    } catch (e) {
        debugLog('Failed to update widget init state in sessionStorage', e);
    }
}

export async function initializeWidget(isInitialLoad = false) {
    debugLog('Initializing widget', {
        isInitialLoad,
        currentUrl: window.location.href,
        currentPage: window.location.pathname + window.location.search,
        alreadyInitialized: isWidgetInitialized(),
        hasConfig: !!window.__AIFurnitureConfig
    });

    // If widget button already exists and not initial load, just update page tracking
    const existingButton = document.getElementById('ai-furniture-trigger-btn');
    if (existingButton && !isInitialLoad) {
        debugLog('Widget button already exists, updating page tracking only');
        updatePageTracking();
        return;
    }

    debugLog('Initializing AI Furniture widget', { isInitialLoad });

    // Check if domain was already verified (persist across script reloads)
    // Normalize domain (remove www) so both www and non-www versions share verification state
    const currentHostname = window.location.hostname;
    const normalizedDomain = currentHostname.replace(/^www\./, '');
    const domainVerifiedKey = 'aif_domain_verified_' + normalizedDomain;
    let domainVerified = sessionStorage.getItem(domainVerifiedKey) === 'true';
    
    if (!domainVerified) {
        if (!verifyDomain()) return;

        const serverVerification = await verifyDomainWithServer();
        if (!serverVerification) {
            debugLog(
                'Domain not authorized in backend database; widget will not initialize',
                currentHostname
            );
            return;
        }
        
        // Mark domain as verified (only if backend confirmed it's in database)
        try {
            sessionStorage.setItem(domainVerifiedKey, 'true');
            domainVerified = true;
        } catch (e) {
            debugLog('Failed to save domain verification state', e);
        }
    } else {
        debugLog('Domain already verified with backend database, skipping verification');
    }
    
    try {
        actions.syncThemeConfig();
    } catch (e) {
        debugLog('syncThemeConfig failed', e);
    }
    initSession();

    const trackingDisconnected = sessionStorage.getItem('tracking_disconnected') === 'true';
    const orderCompletedAt = sessionStorage.getItem('order_completed_at');

    if (trackingDisconnected && orderCompletedAt) {
        debugLog('Tracking disconnected due to completed order - checking if should re-enable');
        const isFurniturePage = isFurnitureProductPage();
        if (isFurniturePage) {
            debugLog('Product page detected after order completion - re-enabling tracking');
            resetWidget();
            setWidgetInitialized(false); // Allow reinitialization
        } else {
            debugLog('Non-product page after order completion - keeping tracking disabled');
            return;
        }
    } else if (trackingDisconnected) {
        debugLog('Tracking already disconnected - skipping widget initialization');
        return;
    }

    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';

    if (isAIFurnitureUser) {
        const orderConfirmed = trackOrderConfirmationPage();

        if (orderConfirmed) {
            debugLog('Order confirmed - stopping widget initialization');
            return;
        }
    } else {
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

    // Mark as initialized (persist in sessionStorage)
    setWidgetInitialized(true);
    debugLog('Widget fully initialized');
}

/**
 * Update page tracking without reinitializing entire widget
 */
function updatePageTracking() {
    try {
        actions.syncThemeConfig();
    } catch (e) {
        debugLog('syncThemeConfig failed', e);
    }

    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';

    if (isAIFurnitureUser) {
        debugLog('Updating page tracking for new URL');
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
    // Prevent duplicate listeners if script reloads
    if (window.__AIFurnitureListenersAttached) {
        debugLog('Listeners already attached, skipping...');
        // Still initialize widget if needed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => initializeWidget(true));
        } else {
            initializeWidget(true);
        }
        return;
    }
    
    window.__AIFurnitureListenersAttached = true;
    
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
            const previousUrl = lastUrl;
            lastUrl = currentUrl;
            debugLog('URL changed, updating widget...', { from: previousUrl, to: currentUrl });
            // Only update page tracking, don't reinitialize
            setTimeout(() => initializeWidget(false), 100);
        }
    };

    // Watch for DOM changes (for SPAs that don't use pushState)
    // Only create one observer
    if (!window.__AIFurnitureMutationObserver) {
        window.__AIFurnitureMutationObserver = new MutationObserver(() => {
            urlChangeHandler();
        });
        window.__AIFurnitureMutationObserver.observe(document, { subtree: true, childList: true });
    }

    // Watch for pushState/replaceState (for SPAs)
    // Only override if not already overridden
    if (!window.__AIFurniturePushStatePatched) {
        window.__AIFurniturePushStatePatched = true;
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
    }

    // Also listen to popstate (back/forward)
    // Use named function to allow removal if needed
    if (!window.__AIFurniturePopstateHandler) {
        window.__AIFurniturePopstateHandler = urlChangeHandler;
        window.addEventListener('popstate', window.__AIFurniturePopstateHandler);
    }

    debugLog('AI Furniture widget initialized successfully');
}
