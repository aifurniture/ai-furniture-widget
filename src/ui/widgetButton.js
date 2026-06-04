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
        bottom: isMobile ? '20px' : '24px',
        right: isMobile ? '20px' : '24px',
        zIndex: '9999',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: '#ffffff',
        padding: isMobile ? '14px 20px' : '14px 24px',
        borderRadius: '999px',
        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35), 0 2px 8px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: isMobile ? '14px' : '15px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: '0',
        transform: 'translateY(20px) scale(0.9)',
        pointerEvents: 'none',
        border: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        minHeight: '48px',
        minWidth: '48px',
        letterSpacing: '0.01em'
    });

    // Icon
    const icon = document.createElement('span');
    icon.innerHTML = '✨';
    icon.style.fontSize = '20px';
    icon.style.lineHeight = '1';
    button.appendChild(icon);

    // Text
    const text = document.createElement('span');
    text.textContent = 'See in my room';
    text.style.lineHeight = '1';
    button.appendChild(text);

    // Badge for queue count
    const badge = document.createElement('span');
    badge.style.display = 'none';
    badge.style.position = 'absolute';
    badge.style.top = '-6px';
    badge.style.right = '-6px';
    badge.style.background = '#ef4444';
    badge.style.color = 'white';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '700';
    badge.style.padding = '4px 8px';
    badge.style.borderRadius = '999px';
    badge.style.minWidth = '20px';
    badge.style.textAlign = 'center';
    badge.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    badge.style.border = '2px solid white';
    button.appendChild(badge);

    // Hover effects (desktop only)
    if (!isMobile) {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-4px) scale(1.02)';
            button.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.45), 0 4px 12px rgba(0, 0, 0, 0.15)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0) scale(1)';
            button.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.35), 0 2px 8px rgba(0, 0, 0, 0.1)';
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
        const processingCount = state.queue.filter(
            (i) => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING
        ).length;
        const completedCount = state.queue.filter(
            (i) => i.status === QUEUE_STATUS.COMPLETED
        ).length;

        const textSpan = button.querySelector('span:nth-child(2)');
        const badgeSpan = button.querySelector('span:last-child');

        if (textSpan) {
            if (processingCount > 0) {
                textSpan.textContent = 'Creating preview…';
                badgeSpan.style.display = 'none';
                button.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
            } else if (completedCount > 0) {
                textSpan.textContent = 'View preview';
                badgeSpan.style.display = 'none';
                button.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
            } else {
                textSpan.textContent = 'See in my room';
                badgeSpan.style.display = 'none';
                button.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            }
        }
    });

    document.body.appendChild(button);
    debugLog('Widget button added to body (floating bottom-right)');

    // Animate in with stagger
    setTimeout(() => {
        requestAnimationFrame(() => {
            button.style.opacity = '1';
            button.style.transform = 'translateY(0) scale(1)';
            button.style.pointerEvents = 'auto';
        });
    }, 100);

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
    
    // Open the simplest path: progress if generating, result if ready, otherwise upload
    const processing = state.queue?.some(
        (i) => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING
    );
    const latestCompleted = state.queue
        ?.filter((i) => i.status === QUEUE_STATUS.COMPLETED && i.result?.generatedImageUrl)
        .sort((a, b) => (b.completedAt || b.queuedAt || 0) - (a.completedAt || a.queuedAt || 0))[0];

    actions.openModal({ productUrl });

    if (processing) {
        actions.setView(VIEWS.QUEUE);
    } else if (latestCompleted) {
        actions.setGenerationResults([
            {
                url: latestCompleted.result.generatedImageUrl,
                originalImageUrl:
                    latestCompleted.result?.originalImageUrl || latestCompleted.userImageUrl || '',
                originalAspectRatio: latestCompleted.result?.originalAspectRatio,
                originalWidth: latestCompleted.result?.originalWidth,
                originalHeight: latestCompleted.result?.originalHeight,
                imageS3Key:
                    latestCompleted.result?.imageS3Key || latestCompleted.imageS3Key || null
            }
        ]);
    } else {
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
