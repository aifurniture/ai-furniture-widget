// src/config.js

// Auto-detect localhost for development
const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.0.')
);

const DEFAULT_CONFIG = {
    apiEndpoint: isLocalhost ? 'http://localhost:4000/api' : 'https://ai-furniture-backend.vercel.app/api',
    trackingEndpoint: isLocalhost ? 'http://localhost:4000/api/tracking/pixel' : 'https://ai-furniture-backend.vercel.app/api/tracking/pixel',
    widgetEndpoint: isLocalhost ? 'http://localhost:3000/furniture' : 'https://ai-furniture-backend.vercel.app/furniture',
    debug: isLocalhost // Auto-enable debug in localhost
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
