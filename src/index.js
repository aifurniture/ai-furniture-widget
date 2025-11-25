// src/index.js
import { createConfig } from './config.js';
import { actions, store } from './state/store.js';
import { injectStyles } from './ui/styles.js';
import { Modal } from './ui/components/Modal.js';
import { attachDomListeners } from './init.js';
import { setConfig } from './state.js';
import { initQueueProcessor } from './services/queueProcessor.js';

export function initAIFurnitureWidget(userConfig = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    // Prevent multiple initializations
    if (window.__AIFurnitureInitialized) {
        console.log('AI Furniture Widget already initialized, skipping...');
        return;
    }
    window.__AIFurnitureInitialized = true;

    // 1. Initialize Config & Store
    const config = createConfig(userConfig);
    setConfig(config);

    // 2. Inject Styles
    injectStyles();

    // 3. Mount Modal (it stays hidden until opened)
    // Check if modal already exists to avoid duplicates
    let modal = document.getElementById('ai-furniture-modal');
    if (!modal) {
        modal = Modal();
        document.body.appendChild(modal);
    }

    // 4. Initialize Queue Processor (must be done after store is ready)
    initQueueProcessor();

    // 5. Expose API
    window.AIFurniture = {
        open: (options) => actions.openModal(options),
        close: actions.closeModal,
        getState: () => store.getState()
    };

    // 6. Attach triggers (optional, if user wants auto-attach)
    // If there are elements with data-ai-furniture-trigger, attach click
    document.querySelectorAll('[data-ai-furniture-trigger]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            actions.openModal();
        });
    });

    // 7. Restore modal state if it was open
    const currentState = store.getState();
    if (currentState.isOpen) {
        // Modal will be shown by the store subscription in Modal component
        console.log('🔄 Restoring modal state:', { isOpen: currentState.isOpen, view: currentState.view });
    }

    // 8. Attach DOM listeners for navigation
    attachDomListeners();

    // 9. Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
        // Restore state on navigation
        const state = store.getState();
        if (state.isOpen) {
            // Keep modal open if it was open
            actions.openModal();
        }
    });

    console.log('AI Furniture Widget Initialized 🚀');
}
