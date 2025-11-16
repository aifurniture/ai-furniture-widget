// src/debug.js
import { getConfig } from './state.js';

export function debugLog(message, data) {
    const config = getConfig();
    if (config.debug) {
        // eslint-disable-next-line no-console
        console.log('[AI Furniture Widget]', message, data || '');
    }
}
