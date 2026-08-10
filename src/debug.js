// src/debug.js
// Intentionally has NO imports — store.js imports this, and state.js imports store.
// A getter is bound after config/store are ready to avoid TDZ / circular init errors.

let debugEnabledGetter = () => false;

/** Called from state.js once config wiring is available. */
export function bindDebugEnabled(getter) {
    if (typeof getter === 'function') {
        debugEnabledGetter = getter;
    }
}

export function debugLog(message, data) {
    let enabled = false;
    try {
        enabled = !!debugEnabledGetter();
    } catch {
        enabled = false;
    }
    if (!enabled) return;
    // eslint-disable-next-line no-console
    console.log('[AI Furniture Debug]', message, data || '');
}
