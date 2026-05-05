/**
 * Main Modal Container
 */
import { store, actions, VIEWS } from '../../state/store.js';
import { UploadView } from './UploadView.js';
import { ResultsView } from './ResultsView.js';
import { QueueView } from './QueueView.js';
import { WidgetFooter } from './WidgetFooter.js';

export const Modal = () => {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'ai-furniture-modal';

    const container = document.createElement('div');
    container.className = 'aif-container';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'aif-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = actions.closeModal;

    container.appendChild(closeBtn);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.className = 'aif-content';
    container.appendChild(contentArea);

    const footer = WidgetFooter();
    container.appendChild(footer);

    modalOverlay.appendChild(container);

    // Click anywhere outside the drawer to close (desktop + mobile).
    // We intentionally avoid a fullscreen overlay element to prevent compositing that can visually blur the page.
    let outsideHandlerAttached = false;
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

    // Render content based on view
    const renderContent = (state) => {
        contentArea.innerHTML = '';
        container.setAttribute('data-aif-view', state.view || '');

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

    // Subscribe to store changes
    store.subscribe((state) => {
        if (state.isOpen) {
            modalOverlay.classList.add('open');
            if (!outsideHandlerAttached && typeof document !== 'undefined') {
                outsideHandlerAttached = true;
                document.addEventListener('pointerdown', onDocPointerDownCapture, true);
            }
        } else {
            modalOverlay.classList.remove('open');
            if (outsideHandlerAttached && typeof document !== 'undefined') {
                outsideHandlerAttached = false;
                document.removeEventListener('pointerdown', onDocPointerDownCapture, true);
            }
        }

        // Re-render content when view changes
        renderContent(state);
    });

    // Restore modal immediately on full-page reload (subscribe only fires on changes,
    // so if isOpen:true was persisted in sessionStorage we must render the initial state here)
    const initialState = store.getState();
    if (initialState.isOpen) {
        modalOverlay.classList.add('open');
        if (!outsideHandlerAttached && typeof document !== 'undefined') {
            outsideHandlerAttached = true;
            document.addEventListener('pointerdown', onDocPointerDownCapture, true);
        }
        renderContent(initialState);
    }

    return modalOverlay;
};
