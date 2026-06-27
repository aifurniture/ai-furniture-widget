/**
 * Simple pub/sub store for widget state management
 * Uses sessionStorage for cross-page persistence within the same session
 */
import { createConfig } from '../config.js';
import { getPersistedString, setPersistedString, getWidgetAnonymousClientId } from '../utils/persistStorage.js';
import {
    fetchWidgetGenerations,
    getStorefrontDomain,
    postWidgetShopper
} from '../utils/widgetShopperApi.js';
import { debugLog } from '../debug.js';

const STORAGE_KEY = 'ai_furniture_widget_state';
const MODAL_STATE_KEY = 'ai_furniture_modal_state';
const USER_EMAIL_KEY = 'aif_widget_user_email';

function ensureApiEndpoint(config) {
    const c = { ...(config || {}) };
    if (!c.apiEndpoint) {
        const isLocalMode =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '0.0.0.0');
        c.apiEndpoint = isLocalMode
            ? 'http://localhost:3000/api'
            : 'https://ai-furniture-backend.vercel.app/api';
    }
    return c;
}

/** Strip non-serializable fields; keep queue metadata needed to resume after navigation. */
function serializeQueueForStorage(queue) {
    return queue.map((item) => {
        const cleanItem = { ...item };
        delete cleanItem.userImage;
        return cleanItem;
    });
}

/** Merge queue rows so async saves cannot wipe progress written during navigation. */
function mergeQueueItem(stored, current) {
    if (!stored) return current;
    if (!current) return stored;
    return {
        ...stored,
        ...current,
        backendJobSubmitted: !!(stored.backendJobSubmitted || current.backendJobSubmitted),
        imageS3Key: current.imageS3Key || stored.imageS3Key || null,
        userImageUrl: current.userImageUrl || stored.userImageUrl || null,
        userImageDataUrl: current.userImageDataUrl || stored.userImageDataUrl || null,
        jobDomain: current.jobDomain || stored.jobDomain || null,
        startedAt: current.startedAt || stored.startedAt || null,
        status: current.status || stored.status,
        error: current.error != null ? current.error : stored.error,
        result: current.result || stored.result || null
    };
}

function mergeQueues(a, b) {
    const byId = new Map();
    for (const item of a || []) {
        if (item?.id) byId.set(item.id, item);
    }
    for (const item of b || []) {
        if (!item?.id) continue;
        byId.set(item.id, mergeQueueItem(byId.get(item.id), item));
    }
    return Array.from(byId.values());
}

let persistGeneration = 0;

function writeSessionSnapshot(state) {
    const { queue, generatedImages, selectedModel, queueTab, config } = state;
    sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            queue: serializeQueueForStorage(queue),
            generatedImages,
            selectedModel,
            queueTab,
            config: ensureApiEndpoint(config || {})
        })
    );
}

/** Synchronous persist before SPA navigation (pagehide often does not fire). */
export function flushSessionSnapshot() {
    if (typeof window === 'undefined') return;
    try {
        persistGeneration += 1;
        writeSessionSnapshot(store.getState());
    } catch (e) {
        debugLog('flushSessionSnapshot failed', e);
    }
}

const loadState = () => {
    try {
        const serialized = sessionStorage.getItem(STORAGE_KEY);
        return serialized ? JSON.parse(serialized) : undefined;
    } catch (e) {
        debugLog('Failed to load state', e);
        return undefined;
    }
};

let isPageUnloading = false;

// Dedupe + rate-limit remote history calls (prevents 429 spam)
let remoteGenerationsInFlight = null;
let nextRemoteGenerationsAllowedAt = 0;
let nextShopperRegisterAllowedAt = 0;

const saveState = async () => {
    if (isPageUnloading) return;
    const myGeneration = persistGeneration;
    try {
        const snapshot = store.getState();
        const dataUrlPatches = new Map();

        await Promise.all(
            snapshot.queue.map(async (item) => {
                if (
                    item.userImage &&
                    (item.userImage instanceof File || item.userImage instanceof Blob) &&
                    !item.userImageDataUrl
                ) {
                    try {
                        dataUrlPatches.set(item.id, await fileToDataURL(item.userImage));
                    } catch (e) {
                        debugLog('Failed to convert image to data URL', e);
                    }
                }
            })
        );

        if (isPageUnloading || myGeneration !== persistGeneration) return;

        const latest = store.getState();
        let cleanQueue = serializeQueueForStorage(latest.queue).map((item) => {
            const patch = dataUrlPatches.get(item.id);
            if (patch && !item.userImageDataUrl) {
                return { ...item, userImageDataUrl: patch };
            }
            return item;
        });

        try {
            const existing = sessionStorage.getItem(STORAGE_KEY);
            if (existing) {
                const parsed = JSON.parse(existing);
                if (parsed?.queue) {
                    cleanQueue = mergeQueues(parsed.queue, cleanQueue);
                }
            }
        } catch (e) {
            debugLog('Failed to merge session queue snapshot', e);
        }

        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                queue: cleanQueue,
                generatedImages: latest.generatedImages,
                selectedModel: latest.selectedModel,
                queueTab: latest.queueTab,
                config: ensureApiEndpoint(latest.config || {})
            })
        );
    } catch (e) {
        debugLog('Failed to save state', e);
    }
};

// Helper to convert File/Blob to data URL (exported so queue items always have data URL before persist)
export const fileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Helper to convert data URL back to Blob
const dataURLToBlob = (dataURL) => {
    if (!dataURL) return null;
    try {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        debugLog('Failed to convert data URL to blob', e);
        return null;
    }
};

// Save modal state separately for quick access
const saveModalState = (isOpen, view) => {
    try {
        sessionStorage.setItem(MODAL_STATE_KEY, JSON.stringify({ isOpen, view }));
    } catch (e) {
        debugLog('Failed to save modal state', e);
    }
};

const loadModalState = () => {
    try {
        const serialized = sessionStorage.getItem(MODAL_STATE_KEY);
        return serialized ? JSON.parse(serialized) : { isOpen: false, view: VIEWS.UPLOAD };
    } catch (e) {
        return { isOpen: false, view: VIEWS.UPLOAD };
    }
};

function loadPersistedEmail() {
    if (typeof window === 'undefined') return '';
    try {
        const e = (getPersistedString(USER_EMAIL_KEY) || '').trim().toLowerCase();
        return e;
    } catch {
        return '';
    }
}

async function syncShopperGenerationsFromServer() {
    if (typeof window === 'undefined') return;
    const { config, userEmail } = store.getState();
    const emailTrim = (userEmail || '').trim().toLowerCase();
    const emailOk = emailTrim && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
    const anonKey = getWidgetAnonymousClientId();
    const anonOk = !!anonKey && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(anonKey);

    if (!emailOk && !anonOk) {
        store.setState({ remoteGenerations: [] });
        return;
    }
    const api = ensureApiEndpoint(config || {});
    const domain = getStorefrontDomain();
    if (!domain) return;
    try {
        const now = Date.now();
        if (now < nextRemoteGenerationsAllowedAt) {
            return remoteGenerationsInFlight || Promise.resolve();
        }
        if (remoteGenerationsInFlight) return remoteGenerationsInFlight;

        remoteGenerationsInFlight = fetchWidgetGenerations(api.apiEndpoint, {
            domain,
            ...(emailOk ? { email: emailTrim } : { anonymousClientKey: anonKey })
        })
            .then((data) => {
                store.setState({ remoteGenerations: data.generations || [] });
                // Normal cadence: don't hammer; allow refresh every 15s.
                nextRemoteGenerationsAllowedAt = Date.now() + 15_000;
            })
            .catch((e) => {
                // On rate-limit, back off for a minute.
                if (e && e.status === 429) {
                    nextRemoteGenerationsAllowedAt = Date.now() + 60_000;
                } else {
                    nextRemoteGenerationsAllowedAt = Date.now() + 15_000;
                }
                debugLog('Could not load preview history', e?.message || e);
            })
            .finally(() => {
                remoteGenerationsInFlight = null;
            });
        await remoteGenerationsInFlight;
    } catch (e) {
        debugLog('Could not load preview history', e?.message || e);
    }
}

export const createStore = (initialState) => {
    const loaded = loadState();
    const modalState = loadModalState();
    const persistedEmail = loadPersistedEmail();
    
    // Restore queue items with image data
    let restoredQueue = [];
    if (loaded && loaded.queue) {
        restoredQueue = loaded.queue.map(item => {
            const restored = { ...item };
            // Convert data URL back to Blob if available
            if (item.userImageDataUrl) {
                restored.userImage = dataURLToBlob(item.userImageDataUrl);
            }
            return restored;
        });
    }
    
    let state = {
        ...initialState,
        ...loaded,
        userEmail: persistedEmail || loaded?.userEmail || initialState.userEmail,
        remoteGenerations: loaded?.remoteGenerations || initialState.remoteGenerations,
        config: ensureApiEndpoint({
            ...initialState.config,
            ...(loaded?.config || {})
        }),
        queue: restoredQueue.length > 0 ? restoredQueue : (loaded?.queue || initialState.queue),
        ...modalState // Restore modal state
    };
    
    const listeners = new Set();

    return {
        getState: () => state,
        setState: (newState) => {
            state = { ...state, ...newState };
            // Save state asynchronously to avoid blocking
            saveState().catch((e) => debugLog('Failed to save state', e));
            
            // Save modal state separately for quick access
            if ('isOpen' in newState || 'view' in newState) {
                saveModalState(state.isOpen, state.view);
            }
            
            listeners.forEach((listener) => listener(state));
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
};

export const VIEWS = {
    UPLOAD: 'UPLOAD',
    GENERATING: 'GENERATING',
    RESULTS: 'RESULTS',
    ERROR: 'ERROR',
    QUEUE: 'QUEUE',
};

export const QUEUE_STATUS = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR',
};

export const initialState = {
    isOpen: false,
    view: VIEWS.UPLOAD,
    uploadedImage: null,
    generatedImages: [],
    queue: [], // Array of { id, productId, status, result, timestamp }
    error: null,
    sessionId: null,
    config: {},
    isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
    selectedModel: 'slow', // Always use high quality model
    queueTab: 'all', // Active tab in queue view
    userEmail: '', // optional shopper email; persisted in localStorage
    remoteGenerations: [] // from GET /api/widget/generations
};

export const store = createStore(initialState);

// Flush session synchronously on navigation — avoids losing queue when async saveState hasn't finished
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        isPageUnloading = true;
        persistGeneration += 1;
        try {
            writeSessionSnapshot(store.getState());
        } catch (e) {
            debugLog('Session snapshot on pagehide failed', e);
        }
    });
}

// Actions
export const actions = {
    openModal: (config = {}) => {
        const currentState = store.getState();
        // Merge configs, ensuring we preserve all existing config properties
        const mergedConfig = {
            ...currentState.config,
            ...config
        };

        store.setState({
            isOpen: true,
            config: ensureApiEndpoint(mergedConfig)
        });
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(() => {
                syncShopperGenerationsFromServer();
            });
        }
    },
    /** Optional shopper email (saved on this device + synced to backend for history). Returns a Promise when email is set (sync completes) or resolves immediately when cleared. */
    setUserEmail: (raw) => {
        const trimmed = (raw || '').trim().toLowerCase();
        try {
            setPersistedString(USER_EMAIL_KEY, trimmed);
        } catch (e) {
            debugLog('Could not persist email', e);
        }
        store.setState({ userEmail: trimmed });
        if (trimmed) {
            const api = ensureApiEndpoint(store.getState().config || {});
            const domain = getStorefrontDomain();
            const now = Date.now();
            if (now >= nextShopperRegisterAllowedAt) {
                postWidgetShopper(api.apiEndpoint, trimmed, domain).catch((e) => {
                    if (e && e.status === 429) {
                        nextShopperRegisterAllowedAt = Date.now() + 60_000;
                    } else {
                        nextShopperRegisterAllowedAt = Date.now() + 15_000;
                    }
                    debugLog('shopper register failed', e?.message || e);
                });
            }
            return syncShopperGenerationsFromServer();
        }
        store.setState({ remoteGenerations: [] });
        return Promise.resolve();
    },
    /** Refresh “My previews” from the server (same email + storefront domain). */
    syncShopperGenerations: () => syncShopperGenerationsFromServer(),
    closeModal: () => {
        store.setState({ isOpen: false });
    },
    /**
     * Update product URL/title from the current page + Shopify embed config after navigation.
     * Preserves domainId, apiEndpoint, session — only refreshes product context for new uploads.
     * In-flight queue items keep their own stored productUrl.
     */
    syncThemeConfig: () => {
        if (typeof window === 'undefined') return;
        const cur = store.getState().config || {};
        const themeCfg = window.FURNITURE_AI_CONFIG
            ? createConfig(window.FURNITURE_AI_CONFIG)
            : createConfig({});
        store.setState({
            config: ensureApiEndpoint({
                ...cur,
                ...themeCfg,
                productUrl:
                    (window.FURNITURE_AI_CONFIG && window.FURNITURE_AI_CONFIG.productUrl) ||
                    window.location.href,
                productTitle:
                    (window.FURNITURE_AI_CONFIG && window.FURNITURE_AI_CONFIG.productTitle) ||
                    document.title,
                productImages:
                    (window.FURNITURE_AI_CONFIG && window.FURNITURE_AI_CONFIG.productImages) ||
                    cur.productImages,
                productData:
                    (window.FURNITURE_AI_CONFIG && window.FURNITURE_AI_CONFIG.productData) ||
                    cur.productData,
                shopifyStore:
                    (window.FURNITURE_AI_CONFIG && window.FURNITURE_AI_CONFIG.shopifyStore) ||
                    cur.shopifyStore,
            }),
        });
    },
    setUploadedImage: (file) => {
        const updates = { uploadedImage: file };
        if (file) {
            updates.view = VIEWS.UPLOAD;
        }
        store.setState(updates);
    },
    beginPreviewGeneration: (item) => {
        const queue = store.getState().queue;
        const queueItem = { ...item, status: QUEUE_STATUS.PENDING, timestamp: Date.now() };

        if (
            item.userImage &&
            (item.userImage instanceof File || item.userImage instanceof Blob) &&
            !item.userImageDataUrl
        ) {
            fileToDataURL(item.userImage)
                .then((dataUrl) => {
                    const currentQueue = store.getState().queue;
                    const updatedQueue = currentQueue.map((qi) =>
                        qi.id === queueItem.id ? { ...qi, userImageDataUrl: dataUrl } : qi
                    );
                    store.setState({ queue: updatedQueue });
                })
                .catch((e) => {
                    console.warn('Failed to convert image to data URL for queue item', e);
                });
        }

        store.setState({
            queue: [...queue, queueItem],
            uploadedImage: null,
            view: VIEWS.QUEUE,
            error: null
        });
    },
    startGeneration: () => {
        store.setState({ view: VIEWS.GENERATING, error: null });
    },
    setGenerationResults: (images) => {
        store.setState({
            generatedImages: images,
            view: VIEWS.RESULTS
        });
    },
    setError: (error) => {
        store.setState({
            error,
            view: VIEWS.ERROR
        });
    },
    reset: () => {
        store.setState({
            view: VIEWS.UPLOAD,
            uploadedImage: null,
            generatedImages: [],
            error: null
        });
    },
    updateDimensions: () => {
        store.setState({
            isMobile: window.innerWidth <= 768
        });
    },
    // Queue Actions
    addToQueue: (item) => {
        const queue = store.getState().queue;
        const queueItem = { ...item, status: QUEUE_STATUS.PENDING, timestamp: Date.now() };

        // Legacy: image without data URL yet — convert async (prefer passing userImageDataUrl from UploadView)
        if (
            item.userImage &&
            (item.userImage instanceof File || item.userImage instanceof Blob) &&
            !item.userImageDataUrl
        ) {
            fileToDataURL(item.userImage)
                .then((dataUrl) => {
                    const currentQueue = store.getState().queue;
                    const updatedQueue = currentQueue.map((qi) =>
                        qi.id === queueItem.id ? { ...qi, userImageDataUrl: dataUrl } : qi
                    );
                    store.setState({ queue: updatedQueue });
                })
                .catch((e) => {
                    console.warn('Failed to convert image to data URL for queue item', e);
                });
        }

        store.setState({
            queue: [...queue, queueItem]
        });
    },
    updateQueueItem: (id, updates) => {
        const queue = store.getState().queue.map(item =>
            item.id === id ? { ...item, ...updates } : item
        );
        store.setState({ queue });
    },
    removeFromQueue: (id) => {
        const queue = store.getState().queue.filter(item => item.id !== id);
        store.setState({ queue });
    },
    setView: (view) => {
        store.setState({ view });
    },
    setSelectedModel: (model) => {
        store.setState({ selectedModel: model });
    },
    setQueueTab: (tab) => {
        store.setState({ queueTab: tab });
    },
    clearCompleted: () => {
        const queue = store.getState().queue.filter(item => item.status !== QUEUE_STATUS.COMPLETED);
        store.setState({ queue });
    }
};
