// src/index.js
import { createConfig } from './config.js';
import { setConfig } from './state.js';
import {
    attachDomListeners,
    attachDeferredProductPageBootstrap,
    isProductPageContext,
    syncWidgetUiForPage
} from './init.js';

function bootstrapWidget() {
    attachDomListeners();
    if (!window.__AIFurnitureInitialized) {
        window.__AIFurnitureInitialized = true;
    }
    syncWidgetUiForPage();
}

export function initAIFurnitureWidget(userConfig = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    if (!userConfig.domain && window.FURNITURE_AI_CONFIG) {
        userConfig = { ...window.FURNITURE_AI_CONFIG, ...userConfig };
    }

    const config = createConfig(userConfig);
    setConfig(config);
    window.__AIFurnitureConfig = config;

    if (window.__AIFurnitureInitialized) {
        syncWidgetUiForPage();
        return;
    }

    if (isProductPageContext()) {
        bootstrapWidget();
        return;
    }

    attachDeferredProductPageBootstrap(bootstrapWidget);
}
