// src/config.js

/** Production AI Furniture API (ai-furniture-backend). */
export const PRODUCTION_BACKEND_ORIGIN = 'https://ai-furniture-backend.vercel.app';

// Check if running in local development mode
// Auto-detect: if page is on localhost, use local backend
// Can also be controlled via:
// 1. URL parameter: ?aif_local=true
// 2. Explicit config: initAIFurnitureWidget({ useLocalBackend: true })
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const isPageOnLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '0.0.0.0');
const isLocalMode = urlParams?.get('aif_local') === 'true' || isPageOnLocalhost;

export function getDefaultApiEndpoints(localMode = isLocalMode) {
    if (localMode) {
        return {
            apiEndpoint: 'http://localhost:3000/api',
            trackingEndpoint: 'http://localhost:3000/api/tracking/pixel',
            widgetEndpoint: 'http://localhost:3000/furniture',
            debug: true,
        };
    }
    return {
        apiEndpoint: `${PRODUCTION_BACKEND_ORIGIN}/api`,
        trackingEndpoint: `${PRODUCTION_BACKEND_ORIGIN}/api/tracking/pixel`,
        widgetEndpoint: `${PRODUCTION_BACKEND_ORIGIN}/furniture`,
        debug: false,
    };
}

// Default configuration
const DEFAULT_CONFIG = getDefaultApiEndpoints();

export function createConfig(userConfig = {}) {
    let config = { ...DEFAULT_CONFIG };

    if (userConfig.useLocalBackend === true) {
        Object.assign(config, getDefaultApiEndpoints(true));
    } else if (userConfig.useLocalBackend === false) {
        Object.assign(config, getDefaultApiEndpoints(false));
    }

    return {
        ...config,
        ...userConfig
    };
}
