// src/ui/widgetButton.js
import { debugLog } from '../debug.js';
import { isFurnitureProductPage } from '../detection.js';
import { actions, store, QUEUE_STATUS, VIEWS } from '../state/store.js';
import { getConfig, getSessionId } from '../state.js';
import { trackEvent } from '../tracking.js';

export function createWidgetButton() {
    // Avoid duplicates
    if (document.getElementById('ai-furniture-trigger-btn')) return;

    const button = document.createElement('div');
    button.id = 'ai-furniture-trigger-btn';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');

    // Detect mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                     (window.innerWidth <= 768) ||
                     ('ontouchstart' in window);

    // Basic styles for the floating button
    Object.assign(button.style, {
        position: 'fixed',
        bottom: isMobile ? '16px' : '20px',
        right: isMobile ? '16px' : '20px',
        zIndex: '9999',
        backgroundColor: '#ffffff',
        color: '#1e293b',
        padding: isMobile ? '14px 18px' : '12px 20px',
        borderRadius: '50px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: isMobile ? '13px' : '14px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        opacity: '0',
        transform: 'translateY(20px)',
        pointerEvents: 'none', // disabled until visible
        // Mobile-specific: prevent text selection and double-tap zoom
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation', // Prevents double-tap zoom
        minHeight: '44px', // Minimum touch target size for mobile
        minWidth: '44px'
    });

    // Icon
    const icon = document.createElement('span');
    icon.innerHTML = '🛋️';
    icon.style.fontSize = '18px';
    button.appendChild(icon);

    // Text
    const text = document.createElement('span');
    text.textContent = 'See this in your room';
    button.appendChild(text);

    // Badge for queue count
    const badge = document.createElement('span');
    badge.style.display = 'none';
    badge.style.position = 'absolute';
    badge.style.top = '-4px';
    badge.style.right = '-4px';
    badge.style.background = '#ef4444';
    badge.style.color = 'white';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '700';
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '10px';
    badge.style.minWidth = '18px';
    badge.style.textAlign = 'center';
    button.appendChild(badge);

    // Hover effects (desktop only)
    if (!isMobile) {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        });
    }

    // Click → open modal
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleWidgetClick();
    });

    // Mobile touch events for better responsiveness
    if (isMobile) {
        let touchStartTime = 0;
        button.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            button.style.transform = 'scale(0.95)';
            button.style.opacity = '0.9';
        }, { passive: true });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touchDuration = Date.now() - touchStartTime;
            button.style.transform = 'scale(1)';
            button.style.opacity = '1';
            // Only trigger if it was a quick tap (not a swipe)
            if (touchDuration < 300) {
                handleWidgetClick();
            }
        }, { passive: false });
    }

    // Subscribe to store to update button status
    store.subscribe((state) => {
        const processingCount = state.queue.filter(i => i.status === QUEUE_STATUS.PROCESSING).length;
        const completedCount = state.queue.filter(i => i.status === QUEUE_STATUS.COMPLETED).length;
        const totalCount = state.queue.length;

        // Update button text based on status
        const textSpan = button.querySelector('span:nth-child(2)');
        const badgeSpan = button.querySelector('span:last-child');

        if (textSpan) {
            if (processingCount > 0) {
                textSpan.textContent = `Generating (${processingCount})...`;
                badgeSpan.style.display = 'block';
                badgeSpan.textContent = processingCount;
                badgeSpan.style.background = '#3b82f6';
            } else if (completedCount > 0) {
                textSpan.textContent = `View Results (${completedCount})`;
                badgeSpan.style.display = 'block';
                badgeSpan.textContent = completedCount;
                badgeSpan.style.background = '#22c55e';
            } else if (totalCount > 0) {
                textSpan.textContent = 'View Queue';
                badgeSpan.style.display = 'block';
                badgeSpan.textContent = totalCount;
                badgeSpan.style.background = '#64748b';
            } else {
                textSpan.textContent = 'See this in your room';
                badgeSpan.style.display = 'none';
            }
        }
    });

    document.body.appendChild(button);
    debugLog('Widget button added to body (floating bottom-right)');

    // Animate in
    requestAnimationFrame(() => {
        button.style.opacity = '1';
        button.style.transform = 'translateY(0)';
        button.style.pointerEvents = 'auto';
    });

    // Reposition if needed (e.g. to avoid other widgets)
    repositionWidgetButton();
}

function handleWidgetClick() {
    // Get product info
    const productUrl = window.location.href;
    const state = store.getState();
    
    // Track widget button click
    trackEvent('widget_opened', {
        productUrl,
        productName: document.title,
        hasQueueItems: state.queue && state.queue.length > 0,
        queueCount: state.queue ? state.queue.length : 0
    });
    
    // Mark user as AI Furniture user (for tracking)
    // Safely handle sessionStorage (may fail on mobile private browsing)
    try {
        sessionStorage.setItem('ai_furniture_user', 'true');
    } catch (e) {
        console.warn('⚠️ Could not save user state to sessionStorage:', e.message);
    }
    
    // If there are items in queue, open to queue view, otherwise upload view
    if (state.queue && state.queue.length > 0) {
        actions.openModal({ productUrl });
        actions.setView(VIEWS.QUEUE);
    } else {
        actions.openModal({ productUrl });
        actions.setView(VIEWS.UPLOAD);
    }
}

function repositionWidgetButton() {
    const button = document.getElementById('ai-furniture-trigger-btn');
    if (!button) return;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                     (window.innerWidth <= 768) ||
                     ('ontouchstart' in window);

    // Check for other common widgets (Intercom, Zendesk, etc.)
    // and move up if necessary. This is a simple heuristic.
    const otherWidgets = [
        '#intercom-container',
        '#launcher', // Zendesk
        '#drift-widget'
    ];

    let bottomOffset = isMobile ? 16 : 20;
    let rightOffset = isMobile ? 16 : 20;
    
    otherWidgets.forEach(selector => {
        if (document.querySelector(selector)) {
            bottomOffset = isMobile ? 80 : 100; // Move up significantly
        }
    });

    button.style.bottom = `${bottomOffset}px`;
    button.style.right = `${rightOffset}px`;
}
