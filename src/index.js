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

    // 1. Initialize Config & Store
    const config = createConfig(userConfig);
    setConfig(config);

    // Initialize Queue Processor
    initQueueProcessor();

    // 2. Inject Styles
    injectStyles();

    // 3. Mount Modal (it stays hidden until opened)
    const modal = Modal();
    document.body.appendChild(modal);

    // 4. Expose API
    window.AIFurniture = {
        open: (options) => actions.openModal(options),
        close: actions.closeModal
    };

    // 5. Attach triggers (optional, if user wants auto-attach)
    // We might need to update init.js to use our new actions instead of the old modal.js
    // For now, let's assume the user calls window.AIFurniture.open() or we attach listeners manually here

    // If there are elements with data-ai-furniture-trigger, attach click
    document.querySelectorAll('[data-ai-furniture-trigger]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            actions.openModal();
        });
    });

    attachDomListeners();

    console.log('AI Furniture Widget Initialized 🚀');
}
