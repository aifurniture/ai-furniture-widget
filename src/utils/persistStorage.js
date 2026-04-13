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
