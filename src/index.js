// src/index.js
import { createConfig } from './config.js';
import { setConfig } from './state.js';
import {
    attachDomListeners,
    shouldShowWidgetUi,
    syncWidgetUiForPage
} from './init.js';

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

    attachDomListeners();

    if (window.__AIFurnitureInitialized) {
        syncWidgetUiForPage();
        return;
    }

    window.__AIFurnitureInitialized = true;
    syncWidgetUiForPage();
}
