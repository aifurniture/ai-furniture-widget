// src/config.js

// Check if running in local development mode
// This can be controlled via:
// 1. URL parameter: ?aif_local=true
// 2. Explicit config: initAIFurnitureWidget({ useLocalBackend: true })
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const isLocalMode = urlParams?.get('aif_local') === 'true';

// Default configuration
const DEFAULT_CONFIG = {
    apiEndpoint: isLocalMode ? 'http://localhost:3000/api' : 'https://ai-furniture-backend.vercel.app/api',
    trackingEndpoint: isLocalMode ? 'http://localhost:3000/api/tracking/pixel' : 'https://ai-furniture-backend.vercel.app/api/tracking/pixel',
    widgetEndpoint: isLocalMode ? 'http://localhost:3000/furniture' : 'https://ai-furniture-backend.vercel.app/furniture',
    debug: isLocalMode // Auto-enable debug in local mode
};

export function createConfig(userConfig = {}) {
    if (!userConfig.domain) {
        throw new Error(
            'AI Furniture Widget: "domain" is required. ' +
            'Call initAIFurnitureWidget({ domain: "example.com" })'
        );
    }

    // Allow explicit override via useLocalBackend config
    let config = { ...DEFAULT_CONFIG };

    if (userConfig.useLocalBackend === true) {
        config.apiEndpoint = 'http://localhost:3000/api';
        config.trackingEndpoint = 'http://localhost:3000/api/tracking/pixel';
        config.widgetEndpoint = 'http://localhost:3000/furniture';
        config.debug = true;
    } else if (userConfig.useLocalBackend === false) {
        config.apiEndpoint = 'https://ai-furniture-backend.vercel.app/api';
        config.trackingEndpoint = 'https://ai-furniture-backend.vercel.app/api/tracking/pixel';
        config.widgetEndpoint = 'https://ai-furniture-backend.vercel.app/furniture';
    }

    return {
        ...config,
        ...userConfig
    };
}
