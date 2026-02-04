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

    // 1. Read config from window.FURNITURE_AI_CONFIG if not provided
    if (!userConfig.domain && window.FURNITURE_AI_CONFIG) {
        console.log('📦 Using config from window.FURNITURE_AI_CONFIG');
        userConfig = { ...window.FURNITURE_AI_CONFIG, ...userConfig };
    }

    // 1. Initialize Config FIRST (needed for init key matching)
    const config = createConfig(userConfig);
    setConfig(config);
    
    // Store config in window immediately for persistence across script reloads
    window.__AIFurnitureConfig = config;

    // Prevent multiple initializations - only check window object (same script execution)
    // Don't check sessionStorage here as it may have stale data and block first-time init
    if (window.__AIFurnitureInitialized) {
        console.log('AI Furniture Widget already initialized in this script execution, skipping...');
        // Restore API if it was lost
        if (!window.AIFurniture) {
            window.AIFurniture = {
                open: (options) => actions.openModal(options),
                close: actions.closeModal,
                getState: () => store.getState()
            };
        }
        // Still attach listeners in case they were lost
        attachDomListeners();
        return;
    }
    
    // Mark as initialized in this script execution
    window.__AIFurnitureInitialized = true;

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
