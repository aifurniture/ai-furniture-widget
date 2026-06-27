/**
 * Main Modal Container
 */
import { store, actions, VIEWS } from '../../state/store.js';
import { UploadView } from './UploadView.js';
import { ResultsView } from './ResultsView.js';
import { QueueView } from './QueueView.js';
import { WidgetFooter } from './WidgetFooter.js';
import { syncMobileLayoutVars } from '../safeArea.js';

const DRAWER_WIDTH_STORAGE_KEY = 'aif_drawer_width_px';
const DRAWER_MIN_WIDTH = 320;
const DRAWER_MAX_WIDTH = 720;
const DRAWER_DESKTOP_MQ = '(min-width: 769px)';
const DRAWER_RESIZE_ICON =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 7 11 12 15 17"/><polyline points="9 7 5 12 9 17"/></svg>';

function clampDrawerWidth(px) {
    return Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, Math.round(px)));
}

function readSavedDrawerWidth() {
    try {
        const raw = localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
        if (!raw) return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? clampDrawerWidth(n) : null;
    } catch {
        return null;
    }
}

function saveDrawerWidth(px) {
    try {
        localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(clampDrawerWidth(px)));
    } catch {
        /* ignore */
    }
}

function getDrawerWidth(container) {
    const rect = container.getBoundingClientRect();
    return rect.width || clampDrawerWidth(420);
}

function initDrawerResize(container) {
    if (typeof window === 'undefined' || !container) return;

    const mq = window.matchMedia(DRAWER_DESKTOP_MQ);
    const saved = readSavedDrawerWidth();
    if (saved) {
        container.style.setProperty('--aif-drawer-width', `${saved}px`);
    }

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'aif-drawer-resize';
    handle.setAttribute('aria-label', 'Drag to resize panel');
    handle.title = 'Drag to resize';
    handle.innerHTML = DRAWER_RESIZE_ICON;

    let dragging = false;
    let startX = 0;
    let startW = 0;

    const onPointerMove = (e) => {
        if (!dragging) return;
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        if (clientX == null) return;
        const delta = startX - clientX;
        const next = clampDrawerWidth(startW + delta);
        container.style.setProperty('--aif-drawer-width', `${next}px`);
    };

    const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('aif-drawer-resize--active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        saveDrawerWidth(getDrawerWidth(container));
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
    };

    handle.addEventListener('pointerdown', (e) => {
        if (!mq.matches) return;
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startW = getDrawerWidth(container);
        handle.classList.add('aif-drawer-resize--active');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        handle.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
    });

    handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (!mq.matches) return;
        container.style.removeProperty('--aif-drawer-width');
        try {
            localStorage.removeItem(DRAWER_WIDTH_STORAGE_KEY);
        } catch {
            /* ignore */
        }
    });

    const syncHandleVisibility = () => {
        handle.hidden = !mq.matches;
        handle.style.display = mq.matches ? '' : 'none';
    };

    syncHandleVisibility();
    mq.addEventListener('change', syncHandleVisibility);

    container.appendChild(handle);
}

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

function listFocusables(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        return el.offsetParent !== null || el.getClientRects().length > 0;
    });
}

export const Modal = () => {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'ai-furniture-modal';

    const scrim = document.createElement('div');
    scrim.className = 'aif-drawer-scrim';
    scrim.setAttribute('aria-hidden', 'true');

    const container = document.createElement('div');
    container.className = 'aif-container';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-label', 'AI furniture preview');

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'aif-close-btn';
    closeBtn.type = 'button';
    closeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/></svg>';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = actions.closeModal;

    const chrome = document.createElement('div');
    chrome.className = 'aif-drawer-chrome';
    chrome.appendChild(closeBtn);
    container.appendChild(chrome);

    const contentArea = document.createElement('div');
    contentArea.className = 'aif-content';
    container.appendChild(contentArea);

    const footer = WidgetFooter();
    container.appendChild(footer);

    modalOverlay.appendChild(scrim);
    modalOverlay.appendChild(container);

    initDrawerResize(container);

    // Click anywhere outside the drawer to close (desktop + mobile).
    // Optional desktop scrim uses a flat tint only — no backdrop-filter (avoids blurring the store).
    let docHandlersAttached = false;
    /** @type {HTMLElement | null} */
    let focusReturnEl = null;

    const onDocPointerDownCapture = (e) => {
        const state = store.getState();
        if (!state.isOpen) return;
        if (!(e.target instanceof Element)) return;
        if (container.contains(e.target)) return;
        // Close and swallow the click so the underlying page doesn't accidentally activate something.
        e.preventDefault();
        e.stopPropagation();
        actions.closeModal();
    };

    const onDocKeyDown = (e) => {
        const state = store.getState();
        if (!state.isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            actions.closeModal();
            return;
        }
        if (e.key !== 'Tab') return;
        const list = listFocusables(container);
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
            if (active === first || !container.contains(active)) {
                e.preventDefault();
                last.focus();
            }
        } else if (active === last) {
            e.preventDefault();
            first.focus();
        }
    };

    const attachDocHandlers = () => {
        if (docHandlersAttached || typeof document === 'undefined') return;
        docHandlersAttached = true;
        document.addEventListener('pointerdown', onDocPointerDownCapture, true);
        document.addEventListener('keydown', onDocKeyDown, true);
    };

    const detachDocHandlers = () => {
        if (!docHandlersAttached || typeof document === 'undefined') return;
        docHandlersAttached = false;
        document.removeEventListener('pointerdown', onDocPointerDownCapture, true);
        document.removeEventListener('keydown', onDocKeyDown, true);
    };

    const focusDrawer = () => {
        requestAnimationFrame(() => {
            try {
                const resultsClose = container.querySelector('.aif-results-close');
                (resultsClose instanceof HTMLElement ? resultsClose : closeBtn).focus();
            } catch {
                /* ignore */
            }
        });
    };

    const syncChromeForView = (view) => {
        const hideChrome = view === VIEWS.RESULTS;
        chrome.hidden = hideChrome;
        chrome.style.display = hideChrome ? 'none' : '';
    };

    const restoreFocusIfPossible = () => {
        if (!(focusReturnEl instanceof HTMLElement)) return;
        try {
            if (document.contains(focusReturnEl)) {
                focusReturnEl.focus();
            }
        } catch {
            /* ignore */
        }
        focusReturnEl = null;
    };

    // Render content based on view
    const renderContent = (state) => {
        contentArea.innerHTML = '';
        container.setAttribute('data-aif-view', state.view || '');
        syncChromeForView(state.view);

        if (state.view === VIEWS.UPLOAD) {
            contentArea.appendChild(UploadView(state));
        } else if (state.view === VIEWS.GENERATING) {
            // In the new flow, GENERATING might just be a state in the queue, 
            // but if we want a dedicated "generating" view, we can keep it.
            // For now, let's redirect to QueueView if generating
            contentArea.appendChild(QueueView(state));
        } else if (state.view === VIEWS.RESULTS) {
            contentArea.appendChild(ResultsView(state));
        } else if (state.view === VIEWS.QUEUE) {
            contentArea.appendChild(QueueView(state));
        } else if (state.view === VIEWS.ERROR) {
            // Error view can be simple or reuse upload with error
            contentArea.appendChild(UploadView(state));
        }
    };

    let wasOpen = false;

    store.subscribe((state) => {
        const nowOpen = !!state.isOpen;
        const opening = nowOpen && !wasOpen;
        const closing = !nowOpen && wasOpen;

        if (opening) {
            if (
                document.activeElement instanceof HTMLElement &&
                !container.contains(document.activeElement)
            ) {
                focusReturnEl = document.activeElement;
            } else {
                focusReturnEl = null;
            }
        }

        if (closing) {
            detachDocHandlers();
            restoreFocusIfPossible();
        }

        if (nowOpen) {
            modalOverlay.classList.add('open');
            attachDocHandlers();
            requestAnimationFrame(() => {
                syncMobileLayoutVars();
            });
        } else {
            modalOverlay.classList.remove('open');
        }

        wasOpen = nowOpen;

        renderContent(state);

        if (opening) {
            focusDrawer();
        }
    });

    // Restore modal immediately on full-page reload (subscribe only fires on changes,
    // so if isOpen:true was persisted in sessionStorage we must render the initial state here)
    const initialState = store.getState();
    if (initialState.isOpen) {
        wasOpen = true;
        if (
            document.activeElement instanceof HTMLElement &&
            !container.contains(document.activeElement)
        ) {
            focusReturnEl = document.activeElement;
        } else {
            focusReturnEl = null;
        }
        modalOverlay.classList.add('open');
        attachDocHandlers();
        renderContent(initialState);
        focusDrawer();
    }

    return modalOverlay;
};
