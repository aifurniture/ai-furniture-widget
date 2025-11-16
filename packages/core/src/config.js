// src/config.js

const DEFAULT_CONFIG = {
    apiEndpoint: 'https://aifurniture.app/api/tracking/pixel',
    widgetEndpoint: 'https://aifurniture.app/furniture',
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
