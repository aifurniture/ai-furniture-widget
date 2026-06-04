// src/ui/widgetButton.js
import { debugLog } from '../debug.js';
import { isFurnitureProductPage } from '../detection.js';
import { actions, store, QUEUE_STATUS, VIEWS } from '../state/store.js';
import { trackEvent } from '../tracking.js';

const TRIGGER_ICON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v12H4V7z"/><circle cx="12" cy="13" r="3.25"/></svg>`;

export function removeWidgetButton() {
    const button = document.getElementById('ai-furniture-trigger-btn');
    if (button) button.remove();
}

export function removeWidgetModal() {
    const modal = document.getElementById('ai-furniture-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}

export function showWidgetModalShell() {
    const modal = document.getElementById('ai-furniture-modal');
    if (modal) {
        modal.style.display = '';
        modal.removeAttribute('aria-hidden');
    }
}

export function createWidgetButton() {
    if (!isFurnitureProductPage()) return;

    if (document.getElementById('ai-furniture-trigger-btn')) return;

    const isMobile =
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        window.innerWidth <= 768 ||
        'ontouchstart' in window;

    const button = document.createElement('div');
    button.id = 'ai-furniture-trigger-btn';
    button.className = 'aif-trigger-btn';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('data-aif-state', 'idle');
    button.setAttribute('aria-label', 'See this product in your room');

    const icon = document.createElement('span');
    icon.className = 'aif-trigger-btn__icon';
    icon.innerHTML = TRIGGER_ICON_SVG;
    button.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'aif-trigger-btn__label';
    text.textContent = 'See in my room';
    button.appendChild(text);

    const badge = document.createElement('span');
    badge.className = 'aif-trigger-btn__badge';
    badge.hidden = true;
    button.appendChild(badge);

    if (!isMobile) {
        button.addEventListener('mouseenter', () => {
            if (!button.classList.contains('is-visible')) return;
            button.style.transform = 'translateY(-3px) scale(1.02)';
        });
        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('is-visible')) return;
            button.style.transform = '';
        });
    }

    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleWidgetClick();
    });

    if (isMobile) {
        let touchStartTime = 0;
        button.addEventListener(
            'touchstart',
            () => {
                touchStartTime = Date.now();
                button.style.transform = 'scale(0.96)';
            },
            { passive: true }
        );

        button.addEventListener(
            'touchend',
            (e) => {
                e.preventDefault();
                e.stopPropagation();
                button.style.transform = '';
                if (Date.now() - touchStartTime < 300) {
                    handleWidgetClick();
                }
            },
            { passive: false }
        );
    }

    store.subscribe((state) => {
        const processingCount = state.queue.filter(
            (i) => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING
        ).length;
        const completedCount = state.queue.filter((i) => i.status === QUEUE_STATUS.COMPLETED).length;

        const label = button.querySelector('.aif-trigger-btn__label');
        if (!label) return;

        if (processingCount > 0) {
            label.textContent = 'Creating preview…';
            button.dataset.aifState = 'processing';
        } else if (completedCount > 0) {
            label.textContent = 'View preview';
            button.dataset.aifState = 'ready';
        } else {
            label.textContent = 'See in my room';
            button.dataset.aifState = 'idle';
        }
    });

    document.body.appendChild(button);
    debugLog('Widget button added to body (floating bottom-right)');

    requestAnimationFrame(() => {
        setTimeout(() => {
            button.classList.add('is-visible');
        }, 80);
    });

    repositionWidgetButton();
}

function handleWidgetClick() {
    const productUrl = window.location.href;
    const state = store.getState();

    trackEvent('widget_opened', {
        productUrl,
        productName: document.title,
        hasQueueItems: state.queue && state.queue.length > 0,
        queueCount: state.queue ? state.queue.length : 0
    });

    try {
        sessionStorage.setItem('ai_furniture_user', 'true');
    } catch (e) {
        console.warn('⚠️ Could not save user state to sessionStorage:', e.message);
    }

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

    const isMobile =
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        window.innerWidth <= 768 ||
        'ontouchstart' in window;

    const otherWidgets = ['#intercom-container', '#launcher', '#drift-widget'];

    let bottomOffset = isMobile ? 16 : 20;
    let rightOffset = isMobile ? 16 : 20;

    otherWidgets.forEach((selector) => {
        if (document.querySelector(selector)) {
            bottomOffset = isMobile ? 80 : 100;
        }
    });

    button.style.bottom = `${bottomOffset}px`;
    button.style.right = `${rightOffset}px`;
}
