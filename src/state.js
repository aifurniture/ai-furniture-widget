// src/state.js
import { store } from './state/store.js';

let config = null;
let sessionId = null;

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
