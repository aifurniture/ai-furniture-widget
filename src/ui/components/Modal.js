/**
 * Main Modal Container
 */
import { store, actions, VIEWS } from '../../state/store.js';
import { UploadView } from './UploadView.js';
import { ResultsView } from './ResultsView.js';
import { QueueView } from './QueueView.js';

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

    modalOverlay.appendChild(container);

    // Click outside to close
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            actions.closeModal();
        }
    });

    // Render content based on view
    const renderContent = (state) => {
        contentArea.innerHTML = '';

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
            document.body.style.overflow = 'hidden';
        } else {
            modalOverlay.classList.remove('open');
            document.body.style.overflow = '';
        }

        // Re-render content when view changes
        renderContent(state);
    });

    return modalOverlay;
};
