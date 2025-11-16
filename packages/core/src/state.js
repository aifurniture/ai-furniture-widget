// src/state.js

let config = null;
let sessionId = null;

export function setConfig(newConfig) {
    config = newConfig;
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
