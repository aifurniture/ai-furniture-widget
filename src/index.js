// src/index.js
import { createConfig } from './config.js';
import { setConfig } from './state.js';
import { attachDomListeners } from './init.js';

export function initAIFurnitureWidget(userConfig = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        // SSR
        return;
    }

    const config = createConfig(userConfig);
    setConfig(config);

    attachDomListeners();
}
