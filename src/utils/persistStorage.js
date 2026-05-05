/**
 * Persist widget queue/config in localStorage (same origin across the whole storefront).
 * Migrates legacy sessionStorage once. Falls back to sessionStorage if quota / private mode.
 */

function safeGet(storage, key) {
    try {
        if (!storage) return null;
        const v = storage.getItem(key);
        return v != null && v !== '' ? v : null;
    } catch {
        return null;
    }
}

function safeSet(storage, key, value) {
    try {
        storage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read from localStorage first; if empty, migrate from sessionStorage (legacy).
 */
export function getPersistedString(key) {
    if (typeof window === 'undefined') return null;
    const local = safeGet(window.localStorage, key);
    if (local != null) return local;
    const legacy = safeGet(window.sessionStorage, key);
    if (legacy != null) {
        if (safeSet(window.localStorage, key, legacy)) {
            try {
                window.sessionStorage.removeItem(key);
            } catch {
                /* ignore */
            }
        }
        return legacy;
    }
    return null;
}

/**
 * Drop base64 image data from finished items to fit under localStorage quota (~5MB typical).
 */
function slimQueueJsonString(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data.queue || !Array.isArray(data.queue)) return null;
        data.queue = data.queue.map((item) => {
            const s = { ...item };
            if (s.status === 'COMPLETED' || s.status === 'ERROR') {
                delete s.userImageDataUrl;
            }
            return s;
        });
        return JSON.stringify(data);
    } catch {
        return null;
    }
}

function slimQueueJsonStringAggressive(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data.queue || !Array.isArray(data.queue)) return null;
        data.queue = data.queue.map((item) => {
            const s = { ...item };
            if (s.status === 'PENDING' || s.status === 'PROCESSING') return s;
            delete s.userImageDataUrl;
            return s;
        });
        return JSON.stringify(data);
    } catch {
        return null;
    }
}

/**
 * Write to localStorage; on quota error retry slimmer payload, then sessionStorage.
 */
export function setPersistedString(key, value) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(key, value);
        return;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            const slim = slimQueueJsonString(value);
            if (slim) {
                try {
                    window.localStorage.setItem(key, slim);
                    console.warn(
                        '[AI Furniture] Saved slimmed queue (removed image data from completed items) to fit storage quota.'
                    );
                    return;
                } catch (_) {
                    const slimmer = slimQueueJsonStringAggressive(value);
                    if (slimmer) {
                        try {
                            window.localStorage.setItem(key, slimmer);
                            console.warn('[AI Furniture] Saved aggressively slimmed queue to fit storage quota.');
                            return;
                        } catch (_) {
                            /* fall through */
                        }
                    }
                }
            }
        }
    }

    try {
        window.sessionStorage.setItem(key, value);
        console.warn('[AI Furniture] localStorage unavailable or full — using sessionStorage for this session.');
    } catch (e2) {
        console.warn('[AI Furniture] Could not persist state', e2);
    }
}

const WIDGET_ANON_CLIENT_KEY = 'aif_widget_anon_client_id';

const UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function randomUUIDv4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Stable per-browser id for server-side preview history when the shopper has not entered an email.
 */
export function getWidgetAnonymousClientId() {
    if (typeof window === 'undefined') return '';
    const existing = (getPersistedString(WIDGET_ANON_CLIENT_KEY) || '').trim();
    if (existing && UUID_V4_RE.test(existing)) {
        return existing.toLowerCase();
    }
    const fresh = randomUUIDv4();
    try {
        setPersistedString(WIDGET_ANON_CLIENT_KEY, fresh);
    } catch {
        /* ignore */
    }
    return fresh.toLowerCase();
}
