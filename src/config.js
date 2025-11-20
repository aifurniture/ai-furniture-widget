// src/config.js

// Default to production backend (Vercel)
// Users can override with explicit config if they want to use local backend
const DEFAULT_CONFIG = {
    apiEndpoint: 'https://ai-furniture-backend.vercel.app/api',
    trackingEndpoint: 'https://ai-furniture-backend.vercel.app/api/tracking/pixel',
    widgetEndpoint: 'https://ai-furniture-backend.vercel.app/furniture',
    debug: false
};

export function createConfig(userConfig = {}) {
    if (!userConfig.domain) {
        throw new Error(
            'AI Furniture Widget: "domain" is required. ' +
            'Call initAIFurnitureWidget({ domain: "example.com" })'
        );
    }

    return {
        ...DEFAULT_CONFIG,
        ...userConfig
    };
}
