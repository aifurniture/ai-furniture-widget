// src/state.js
import { store } from './state/store.js';
import { bindDebugEnabled } from './debug.js';

let config = null;
let sessionId = null;

bindDebugEnabled(() => {
    try {
        return !!(config?.debug || store.getState()?.config?.debug);
    } catch {
        return false;
    }
});

export function setConfig(newConfig) {
    config = newConfig;
    // Also update the store's config
    store.setState({ config: newConfig });
}

export function getConfig() {
    if (!config) {
        throw new Error('AI Furniture: config not set. Call initAIFurnitureWidget first.');
    }
    return config;
}

export function setSessionId(id) {
    sessionId = id;
}

export function getSessionId() {
    return sessionId;
}
