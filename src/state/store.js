/**
 * Simple pub/sub store for widget state management
 * Uses sessionStorage for cross-page persistence within the same session
 */
import { createConfig } from '../config.js';
import { getPersistedString, setPersistedString } from '../utils/persistStorage.js';
import {
    fetchWidgetGenerations,
    getStorefrontDomain,
    postWidgetShopper
} from '../utils/widgetShopperApi.js';

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

/** Strip non-serializable fields; keep userImageDataUrl for restore after navigation. */
function serializeQueueForStorage(queue) {
    return queue.map((item) => {
        const cleanItem = { ...item };
        delete cleanItem.userImage;
        return cleanItem;
    });
}

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

const loadState = () => {
    try {
        const serialized = sessionStorage.getItem(STORAGE_KEY);
        return serialized ? JSON.parse(serialized) : undefined;
    } catch (e) {
        console.warn('Failed to load state', e);
        return undefined;
    }
};

let isPageUnloading = false;

const saveState = async (state) => {
    // Don't let a pending async write overwrite the synchronous pagehide snapshot
    if (isPageUnloading) return;
    try {
        // Persist essential data (queue, generatedImages, selectedModel, queueTab)
        // Store image data as URLs/data URLs for persistence
        const { queue, generatedImages, selectedModel, queueTab } = state;

        // Clean queue items - convert File/Blob to data URLs if needed
        const cleanQueue = await Promise.all(queue.map(async (item) => {
            const cleanItem = { ...item };
            
            // If userImage is a File/Blob and we don't already have a data URL, convert it
            if (item.userImage && (item.userImage instanceof File || item.userImage instanceof Blob)) {
                // Only convert if we don't already have a data URL
                if (!item.userImageDataUrl) {
                    try {
                        cleanItem.userImageDataUrl = await fileToDataURL(item.userImage);
                    } catch (e) {
                        console.warn('Failed to convert image to data URL', e);
                    }
                }
            }
            
            // Remove the File/Blob object (can't be serialized)
            delete cleanItem.userImage;
            
            return cleanItem;
        }));

        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                queue: cleanQueue,
                generatedImages,
                selectedModel,
                queueTab,
                config: ensureApiEndpoint(state.config || {})
            })
        );
    } catch (e) {
        console.warn('Failed to save state', e);
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
        console.warn('Failed to convert data URL to blob', e);
        return null;
    }
};

// Save modal state separately for quick access
const saveModalState = (isOpen, view) => {
    try {
        sessionStorage.setItem(MODAL_STATE_KEY, JSON.stringify({ isOpen, view }));
    } catch (e) {
        console.warn('Failed to save modal state', e);
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
    if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        store.setState({ remoteGenerations: [] });
        return;
    }
    const api = ensureApiEndpoint(config || {});
    const domain = getStorefrontDomain();
    if (!domain) return;
    try {
        const data = await fetchWidgetGenerations(api.apiEndpoint, userEmail, domain);
        store.setState({ remoteGenerations: data.generations || [] });
    } catch (e) {
        console.warn('[AI Furniture] Could not load preview history:', e?.message || e);
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
            saveState(state).catch(e => console.warn('Failed to save state', e));
            
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
        try {
            writeSessionSnapshot(store.getState());
        } catch (e) {
            console.warn('Session snapshot on pagehide failed', e);
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
                if (store.getState().userEmail) {
                    syncShopperGenerationsFromServer();
                }
            });
        }
    },
    /** Optional shopper email (saved on this device + synced to backend for history). Returns a Promise when email is set (sync completes) or resolves immediately when cleared. */
    setUserEmail: (raw) => {
        const trimmed = (raw || '').trim().toLowerCase();
        try {
            setPersistedString(USER_EMAIL_KEY, trimmed);
        } catch (e) {
            console.warn('[AI Furniture] Could not persist email', e);
        }
        store.setState({ userEmail: trimmed });
        if (trimmed) {
            const api = ensureApiEndpoint(store.getState().config || {});
            const domain = getStorefrontDomain();
            postWidgetShopper(api.apiEndpoint, trimmed, domain).catch((e) =>
                console.warn('[AI Furniture] shopper register:', e?.message || e)
            );
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
            }),
        });
    },
    setUploadedImage: (file) => {
        store.setState({
            uploadedImage: file,
            view: VIEWS.UPLOAD
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
