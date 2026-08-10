var AIFurnitureWidget = (function (exports) {
    'use strict';

    // src/config.js

    /** Production AI Furniture API (ai-furniture-backend). */
    const PRODUCTION_BACKEND_ORIGIN = 'https://ai-furniture-backend.vercel.app';

    // Check if running in local development mode
    // Auto-detect: if page is on localhost, use local backend
    // Can also be controlled via:
    // 1. URL parameter: ?aif_local=true
    // 2. Explicit config: initAIFurnitureWidget({ useLocalBackend: true })
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isPageOnLocalhost = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '0.0.0.0');
    const isLocalMode = urlParams?.get('aif_local') === 'true' || isPageOnLocalhost;

    function getDefaultApiEndpoints(localMode = isLocalMode) {
        if (localMode) {
            return {
                apiEndpoint: 'http://localhost:3000/api',
                trackingEndpoint: 'http://localhost:3000/api/tracking/pixel',
                widgetEndpoint: 'http://localhost:3000/furniture',
                debug: true,
            };
        }
        return {
            apiEndpoint: `${PRODUCTION_BACKEND_ORIGIN}/api`,
            trackingEndpoint: `${PRODUCTION_BACKEND_ORIGIN}/api/tracking/pixel`,
            widgetEndpoint: `${PRODUCTION_BACKEND_ORIGIN}/furniture`,
            debug: false,
        };
    }

    // Default configuration
    const DEFAULT_CONFIG = getDefaultApiEndpoints();

    function createConfig(userConfig = {}) {
        let config = { ...DEFAULT_CONFIG };

        if (userConfig.useLocalBackend === true) {
            Object.assign(config, getDefaultApiEndpoints(true));
        } else if (userConfig.useLocalBackend === false) {
            Object.assign(config, getDefaultApiEndpoints(false));
        }

        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const trainingReview =
            userConfig.trainingReview === true || urlParams?.get('aif_training') === '1';

        return {
            ...config,
            ...userConfig,
            trainingReview,
        };
    }

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
    function getPersistedString(key) {
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
    function setPersistedString(key, value) {
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
    function getWidgetAnonymousClientId() {
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

    /**
     * Anonymous shopper preview history — backend /api/widget/* routes.
     */

    function getStorefrontDomain() {
        if (typeof window === 'undefined') return '';
        return window.location.hostname.replace(/^www\./, '');
    }

    function apiBase$1(apiEndpoint) {
        return (apiEndpoint || '').replace(/\/$/, '');
    }

    async function fetchWidgetGenerations(apiEndpoint, { domain, domainId, anonymousClientKey }) {
        const q = new URLSearchParams();
        if (domain) q.set('domain', domain);
        if (domainId) q.set('domainId', domainId);
        if (anonymousClientKey) q.set('anonymousClientKey', anonymousClientKey);
        const res = await fetch(`${apiBase$1(apiEndpoint)}/widget/generations?${q}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                ...(domain ? { 'x-domain': domain } : {}),
                ...(domainId ? { 'x-domain-id': domainId } : {}),
            },
            credentials: 'omit'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    async function postWidgetGeneration(apiEndpoint, payload) {
        const res = await fetch(`${apiBase$1(apiEndpoint)}/widget/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(payload),
            credentials: 'omit'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    /** Start async widget generation (returns immediately; poll with fetchWidgetGenerationStatus). */
    async function startWidgetGeneration(apiEndpoint, formData) {
        const res = await fetch(`${apiBase$1(apiEndpoint)}/widget/generate`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: formData,
            credentials: 'omit'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    /** Poll async generation status by widget queueId. */
    async function fetchWidgetGenerationStatus(apiEndpoint, { queueId, domain, domainId }) {
        const q = new URLSearchParams();
        if (queueId) q.set('queueId', queueId);
        if (domain) q.set('domain', domain);
        if (domainId) q.set('domainId', domainId);
        const res = await fetch(`${apiBase$1(apiEndpoint)}/widget/generate?${q}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'omit'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    // src/debug.js
    // Intentionally has NO imports — store.js imports this, and state.js imports store.
    // A getter is bound after config/store are ready to avoid TDZ / circular init errors.

    let debugEnabledGetter = () => false;

    /** Called from state.js once config wiring is available. */
    function bindDebugEnabled(getter) {
        if (typeof getter === 'function') {
            debugEnabledGetter = getter;
        }
    }

    function debugLog(message, data) {
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

    /**
     * Simple pub/sub store for widget state management
     * Uses sessionStorage for cross-page persistence within the same session
     */

    const STORAGE_KEY = 'ai_furniture_widget_state';
    const MODAL_STATE_KEY = 'ai_furniture_modal_state';

    function ensureApiEndpoint(config) {
        const c = { ...(config || {}) };
        if (!c.apiEndpoint) {
            const isLocalMode =
                typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '0.0.0.0');
            c.apiEndpoint = getDefaultApiEndpoints(isLocalMode).apiEndpoint;
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
    function flushSessionSnapshot() {
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

    let isPageUnloading$1 = false;

    // Dedupe + rate-limit remote history calls (prevents 429 spam)
    let remoteGenerationsInFlight = null;
    let nextRemoteGenerationsAllowedAt = 0;

    const saveState = async () => {
        if (isPageUnloading$1) return;
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

            if (isPageUnloading$1 || myGeneration !== persistGeneration) return;

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
    const fileToDataURL = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Helper to convert data URL back to Blob
    const dataURLToBlob$1 = (dataURL) => {
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

    async function syncShopperGenerationsFromServer() {
        if (typeof window === 'undefined') return;
        const { config } = store.getState();
        const anonKey = getWidgetAnonymousClientId();
        const anonOk = !!anonKey && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(anonKey);

        if (!anonOk) {
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
                domainId: api.domainId,
                anonymousClientKey: anonKey
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

    const createStore = (initialState) => {
        const loaded = loadState();
        const modalState = loadModalState();
        
        // Restore queue items with image data
        let restoredQueue = [];
        if (loaded && loaded.queue) {
            restoredQueue = loaded.queue.map(item => {
                const restored = { ...item };
                // Convert data URL back to Blob if available
                if (item.userImageDataUrl) {
                    restored.userImage = dataURLToBlob$1(item.userImageDataUrl);
                }
                return restored;
            });
        }
        
        let state = {
            ...initialState,
            ...loaded,
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

    const VIEWS = {
        UPLOAD: 'UPLOAD',
        MEASURE: 'MEASURE',
        GENERATING: 'GENERATING',
        RESULTS: 'RESULTS',
        ERROR: 'ERROR',
        QUEUE: 'QUEUE',
    };

    const QUEUE_STATUS = {
        PENDING: 'PENDING',
        PROCESSING: 'PROCESSING',
        COMPLETED: 'COMPLETED',
        ERROR: 'ERROR',
    };

    const initialState = {
        isOpen: false,
        view: VIEWS.UPLOAD,
        uploadedImage: null,
        /** User-estimated width (cm) of the existing piece in the room photo — optional scale cue */
        furnitureWidthCm: null,
        generatedImages: [],
        queue: [], // Array of { id, productId, status, result, timestamp }
        error: null,
        sessionId: null,
        config: {},
        isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
        selectedModel: 'slow', // Always use high quality model
        queueTab: 'all', // Active tab in queue view
        remoteGenerations: [] // from GET /api/widget/generations (anonymous browser key)
    };

    const store = createStore(initialState);

    // Flush session synchronously on navigation — avoids losing queue when async saveState hasn't finished
    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
            isPageUnloading$1 = true;
            persistGeneration += 1;
            try {
                writeSessionSnapshot(store.getState());
            } catch (e) {
                debugLog('Session snapshot on pagehide failed', e);
            }
        });
    }

    // Actions
    const actions = {
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
        /** Refresh “My previews” from the server (anonymous browser key + storefront domain). */
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
                // Keep current view if caller advances (e.g. to MEASURE); default to upload preview
                updates.error = null;
            } else {
                updates.furnitureWidthCm = null;
                updates.view = VIEWS.UPLOAD;
            }
            store.setState(updates);
        },
        setFurnitureWidthCm: (cm) => {
            if (cm == null || cm === '') {
                store.setState({ furnitureWidthCm: null });
                return;
            }
            const n = typeof cm === 'number' ? cm : parseFloat(String(cm).replace(',', '.'));
            if (!Number.isFinite(n) || n <= 0) {
                store.setState({ furnitureWidthCm: null });
                return;
            }
            store.setState({ furnitureWidthCm: Math.round(n * 10) / 10 });
        },
        goToMeasure: () => {
            const { uploadedImage } = store.getState();
            if (!uploadedImage) {
                store.setState({ view: VIEWS.UPLOAD });
                return;
            }
            store.setState({ view: VIEWS.MEASURE, error: null });
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
                furnitureWidthCm: null,
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
                furnitureWidthCm: null,
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

    // src/state.js

    let config = null;
    let sessionId = null;

    bindDebugEnabled(() => {
        try {
            return !!(config?.debug || store.getState()?.config?.debug);
        } catch {
            return false;
        }
    });

    function setConfig(newConfig) {
        config = newConfig;
        // Also update the store's config
        store.setState({ config: newConfig });
    }

    function getConfig() {
        if (!config) {
            throw new Error('AI Furniture: config not set. Call initAIFurnitureWidget first.');
        }
        return config;
    }

    function setSessionId(id) {
        sessionId = id;
    }

    function getSessionId() {
        return sessionId;
    }

    // src/domainVerification.js

    /** Auth is enforced on the backend API — widget UI always loads. */
    function verifyDomain() {
        debugLog('Client domain check skipped (backend validates Domain ID on API calls)');
        return true;
    }

    // src/tracking.js
    // Do NOT import detection.js here — detection imports tracking (circular TDZ risk).

    function isTrackingDebugEnabled(config) {
        try {
            if (config?.debugTracking === true) return true;
            if (typeof window !== 'undefined' && window.__AIFurnitureDebugTracking === true) return true;
        } catch {
            // ignore
        }
        return false;
    }

    function trackingLog(config, ...args) {
        if (!isTrackingDebugEnabled(config)) return;
        // eslint-disable-next-line no-console
        console.log('[AI Furniture Tracking]', ...args);
    }

    function truncateString(v, maxLen) {
        if (v === null || v === undefined) return '';
        const s = typeof v === 'string' ? v : String(v);
        if (s.length <= maxLen) return s;
        return s.slice(0, maxLen);
    }

    function safeJsonStringify(v, maxLen) {
        try {
            return truncateString(JSON.stringify(v), maxLen);
        } catch {
            return '';
        }
    }

    // This will be set from init so tracking can recreate the widget
    let recreateWidgetButtonFn = null;

    function setRecreateWidgetButton(fn) {
        recreateWidgetButtonFn = fn;
    }

    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function initSession() {
        let sessionId = sessionStorage.getItem('ai_furniture_session_id');
        if (!sessionId) {
            sessionId = generateSessionId();
            sessionStorage.setItem('ai_furniture_session_id', sessionId);
        }
        setSessionId(sessionId);
        const config = getConfig();
        debugLog('Widget script loaded', { domain: config.domain, sessionId });
    }

    function trackEvent(eventType, data = {}) {
        const config = getConfig();
        const sessionId = getSessionId();

        const trackingDisconnected = sessionStorage.getItem('tracking_disconnected') === 'true';

        if (trackingDisconnected) {
            debugLog('Skipping tracking - session has timed out and tracking disconnected');
            return;
        }

        trackingLog(config, 'trackEvent()', { eventType, page: window.location.pathname + window.location.search });

        const params = new URLSearchParams({
            sessionId: truncateString(sessionId, 120),
            domain: truncateString(config.domain, 200),
            ...(config.domainId ? { domainId: truncateString(config.domainId, 64) } : {}),
            eventType: truncateString(eventType, 80),
            page: truncateString(window.location.pathname + window.location.search, 500),
            timestamp: new Date().toISOString(),
            userAgent: truncateString(navigator.userAgent, 300),
            referrer: truncateString(document.referrer, 500),
            title: truncateString(document.title, 300),
            url: truncateString(window.location.href, 800)
        });

        for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== undefined) {
                params.append(
                    `data_${truncateString(key, 60)}`,
                    typeof value === 'object' ? safeJsonStringify(value, 800) : truncateString(value, 800)
                );
            }
        }

        // Prefer dedicated trackingEndpoint. Fallback: derive from apiEndpoint.
        let trackingEndpoint = config.trackingEndpoint;
        if (!trackingEndpoint) {
            const apiEndpoint = config.apiEndpoint;
            if (typeof apiEndpoint === 'string' && apiEndpoint.length > 0) {
                trackingEndpoint = apiEndpoint.replace(/\/$/, '') + '/tracking/pixel';
                console.warn(
                    '⚠️ trackingEndpoint was undefined in tracking, derived from apiEndpoint:',
                    trackingEndpoint
                );
            } else {
                // Final fallback to default production/local endpoints
                const isLocalMode =
                    typeof window !== 'undefined' &&
                    (window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname === '0.0.0.0');
                trackingEndpoint = getDefaultApiEndpoints(isLocalMode).trackingEndpoint;
                console.warn('⚠️ trackingEndpoint was undefined in config, using fallback:', trackingEndpoint);
            }
        }

        if (typeof trackingEndpoint !== 'string' || trackingEndpoint.length === 0) {
            console.error('❌ Invalid tracking endpoint, cannot send tracking event');
            return;
        }

        const pixelUrl = `${trackingEndpoint}?${params.toString()}`;

        debugLog('Pixel tracking URL', pixelUrl);
        trackingLog(config, 'pixel', pixelUrl);

        const img = new Image();

        img.onload = function () {
            debugLog('Pixel loaded successfully', { eventType });
            // (keep your special order-confirmation logic here if you want – you can paste it from your original img.onload)
        };

        img.onerror = function () {
            debugLog('Pixel failed to load', { eventType });
            trackingLog(config, 'pixel failed', { eventType });
        };

        img.src = pixelUrl;
    }

    function disconnectAllTracking() {
        debugLog('Disconnecting all tracking - order completed');

        sessionStorage.setItem('tracking_disconnected', 'true');
        sessionStorage.setItem('order_completed_at', new Date().toISOString());
        sessionStorage.setItem('order_completion_reason', 'order_placed');
        setTimeout(() => {
            resetWidget();
        }, 2000);
    }

    function resetWidget() {
        debugLog('Resetting widget - clearing all tracking state');

        sessionStorage.removeItem('ai_furniture_user');
        sessionStorage.removeItem('ai_furniture_session_id');
        sessionStorage.removeItem('aifurniture_session_id');
        sessionStorage.removeItem('tracking_disconnected');
        sessionStorage.removeItem('order_completed_at');
        sessionStorage.removeItem('order_completion_reason');
        sessionStorage.removeItem('session_ended_at');
        sessionStorage.removeItem('ai_furniture_original_url');

        const existingWidget = document.querySelector('#ai-furniture-widget');
        if (existingWidget) {
            existingWidget.remove();
        }

        const newSessionId = generateSessionId();
        sessionStorage.setItem('ai_furniture_session_id', newSessionId);
        setSessionId(newSessionId);

        debugLog('Widget reset complete - user can now use AI Furniture widget again', {
            newSessionId
        });

        showResetMessage();

        if (typeof recreateWidgetButtonFn === 'function') {
            // Lazy import avoids tracking ↔ detection circular init
            Promise.resolve().then(function () { return detection; })
                .then(({ isFurnitureProductPage }) => {
                    if (isFurnitureProductPage()) {
                        setTimeout(() => {
                            recreateWidgetButtonFn();
                        }, 1000);
                    }
                })
                .catch(() => {
                    /* ignore */
                });
        }
    }

    function showResetMessage() {
        const message = document.createElement('div');
        message.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: slideIn 0.3s ease-out;
      ">
        ✅ Order completed! AI Furniture widget refreshed for new session
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

        document.body.appendChild(message);

        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 4000);
    }

    // called by backend
    function onOrderAddedToDatabase(orderData) {
        debugLog('Order successfully added to database - disconnecting tracking immediately', orderData);
        disconnectAllTracking();
    }

    // src/detection.js

    const NON_PRODUCT_SHOPIFY_PAGE_TYPES = new Set([
        'index',
        'home',
        'collection',
        'list-collections',
        'cart',
        'checkout',
        'search',
        'page',
        'blog',
        'article',
        '404',
        'password',
        'gift_card',
        'customers/account',
        'customers/login',
        'customers/register'
    ]);

    function getShopifyPageType() {
        try {
            return String(
                window.ShopifyAnalytics?.meta?.page?.pageType ||
                    window.meta?.page?.pageType ||
                    window.Shopify?.Analytics?.meta?.page?.pageType ||
                    ''
            ).toLowerCase();
        } catch {
            return '';
        }
    }

    function isCatalogPath(pathname) {
        const path = (pathname || '').toLowerCase();

        if (!path || path === '/') return true;

        // Locale-only home paths, e.g. /en or /en-gb
        if (/^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(path)) return true;

        const catalogMarkers = [
            '/collections',
            '/catalog',
            '/category',
            '/categories',
            '/shop',
            '/search',
            '/cart',
            '/checkout',
            '/account',
            '/pages/',
            '/blog',
            '/blogs/',
            '/about',
            '/contact',
            '/home',
            '/index',
            '/brands',
            '/sale',
            '/deals',
            '/tag/',
            '/tags/',
            '/vendor',
            '/vendors',
            '/browse',
            '/store',
            '/listing',
            '/all-products'
        ];

        if (catalogMarkers.some((marker) => path.includes(marker))) return true;
        if (/^\/products\/?$/i.test(path)) return true;

        return false;
    }

    function isProductDetailPath(pathname) {
        const path = (pathname || '').toLowerCase();
        return (
            /\/products\/[^/?#]+/i.test(path) ||
            /\/product\/[^/?#]+/i.test(path) ||
            /\/p\/[^/?#]+/i.test(path) ||
            /\/item\/[^/?#]+/i.test(path)
        );
    }

    function hasJsonLdProduct() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            try {
                const parsed = JSON.parse(script.textContent || '');
                const nodes = Array.isArray(parsed) ? parsed : [parsed];
                for (const node of nodes) {
                    if (!node || typeof node !== 'object') continue;
                    const type = node['@type'];
                    if (type === 'Product') return true;
                    if (Array.isArray(type) && type.includes('Product')) return true;
                    if (Array.isArray(node['@graph'])) {
                        if (node['@graph'].some((g) => g && g['@type'] === 'Product')) return true;
                    }
                }
            } catch {
                /* ignore invalid JSON-LD */
            }
        }
        return false;
    }

    function hasOpenGraphProduct() {
        const ogType = document
            .querySelector('meta[property="og:type"]')
            ?.getAttribute('content')
            ?.toLowerCase();
        return ogType === 'product';
    }

    function hasSingleProductDetailSignals() {
        const detailRoot =
            document.querySelector(
                '[data-product-id], [data-product-handle], .product-single, .product-detail, #product-detail, .productView, .product-page'
            ) || document.querySelector('main .product, #product');

        if (!detailRoot) return false;

        const addToCart =
            detailRoot.querySelector(
                'form[action*="/cart/add"], form[action*="add-to-cart"], [data-add-to-cart], button[name="add"], input[name="add"]'
            ) ||
            document.querySelector('form[action*="/cart/add"], form[action*="add-to-cart"]');

        if (!addToCart) return false;

        const inListing = addToCart.closest(
            '[class*="collection"], [class*="grid"], [class*="carousel"], [class*="slider"], [class*="listing"], [class*="catalog"]'
        );
        return !inListing;
    }

    function isFurnitureProductPage() {
        const path = window.location.pathname;
        const shopifyPageType = getShopifyPageType();

        if (shopifyPageType === 'product') return true;
        if (shopifyPageType && NON_PRODUCT_SHOPIFY_PAGE_TYPES.has(shopifyPageType)) {
            return false;
        }

        if (isCatalogPath(path)) return false;
        if (isProductDetailPath(path)) return true;

        if (hasOpenGraphProduct()) return true;

        if (hasJsonLdProduct() && hasSingleProductDetailSignals()) {
            return true;
        }

        return false;
    }

    /**
     * Detect cart and order pages for AI Furniture users
     */
    function detectCartAndOrderPages() {
        // Only track if user has used AI Furniture
        const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';
        if (!isAIFurnitureUser) {
            debugLog('Skipping cart/order page detection - user has not used AI Furniture');
            return {
                isCartPage: false,
                isOrderPage: false,
                pageType: 'product'
            };
        }

        const currentUrl = window.location.href.toLowerCase();
        const currentPath = window.location.pathname.toLowerCase();
        const pageTitle = document.title.toLowerCase();
        const bodyText = document.body.textContent.toLowerCase();

        // If we're clearly on a product page, only trust strong URL/path matches for cart/checkout.
        const looksLikeProductPage =
            isFurnitureProductPage() || currentPath.startsWith('/products/') || currentPath.includes('/product');

        // Cart page detection patterns
        const cartPatterns = [
            // URL patterns
            /\/cart/,
            /\/basket/,
            /\/shopping-cart/,
            /\/checkout\/cart/,
            /\/cart\.html/,
            /\/basket\.html/,
            /\/shopping-cart\.html/,
            // Query parameters
            /[?&]cart/,
            /[?&]basket/,
            /[?&]add-to-cart/,
            // Page title patterns
            /cart/,
            /basket/,
            /shopping cart/,
            /your cart/,
            /shopping bag/,
            // Body text patterns
            /cart total/,
            /basket total/,
            /shopping cart/,
            /proceed to checkout/,
            /update cart/,
            /remove from cart/,
            /empty cart/,
            /cart is empty/
        ];

        // Order/checkout page detection patterns
        const orderPatterns = [
            // URL patterns
            /\/checkout/,
            /\/order/,
            /\/payment/,
            /\/billing/,
            /\/shipping/,
            /\/review/,
            /\/confirm/,
            /\/success/,
            /\/thank-you/,
            /\/order-confirmation/,
            /\/checkout\/success/,
            /\/order\/success/,
            /\/payment\/success/,
            /\/checkout\.html/,
            /\/order\.html/,
            /\/payment\.html/,
            /\/success\.html/,
            /\/thank-you\.html/,
            // Query parameters
            /[?&]checkout/,
            /[?&]order/,
            /[?&]payment/,
            /[?&]success/,
            /[?&]order_id/,
            /[?&]transaction_id/,
            // Page title patterns
            /checkout/,
            /order/,
            /payment/,
            /billing/,
            /shipping/,
            /review order/,
            /order confirmation/,
            /payment confirmation/,
            /thank you/,
            /order successful/,
            /payment successful/,
            // Body text patterns
            /billing information/,
            /shipping information/,
            /payment method/,
            /order summary/,
            /total amount/,
            /place order/,
            /complete purchase/,
            /order confirmed/,
            /payment successful/,
            /thank you for your order/,
            /order number/,
            /confirmation number/,
            /transaction id/
        ];

        const strongCartMatch =
            /(^|\/)cart(\/|$)/i.test(currentPath) || /\/checkout\/cart(\/|$)/i.test(currentPath);
        const strongOrderMatch =
            /(^|\/)checkout(\/|$)/i.test(currentPath) ||
            /(^|\/)order(\/|$)/i.test(currentPath) ||
            /(^|\/)payment(\/|$)/i.test(currentPath);

        const weakCartMatch = cartPatterns.some(
            (pattern) => pattern.test(pageTitle) || pattern.test(bodyText) || pattern.test(currentUrl)
        );
        const weakOrderMatch = orderPatterns.some(
            (pattern) => pattern.test(pageTitle) || pattern.test(bodyText) || pattern.test(currentUrl)
        );

        const isCartPage = looksLikeProductPage ? strongCartMatch : strongCartMatch || weakCartMatch;
        const isOrderPage = looksLikeProductPage ? strongOrderMatch : strongOrderMatch || weakOrderMatch;

        let pageType = 'product';
        if (isCartPage) {
            pageType = 'cart';
        } else if (isOrderPage) {
            pageType = 'order';
        }

        if (isCartPage || isOrderPage) {
            const eventData = {
                pageType,
                url: window.location.href,
                title: document.title,
                detectedBy: 'generalized_detection'
            };

            const aiFurnitureSessionId = sessionStorage.getItem('ai_furniture_session_id');
            eventData.aiFurnitureUser = true;
            eventData.aiFurnitureSessionId = aiFurnitureSessionId;
            eventData.eventType = `ai_furniture_user_${pageType}_page_visit`;

            trackEvent(`${pageType}_page_visit`, eventData);

            debugLog(`${pageType} page detected:`, {
                url: window.location.href,
                title: document.title,
                pageType,
                aiFurnitureUser: isAIFurnitureUser
            });

            if (
                isOrderPage &&
                (currentUrl.includes('success') ||
                    currentUrl.includes('thank') ||
                    currentUrl.includes('confirmation') ||
                    currentUrl.includes('complete'))
            ) {
                debugLog(
                    'Order confirmation page detected - continuing to track until order confirmed in database'
                );
            }
        }

        return {
            isCartPage,
            isOrderPage,
            pageType
        };
    }

    /**
     * Detect hard order confirmation URLs with ?order=... and send explicit events
     */
    function trackOrderConfirmationPage() {
        const currentPage = window.location.pathname + window.location.search;

        const orderConfirmationPatterns = [
            /\/confirmation\?order=[A-Z0-9-]+/i,
            /\/success\?order=[A-Z0-9-]+/i,
            /\/thank-you\?order=[A-Z0-9-]+/i,
            /\/order-confirmation\?order=[A-Z0-9-]+/i,
            /\/checkout\/success\?order=[A-Z0-9-]+/i,
            /\/order\/success\?order=[A-Z0-9-]+/i,
            /\/payment\/success\?order=[A-Z0-9-]+/i
        ];

        const isOrderConfirmation = orderConfirmationPatterns.some(pattern =>
            pattern.test(currentPage)
        );

        if (isOrderConfirmation) {
            const orderMatch = currentPage.match(/[?&]order[=_-]([A-Z0-9-]+)/i);
            const orderId = orderMatch ? orderMatch[1] : null;

            if (orderId) {
                sessionStorage.removeItem('tracking_disconnected');
                sessionStorage.removeItem('order_completed_at');
                sessionStorage.removeItem('order_completion_reason');

                trackEvent('order_confirmation_detected', {
                    orderId: orderId,
                    confirmationPage: currentPage,
                    isOrderConfirmation: true
                });

                trackEvent('order_page_visit', {
                    orderId: orderId,
                    page: currentPage,
                    isOrderConfirmation: true
                });
                setTimeout(() => {
                    disconnectAllTracking();
                }, 10000);

                return true;
            }
        }

        return false;
    }

    var detection = /*#__PURE__*/Object.freeze({
        __proto__: null,
        detectCartAndOrderPages: detectCartAndOrderPages,
        isFurnitureProductPage: isFurnitureProductPage,
        trackOrderConfirmationPage: trackOrderConfirmationPage
    });

    /**
     * Mobile safe-area + visual viewport sync for embedded storefronts (often lack viewport-fit=cover).
     */

    function probeInset(prop) {
        if (typeof document === 'undefined') return 0;
        const el = document.createElement('div');
        el.style.cssText = [
            'position:fixed',
            'visibility:hidden',
            'pointer-events:none',
            `padding-${prop}:env(safe-area-inset-${prop})`
        ].join(';');
        document.documentElement.appendChild(el);
        const value = parseFloat(getComputedStyle(el).getPropertyValue(`padding-${prop}`)) || 0;
        el.remove();
        return value;
    }

    function isNotchIphone() {
        if (!/iPhone/i.test(navigator.userAgent || '')) return false;
        const h = Math.max(window.screen.height, window.screen.width);
        const w = Math.min(window.screen.height, window.screen.width);
        return h >= 812 && w >= 375;
    }

    function isAndroidMobile() {
        return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && window.innerWidth <= 768;
    }

    function applyInsetFallbacks(insets) {
        let { top, bottom, left, right } = insets;

        if (isNotchIphone() && top === 0 && bottom === 0) {
            top = 47;
            bottom = 34;
        }

        if (isAndroidMobile()) {
            if (top === 0) top = 32;
            if (right === 0) right = 12;
            if (left === 0) left = 12;
        }

        if (window.visualViewport && window.visualViewport.offsetTop > 0) {
            top = Math.max(top, Math.round(window.visualViewport.offsetTop));
        }

        return { top, bottom, left, right };
    }

    function syncMobileLayoutVars() {
        if (typeof document === 'undefined' || typeof window === 'undefined') return;

        const root = document.documentElement;
        const raw = {
            top: probeInset('top'),
            bottom: probeInset('bottom'),
            left: probeInset('left'),
            right: probeInset('right')
        };
        const { top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight } =
            applyInsetFallbacks(raw);

        const vvh = Math.round(window.visualViewport?.height || window.innerHeight);
        const drawerHeight = Math.max(320, vvh - safeTop);

        root.style.setProperty('--aif-safe-top', `${safeTop}px`);
        root.style.setProperty('--aif-safe-bottom', `${safeBottom}px`);
        root.style.setProperty('--aif-safe-left', `${safeLeft}px`);
        root.style.setProperty('--aif-safe-right', `${safeRight}px`);
        root.style.setProperty('--aif-vvh', `${vvh}px`);
        root.style.setProperty('--aif-drawer-height', `${drawerHeight}px`);

        const container = document.querySelector('#ai-furniture-modal .aif-container');
        if (container && window.innerWidth <= 768) {
            container.style.top = `${safeTop}px`;
            container.style.left = `${safeLeft}px`;
            container.style.right = `${safeRight}px`;
            container.style.width = 'auto';
            container.style.height = `${drawerHeight}px`;
            container.style.maxHeight = `${drawerHeight}px`;
        } else if (container) {
            container.style.top = '';
            container.style.left = '';
            container.style.right = '';
            container.style.width = '';
            container.style.height = '';
            container.style.maxHeight = '';
        }

        const trigger = document.getElementById('ai-furniture-trigger-btn');
        if (trigger) {
            const isMobile = window.innerWidth <= 768;
            const base = isMobile ? 16 : 20;
            trigger.style.bottom = `${Math.max(base, safeBottom + 12)}px`;
            trigger.style.right = `${Math.max(base, safeRight + 12)}px`;
        }
    }

    let initialized = false;

    function initMobileLayout() {
        if (initialized || typeof window === 'undefined') return;
        initialized = true;

        syncMobileLayoutVars();

        window.visualViewport?.addEventListener('resize', syncMobileLayoutVars);
        window.visualViewport?.addEventListener('scroll', syncMobileLayoutVars);
        window.addEventListener('resize', syncMobileLayoutVars);
        window.addEventListener('orientationchange', () => {
            setTimeout(syncMobileLayoutVars, 80);
            setTimeout(syncMobileLayoutVars, 320);
        });
    }

    // src/ui/widgetButton.js

    const TRIGGER_ICON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v12H4V7z"/><circle cx="12" cy="13" r="3.25"/></svg>`;

    function removeWidgetButton() {
        const button = document.getElementById('ai-furniture-trigger-btn');
        if (button) button.remove();
    }

    function removeWidgetModal() {
        const modal = document.getElementById('ai-furniture-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    function showWidgetModalShell() {
        const modal = document.getElementById('ai-furniture-modal');
        if (modal) {
            modal.style.display = '';
            modal.removeAttribute('aria-hidden');
        }
    }

    function createWidgetButton() {
        if (!isFurnitureProductPage()) return;

        if (document.getElementById('ai-furniture-trigger-btn')) return;

        const isMobile =
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            window.innerWidth <= 768 ||
            'ontouchstart' in window;

        const button = document.createElement('div');
        button.id = 'ai-furniture-trigger-btn';
        button.className = 'aif-trigger-btn';
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        button.setAttribute('data-aif-state', 'idle');
        button.setAttribute('aria-label', 'See this product in your room');

        const icon = document.createElement('span');
        icon.className = 'aif-trigger-btn__icon';
        icon.innerHTML = TRIGGER_ICON_SVG;
        button.appendChild(icon);

        const text = document.createElement('span');
        text.className = 'aif-trigger-btn__label';
        text.textContent = 'See in my room';
        button.appendChild(text);

        const badge = document.createElement('span');
        badge.className = 'aif-trigger-btn__badge';
        badge.hidden = true;
        button.appendChild(badge);

        if (!isMobile) {
            button.addEventListener('mouseenter', () => {
                if (!button.classList.contains('is-visible')) return;
                button.style.transform = 'translateY(-3px) scale(1.02)';
            });
            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('is-visible')) return;
                button.style.transform = '';
            });
        }

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleWidgetClick();
        });

        if (isMobile) {
            let touchStartTime = 0;
            button.addEventListener(
                'touchstart',
                () => {
                    touchStartTime = Date.now();
                    button.style.transform = 'scale(0.96)';
                },
                { passive: true }
            );

            button.addEventListener(
                'touchend',
                (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    button.style.transform = '';
                    if (Date.now() - touchStartTime < 300) {
                        handleWidgetClick();
                    }
                },
                { passive: false }
            );
        }

        store.subscribe((state) => {
            const processingCount = state.queue.filter(
                (i) => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING
            ).length;
            const completedCount = state.queue.filter((i) => i.status === QUEUE_STATUS.COMPLETED).length;

            const label = button.querySelector('.aif-trigger-btn__label');
            if (!label) return;

            if (processingCount > 0) {
                label.textContent = 'Analysing room…';
                button.dataset.aifState = 'processing';
            } else if (completedCount > 0) {
                label.textContent = 'View preview';
                button.dataset.aifState = 'ready';
            } else {
                label.textContent = 'See in my room';
                button.dataset.aifState = 'idle';
            }
        });

        document.body.appendChild(button);
        debugLog('Widget button added to body (floating bottom-right)');

        requestAnimationFrame(() => {
            setTimeout(() => {
                button.classList.add('is-visible');
            }, 80);
        });

        syncMobileLayoutVars();
        repositionWidgetButton();
    }

    function handleWidgetClick() {
        const productUrl = window.location.href;
        const state = store.getState();

        trackEvent('widget_opened', {
            productUrl,
            productName: document.title,
            hasQueueItems: state.queue && state.queue.length > 0,
            queueCount: state.queue ? state.queue.length : 0
        });

        try {
            sessionStorage.setItem('ai_furniture_user', 'true');
        } catch (e) {
            console.warn('⚠️ Could not save user state to sessionStorage:', e.message);
        }

        const processing = state.queue?.some(
            (i) => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING
        );
        const latestCompleted = state.queue
            ?.filter((i) => i.status === QUEUE_STATUS.COMPLETED && i.result?.generatedImageUrl)
            .sort((a, b) => (b.completedAt || b.queuedAt || 0) - (a.completedAt || a.queuedAt || 0))[0];

        actions.openModal({ productUrl });

        if (processing) {
            actions.setView(VIEWS.QUEUE);
        } else if (latestCompleted) {
            actions.setGenerationResults([
                {
                    url: latestCompleted.result.generatedImageUrl,
                    originalImageUrl:
                        latestCompleted.result?.originalImageUrl || latestCompleted.userImageUrl || '',
                    originalAspectRatio: latestCompleted.result?.originalAspectRatio,
                    originalWidth: latestCompleted.result?.originalWidth,
                    originalHeight: latestCompleted.result?.originalHeight,
                    imageS3Key:
                        latestCompleted.result?.imageS3Key || latestCompleted.imageS3Key || null
                }
            ]);
        } else {
            actions.setView(VIEWS.UPLOAD);
        }
    }

    function repositionWidgetButton() {
        const button = document.getElementById('ai-furniture-trigger-btn');
        if (!button) return;

        const isMobile =
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            window.innerWidth <= 768 ||
            'ontouchstart' in window;

        const otherWidgets = ['#intercom-container', '#launcher', '#drift-widget'];

        const root = document.documentElement;
        const safeBottom = parseFloat(root.style.getPropertyValue('--aif-safe-bottom')) ||
            parseFloat(getComputedStyle(root).getPropertyValue('--aif-safe-bottom')) || 0;
        const safeRight = parseFloat(root.style.getPropertyValue('--aif-safe-right')) ||
            parseFloat(getComputedStyle(root).getPropertyValue('--aif-safe-right')) || 0;

        let bottomOffset = Math.max(isMobile ? 16 : 20, safeBottom + 12);
        let rightOffset = Math.max(isMobile ? 16 : 20, safeRight + 12);

        otherWidgets.forEach((selector) => {
            if (document.querySelector(selector)) {
                bottomOffset = Math.max(isMobile ? 80 : 100, bottomOffset);
            }
        });

        button.style.bottom = `${bottomOffset}px`;
        button.style.right = `${rightOffset}px`;
    }

    /**
     * Reusable Button Component
     */

    const Button = ({
        text,
        onClick,
        disabled = false,
        loading = false,
        variant = 'primary',
        className = ''
    }) => {
        const button = document.createElement('button');
        button.className = `aif-btn-${variant} ${className}`;
        button.disabled = disabled || loading;

        if (loading) {
            const spinner = document.createElement('div');
            spinner.className = 'aif-spinner';
            button.appendChild(spinner);

            const span = document.createElement('span');
            span.textContent = ' ' + text;
            button.appendChild(span);

            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.gap = '8px';
        } else {
            button.textContent = text;
        }

        button.addEventListener('click', onClick);

        return button;
    };

    /**
     * Normalize + compress a room photo in the browser before upload.
     * Vercel rejects request bodies over ~4.5MB (413) before the server can compress.
     *
     * Gallery vs camera inconsistency fix:
     * - Always bake EXIF orientation into pixels (gallery JPEGs often have Orientation=6/8)
     * - Prefer createImageBitmap (high-quality resize + consistent orientation)
     * - Always emit upright sRGB JPEG so Gemini sees the same kind of input
     */

    const DEFAULT_MAX_SIDE = 2048;
    const DEFAULT_MAX_BYTES = 2.4 * 1024 * 1024;
    const MIN_QUALITY = 0.55;
    const START_QUALITY = 0.92;
    /** Skip re-encode only for our own already-normalized outputs. */
    const NORMALIZED_NAME = 'room.jpg';

    function scaleDimensions(width, height, maxSide) {
        if (width <= maxSide && height <= maxSide) {
            return { width, height };
        }
        const ratio = Math.min(maxSide / width, maxSide / height);
        return {
            width: Math.max(1, Math.round(width * ratio)),
            height: Math.max(1, Math.round(height * ratio))
        };
    }

    function loadImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Could not read image'));
            };
            img.src = url;
        });
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Could not compress image'));
                },
                type,
                quality
            );
        });
    }

    function isJpegType(type) {
        const t = (type || '').toLowerCase().split(';')[0].trim();
        return t === 'image/jpeg' || t === 'image/jpg';
    }

    /**
     * Decode with orientation applied. Gallery photos often need this; camera captures
     * usually already look upright but we treat both the same for consistency.
     */
    async function decodeOrientedBitmap(blob, resizeWidth, resizeHeight) {
        if (typeof createImageBitmap === 'function') {
            try {
                const opts = {
                    imageOrientation: 'from-image',
                    colorSpaceConversion: 'default',
                };
                if (resizeWidth && resizeHeight) {
                    opts.resizeWidth = resizeWidth;
                    opts.resizeHeight = resizeHeight;
                    opts.resizeQuality = 'high';
                }
                return await createImageBitmap(blob, opts);
            } catch {
                // Fall through — older WebViews / odd HEIC
            }

            // Retry without resize options (some browsers reject resizeQuality)
            try {
                return await createImageBitmap(blob, {
                    imageOrientation: 'from-image',
                    colorSpaceConversion: 'default',
                });
            } catch {
                // Fall through to Image()
            }
        }

        return null;
    }

    /**
     * @param {File|Blob} fileOrBlob
     * @param {{ maxSide?: number, maxBytes?: number }} [options]
     * @returns {Promise<File>}
     */
    async function compressRoomImage(fileOrBlob, options = {}) {
        if (typeof document === 'undefined') {
            if (fileOrBlob instanceof File) return fileOrBlob;
            return new File([fileOrBlob], NORMALIZED_NAME, { type: fileOrBlob.type || 'image/jpeg' });
        }

        const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE;
        const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
        const input =
            fileOrBlob instanceof Blob
                ? fileOrBlob
                : new Blob([fileOrBlob], { type: 'image/jpeg' });

        // Second-pass short circuit: already our normalized JPEG under limits
        if (
            fileOrBlob instanceof File &&
            fileOrBlob.name === NORMALIZED_NAME &&
            isJpegType(fileOrBlob.type) &&
            fileOrBlob.size <= maxBytes
        ) {
            try {
                const probe = await decodeOrientedBitmap(input);
                if (probe) {
                    const ok = probe.width <= maxSide && probe.height <= maxSide;
                    const w = probe.width;
                    const h = probe.height;
                    probe.close?.();
                    if (ok) return fileOrBlob;
                    // need resize — fall through with known dims unused
                    void w;
                    void h;
                }
            } catch {
                // re-encode below
            }
        }

        let width;
        let height;
        let source;

        // Probe natural size (oriented)
        const probeBitmap = await decodeOrientedBitmap(input);
        if (probeBitmap) {
            width = probeBitmap.width;
            height = probeBitmap.height;
            probeBitmap.close?.();
        } else {
            const img = await loadImageFromBlob(input);
            width = img.naturalWidth || img.width;
            height = img.naturalHeight || img.height;
            source = img;
        }

        if (!width || !height) {
            throw new Error('Could not read image dimensions');
        }

        const target = scaleDimensions(width, height, maxSide);

        // Prefer bitmap decode+resize in one step when available
        let bitmap = null;
        if (!source) {
            bitmap = await decodeOrientedBitmap(input, target.width, target.height);
            if (bitmap && (bitmap.width !== target.width || bitmap.height !== target.height)) ;
        }

        const canvas = document.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const ctx =
            canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' }) ||
            canvas.getContext('2d', { alpha: false }) ||
            canvas.getContext('2d');
        if (!ctx) throw new Error('Could not compress image');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Neutral background (avoids black edges if anything is weird)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, target.width, target.height);

        if (bitmap) {
            ctx.drawImage(bitmap, 0, 0, target.width, target.height);
            bitmap.close?.();
        } else if (source) {
            ctx.drawImage(source, 0, 0, target.width, target.height);
        } else {
            const img = await loadImageFromBlob(input);
            ctx.drawImage(img, 0, 0, target.width, target.height);
        }

        let quality = START_QUALITY;
        let outBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
        while (outBlob.size > maxBytes && quality > MIN_QUALITY) {
            quality -= 0.05;
            outBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
        }

        // Last resort: shrink dimensions further if still huge
        let side = maxSide;
        while (outBlob.size > maxBytes && side > 1280) {
            side = Math.floor(side * 0.85);
            const smaller = scaleDimensions(width, height, side);
            canvas.width = smaller.width;
            canvas.height = smaller.height;
            // Resizing canvas resets the context
            const shrinkCtx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
            if (!shrinkCtx) break;
            shrinkCtx.imageSmoothingEnabled = true;
            shrinkCtx.imageSmoothingQuality = 'high';
            shrinkCtx.fillStyle = '#ffffff';
            shrinkCtx.fillRect(0, 0, smaller.width, smaller.height);

            const again = await decodeOrientedBitmap(input, smaller.width, smaller.height);
            if (again) {
                shrinkCtx.drawImage(again, 0, 0, smaller.width, smaller.height);
                again.close?.();
            } else {
                const img = await loadImageFromBlob(input);
                shrinkCtx.drawImage(img, 0, 0, smaller.width, smaller.height);
            }
            outBlob = await canvasToBlob(canvas, 'image/jpeg', Math.max(quality, MIN_QUALITY));
        }

        return new File([outBlob], NORMALIZED_NAME, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });
    }

    /**
     * Upload View Component
     */

    async function handleRoomPhotoSelected(file, source) {
        const compressed = await compressRoomImage(file);
        actions.setUploadedImage(compressed);

        const currentState = store.getState();
        const productUrl = currentState.config?.productUrl || window.location.href;
        const productName = currentState.config?.productTitle || document.title;

        trackEvent('image_uploaded', {
            productUrl,
            productName,
            imageSize: compressed.size,
            imageType: compressed.type,
            fileName: file.name,
            source,
            originalSize: file.size
        });

        // Fluid next step: scale cue before generation
        trackEvent('measure_step_opened', { productUrl, source });
        actions.goToMeasure();
    }

    const UploadView = (state) => {
        const container = document.createElement('div');
        container.className = 'aif-upload-view';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.height = '100%';
        container.style.minHeight = '0';
        container.style.overflow = 'hidden';

        const header = document.createElement('div');
        header.className = 'aif-header';
        header.innerHTML = `
    <span class="aif-eyebrow">Room preview</span>
    <h2>See it in your space</h2>
    <p>Snap your room once — we'll place this piece where it belongs.</p>
  `;
        container.appendChild(header);

        if (state.error) {
            const errorBox = document.createElement('div');
            errorBox.style.padding = '12px';
            errorBox.style.background = '#fee2e2';
            errorBox.style.color = '#b91c1c';
            errorBox.style.borderRadius = '8px';
            errorBox.style.fontSize = '13px';
            errorBox.textContent = state.error;
            container.appendChild(errorBox);
        }

        const uploadArea = document.createElement('div');
        uploadArea.style.flex = '1';
        uploadArea.style.minHeight = '0';
        uploadArea.style.overflow = 'hidden';
        uploadArea.style.display = 'flex';
        uploadArea.style.flexDirection = 'column';

        if (state.uploadedImage) {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'aif-upload-stage';
            previewContainer.style.position = 'relative';
            previewContainer.style.borderRadius = '12px';
            previewContainer.style.overflow = 'hidden';
            previewContainer.style.background = '#f1f5f9';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(state.uploadedImage);
            img.style.objectFit = 'contain';

            const changeBtn = document.createElement('button');
            changeBtn.textContent = 'Change photo';
            changeBtn.style.position = 'absolute';
            changeBtn.style.bottom = '12px';
            changeBtn.style.right = '12px';
            changeBtn.style.padding = '6px 12px';
            changeBtn.style.background = 'rgba(255,255,255,0.9)';
            changeBtn.style.border = '1px solid rgba(0,0,0,0.1)';
            changeBtn.style.borderRadius = '6px';
            changeBtn.style.fontSize = '12px';
            changeBtn.style.cursor = 'pointer';
            changeBtn.onclick = () => actions.setUploadedImage(null);

            previewContainer.appendChild(img);
            previewContainer.appendChild(changeBtn);
            uploadArea.appendChild(previewContainer);
        } else {
            const dropzoneContainer = document.createElement('div');
            dropzoneContainer.className = 'aif-dropzone';

            const icon = document.createElement('div');
            icon.className = 'aif-dropzone-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v12H4V7z"/><circle cx="12" cy="13" r="3.25"/></svg>`;
            dropzoneContainer.appendChild(icon);

            const title = document.createElement('p');
            title.className = 'aif-dropzone-title';
            title.textContent = 'Add a room photo';
            dropzoneContainer.appendChild(title);

            const isMobile =
                /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;

            const note = document.createElement('p');
            note.className = 'aif-dropzone-note';
            note.textContent = isMobile
                ? 'Tip: a fresh camera photo usually beats an old gallery shot (lighting + sharpness).'
                : 'Natural light and a straight-on angle work best.';
            dropzoneContainer.appendChild(note);

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.id = 'aif-file-input-' + Date.now();
            fileInput.style.display = 'none';
            fileInput.onchange = async (e) => {
                if (e.target.files[0]) {
                    try {
                        await handleRoomPhotoSelected(e.target.files[0], 'gallery');
                    } catch (err) {
                        console.error('Failed to process image:', err);
                        actions.setError(err.message || 'Could not process image');
                    }
                }
            };

            const cameraInput = document.createElement('input');
            cameraInput.type = 'file';
            cameraInput.accept = 'image/*';
            cameraInput.setAttribute('capture', 'environment');
            cameraInput.id = 'aif-camera-input-' + Date.now();
            cameraInput.style.display = 'none';
            cameraInput.onchange = async (e) => {
                if (e.target.files[0]) {
                    try {
                        await handleRoomPhotoSelected(e.target.files[0], 'camera');
                    } catch (err) {
                        console.error('Failed to process image:', err);
                        actions.setError(err.message || 'Could not process image');
                    }
                }
            };

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'aif-upload-actions';

            if (isMobile) {
                const cameraLabel = document.createElement('label');
                cameraLabel.htmlFor = cameraInput.id;
                cameraLabel.className = 'aif-upload-cta aif-upload-cta--primary';
                cameraLabel.innerHTML = '<span aria-hidden="true">📷</span><span>Take a photo</span>';
                buttonContainer.appendChild(cameraLabel);
            }

            const uploadLabel = document.createElement('label');
            uploadLabel.htmlFor = fileInput.id;
            uploadLabel.className = isMobile
                ? 'aif-upload-cta aif-upload-cta--secondary'
                : 'aif-upload-cta aif-upload-cta--primary';
            uploadLabel.innerHTML = isMobile
                ? '<span aria-hidden="true">🖼️</span><span>Choose from gallery</span>'
                : '<span aria-hidden="true">🖼️</span><span>Choose a photo</span>';
            buttonContainer.appendChild(uploadLabel);

            dropzoneContainer.appendChild(fileInput);
            dropzoneContainer.appendChild(cameraInput);
            dropzoneContainer.appendChild(buttonContainer);
            uploadArea.appendChild(dropzoneContainer);
        }

        container.appendChild(uploadArea);

        const footer = document.createElement('div');
        footer.style.marginTop = 'auto';

        const continueBtn = Button({
            text: 'Continue',
            disabled: !state.uploadedImage,
            onClick: () => {
                if (!state.uploadedImage) return;
                trackEvent('measure_step_opened', {
                    productUrl: store.getState().config?.productUrl || window.location.href,
                });
                actions.goToMeasure();
            },
        });

        footer.appendChild(continueBtn);

        const note = document.createElement('p');
        note.className = 'aif-upload-privacy';
        note.textContent = state.uploadedImage
            ? 'Next: a quick size check so placement matches your room.'
            : 'Your photo is only used to generate this preview.';
        footer.appendChild(note);

        container.appendChild(footer);

        return container;
    };

    /**
     * Scale cue step — collect approximate width of the piece being replaced
     * so placement can match real-world size in the room photo.
     */

    const CHIP_SETS = {
        sofa: [140, 160, 180, 200, 220, 240, 280],
        bed: [90, 120, 135, 150, 180],
        diningTable: [120, 140, 160, 180, 200, 220],
        coffeeTable: [80, 100, 120, 140],
        default: [100, 120, 140, 160, 180, 200, 220],
    };

    function inferPieceKind(productName = '', productUrl = '') {
        const text = `${productName} ${productUrl}`.toLowerCase();
        if (/\b(sofa|couch|settee|sectional|loveseat)\b/.test(text)) return 'sofa';
        if (/\b(bed|mattress|headboard)\b/.test(text)) return 'bed';
        if (/\b(coffee\s+table|cocktail\s+table)\b/.test(text)) return 'coffeeTable';
        if (/\b(dining\s+table|kitchen\s+table|dining\s+set)\b/.test(text)) return 'diningTable';
        if (/\btable\b/.test(text)) return 'diningTable';
        return 'default';
    }

    function pieceLabel(kind) {
        switch (kind) {
            case 'sofa':
                return 'sofa';
            case 'bed':
                return 'bed';
            case 'coffeeTable':
                return 'coffee table';
            case 'diningTable':
                return 'table';
            default:
                return 'piece';
        }
    }

    function parseCustomCm(raw) {
        if (raw == null || raw === '') return null;
        const n = parseFloat(String(raw).replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!Number.isFinite(n) || n < 30 || n > 600) return null;
        return Math.round(n * 10) / 10;
    }

    async function startGeneration({ furnitureWidthCm }) {
        const currentState = store.getState();
        const image = currentState.uploadedImage;
        if (!image) {
            actions.setView(VIEWS.UPLOAD);
            return;
        }

        const productUrl = currentState.config?.productUrl || window.location.href;
        const productName = currentState.config?.productTitle || document.title || productUrl;
        const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const userImageDataUrl = await fileToDataURL(image);

        const payload = {
            id: queueId,
            productUrl,
            productName,
            userImage: image,
            userImageDataUrl,
            selectedModel: 'slow',
            config: currentState.config || {},
            queuedAt: Date.now(),
        };

        if (typeof furnitureWidthCm === 'number' && furnitureWidthCm > 0) {
            payload.furnitureWidthCm = furnitureWidthCm;
        }

        actions.beginPreviewGeneration(payload);
        flushSessionSnapshot();

        trackEvent('ai_generation_started', {
            queueId,
            productUrl,
            productName,
            model: 'slow',
            imageSize: image?.size || 0,
            furnitureWidthCm: payload.furnitureWidthCm || null,
            hasScaleCue: Boolean(payload.furnitureWidthCm),
        });
    }

    const MeasureView = (state) => {
        const container = document.createElement('div');
        container.className = 'aif-measure-view';

        const productName = state.config?.productTitle || document.title || '';
        const productUrl = state.config?.productUrl || '';
        const kind = inferPieceKind(productName, productUrl);
        const label = pieceLabel(kind);
        const chips = CHIP_SETS[kind] || CHIP_SETS.default;
        const selected = state.furnitureWidthCm;

        const header = document.createElement('div');
        header.className = 'aif-header';
        header.innerHTML = `
      <span class="aif-eyebrow">Scale check</span>
      <h2>How wide is your current ${label}?</h2>
      <p>One quick number helps us place the new piece at a true-to-life size in your photo.</p>
    `;
        container.appendChild(header);

        const stage = document.createElement('div');
        stage.className = 'aif-measure-stage';

        if (state.uploadedImage) {
            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'aif-measure-thumb';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(state.uploadedImage);
            img.alt = 'Your room photo';
            thumbWrap.appendChild(img);

            const overlay = document.createElement('div');
            overlay.className = 'aif-measure-span';
            overlay.innerHTML = `
          <span class="aif-measure-span__cap"></span>
          <span class="aif-measure-span__line"></span>
          <span class="aif-measure-span__cap"></span>
          <span class="aif-measure-span__label">${selected ? `${selected} cm` : 'width'}</span>
        `;
            thumbWrap.appendChild(overlay);
            stage.appendChild(thumbWrap);
        }

        const chipSection = document.createElement('div');
        chipSection.className = 'aif-measure-chips';
        chipSection.setAttribute('role', 'group');
        chipSection.setAttribute('aria-label', `Approximate ${label} width in centimetres`);

        const unsureBtn = document.createElement('button');
        unsureBtn.type = 'button';
        unsureBtn.className = `aif-measure-chip aif-measure-chip--ghost${selected == null ? ' is-selected' : ''}`;
        unsureBtn.textContent = 'Not sure';
        unsureBtn.onclick = () => actions.setFurnitureWidthCm(null);
        chipSection.appendChild(unsureBtn);

        chips.forEach((cm) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `aif-measure-chip${selected === cm ? ' is-selected' : ''}`;
            btn.textContent = `${cm}`;
            btn.setAttribute('aria-pressed', selected === cm ? 'true' : 'false');
            btn.onclick = () => actions.setFurnitureWidthCm(cm);
            chipSection.appendChild(btn);
        });

        const unitHint = document.createElement('span');
        unitHint.className = 'aif-measure-unit';
        unitHint.textContent = 'cm';
        chipSection.appendChild(unitHint);

        stage.appendChild(chipSection);

        const customRow = document.createElement('div');
        customRow.className = 'aif-measure-custom';

        const customLabel = document.createElement('label');
        customLabel.className = 'aif-measure-custom__label';
        customLabel.htmlFor = 'aif-measure-custom-input';
        customLabel.textContent = 'Or type exact width';

        const customField = document.createElement('div');
        customField.className = 'aif-measure-custom__field';

        const customInput = document.createElement('input');
        customInput.id = 'aif-measure-custom-input';
        customInput.type = 'number';
        customInput.inputMode = 'decimal';
        customInput.min = '30';
        customInput.max = '600';
        customInput.step = '1';
        customInput.placeholder = 'e.g. 195';
        customInput.className = 'aif-measure-custom__input';
        if (selected != null && !chips.includes(selected)) {
            customInput.value = String(selected);
        }

        const customSuffix = document.createElement('span');
        customSuffix.className = 'aif-measure-custom__suffix';
        customSuffix.textContent = 'cm';

        const commitCustom = () => {
            const parsed = parseCustomCm(customInput.value);
            actions.setFurnitureWidthCm(parsed);
        };
        customInput.addEventListener('change', commitCustom);
        customInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitCustom();
            }
        });

        customField.appendChild(customInput);
        customField.appendChild(customSuffix);
        customRow.appendChild(customLabel);
        customRow.appendChild(customField);
        stage.appendChild(customRow);

        const tip = document.createElement('p');
        tip.className = 'aif-measure-tip';
        tip.textContent =
            'Tip: measure the piece you’re replacing (left to right), or estimate — even a close guess improves scale.';
        stage.appendChild(tip);

        container.appendChild(stage);

        const footer = document.createElement('div');
        footer.className = 'aif-measure-footer';

        let busy = false;
        const run = async (widthCm) => {
            if (busy) return;
            if (!state.uploadedImage) {
                actions.setView(VIEWS.UPLOAD);
                return;
            }
            busy = true;
            continueBtn.disabled = true;
            skipBtn.disabled = true;
            continueBtn.textContent = 'Starting…';
            try {
                await startGeneration({ furnitureWidthCm: widthCm });
            } catch (err) {
                console.error('Failed to start generation:', err);
                actions.setError(err.message || 'Could not start preview');
                busy = false;
                continueBtn.disabled = false;
                skipBtn.disabled = false;
                continueBtn.textContent = selected ? 'Place at this size' : 'Continue';
            }
        };

        const continueBtn = Button({
            text: selected ? 'Place at this size' : 'Continue',
            onClick: () => run(selected),
        });

        const skipBtn = Button({
            text: 'Skip — estimate from photo',
            variant: 'text',
            onClick: () => run(null),
        });

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'aif-btn-text aif-measure-back';
        backBtn.textContent = '← Change photo';
        backBtn.onclick = () => actions.setUploadedImage(null);

        footer.appendChild(continueBtn);
        footer.appendChild(skipBtn);
        footer.appendChild(backBtn);
        container.appendChild(footer);

        return container;
    };

    /**
     * Before/After Slider Component
     */
    const Slider = ({ beforeImage, afterImage, aspectRatio, fillParent = false, variant = '' }) => {
        const isResults = variant === 'results';
        const useFillParent = isResults ? false : fillParent;

        const container = document.createElement('div');
        container.className = useFillParent
            ? 'aif-slider aif-slider--fill'
            : isResults
              ? 'aif-slider aif-slider--results'
              : 'aif-slider';

        const numericRatio = typeof aspectRatio === 'number' ? aspectRatio : null;
        const initialAspectRatio = numericRatio != null ? String(numericRatio) : '3/4';
        let resultsRatio = numericRatio ?? 4 / 3;

        const imgBefore = document.createElement('img');
        imgBefore.className = 'aif-slider__img aif-slider__img--before';
        imgBefore.src = beforeImage;
        imgBefore.alt = 'Room before';
        imgBefore.decoding = 'async';

        const afterClip = document.createElement('div');
        afterClip.className = 'aif-slider__after-clip';

        const imgAfter = document.createElement('img');
        imgAfter.className = 'aif-slider__img aif-slider__img--after';
        imgAfter.src = afterImage;
        imgAfter.alt = 'Room after';
        imgAfter.decoding = 'async';

        const applyAspectFromNatural = (w, h) => {
            if (useFillParent || isResults) return;
            if (w > 0 && h > 0) {
                container.style.aspectRatio = String(w / h);
            }
        };

        const syncAspectFromImages = () => {
            if (useFillParent) return;
            const wb = imgBefore.naturalWidth;
            const hb = imgBefore.naturalHeight;
            const wa = imgAfter.naturalWidth;
            const ha = imgAfter.naturalHeight;
            if (isResults) {
                if (wb > 0 && hb > 0) {
                    resultsRatio = wb / hb;
                } else if (wa > 0 && ha > 0) {
                    resultsRatio = wa / ha;
                }
                syncResultsBox();
                return;
            }
            if (wb > 0 && hb > 0 && wa > 0 && ha > 0) {
                const rb = wb / hb;
                const ra = wa / ha;
                container.style.aspectRatio = String(Math.min(rb, ra));
            } else if (wb > 0 && hb > 0) {
                applyAspectFromNatural(wb, hb);
            } else if (wa > 0 && ha > 0) {
                applyAspectFromNatural(wa, ha);
            }
        };

        if (!useFillParent) {
            if (isResults) {
                container.style.width = '100%';
                container.style.display = 'block';
                container.style.minHeight = '160px';
            } else {
                container.style.aspectRatio = initialAspectRatio;
                container.style.maxHeight = 'min(34dvh, 320px)';
                container.style.minHeight = 'min(22dvh, 180px)';
            }
        } else {
            container.style.aspectRatio = initialAspectRatio;
        }

        /*
         * Size the results preview to the space that's actually left after the
         * header + action buttons, so the whole results view fits the drawer
         * without scrolling. Falls back to a width/ratio box when measurement
         * isn't available yet.
         */
        const syncResultsBox = () => {
            if (!isResults) return;

            const previewBlock = container.closest('.aif-result-preview-block');
            if (!previewBlock) return;

            const availW = previewBlock.clientWidth;
            let availH = previewBlock.clientHeight;
            if (availW <= 0) return;

            // If flex layout has not assigned height yet, derive from drawer content
            if (availH < 80) {
                const grid = container.closest('.aif-results-grid');
                const view = container.closest('.aif-results-view');
                const content = container.closest('.aif-content');
                if (grid && view && content) {
                    const cs = getComputedStyle(content);
                    const padY =
                        parseFloat(cs.paddingTop || '0') + parseFloat(cs.paddingBottom || '0');
                    const innerH = content.clientHeight - padY;
                    let others = 0;
                    Array.from(view.children).forEach((child) => {
                        if (child !== grid) others += child.offsetHeight;
                    });
                    const viewGap = Math.max(0, view.children.length - 1) * 10;
                    availH = innerH - others - viewGap;
                }
            }

            if (availH < 80) {
                availH = Math.floor((window.innerHeight || 640) * 0.45);
            }

            const ratio = resultsRatio > 0 ? resultsRatio : 4 / 3;
            let boxW;
            let boxH;

            // Fit full image inside available rect (object-fit: contain sizing)
            if (availW / availH > ratio) {
                boxH = availH;
                boxW = boxH * ratio;
            } else {
                boxW = availW;
                boxH = boxW / ratio;
            }

            boxW = Math.round(boxW);
            boxH = Math.max(120, Math.round(boxH));

            container.style.width = boxW >= availW - 2 ? '100%' : `${boxW}px`;
            container.style.maxWidth = '100%';
            container.style.height = `${boxH}px`;
            container.style.margin = '0 auto';
            container.classList.remove('aif-slider--results-cover');
        };

        const syncAfterImageWidth = () => {
            syncResultsBox();
            const w = container.offsetWidth;
            if (w > 0) {
                imgAfter.style.width = `${w}px`;
                imgAfter.style.height = '100%';
                imgAfter.style.left = '0';
                imgAfter.style.top = '0';
            }
        };

        imgBefore.onload = () => {
            syncAspectFromImages();
            syncAfterImageWidth();
        };
        imgAfter.onload = () => {
            syncAspectFromImages();
            syncAfterImageWidth();
        };

        const labelBefore = document.createElement('div');
        labelBefore.className = 'aif-slider__label aif-slider__label--before';
        labelBefore.textContent = 'Before';

        const labelAfter = document.createElement('div');
        labelAfter.className = 'aif-slider__label aif-slider__label--after';
        labelAfter.textContent = 'After';

        const dividerWrapper = document.createElement('div');
        dividerWrapper.className = 'aif-slider__divider-wrap';

        const divider = document.createElement('div');
        divider.className = 'aif-slider__divider';

        const handle = document.createElement('div');
        handle.className = 'aif-slider__handle';
        handle.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
    `;

        dividerWrapper.appendChild(divider);
        dividerWrapper.appendChild(handle);

        let isDragging = false;
        let cachedRect = null;
        let rafId = 0;
        let pendingClientX = null;

        const applyPosition = (percentage) => {
            afterClip.style.width = `${percentage}%`;
            dividerWrapper.style.left = `${percentage}%`;
        };

        const flushPosition = () => {
            rafId = 0;
            if (pendingClientX == null || !cachedRect) return;
            const { left, width } = cachedRect;
            let percentage = ((pendingClientX - left) / width) * 100;
            percentage = Math.max(0, Math.min(100, percentage));
            applyPosition(percentage);
        };

        const schedulePosition = (clientX) => {
            pendingClientX = clientX;
            if (!rafId) {
                rafId = requestAnimationFrame(flushPosition);
            }
        };

        const setHandleActive = (active) => {
            handle.classList.toggle('aif-slider__handle--active', active);
        };

        const beginDrag = () => {
            isDragging = true;
            cachedRect = container.getBoundingClientRect();
            syncAfterImageWidth();
            container.classList.add('aif-slider--dragging');
            setHandleActive(true);
        };

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            cachedRect = null;
            pendingClientX = null;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = 0;
            }
            container.classList.remove('aif-slider--dragging');
            setHandleActive(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };

        const onMouseDown = (e) => {
            beginDrag();
            schedulePosition(e.clientX);
            e.preventDefault();
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            schedulePosition(e.clientX);
        };

        const onMouseUp = () => endDrag();

        const onTouchStart = (e) => {
            beginDrag();
            if (e.touches[0]) schedulePosition(e.touches[0].clientX);
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
        };

        const onTouchMove = (e) => {
            if (!isDragging || !e.touches[0]) return;
            schedulePosition(e.touches[0].clientX);
            e.preventDefault();
        };

        const onTouchEnd = () => endDrag();

        dividerWrapper.addEventListener('mousedown', onMouseDown);
        dividerWrapper.addEventListener('touchstart', onTouchStart, { passive: true });

        const resizeObserver =
            typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(() => syncAfterImageWidth())
                : null;
        if (resizeObserver) {
            resizeObserver.observe(container);
            if (isResults) {
                const viewEl = container.closest('.aif-results-view');
                const blockEl = container.closest('.aif-result-preview-block');
                if (viewEl) resizeObserver.observe(viewEl);
                if (blockEl) resizeObserver.observe(blockEl);
            }
        }

        const onViewportResize = () => {
            syncResultsBox();
            syncAfterImageWidth();
        };
        if (isResults && typeof window !== 'undefined') {
            window.addEventListener('resize', onViewportResize);
            window.addEventListener('orientationchange', onViewportResize);
        }

        container._cleanup = () => {
            endDrag();
            resizeObserver?.disconnect();
            if (isResults && typeof window !== 'undefined') {
                window.removeEventListener('resize', onViewportResize);
                window.removeEventListener('orientationchange', onViewportResize);
            }
        };

        afterClip.appendChild(imgAfter);
        container.appendChild(imgBefore);
        container.appendChild(afterClip);
        container.appendChild(labelBefore);
        container.appendChild(labelAfter);
        container.appendChild(dividerWrapper);

        if (!useFillParent) {
            if (imgBefore.complete) syncAspectFromImages();
            if (imgAfter.complete) syncAspectFromImages();
        }
        syncAfterImageWidth();
        if (isResults && typeof requestAnimationFrame !== 'undefined') {
            const relayout = () => {
                syncAfterImageWidth();
            };
            requestAnimationFrame(() => {
                relayout();
                requestAnimationFrame(() => {
                    relayout();
                    requestAnimationFrame(relayout);
                });
            });
            if (typeof setTimeout !== 'undefined') {
                setTimeout(relayout, 120);
            }
        }

        return container;
    };

    /**
     * Save images as files. Remote URLs use the backend proxy first so the browser
     * actually downloads (S3/CDN often block CORS; <a download> is ignored cross-origin).
     * iOS/Android: Web Share API (Save to Photos / Downloads). Desktop: blob download.
     */

    function getFilenameFromUrl(url, fallback = 'image') {
        try {
            const u = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
            let name = u.pathname.split('/').pop() || fallback;
            name = name.split('?')[0];
            if (!name || name === '') return fallback;
            return name;
        } catch (_) {
            return fallback;
        }
    }

    function sleep$1(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isIOSDevice() {
        if (typeof navigator === 'undefined') return false;
        return (
            /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );
    }

    function isAndroidDevice() {
        return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    }

    function isMobileDevice() {
        return isIOSDevice() || isAndroidDevice();
    }

    function guessMimeFromFilename(filename) {
        const lower = (filename || '').toLowerCase();
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.webp')) return 'image/webp';
        if (lower.endsWith('.gif')) return 'image/gif';
        return 'image/jpeg';
    }

    function blobToFile(blob, filename) {
        const type =
            blob.type && blob.type !== 'application/octet-stream'
                ? blob.type
                : guessMimeFromFilename(filename);
        return new File([blob], filename, { type });
    }

    function triggerBlobDownload(blob, filename) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
        return true;
    }

    /**
     * Open image in a new tab — must run synchronously inside a user click on iOS.
     */
    function openImageSaveTarget(url, filename, options = {}) {
        if (!url) return;

        if (url.startsWith('blob:') || url.startsWith('data:')) {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        const { apiEndpoint } = options;
        if (apiEndpoint && /^https?:\/\//i.test(url)) {
            const base = apiEndpoint.replace(/\/$/, '');
            const proxyUrl = `${base}/download-image?${new URLSearchParams({ url, name: filename })}`;
            window.open(proxyUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        window.open(url, '_blank', 'noopener,noreferrer');
    }

    async function trySharePayload(payload) {
        if (typeof navigator.share !== 'function') return false;
        try {
            if (navigator.canShare && !navigator.canShare(payload)) return false;
            await navigator.share(payload);
            return true;
        } catch (e) {
            if (e?.name === 'AbortError') throw e;
            return false;
        }
    }

    async function shareFiles(files) {
        if (typeof navigator.share !== 'function' || typeof File === 'undefined' || !files.length) {
            return false;
        }

        if (files.length > 1) {
            const shared = await trySharePayload({
                files,
                title: 'Room preview',
                text: 'Before and after photos'
            });
            if (shared) return true;
        }

        let sharedAny = false;
        for (const file of files) {
            const shared = await trySharePayload({ files: [file], title: file.name });
            if (shared) sharedAny = true;
        }
        return sharedAny;
    }

    /**
     * Fetch image bytes (same proxy / CORS strategy as download).
     */
    async function fetchImageBlob(url, filename, options = {}) {
        if (!url) return null;

        const { apiEndpoint } = options;

        if (url.startsWith('blob:') || url.startsWith('data:')) {
            try {
                const res = await fetch(url);
                if (!res.ok) return null;
                return await res.blob();
            } catch (e) {
                console.warn('[AI Furniture] fetchImageBlob local failed:', e);
                return null;
            }
        }

        const isHttp = /^https?:\/\//i.test(url);

        if (apiEndpoint && isHttp) {
            try {
                const base = apiEndpoint.replace(/\/$/, '');
                const proxyUrl = `${base}/download-image?${new URLSearchParams({ url, name: filename })}`;
                const res = await fetch(proxyUrl, { mode: 'cors', credentials: 'omit' });
                if (res.ok) return await res.blob();
                console.warn('[AI Furniture] fetchImageBlob proxy HTTP', res.status);
            } catch (e) {
                console.warn('[AI Furniture] fetchImageBlob proxy failed:', e);
            }
        }

        try {
            const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.blob();
        } catch (err) {
            console.warn('[AI Furniture] fetchImageBlob direct failed:', err);
            return null;
        }
    }

    /**
     * Download a single image to the device — NEVER opens the share sheet.
     * Cross-origin http(s) goes through the backend proxy which sends
     * `Content-Disposition: attachment`, forcing a real file download on
     * desktop and mobile alike. blob:/data: URLs download directly.
     */
    async function downloadSingleImage(item, options = {}) {
        if (!item?.url) return { ok: false, reason: 'empty' };
        const { url, filename } = item;
        const { apiEndpoint } = options;

        if (apiEndpoint && /^https?:\/\//i.test(url)) {
            const base = apiEndpoint.replace(/\/$/, '');
            const proxyUrl = `${base}/download-image?${new URLSearchParams({ url, name: filename })}`;
            const a = document.createElement('a');
            a.href = proxyUrl;
            a.download = filename;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            return { ok: true, method: 'download' };
        }

        const blob = await fetchImageBlob(url, filename, options);
        if (blob) {
            triggerBlobDownload(blob, filename);
            return { ok: true, method: 'download' };
        }

        openImageSaveTarget(url, filename, options);
        return { ok: true, method: 'open' };
    }

    /**
     * Share the before & after as TWO separate, full-quality image files —
     * never a stitched composite (which degrades quality) and never a URL.
     * Falls back to downloading both files on desktop / unsupported browsers.
     */
    async function shareBeforeAfter(beforeUrl, afterUrl, options = {}) {
        if (!afterUrl) return { ok: false, reason: 'empty' };

        const afterName = `ai-preview-${getFilenameFromUrl(afterUrl, 'preview.png')}`;
        const afterBlob = await fetchImageBlob(afterUrl, afterName, options);
        if (!afterBlob) return { ok: false, reason: 'fetch_failed' };

        const beforeName = `room-${getFilenameFromUrl(beforeUrl, 'room.jpg')}`;
        const beforeBlob = beforeUrl ? await fetchImageBlob(beforeUrl, beforeName, options) : null;

        const files = [];
        if (beforeBlob) files.push(blobToFile(beforeBlob, beforeName));
        files.push(blobToFile(afterBlob, afterName));

        if (typeof navigator.share === 'function') {
            try {
                const shared = await shareFiles(files);
                if (shared) return { ok: true, method: 'share', saved: files.length };
            } catch (e) {
                if (e?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
            }
        }

        if (isMobileDevice()) {
            return { ok: false, reason: 'mobile_fallback' };
        }

        for (const file of files) {
            triggerBlobDownload(file, file.name);
            await sleep$1(250);
        }
        return { ok: true, method: 'download', saved: files.length };
    }

    /**
     * Training dataset export/reject — backend /api/training/* routes.
     */

    function apiBase(apiEndpoint) {
        return (apiEndpoint || '').replace(/\/$/, '');
    }

    async function exportTrainingPair(apiEndpoint, payload) {
        const res = await fetch(`${apiBase(apiEndpoint)}/training/pairs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
            credentials: 'omit',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    async function rejectTrainingItem(apiEndpoint, { itemNumber, folderName }) {
        const res = await fetch(`${apiBase(apiEndpoint)}/training/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ itemNumber, folderName }),
            credentials: 'omit',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    /** Build preScrapedData for Shopify storefronts (theme-provided images, no HTTP scrape). */

    function normalizeProductImageUrl(url) {
      const s = String(url || '').trim();
      if (!s) return '';
      if (s.startsWith('//')) return `https:${s}`;
      return s;
    }

    function isShopifyStoreConfig(config) {
      if (!config) return false;
      if (config.shopifyStore === true) return true;
      const domain = String(config.domain || '').toLowerCase();
      return domain.endsWith('.myshopify.com');
    }

    /** Prefer live theme config so productImages stay current on product pages. */
    function mergeShopifyThemeConfig(mergedConfig) {
      const live =
        typeof window !== 'undefined' && window.FURNITURE_AI_CONFIG
          ? window.FURNITURE_AI_CONFIG
          : null;
      if (!live && !mergedConfig) return mergedConfig || null;

      const liveImages = Array.isArray(live?.productImages) ? live.productImages : [];
      const cfgImages = Array.isArray(mergedConfig?.productImages) ? mergedConfig.productImages : [];
      const productImages = cfgImages.length ? cfgImages : liveImages;

      return {
        ...(live && typeof live === 'object' ? live : {}),
        ...(mergedConfig && typeof mergedConfig === 'object' ? mergedConfig : {}),
        shopifyStore: mergedConfig?.shopifyStore ?? live?.shopifyStore ?? false,
        domain: mergedConfig?.domain || live?.domain,
        productTitle: mergedConfig?.productTitle || live?.productTitle,
        productImages,
        productData: mergedConfig?.productData || live?.productData || null,
      };
    }

    function buildShopifyPreScrapedPayload(config) {
      const cfg = mergeShopifyThemeConfig(config);
      if (!isShopifyStoreConfig(cfg)) return null;

      const rawImages = cfg.productImages;
      if (!Array.isArray(rawImages) || rawImages.length === 0) return null;

      const images = rawImages
        .slice(0, 4)
        .map((entry, index) => {
          const url = normalizeProductImageUrl(
            typeof entry === 'string'
              ? entry
              : (entry?.url || entry?.src || '').toString()
          );
          if (!url) return null;
          return {
            url,
            type: index === 0 ? 'main' : 'product',
            score: 100 - index,
          };
        })
        .filter(Boolean);

      if (!images.length) return null;

      const productData = {
        ...(cfg.productData && typeof cfg.productData === 'object' ? cfg.productData : {}),
      };
      if (!productData.title && cfg.productTitle) {
        productData.title = cfg.productTitle;
      }

      return {
        images,
        productData,
        source: 'shopify-theme',
      };
    }

    function isTrainingReviewEnabled(config) {
        if (!config) return false;
        if (config.trainingReview === true) return true;
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('aif_training') === '1') return true;
        }
        return false;
    }

    function collectProductImageUrls(mergedConfig, result) {
        const urls = [];
        const seen = new Set();

        const preScraped = buildShopifyPreScrapedPayload(mergedConfig);
        if (preScraped?.images?.length) {
            for (const img of preScraped.images) {
                const url = img?.url;
                if (url && !seen.has(url)) {
                    seen.add(url);
                    urls.push(url);
                }
            }
        }

        const cfgImages = mergedConfig?.productImages;
        if (Array.isArray(cfgImages)) {
            for (const entry of cfgImages) {
                const url = typeof entry === 'string' ? entry : entry?.url || entry?.src;
                if (url && !seen.has(url)) {
                    seen.add(url);
                    urls.push(url);
                }
            }
        }

        const scraped = result?.sourceImages?.productUrls;
        if (Array.isArray(scraped)) {
            for (const url of scraped) {
                if (url && !seen.has(url)) {
                    seen.add(url);
                    urls.push(url);
                }
            }
        }

        return urls.slice(0, 4);
    }

    /**
     * Upload before/after/product refs to training/raw_data/item_XXXX (non-blocking).
     */
    function scheduleTrainingPairExport({
        queueId,
        item,
        result,
        uploaded,
        mergedConfig,
        apiEndpoint,
        domain,
        originalImageUrl,
        generatedImageUrl,
    }) {
        if (!apiEndpoint || !originalImageUrl || !generatedImageUrl) return;

        const roomBefore =
            uploaded?.s3Key || item.imageS3Key || originalImageUrl;
        const generated = result?.generatedImages?.[0];
        const roomAfter = generated?.s3Key || generatedImageUrl;

        const payload = {
            roomBefore,
            roomAfter,
            productImages: collectProductImageUrls(mergedConfig, result),
            productUrl: item.productUrl,
            domain,
            requestId: result?.requestId || null,
            metadata: {
                queueId,
                productName: item.productName || null,
                model: item.selectedModel || 'slow',
                imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
            },
        };

        exportTrainingPair(apiEndpoint, payload)
            .then((saved) => {
                const trainingItemNumber = saved.itemNumber;
                const trainingFolderName = saved.folderName;
                if (!trainingItemNumber) return;

                const current = store.getState().queue.find((q) => q.id === queueId);
                actions.updateQueueItem(queueId, {
                    result: {
                        ...(current?.result || {}),
                        trainingItemNumber,
                        trainingFolderName,
                        trainingRejected: false,
                    },
                });

                const { generatedImages } = store.getState();
                if (generatedImages?.length) {
                    actions.setGenerationResults(
                        generatedImages.map((img, index) =>
                            index === 0
                                ? {
                                      ...img,
                                      queueId,
                                      trainingItemNumber,
                                      trainingFolderName,
                                      trainingRejected: false,
                                  }
                                : img
                        )
                    );
                }

                debugLog('Training pair exported', {
                    itemNumber: trainingItemNumber,
                    folderName: trainingFolderName,
                });
            })
            .catch((e) => debugLog('Training export failed (non-blocking)', e?.message || e));
    }

    /**
     * Results View Component
     */

    function previewBlock(el) {
        const wrap = document.createElement('div');
        wrap.className = 'aif-result-preview-block';
        wrap.appendChild(el);
        return wrap;
    }

    const ICON_SHARE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
    const ICON_DOWNLOAD = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    const ICON_SLIDE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/><polyline points="9 18 15 12 9 6"/></svg>`;
    const ICON_CLOSE = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/></svg>`;

    function createResultsHeader() {
        const header = document.createElement('div');
        header.className = 'aif-results-lede';

        const eyebrow = document.createElement('span');
        eyebrow.className = 'aif-results-eyebrow';
        eyebrow.textContent = 'Showroom';
        header.appendChild(eyebrow);

        const row = document.createElement('div');
        row.className = 'aif-results-lede__row';

        const title = document.createElement('h3');
        title.className = 'aif-results-title';
        title.textContent = 'Your preview';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'aif-close-btn aif-results-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = ICON_CLOSE;
        closeBtn.addEventListener('click', () => actions.closeModal());

        row.appendChild(title);
        row.appendChild(closeBtn);
        header.appendChild(row);

        const hint = document.createElement('p');
        hint.className = 'aif-results-hint';
        hint.innerHTML = `
      <span class="aif-results-hint__icon">${ICON_SLIDE}</span>
      Slide to compare before &amp; after
    `;
        header.appendChild(hint);

        return header;
    }

    function makeActionButton({ label, className, onClick, icon = null, disabled = false, title = '' }) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = className;
        if (icon) {
            btn.innerHTML = `<span class="aif-result-actions__icon">${icon}</span><span class="aif-result-actions__label">${label}</span>`;
        } else {
            btn.textContent = label;
        }
        if (disabled) btn.disabled = true;
        if (title) btn.title = title;
        btn.addEventListener('click', onClick);
        return btn;
    }

    function setButtonLabel(button, text) {
        const labelEl = button.querySelector('.aif-result-actions__label');
        if (labelEl) labelEl.textContent = text;
        else button.textContent = text;
    }

    async function runShare(button, beforeUrl, afterUrl, dlOpts) {
        button.disabled = true;
        const label = button.querySelector('.aif-result-actions__label')?.textContent || button.textContent;
        setButtonLabel(button, 'Preparing…');
        try {
            const result = await shareBeforeAfter(beforeUrl, afterUrl, dlOpts);
            if (!result.ok && result.reason === 'mobile_fallback') {
                alert('Sharing isn’t supported on this browser. Use the Save buttons below to download the photos, then share them from your gallery.');
            }
        } finally {
            button.disabled = false;
            setButtonLabel(button, label);
        }
    }

    async function saveOneImage(button, item, dlOpts) {
        button.disabled = true;
        const label = button.querySelector('.aif-result-actions__label')?.textContent || button.textContent;
        setButtonLabel(button, 'Downloading…');
        try {
            const result = await downloadSingleImage(item, dlOpts);
            if (result && !result.ok && result.reason !== 'cancelled') {
                openImageSaveTarget(item.url, item.filename, dlOpts);
            }
        } finally {
            button.disabled = false;
            setButtonLabel(button, label);
        }
    }

    function resolveBeforeUrl(imgData, afterUrl, state, uploadedBlobUrl) {
        if (imgData?.originalImageUrl) return imgData.originalImageUrl;
        if (uploadedBlobUrl) return uploadedBlobUrl;

        const after = typeof afterUrl === 'string' ? afterUrl : imgData?.url || '';
        const queue = state.queue || [];

        const matched = queue.find((item) => {
            const generated = item.result?.generatedImageUrl;
            return (
                generated &&
                after &&
                (generated === after || generated === imgData?.url)
            );
        });
        if (matched) {
            return (
                matched.result?.originalImageUrl ||
                matched.userImageUrl ||
                matched.userImageDataUrl ||
                ''
            );
        }

        const latestCompleted = queue
            .filter(
                (item) =>
                    item.status === QUEUE_STATUS.COMPLETED &&
                    (item.result?.originalImageUrl || item.userImageUrl || item.userImageDataUrl)
            )
            .sort(
                (a, b) =>
                    (b.completedAt || b.queuedAt || 0) - (a.completedAt || a.queuedAt || 0)
            )[0];

        if (latestCompleted) {
            return (
                latestCompleted.result?.originalImageUrl ||
                latestCompleted.userImageUrl ||
                latestCompleted.userImageDataUrl ||
                ''
            );
        }

        return '';
    }

    function findTrainingMeta(state, imgData, afterUrl) {
        if (imgData?.trainingItemNumber) {
            return {
                itemNumber: imgData.trainingItemNumber,
                folderName: imgData.trainingFolderName,
                rejected: !!imgData.trainingRejected,
                approved: !!imgData.trainingApproved,
                queueId: imgData.queueId,
            };
        }

        const after = typeof afterUrl === 'string' ? afterUrl : imgData?.url || '';
        const matched = (state.queue || []).find((item) => {
            const generated = item.result?.generatedImageUrl;
            return (
                (generated && after && (generated === after || generated === imgData?.url)) ||
                item.id === imgData?.queueId
            );
        });

        if (matched?.result?.trainingItemNumber) {
            return {
                itemNumber: matched.result.trainingItemNumber,
                folderName: matched.result.trainingFolderName,
                rejected: !!matched.result.trainingRejected,
                approved: !!matched.result.trainingApproved,
                queueId: matched.id,
            };
        }

        // Training mode: show pending UI while export finishes
        if (matched || imgData?.queueId) {
            return {
                itemNumber: null,
                folderName: null,
                rejected: false,
                approved: false,
                queueId: matched?.id || imgData?.queueId || null,
                pending: true,
            };
        }

        return { itemNumber: null, folderName: null, rejected: false, approved: false, pending: true };
    }

    function createTrainingReviewSection(apiEndpoint, trainingMeta, state) {
        const section = document.createElement('div');
        section.className = 'aif-results-training';

        const label = document.createElement('p');
        label.className = 'aif-results-panel__label';
        label.textContent = 'Was this preview good?';
        section.appendChild(label);

        const info = document.createElement('p');
        info.className = 'aif-results-training__info';

        if (!trainingMeta?.itemNumber) {
            info.textContent = 'Saving pair for review…';
            section.appendChild(info);
            return section;
        }

        info.textContent = trainingMeta.folderName
            ? `${trainingMeta.folderName} · saved to raw_data`
            : `item #${trainingMeta.itemNumber} · saved to raw_data`;
        section.appendChild(info);

        if (trainingMeta.rejected) {
            const done = document.createElement('p');
            done.className = 'aif-results-training__done';
            done.textContent = 'Marked as reject — moved to rejects/';
            section.appendChild(done);
            return section;
        }

        if (trainingMeta.approved) {
            const done = document.createElement('p');
            done.className = 'aif-results-training__done';
            done.style.color = '#047857';
            done.textContent = 'Marked as good — kept in raw_data';
            section.appendChild(done);
            return section;
        }

        const btnRow = document.createElement('div');
        btnRow.className = 'aif-results-training__actions';

        const goodBtn = makeActionButton({
            label: 'Looks good',
            className: 'aif-result-actions__btn aif-result-actions__btn--primary',
            onClick: () => {
                if (trainingMeta.queueId) {
                    const current = store.getState().queue.find((q) => q.id === trainingMeta.queueId);
                    actions.updateQueueItem(trainingMeta.queueId, {
                        result: {
                            ...(current?.result || {}),
                            trainingApproved: true,
                        },
                    });
                }
                const { generatedImages } = store.getState();
                if (generatedImages?.length) {
                    actions.setGenerationResults(
                        generatedImages.map((img) => ({
                            ...img,
                            trainingApproved: true,
                        }))
                    );
                }
                btnRow.remove();
                const done = document.createElement('p');
                done.className = 'aif-results-training__done';
                done.style.color = '#047857';
                done.textContent = 'Marked as good — kept in raw_data';
                section.appendChild(done);
            },
        });

        const rejectBtn = makeActionButton({
            label: 'Reject',
            className: 'aif-result-actions__btn aif-result-actions__btn--secondary',
            onClick: async () => {
                rejectBtn.disabled = true;
                goodBtn.disabled = true;
                setButtonLabel(rejectBtn, 'Rejecting…');
                try {
                    await rejectTrainingItem(apiEndpoint, {
                        itemNumber: trainingMeta.itemNumber,
                        folderName: trainingMeta.folderName,
                    });

                    if (trainingMeta.queueId) {
                        const current = store.getState().queue.find((q) => q.id === trainingMeta.queueId);
                        actions.updateQueueItem(trainingMeta.queueId, {
                            result: {
                                ...(current?.result || {}),
                                trainingRejected: true,
                            },
                        });
                    }

                    const { generatedImages } = store.getState();
                    if (generatedImages?.length) {
                        actions.setGenerationResults(
                            generatedImages.map((img) => ({
                                ...img,
                                trainingRejected: true,
                            }))
                        );
                    }

                    info.textContent = trainingMeta.folderName
                        ? `${trainingMeta.folderName} · moved to rejects/`
                        : `item #${trainingMeta.itemNumber} · moved to rejects/`;
                    btnRow.remove();
                    const done = document.createElement('p');
                    done.className = 'aif-results-training__done';
                    done.textContent = 'Marked as reject — moved to rejects/';
                    section.appendChild(done);
                } catch (err) {
                    alert(err?.message || 'Could not reject training pair');
                    rejectBtn.disabled = false;
                    goodBtn.disabled = false;
                    setButtonLabel(rejectBtn, 'Reject');
                }
            },
        });

        btnRow.appendChild(goodBtn);
        btnRow.appendChild(rejectBtn);
        section.appendChild(btnRow);

        return section;
    }

    function createSaveSection(beforeUrl, afterUrl, dlOpts, state) {
        const section = document.createElement('div');
        section.className = 'aif-results-save';

        const afterItem = afterUrl
            ? { url: afterUrl, filename: `after-${getFilenameFromUrl(afterUrl, 'preview.png')}` }
            : null;

        const resolvedBefore = beforeUrl || resolveBeforeUrl(null, afterUrl, state, '');
        const beforeItem = resolvedBefore
            ? { url: resolvedBefore, filename: `before-${getFilenameFromUrl(resolvedBefore, 'room.jpg')}` }
            : null;

        const panel = document.createElement('div');
        panel.className = 'aif-results-panel';

        const panelLabel = document.createElement('p');
        panelLabel.className = 'aif-results-panel__label';
        panelLabel.textContent = 'Share or save';
        panel.appendChild(panelLabel);

        if (afterItem) {
            const shareBtn = makeActionButton({
                label: 'Share comparison',
                icon: ICON_SHARE,
                className:
                    'aif-result-actions__btn aif-result-actions__btn--primary aif-result-actions__btn--full aif-result-actions__btn--icon',
                onClick: () => runShare(shareBtn, resolvedBefore, afterUrl, dlOpts),
            });
            panel.appendChild(shareBtn);

            const split = document.createElement('div');
            split.className = 'aif-result-actions__split';

            const beforeBtn = makeActionButton({
                label: 'Room photo',
                icon: ICON_DOWNLOAD,
                className:
                    'aif-result-actions__btn aif-result-actions__btn--save aif-result-actions__btn--icon',
                onClick: () => {
                    if (beforeItem) saveOneImage(beforeBtn, beforeItem, dlOpts);
                },
                disabled: !beforeItem,
                title: beforeItem ? '' : 'Original room photo unavailable',
            });

            const afterBtn = makeActionButton({
                label: 'AI preview',
                icon: ICON_DOWNLOAD,
                className:
                    'aif-result-actions__btn aif-result-actions__btn--save aif-result-actions__btn--icon',
                onClick: () => saveOneImage(afterBtn, afterItem, dlOpts),
            });

            split.appendChild(beforeBtn);
            split.appendChild(afterBtn);
            panel.appendChild(split);
        }

        section.appendChild(panel);
        return section;
    }

    const ResultsView = (state) => {
        const uploadedBlobUrl = state.uploadedImage ? URL.createObjectURL(state.uploadedImage) : '';

        const apiEndpoint =
            state.config?.apiEndpoint ||
            (typeof window !== 'undefined' && window.__AIFurnitureConfig?.apiEndpoint) ||
            'https://ai-furniture-backend.vercel.app/api';

        const dlOpts = { apiEndpoint };
        const showTrainingReview = isTrainingReviewEnabled(state.config);

        const buildPairs = () => {
            const pairs = [];
            state.generatedImages.forEach((imgData, index) => {
                const afterUrl = imgData.url || imgData;
                const beforeUrl = resolveBeforeUrl(imgData, afterUrl, state, uploadedBlobUrl);
                if (afterUrl) pairs.push({ beforeUrl, afterUrl, index });
            });
            return pairs;
        };

        const container = document.createElement('div');
        container.className = 'aif-results-view';

        container.appendChild(createResultsHeader());

        const pairs = buildPairs();
        const grid = document.createElement('div');
        grid.className = 'aif-results-grid';

        let saveSection = null;
        let trainingSection = null;

        pairs.forEach(({ beforeUrl, afterUrl, index: i }) => {
            const imgData = state.generatedImages[i];
            const generatedUrl = imgData.url || imgData;
            const aspectRatio =
                imgData.originalAspectRatio ||
                (imgData.originalWidth && imgData.originalHeight
                    ? imgData.originalWidth / imgData.originalHeight
                    : null);

            if (generatedUrl) {
                if (beforeUrl) {
                    grid.appendChild(
                        previewBlock(
                            Slider({
                                beforeImage: beforeUrl,
                                afterImage: generatedUrl,
                                aspectRatio,
                                fillParent: false,
                                variant: 'results'
                            })
                        )
                    );
                } else {
                    const img = document.createElement('img');
                    img.src = generatedUrl;
                    img.className = 'aif-results-fallback-img';
                    img.alt = 'Room preview';
                    grid.appendChild(previewBlock(img));
                }
                saveSection = createSaveSection(beforeUrl, generatedUrl, dlOpts, state);
                if (showTrainingReview) {
                    const trainingMeta = findTrainingMeta(state, imgData, generatedUrl);
                    trainingSection = createTrainingReviewSection(apiEndpoint, trainingMeta);
                }
            }
        });

        container.appendChild(grid);

        if (trainingSection) {
            container.appendChild(trainingSection);
        }

        if (saveSection) {
            container.appendChild(saveSection);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'aif-results-footer';

        const disclaimer = document.createElement('p');
        disclaimer.className = 'aif-results-disclaimer';
        disclaimer.textContent =
            'Preview sizing is guided by product specs and any width you provided — still double-check dimensions before buying.';
        actionsDiv.appendChild(disclaimer);

        actionsDiv.appendChild(
            Button({
                text: 'Try another photo',
                variant: 'secondary',
                onClick: () => actions.setView(VIEWS.UPLOAD)
            })
        );

        container.appendChild(actionsDiv);

        return container;
    };

    /**
     * Queue View Component - Enhanced with tabs and better UI
     */

    function toTimestampMs(value) {
        if (value == null) return 0;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const ms = new Date(value).getTime();
            return Number.isFinite(ms) ? ms : 0;
        }
        return 0;
    }

    function queueItemSortTimestamp(item) {
        return toTimestampMs(
            item.completedAt || item.startedAt || item.queuedAt || item.timestamp || 0
        );
    }

    function sortQueueItemsNewestFirst(items) {
        return [...items].sort((a, b) => queueItemSortTimestamp(b) - queueItemSortTimestamp(a));
    }

    function sortRemoteGenerationsNewestFirst(entries) {
        return [...entries].sort((a, b) => toTimestampMs(b.createdAt) - toTimestampMs(a.createdAt));
    }

    function normalizePreviewUrl(url) {
        if (!url || typeof url !== 'string') return '';
        try {
            const u = new URL(url);
            return `${u.origin}${u.pathname}`;
        } catch {
            return url.split('?')[0] || url;
        }
    }

    /** Merge session completed items with server history, skipping duplicates already in the queue. */
    function buildReadyTabEntries(queue, remoteGenerations) {
        const sessionCompleted = sortQueueItemsNewestFirst(
            queue.filter((item) => item.status === QUEUE_STATUS.COMPLETED)
        );

        const sessionQueueIds = new Set(sessionCompleted.map((item) => item.id));
        const sessionPreviewUrls = new Set(
            sessionCompleted
                .map((item) => item.result?.generatedImageUrl)
                .filter(Boolean)
                .map(normalizePreviewUrl)
        );

        const savedOnly = sortRemoteGenerationsNewestFirst(remoteGenerations || []).filter((entry) => {
            const queueId = entry?.metadata?.queueId;
            if (queueId && sessionQueueIds.has(queueId)) return false;
            const previewUrl = normalizePreviewUrl(entry?.previewImageUrl);
            if (previewUrl && sessionPreviewUrls.has(previewUrl)) return false;
            return true;
        });

        return [
            ...sessionCompleted.map((item) => ({
                kind: 'session',
                ts: queueItemSortTimestamp(item),
                item
            })),
            ...savedOnly.map((entry) => ({
                kind: 'saved',
                ts: toTimestampMs(entry?.createdAt),
                entry
            }))
        ].sort((a, b) => b.ts - a.ts);
    }

    const QueueView = (state) => {
        const container = document.createElement('div');
        container.className = 'aif-queue-view';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';
        container.style.height = '100%';
        container.style.minHeight = '0';
        container.style.overflow = 'hidden';

        const activeItem = state.queue.find(
            (i) => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING
        );
        const failedItem = state.queue.find((i) => i.status === QUEUE_STATUS.ERROR);

        if (activeItem) {
            container.appendChild(createProgressView(activeItem));
            return container;
        }

        if (failedItem) {
            container.appendChild(createErrorView(failedItem));
            return container;
        }

        const remoteGenerations = state.remoteGenerations || [];
        const readyEntries = buildReadyTabEntries(state.queue, remoteGenerations);

        const header = document.createElement('div');
        header.className = 'aif-header';
        header.innerHTML = `
    <h2>Your previews</h2>
    <p>${readyEntries.length ? 'Tap a preview to open it.' : 'No previews yet.'}</p>
  `;
        container.appendChild(header);

        const list = document.createElement('div');
        list.className = 'aif-queue-list';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.flex = '1';
        list.style.minHeight = '0';
        list.style.overflow = 'auto';

        if (readyEntries.length === 0) {
            const empty = document.createElement('div');
            empty.style.textAlign = 'center';
            empty.style.padding = '24px 12px';
            empty.style.color = '#64748b';
            empty.innerHTML = `
            <p style="margin:0 0 16px; font-size:14px;">Take a room photo to see this product in your space.</p>
        `;
            const startBtn = Button({
                text: 'Take a photo',
                onClick: () => actions.setView(VIEWS.UPLOAD)
            });
            empty.appendChild(startBtn);
            list.appendChild(empty);
        } else {
            readyEntries.forEach((x) => {
                if (x.kind === 'saved') list.appendChild(createSavedHistoryRow(x.entry));
                else list.appendChild(createQueueItem(x.item));
            });
        }

        container.appendChild(list);

        const footer = document.createElement('div');
        footer.style.marginTop = 'auto';
        footer.style.flexShrink = '0';
        footer.appendChild(
            Button({
                text: 'New photo',
                variant: 'secondary',
                onClick: () => actions.setView(VIEWS.UPLOAD)
            })
        );
        container.appendChild(footer);

        return container;
    };

    const ANALYZE_STEPS = [
        { atMs: 0, label: 'Reading room geometry', detail: 'Walls, floor plane & camera angle' },
        { atMs: 3500, label: 'Finding scale anchors', detail: 'Doors, seating height & perspective cues' },
        {
            atMs: 8000,
            label: 'Calibrating product size',
            detail: (item) =>
                typeof item.furnitureWidthCm === 'number' && item.furnitureWidthCm > 0
                    ? `Using your ${item.furnitureWidthCm} cm scale cue`
                    : 'Matching catalog dimensions to the scene',
        },
        { atMs: 14000, label: 'Aligning lighting & shadows', detail: 'Colour temperature, contact & cast shadows' },
        { atMs: 21000, label: 'Compositing into your photo', detail: 'Placing the piece with correct occlusion' },
        { atMs: 30000, label: 'Refining edges & realism', detail: 'Final photoreal polish' },
    ];

    function analyzeProgressRatio(elapsedMs) {
        // Ease toward ~92% over ~40s so it never looks “stuck at 100%” before completion
        const t = Math.max(0, elapsedMs) / 40000;
        return Math.min(0.92, 1 - Math.exp(-2.1 * t));
    }

    function createProgressView(item) {
        const wrap = document.createElement('div');
        wrap.className = 'aif-analyze-view';

        const header = document.createElement('div');
        header.className = 'aif-header aif-analyze-header';
        header.innerHTML = `
      <span class="aif-eyebrow">Room analysis</span>
      <h2>Placing it accurately…</h2>
      <p>We’re measuring your space and matching the product to real-world scale.</p>
    `;
        wrap.appendChild(header);

        const visual = document.createElement('div');
        visual.className = 'aif-analyze-visual';

        const roomFrame = document.createElement('div');
        roomFrame.className = 'aif-analyze-room';
        const roomSrc = item.userImageDataUrl || item.userImageUrl || item.result?.originalImageUrl;
        if (roomSrc) {
            const img = document.createElement('img');
            img.src = roomSrc;
            img.alt = '';
            roomFrame.appendChild(img);
        } else {
            roomFrame.classList.add('aif-analyze-room--empty');
        }
        const scan = document.createElement('div');
        scan.className = 'aif-analyze-scan';
        roomFrame.appendChild(scan);
        const grid = document.createElement('div');
        grid.className = 'aif-analyze-grid';
        roomFrame.appendChild(grid);
        visual.appendChild(roomFrame);

        const meter = document.createElement('div');
        meter.className = 'aif-analyze-meter';
        const meterTrack = document.createElement('div');
        meterTrack.className = 'aif-analyze-meter__track';
        const meterFill = document.createElement('div');
        meterFill.className = 'aif-analyze-meter__fill';
        meterTrack.appendChild(meterFill);
        const meterLabel = document.createElement('div');
        meterLabel.className = 'aif-analyze-meter__label';
        meter.appendChild(meterTrack);
        meter.appendChild(meterLabel);
        visual.appendChild(meter);

        wrap.appendChild(visual);

        const stepsEl = document.createElement('ol');
        stepsEl.className = 'aif-analyze-steps';
        stepsEl.setAttribute('aria-live', 'polite');

        const stepNodes = ANALYZE_STEPS.map((step, index) => {
            const li = document.createElement('li');
            li.className = 'aif-analyze-step';
            li.dataset.stepIndex = String(index);
            const detail =
                typeof step.detail === 'function' ? step.detail(item) : step.detail;
            li.innerHTML = `
          <span class="aif-analyze-step__mark" aria-hidden="true"></span>
          <span class="aif-analyze-step__body">
            <span class="aif-analyze-step__label">${step.label}</span>
            <span class="aif-analyze-step__detail">${detail}</span>
          </span>
        `;
            stepsEl.appendChild(li);
            return li;
        });
        wrap.appendChild(stepsEl);

        const hint = document.createElement('p');
        hint.className = 'aif-analyze-hint';
        hint.textContent =
            'Usually about 20–40 seconds. You can keep browsing — we’ll finish in the background.';
        wrap.appendChild(hint);

        const startedAt = item.startedAt || item.queuedAt || Date.now();

        // Use `let` + null so the first paint (before mount) cannot TDZ on `timer`
        let timer = null;
        const tick = () => {
            if (timer != null && !wrap.isConnected) {
                clearInterval(timer);
                timer = null;
                return;
            }
            const elapsed = Date.now() - startedAt;
            const ratio = analyzeProgressRatio(elapsed);
            meterFill.style.width = `${Math.round(ratio * 100)}%`;
            meterLabel.textContent = `${Math.round(ratio * 100)}% calibrated`;

            let activeIndex = 0;
            for (let i = 0; i < ANALYZE_STEPS.length; i++) {
                if (elapsed >= ANALYZE_STEPS[i].atMs) activeIndex = i;
            }

            stepNodes.forEach((li, i) => {
                li.classList.remove('is-done', 'is-active', 'is-pending');
                if (i < activeIndex) li.classList.add('is-done');
                else if (i === activeIndex) li.classList.add('is-active');
                else li.classList.add('is-pending');
            });
        };

        tick();
        timer = setInterval(tick, 400);
        wrap._aifAnalyzeTimer = timer;

        return wrap;
    }

    function createErrorView(item) {
        const wrap = document.createElement('div');
        wrap.style.flex = '1';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        wrap.style.textAlign = 'center';
        wrap.style.padding = '24px 16px';
        wrap.style.gap = '12px';

        const icon = document.createElement('div');
        icon.textContent = '😕';
        icon.style.fontSize = '40px';

        const title = document.createElement('h2');
        title.style.margin = '0';
        title.style.fontSize = '18px';
        title.style.fontWeight = '600';
        title.textContent = "That didn't work";

        const msg = document.createElement('p');
        msg.style.margin = '0';
        msg.style.fontSize = '14px';
        msg.style.color = '#64748b';
        msg.style.maxWidth = '280px';
        msg.textContent = item.error || 'Something went wrong. Please try again.';

        const retryBtn = Button({
            text: 'Try again',
            onClick: () => {
                actions.updateQueueItem(item.id, { status: QUEUE_STATUS.PENDING, error: null });
            }
        });

        const newPhotoBtn = Button({
            text: 'New photo',
            variant: 'secondary',
            onClick: () => {
                actions.removeFromQueue(item.id);
                actions.setView(VIEWS.UPLOAD);
            }
        });

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.flexDirection = 'column';
        btnRow.style.gap = '8px';
        btnRow.style.width = '100%';
        btnRow.style.maxWidth = '280px';
        btnRow.style.marginTop = '8px';
        btnRow.appendChild(retryBtn);
        btnRow.appendChild(newPhotoBtn);

        wrap.appendChild(icon);
        wrap.appendChild(title);
        wrap.appendChild(msg);
        wrap.appendChild(btnRow);

        return wrap;
    }

    /** Server-stored preview (same shape as GET /api/widget/generations). */
    function createSavedHistoryRow(entry) {
        const itemEl = document.createElement('div');
        itemEl.className = 'aif-queue-card';
        itemEl.style.padding = '10px';
        itemEl.style.background = '#ffffff';
        itemEl.style.borderRadius = '12px';
        itemEl.style.border = '1px solid #e2e8f0';
        itemEl.style.display = 'flex';
        itemEl.style.gap = '12px';
        itemEl.style.alignItems = 'center';
        itemEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

        const thumbnail = document.createElement('div');
        thumbnail.style.width = '48px';
        thumbnail.style.height = '48px';
        thumbnail.style.borderRadius = '8px';
        thumbnail.style.background = '#f1f5f9';
        thumbnail.style.flexShrink = '0';
        thumbnail.style.overflow = 'hidden';

        const setExpiredState = () => {
            thumbnail.innerHTML = '';
            thumbnail.style.display = 'flex';
            thumbnail.style.alignItems = 'center';
            thumbnail.style.justifyContent = 'center';
            thumbnail.style.background = '#fff7ed';
            thumbnail.style.border = '1px solid #fed7aa';
            thumbnail.style.color = '#9a3412';
            thumbnail.style.fontSize = '10px';
            thumbnail.style.fontWeight = '700';
            thumbnail.style.letterSpacing = '0.04em';
            thumbnail.style.textTransform = 'uppercase';
            thumbnail.textContent = 'Expired';

            meta.textContent = 'Expired';
            viewBtn.disabled = true;
            viewBtn.style.opacity = '0.6';
            viewBtn.style.cursor = 'not-allowed';
        };

        const isSignedUrlExpired = (url) => {
            try {
                if (!url || typeof url !== 'string') return false;
                if (!url.includes('X-Amz-Expires=') || !url.includes('X-Amz-Date=')) return false;
                const u = new URL(url);
                const amzDate = u.searchParams.get('X-Amz-Date');
                const amzExpires = u.searchParams.get('X-Amz-Expires');
                if (!amzDate || !amzExpires) return false;
                const expiresSec = Number(amzExpires);
                if (!Number.isFinite(expiresSec) || expiresSec <= 0) return false;

                // X-Amz-Date format: YYYYMMDDTHHMMSSZ
                const m = amzDate.match(
                    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
                );
                if (!m) return false;
                const issuedAt = Date.UTC(
                    Number(m[1]),
                    Number(m[2]) - 1,
                    Number(m[3]),
                    Number(m[4]),
                    Number(m[5]),
                    Number(m[6])
                );
                if (!Number.isFinite(issuedAt)) return false;
                const expiresAt = issuedAt + expiresSec * 1000;
                return Date.now() > expiresAt;
            } catch {
                return false;
            }
        };

        const content = document.createElement('div');
        content.style.flex = '1';
        content.style.minWidth = '0';

        const productName = document.createElement('div');
        productName.style.fontWeight = '600';
        productName.style.fontSize = '13px';
        productName.style.color = '#1e293b';
        let pathLabel = 'Preview';
        try {
            if (entry.productUrl) {
                pathLabel =
                    new URL(entry.productUrl).pathname.split('/').filter(Boolean).pop() || pathLabel;
            }
        } catch {
            /* ignore */
        }
        productName.textContent = (entry.productName && entry.productName.slice(0, 60)) || pathLabel;

        const meta = document.createElement('div');
        meta.style.fontSize = '11px';
        meta.style.color = '#64748b';
        meta.style.marginTop = '2px';
        try {
            meta.textContent = entry.createdAt
                ? `Saved · ${new Date(entry.createdAt).toLocaleString()}`
                : 'Saved';
        } catch {
            meta.textContent = 'Saved';
        }

        content.appendChild(productName);
        content.appendChild(meta);

        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View';
        viewBtn.style.padding = '8px 14px';
        viewBtn.style.background = '#059669';
        viewBtn.style.color = 'white';
        viewBtn.style.border = 'none';
        viewBtn.style.borderRadius = '8px';
        viewBtn.style.cursor = 'pointer';
        viewBtn.style.fontSize = '12px';
        viewBtn.style.fontWeight = '600';
        viewBtn.style.flexShrink = '0';
        // Default disabled until we confirm the thumbnail loads.
        viewBtn.disabled = true;
        viewBtn.style.opacity = '0.6';
        viewBtn.style.cursor = 'not-allowed';
        viewBtn.onclick = () => {
            if (viewBtn.disabled) return;
            actions.setGenerationResults([
                {
                    url: entry.previewImageUrl,
                    originalImageUrl: entry.originalImageUrl || '',
                    originalAspectRatio: entry.metadata?.originalAspectRatio,
                    originalWidth: entry.metadata?.originalWidth,
                    originalHeight: entry.metadata?.originalHeight,
                    imageS3Key: entry.metadata?.imageS3Key || null,
                    furnitureWidthCm:
                        typeof entry.metadata?.furnitureWidthCm === 'number' &&
                        Number.isFinite(entry.metadata.furnitureWidthCm)
                            ? entry.metadata.furnitureWidthCm
                            : null
                }
            ]);
        };

        const img = document.createElement('img');
        img.src = entry.previewImageUrl;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.loading = 'lazy';
        img.onload = () => {
            viewBtn.disabled = false;
            viewBtn.style.opacity = '';
            viewBtn.style.cursor = 'pointer';
        };
        img.onerror = () => {
            setExpiredState();
        };
        thumbnail.appendChild(img);

        itemEl.appendChild(thumbnail);
        itemEl.appendChild(content);
        itemEl.appendChild(viewBtn);

        // If the backend returned a signed URL and it's already expired, don't show a broken image.
        if (isSignedUrlExpired(entry.previewImageUrl)) {
            setExpiredState();
        }

        return itemEl;
    }

    function createQueueItem(item) {
        const itemEl = document.createElement('div');
        itemEl.className = 'aif-queue-card';
        itemEl.style.padding = '12px';
        itemEl.style.background = '#ffffff';
        itemEl.style.borderRadius = '12px';
        itemEl.style.border = '1px solid #e2e8f0';
        itemEl.style.display = 'flex';
        itemEl.style.gap = '12px';
        itemEl.style.alignItems = 'center';
        itemEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        itemEl.style.cursor = 'pointer';

        const thumbnail = document.createElement('div');
        thumbnail.style.width = '56px';
        thumbnail.style.height = '56px';
        thumbnail.style.borderRadius = '8px';
        thumbnail.style.background = '#f1f5f9';
        thumbnail.style.flexShrink = '0';
        thumbnail.style.overflow = 'hidden';

        const previewUrl = item.result?.generatedImageUrl;
        if (previewUrl) {
            const img = document.createElement('img');
            img.src = previewUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            thumbnail.appendChild(img);
        } else if (item.userImageUrl) {
            const img = document.createElement('img');
            img.src = item.userImageUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            thumbnail.appendChild(img);
        } else {
            thumbnail.innerHTML = '<span style="font-size:24px;">🖼️</span>';
            thumbnail.style.display = 'flex';
            thumbnail.style.alignItems = 'center';
            thumbnail.style.justifyContent = 'center';
        }

        const content = document.createElement('div');
        content.style.flex = '1';
        content.style.minWidth = '0';

        const label = document.createElement('div');
        label.style.fontWeight = '600';
        label.style.fontSize = '14px';
        label.style.color = '#1e293b';
        label.textContent = 'Room preview';

        const meta = document.createElement('div');
        meta.style.fontSize = '12px';
        meta.style.color = '#64748b';
        meta.style.marginTop = '2px';
        meta.textContent = 'Tap to view';

        content.appendChild(label);
        content.appendChild(meta);

        const openPreview = () => {
            if (!item.result?.generatedImageUrl) return;
            trackEvent('results_viewed', {
                queueId: item.id,
                productUrl: item.productUrl,
                productName: item.productName,
                model: item.selectedModel,
                generationTime: item.result?.generationTime
            });
            actions.setGenerationResults([
                {
                    url: item.result.generatedImageUrl,
                    originalImageUrl: item.result?.originalImageUrl || item.userImageUrl || '',
                    originalAspectRatio: item.result?.originalAspectRatio,
                    originalWidth: item.result?.originalWidth,
                    originalHeight: item.result?.originalHeight,
                    imageS3Key: item.result?.imageS3Key || item.imageS3Key || null
                }
            ]);
        };

        itemEl.onclick = openPreview;

        itemEl.appendChild(thumbnail);
        itemEl.appendChild(content);

        return itemEl;
    }

    // Add spinner animation
    if (typeof document !== 'undefined') {
        const style = document.createElement('style');
        style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
        document.head.appendChild(style);
    }

    /**
     * Minimal privacy note — no email or account UI.
     */
    function WidgetFooter() {
        const wrap = document.createElement('div');
        wrap.className = 'aif-widget-footer';
        wrap.style.padding = '8px 16px 12px';
        wrap.style.textAlign = 'center';
        wrap.style.fontSize = '10px';
        wrap.style.color = '#94a3b8';
        wrap.style.lineHeight = '1.4';
        wrap.textContent = 'Your photo is only used to create your preview.';
        return wrap;
    }

    /**
     * Main Modal Container
     */

    const DRAWER_WIDTH_STORAGE_KEY = 'aif_drawer_width_px';
    const DRAWER_MIN_WIDTH = 320;
    const DRAWER_MAX_WIDTH = 720;
    const DRAWER_DESKTOP_MQ = '(min-width: 769px)';
    const DRAWER_RESIZE_ICON =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 7 11 12 15 17"/><polyline points="9 7 5 12 9 17"/></svg>';

    function clampDrawerWidth(px) {
        return Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, Math.round(px)));
    }

    function readSavedDrawerWidth() {
        try {
            const raw = localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
            if (!raw) return null;
            const n = parseInt(raw, 10);
            return Number.isFinite(n) ? clampDrawerWidth(n) : null;
        } catch {
            return null;
        }
    }

    function saveDrawerWidth(px) {
        try {
            localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(clampDrawerWidth(px)));
        } catch {
            /* ignore */
        }
    }

    function getDrawerWidth(container) {
        const rect = container.getBoundingClientRect();
        return rect.width || clampDrawerWidth(420);
    }

    function initDrawerResize(container, modalOverlay) {
        if (typeof window === 'undefined' || !container || !modalOverlay) return null;

        const mq = window.matchMedia(DRAWER_DESKTOP_MQ);
        const saved = readSavedDrawerWidth();
        if (saved) {
            container.style.setProperty('--aif-drawer-width', `${saved}px`);
        }

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'aif-drawer-resize';
        handle.setAttribute('aria-label', 'Drag to resize panel');
        handle.title = 'Drag to resize';
        handle.innerHTML = DRAWER_RESIZE_ICON;
        handle.hidden = true;

        let dragging = false;
        let startX = 0;
        let startW = 0;

        const positionHandle = () => {
            const open = modalOverlay.classList.contains('open');
            if (!mq.matches || !open) {
                handle.hidden = true;
                handle.style.display = 'none';
                return;
            }

            handle.hidden = false;
            handle.style.display = 'flex';
            const rect = container.getBoundingClientRect();
            handle.style.top = `${rect.top + rect.height / 2}px`;
            handle.style.left = `${rect.left}px`;
            handle.style.transform = dragging
                ? 'translate(-58%, -50%) scale(1.03)'
                : 'translate(-58%, -50%)';
        };

        const onPointerMove = (e) => {
            if (!dragging) return;
            const clientX = e.clientX ?? e.touches?.[0]?.clientX;
            if (clientX == null) return;
            const delta = startX - clientX;
            const next = clampDrawerWidth(startW + delta);
            container.style.setProperty('--aif-drawer-width', `${next}px`);
            positionHandle();
        };

        const endDrag = () => {
            if (!dragging) return;
            dragging = false;
            handle.classList.remove('aif-drawer-resize--active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            saveDrawerWidth(getDrawerWidth(container));
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', endDrag);
            window.removeEventListener('pointercancel', endDrag);
            positionHandle();
        };

        handle.addEventListener('pointerdown', (e) => {
            if (!mq.matches) return;
            e.preventDefault();
            e.stopPropagation();
            dragging = true;
            startX = e.clientX;
            startW = getDrawerWidth(container);
            handle.classList.add('aif-drawer-resize--active');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            handle.setPointerCapture(e.pointerId);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', endDrag);
            window.addEventListener('pointercancel', endDrag);
            positionHandle();
        });

        handle.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!mq.matches) return;
            container.style.removeProperty('--aif-drawer-width');
            try {
                localStorage.removeItem(DRAWER_WIDTH_STORAGE_KEY);
            } catch {
                /* ignore */
            }
            positionHandle();
        });

        const syncHandleVisibility = () => {
            positionHandle();
        };

        mq.addEventListener('change', syncHandleVisibility);
        window.addEventListener('resize', positionHandle);
        container.addEventListener('transitionend', positionHandle);

        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => positionHandle());
            resizeObserver.observe(container);
        }

        modalOverlay.appendChild(handle);

        return {
            handle,
            sync: positionHandle,
            destroy() {
                mq.removeEventListener('change', syncHandleVisibility);
                window.removeEventListener('resize', positionHandle);
                container.removeEventListener('transitionend', positionHandle);
                resizeObserver?.disconnect();
                handle.remove();
            }
        };
    }

    const FOCUSABLE_SELECTOR = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function listFocusables(root) {
        return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.getAttribute('aria-hidden') === 'true') return false;
            return el.offsetParent !== null || el.getClientRects().length > 0;
        });
    }

    const Modal = () => {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'ai-furniture-modal';

        const scrim = document.createElement('div');
        scrim.className = 'aif-drawer-scrim';
        scrim.setAttribute('aria-hidden', 'true');

        const container = document.createElement('div');
        container.className = 'aif-container';
        container.setAttribute('role', 'dialog');
        container.setAttribute('aria-modal', 'true');
        container.setAttribute('aria-label', 'AI furniture preview');

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'aif-close-btn';
        closeBtn.type = 'button';
        closeBtn.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/></svg>';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.onclick = actions.closeModal;

        const chrome = document.createElement('div');
        chrome.className = 'aif-drawer-chrome';
        chrome.appendChild(closeBtn);
        container.appendChild(chrome);

        const contentArea = document.createElement('div');
        contentArea.className = 'aif-content';
        container.appendChild(contentArea);

        const footer = WidgetFooter();
        container.appendChild(footer);

        modalOverlay.appendChild(scrim);
        modalOverlay.appendChild(container);

        const drawerResize = initDrawerResize(container, modalOverlay);

        // Click anywhere outside the drawer to close (desktop + mobile).
        // Optional desktop scrim uses a flat tint only — no backdrop-filter (avoids blurring the store).
        let docHandlersAttached = false;
        /** @type {HTMLElement | null} */
        let focusReturnEl = null;

        const onDocPointerDownCapture = (e) => {
            const state = store.getState();
            if (!state.isOpen) return;
            if (!(e.target instanceof Element)) return;
            if (container.contains(e.target)) return;
            if (drawerResize?.handle?.contains(e.target)) return;
            // Close and swallow the click so the underlying page doesn't accidentally activate something.
            e.preventDefault();
            e.stopPropagation();
            actions.closeModal();
        };

        const onDocKeyDown = (e) => {
            const state = store.getState();
            if (!state.isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                actions.closeModal();
                return;
            }
            if (e.key !== 'Tab') return;
            const list = listFocusables(container);
            if (list.length === 0) return;
            const first = list[0];
            const last = list[list.length - 1];
            const active = document.activeElement;
            if (e.shiftKey) {
                if (active === first || !container.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        const attachDocHandlers = () => {
            if (docHandlersAttached || typeof document === 'undefined') return;
            docHandlersAttached = true;
            document.addEventListener('pointerdown', onDocPointerDownCapture, true);
            document.addEventListener('keydown', onDocKeyDown, true);
        };

        const detachDocHandlers = () => {
            if (!docHandlersAttached || typeof document === 'undefined') return;
            docHandlersAttached = false;
            document.removeEventListener('pointerdown', onDocPointerDownCapture, true);
            document.removeEventListener('keydown', onDocKeyDown, true);
        };

        const focusDrawer = () => {
            requestAnimationFrame(() => {
                try {
                    const resultsClose = container.querySelector('.aif-results-close');
                    (resultsClose instanceof HTMLElement ? resultsClose : closeBtn).focus();
                } catch {
                    /* ignore */
                }
            });
        };

        const syncChromeForView = (view) => {
            const hideChrome = view === VIEWS.RESULTS;
            chrome.hidden = hideChrome;
            chrome.style.display = hideChrome ? 'none' : '';
        };

        const restoreFocusIfPossible = () => {
            if (!(focusReturnEl instanceof HTMLElement)) return;
            try {
                if (document.contains(focusReturnEl)) {
                    focusReturnEl.focus();
                }
            } catch {
                /* ignore */
            }
            focusReturnEl = null;
        };

        // Render content based on view
        const renderContent = (state) => {
            const activeProcessing = state.queue.find(
                (i) => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING
            );
            const activeId = activeProcessing?.id || '';
            const analyzing =
                (state.view === VIEWS.QUEUE || state.view === VIEWS.GENERATING) &&
                activeId &&
                contentArea.querySelector('.aif-analyze-view');

            // Keep the analyze UI mounted so step animations don't reset on every poll tick
            if (
                analyzing &&
                contentArea.dataset.aifActiveQueueId === activeId &&
                contentArea.dataset.aifRenderedView === VIEWS.QUEUE
            ) {
                container.setAttribute('data-aif-view', state.view || '');
                syncChromeForView(state.view);
                return;
            }

            // Preserve measure chip selection focus churn only when width changes mid-type —
            // still remount MeasureView from state (furnitureWidthCm lives in store).

            contentArea.innerHTML = '';
            container.setAttribute('data-aif-view', state.view || '');
            syncChromeForView(state.view);
            contentArea.dataset.aifRenderedView = state.view || '';
            if (activeId) contentArea.dataset.aifActiveQueueId = activeId;
            else delete contentArea.dataset.aifActiveQueueId;

            if (state.view === VIEWS.UPLOAD) {
                contentArea.appendChild(UploadView(state));
            } else if (state.view === VIEWS.MEASURE) {
                contentArea.appendChild(MeasureView(state));
            } else if (state.view === VIEWS.GENERATING) {
                contentArea.appendChild(QueueView(state));
            } else if (state.view === VIEWS.RESULTS) {
                contentArea.appendChild(ResultsView(state));
            } else if (state.view === VIEWS.QUEUE) {
                contentArea.appendChild(QueueView(state));
            } else if (state.view === VIEWS.ERROR) {
                contentArea.appendChild(UploadView(state));
            }
        };

        let wasOpen = false;

        store.subscribe((state) => {
            const nowOpen = !!state.isOpen;
            const opening = nowOpen && !wasOpen;
            const closing = !nowOpen && wasOpen;

            if (opening) {
                if (
                    document.activeElement instanceof HTMLElement &&
                    !container.contains(document.activeElement)
                ) {
                    focusReturnEl = document.activeElement;
                } else {
                    focusReturnEl = null;
                }
            }

            if (closing) {
                detachDocHandlers();
                restoreFocusIfPossible();
            }

            if (nowOpen) {
                modalOverlay.classList.add('open');
                attachDocHandlers();
                requestAnimationFrame(() => {
                    syncMobileLayoutVars();
                    drawerResize?.sync();
                });
                setTimeout(() => drawerResize?.sync(), 450);
            } else {
                modalOverlay.classList.remove('open');
                drawerResize?.sync();
            }

            wasOpen = nowOpen;

            renderContent(state);
            drawerResize?.sync();

            if (opening) {
                focusDrawer();
            }
        });

        // Restore modal immediately on full-page reload (subscribe only fires on changes,
        // so if isOpen:true was persisted in sessionStorage we must render the initial state here)
        const initialState = store.getState();
        if (initialState.isOpen) {
            wasOpen = true;
            if (
                document.activeElement instanceof HTMLElement &&
                !container.contains(document.activeElement)
            ) {
                focusReturnEl = document.activeElement;
            } else {
                focusReturnEl = null;
            }
            modalOverlay.classList.add('open');
            attachDocHandlers();
            renderContent(initialState);
            focusDrawer();
            requestAnimationFrame(() => drawerResize?.sync());
            setTimeout(() => drawerResize?.sync(), 450);
        }

        return modalOverlay;
    };

    const BACKEND_JOB_STATUS = {
        PROCESSING: 'PROCESSING',
        COMPLETED: 'COMPLETED',
        FAILED: 'FAILED'
    };

    const POLL_INTERVAL_MS = 4000;
    const MAX_POLL_MS = 5 * 60 * 1000;
    const MAX_MISSING_STATUS_POLLS = 20;

    function pickStablePreviewUrl(savedResponse, fallbackUrl) {
        const candidate =
            savedResponse?.generation?.previewImageUrl ||
            savedResponse?.previewImageUrl ||
            savedResponse?.generation?.url ||
            savedResponse?.url ||
            fallbackUrl;
        if (typeof candidate !== 'string') return fallbackUrl;
        return candidate;
    }

    function getDomainForApi(mergedConfig) {
        const raw = mergedConfig?.domain || getStorefrontDomain();
        if (!raw) return getStorefrontDomain();
        return String(raw)
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '')
            .toLowerCase()
            .trim();
    }

    function getDomainForItem(item, mergedConfig) {
        return item?.jobDomain || getDomainForApi(mergedConfig);
    }

    function getSessionIdForApi(mergedConfig) {
        try {
            return (
                mergedConfig?.sessionId ||
                (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ai_furniture_session_id')) ||
                null
            );
        } catch {
            return mergedConfig?.sessionId || null;
        }
    }

    function isTransientFetchError(error) {
        if (!error) return false;
        if (isPageUnloading) return true;
        if (error.name === 'AbortError') return true;
        const msg = String(error.message || error).toLowerCase();
        return (
            msg.includes('failed to fetch') ||
            msg.includes('networkerror') ||
            msg.includes('network request failed') ||
            msg.includes('load failed') ||
            msg.includes('the operation was aborted')
        );
    }

    let queueRetryTimer = null;

    function scheduleQueueRetry(delayMs = 800) {
        if (isPageUnloading) return;
        if (queueRetryTimer) clearTimeout(queueRetryTimer);
        queueRetryTimer = setTimeout(() => {
            queueRetryTimer = null;
            if (!isPageUnloading) {
                scheduleQueueWork(store.getState());
            }
        }, delayMs);
    }

    function persistQueueProgress(id, updates) {
        actions.updateQueueItem(id, updates);
        flushSessionSnapshot();
    }

    function handleMissingJobStatus(id, item) {
        const misses = (item.pollMissCount || 0) + 1;
        if (misses >= MAX_MISSING_STATUS_POLLS) {
            actions.updateQueueItem(id, {
                pollMissCount: misses,
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: 'Preview timed out — tap Try again'
            });
            return 'failed';
        }
        persistQueueProgress(id, { pollMissCount: misses });
        scheduleQueueRetry(1500);
        return 'missing';
    }

    function resumeQueueAfterNavigation() {
        isPageUnloading = false;
        if (queueRetryTimer) {
            clearTimeout(queueRetryTimer);
            queueRetryTimer = null;
        }
        processingItems.clear();
        pollingItems.clear();
        inFlightById.clear();

        store.getState().queue.forEach((item) => {
            if (
                (item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING) &&
                (item.backendJobSubmitted || item.imageS3Key)
            ) {
                actions.updateQueueItem(item.id, { pollMissCount: 0, error: null });
            }
        });

        flushSessionSnapshot();
        scheduleQueueWork(store.getState());
    }

    function getApiEndpoint(mergedConfig) {
        if (mergedConfig?.apiEndpoint) return mergedConfig.apiEndpoint;
        const isLocalMode =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '0.0.0.0');
        return getDefaultApiEndpoints(isLocalMode).apiEndpoint;
    }

    function getDomainIdForApi(mergedConfig) {
        const id = mergedConfig?.domainId;
        return id ? String(id).trim() : '';
    }

    async function uploadImageViaBackend({ apiEndpoint, domain, domainId, sessionId, fileOrBlob }) {
        const compressed = await compressRoomImage(fileOrBlob);
        const formData = new FormData();
        formData.append('image', compressed, compressed.name || 'room.jpg');
        formData.append('domain', domain);
        if (domainId) formData.append('domainId', domainId);
        if (sessionId) formData.append('sessionId', sessionId);

        const r = await fetch(`${apiEndpoint}/upload`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: formData,
            credentials: 'omit'
        });
        const data = await r.json().catch(() => ({}));
        if (r.status === 413) {
            throw new Error('Photo is too large — try a smaller image or retake the photo');
        }
        if (!r.ok) throw new Error(data.error || `upload HTTP ${r.status}`);
        if (!data.s3Key) throw new Error('upload missing s3Key');
        return { s3Key: data.s3Key, imageUrl: data.imageUrl || null };
    }

    const processingItems = new Set();
    const pollingItems = new Set();
    const inFlightById = new Map();
    let queueProcessorInitialized = false;
    let isPageUnloading = false;

    function tryClaimQueueItem(id) {
        if (inFlightById.has(id) || processingItems.has(id) || pollingItems.has(id)) {
            return false;
        }
        processingItems.add(id);
        return true;
    }

    function releaseQueueItem(id) {
        processingItems.delete(id);
        pollingItems.delete(id);
        inFlightById.delete(id);
    }

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

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function applyCompletedResult(id, item, resultPayload, uploaded, mergedConfig) {
        const result = resultPayload?.result || resultPayload;
        const originalImageUrl =
            result.generatedImages?.[0]?.originalImageUrl || uploaded?.imageUrl || item.userImageUrl || null;
        const generatedImageUrl = result.generatedImages?.[0]?.url;

        actions.updateQueueItem(id, {
            status: QUEUE_STATUS.COMPLETED,
            completedAt: Date.now(),
            pollMissCount: 0,
            imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
            userImageUrl: originalImageUrl || item.userImageUrl,
            backendJobSubmitted: false,
            result: {
                generatedImageUrl,
                originalImageUrl,
                imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
                furnitureWidthCm:
                    typeof item.furnitureWidthCm === 'number' &&
                    Number.isFinite(item.furnitureWidthCm) &&
                    item.furnitureWidthCm > 0
                        ? item.furnitureWidthCm
                        : null,
                model: item.selectedModel,
                generationTime: result.timings?.total?.durationSeconds,
                timestamp: new Date().toISOString(),
                productData: result.productData,
                originalAspectRatio:
                    result.originalImageDimensions?.aspectRatio ||
                    result.generatedImages?.[0]?.originalAspectRatio,
                originalWidth:
                    result.originalImageDimensions?.width || result.generatedImages?.[0]?.originalWidth,
                originalHeight:
                    result.originalImageDimensions?.height || result.generatedImages?.[0]?.originalHeight
            }
        });

        trackEvent('ai_generation_completed', {
            queueId: id,
            productUrl: item.productUrl,
            productName: item.productName || document.title,
            model: item.selectedModel,
            generationTime: result.timings?.total?.durationSeconds,
            hasResult: !!generatedImageUrl,
            generatedImageUrl
        });

        const anonKey = getWidgetAnonymousClientId();
        const apiEndpoint = mergedConfig?.apiEndpoint || getApiEndpoint(mergedConfig);
        const { productUrl } = item;
        const { furnitureWidthCm } = item;

        if (generatedImageUrl && anonKey && apiEndpoint) {
            const domainForHistory = getDomainForApi(mergedConfig);
            const payload = {
                domain: domainForHistory,
                ...(mergedConfig?.domainId ? { domainId: mergedConfig.domainId } : {}),
                productUrl,
                productName: (item.productName || document.title || '').slice(0, 500),
                previewImageUrl: generatedImageUrl,
                originalImageUrl: originalImageUrl || null,
                anonymousClientKey: anonKey,
                metadata: {
                    queueId: id,
                    imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
                    ...(typeof furnitureWidthCm === 'number' &&
                    Number.isFinite(furnitureWidthCm) &&
                    furnitureWidthCm > 0
                        ? { furnitureWidthCm }
                        : {}),
                    originalAspectRatio:
                        result.originalImageDimensions?.aspectRatio ||
                        result.generatedImages?.[0]?.originalAspectRatio,
                    originalWidth:
                        result.originalImageDimensions?.width ||
                        result.generatedImages?.[0]?.originalWidth,
                    originalHeight:
                        result.originalImageDimensions?.height ||
                        result.generatedImages?.[0]?.originalHeight
                }
            };
            postWidgetGeneration(apiEndpoint, payload)
                .then((saved) => {
                    const stablePreviewUrl = pickStablePreviewUrl(saved, generatedImageUrl);
                    if (stablePreviewUrl && stablePreviewUrl !== generatedImageUrl) {
                        actions.updateQueueItem(id, {
                            result: {
                                ...(store.getState().queue.find((q) => q.id === id)?.result || {}),
                                generatedImageUrl: stablePreviewUrl
                            }
                        });
                    }
                    actions.syncShopperGenerations();
                })
                .catch((e) => debugLog('Could not save preview to history', e?.message || e));
        }

        if (generatedImageUrl) {
            actions.setGenerationResults([
                {
                    url: generatedImageUrl,
                    originalImageUrl: originalImageUrl || '',
                    queueId: id,
                    originalAspectRatio:
                        result.originalImageDimensions?.aspectRatio ||
                        result.generatedImages?.[0]?.originalAspectRatio,
                    originalWidth:
                        result.originalImageDimensions?.width ||
                        result.generatedImages?.[0]?.originalWidth,
                    originalHeight:
                        result.originalImageDimensions?.height ||
                        result.generatedImages?.[0]?.originalHeight,
                    imageS3Key: uploaded?.s3Key || item.imageS3Key || null,
                    generatedS3Key: result.generatedImages?.[0]?.s3Key || null,
                    furnitureWidthCm:
                        typeof item.furnitureWidthCm === 'number' &&
                        Number.isFinite(item.furnitureWidthCm) &&
                        item.furnitureWidthCm > 0
                            ? item.furnitureWidthCm
                            : null
                }
            ]);
            actions.setView(VIEWS.RESULTS);

            // Only collect training pairs when review mode is on (?aif_training=1 or config.trainingReview)
            if (isTrainingReviewEnabled(mergedConfig)) {
                scheduleTrainingPairExport({
                    queueId: id,
                    item,
                    result,
                    uploaded,
                    mergedConfig,
                    apiEndpoint,
                    domain: getDomainForApi(mergedConfig),
                    originalImageUrl,
                    generatedImageUrl,
                });
            }
        }
    }

    function handleAsyncJobStatus(id, item, statusPayload, uploaded, mergedConfig) {
        if (statusPayload.status === BACKEND_JOB_STATUS.COMPLETED && statusPayload.result) {
            applyCompletedResult(id, item, statusPayload, uploaded, mergedConfig);
            return 'completed';
        }
        if (statusPayload.status === BACKEND_JOB_STATUS.FAILED) {
            actions.updateQueueItem(id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: statusPayload.error || 'Generation failed',
                backendJobSubmitted: false
            });
            return 'failed';
        }
        if (statusPayload.status === BACKEND_JOB_STATUS.PROCESSING) {
            return 'processing';
        }
        return 'unknown';
    }

    async function pollAsyncJobUntilComplete(id, item, apiEndpoint, domainForApi, domainIdForApi, uploaded, mergedConfig) {
        if (pollingItems.has(id)) return 'polling';
        pollingItems.add(id);

        const startedAt = item.startedAt || Date.now();
        const deadline = startedAt + MAX_POLL_MS;

        try {
            while (!isPageUnloading && Date.now() < deadline) {
                let statusPayload;
                try {
                    statusPayload = await fetchWidgetGenerationStatus(apiEndpoint, {
                        queueId: id,
                        domain: domainForApi,
                        domainId: domainIdForApi
                    });
                } catch (e) {
                    if (e?.status === 404) return 'missing';
                    if (isTransientFetchError(e)) {
                        if (isPageUnloading) return 'interrupted';
                        await sleep(POLL_INTERVAL_MS);
                        continue;
                    }
                    await sleep(POLL_INTERVAL_MS);
                    continue;
                }

                const outcome = handleAsyncJobStatus(id, item, statusPayload, uploaded, mergedConfig);
                if (outcome === 'completed' || outcome === 'failed') return outcome;
                await sleep(POLL_INTERVAL_MS);
            }
            return isPageUnloading ? 'interrupted' : 'timeout';
        } finally {
            pollingItems.delete(id);
        }
    }

    async function fetchAsyncJobStatusOnce(id, apiEndpoint, domainForApi, domainIdForApi) {
        try {
            return await fetchWidgetGenerationStatus(apiEndpoint, {
                queueId: id,
                domain: domainForApi,
                domainId: domainIdForApi
            });
        } catch (e) {
            if (e?.status === 404) return null;
            if (isTransientFetchError(e)) return null;
            throw e;
        }
    }

    function appendPreScrapedData(formData, mergedConfig) {
        const preScraped = buildShopifyPreScrapedPayload(mergedConfig);
        if (preScraped) {
            formData.append('preScrapedData', JSON.stringify(preScraped));
            debugLog('Using Shopify theme product images (skip scrape)', {
                count: preScraped.images.length,
            });
        }
    }

    async function submitAsyncJob(id, item, apiEndpoint, domainForApi, domainIdForApi, sessionIdForApi, uploaded, mergedConfig) {
        if (!uploaded?.s3Key) {
            throw new Error('imageS3Key required for async generation');
        }

        const formData = new FormData();
        formData.append('queueId', id);
        formData.append('productUrl', item.productUrl);
        formData.append('productName', (item.productName || document.title || '').slice(0, 500));
        formData.append('model', 'slow');
        formData.append('domain', domainForApi);
        if (domainIdForApi) formData.append('domainId', domainIdForApi);
        formData.append('imageS3Key', uploaded.s3Key);
        if (sessionIdForApi) formData.append('sessionId', sessionIdForApi);
        if (
            typeof item.furnitureWidthCm === 'number' &&
            Number.isFinite(item.furnitureWidthCm) &&
            item.furnitureWidthCm > 0
        ) {
            formData.append('furnitureWidthCm', String(item.furnitureWidthCm));
        }
        appendPreScrapedData(formData, mergedConfig);

        debugLog(`POST /widget/generate for ${id.slice(0, 8)}`);
        await startWidgetGeneration(apiEndpoint, formData);
        persistQueueProgress(id, {
            backendJobSubmitted: true,
            pollMissCount: 0,
            jobDomain: domainForApi
        });
    }

    async function runSyncGenerate(id, item, apiEndpoint, domainForApi, domainIdForApi, sessionIdForApi, uploaded, imageToUse, mergedConfig) {
        const formData = new FormData();
        formData.append('productUrl', item.productUrl);
        formData.append('model', 'slow');
        formData.append('domain', domainForApi);
        if (domainIdForApi) formData.append('domainId', domainIdForApi);
        if (sessionIdForApi) formData.append('sessionId', sessionIdForApi);
        if (uploaded?.s3Key) {
            formData.append('imageS3Key', uploaded.s3Key);
        } else if (imageToUse) {
            formData.append('image', imageToUse);
        }
        if (
            typeof item.furnitureWidthCm === 'number' &&
            Number.isFinite(item.furnitureWidthCm) &&
            item.furnitureWidthCm > 0
        ) {
            formData.append('furnitureWidthCm', String(item.furnitureWidthCm));
        }
        appendPreScrapedData(formData, mergedConfig);

        debugLog(`POST /generate for ${id.slice(0, 8)}`);
        const response = await fetch(`${apiEndpoint}/generate`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: formData,
            credentials: 'omit'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || `generate HTTP ${response.status}`);
        }
        return result;
    }

    let queueWatchdogStarted = false;

    function startQueueWatchdog() {
        if (queueWatchdogStarted || typeof window === 'undefined') return;
        queueWatchdogStarted = true;
        window.setInterval(() => {
            if (isPageUnloading) return;
            const { queue } = store.getState();
            const needsWork = queue.some(
                (item) =>
                    (item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING) &&
                    !inFlightById.has(item.id) &&
                    !pollingItems.has(item.id)
            );
            if (needsWork) {
                scheduleQueueWork(store.getState());
            }
        }, 5000);
    }

    function initQueueProcessor() {
        if (queueProcessorInitialized) {
            scheduleQueueWork(store.getState());
            return;
        }

        queueProcessorInitialized = true;
        store.subscribe((state) => scheduleQueueWork(state));
        startQueueWatchdog();
        scheduleQueueWork(store.getState());
    }

    function getFreshQueueItem(id) {
        return store.getState().queue.find((q) => q.id === id) || null;
    }

    function prepareQueueItemForProcessing(item) {
        if (
            item.status !== QUEUE_STATUS.PENDING &&
            item.startedAt &&
            Date.now() - item.startedAt > MAX_POLL_MS
        ) {
            actions.updateQueueItem(item.id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: 'Generation timed out - please retry'
            });
            return null;
        }

        if (!item.userImage && !item.userImageDataUrl && !item.imageS3Key) {
            actions.updateQueueItem(item.id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: 'Image data lost - please re-upload'
            });
            return null;
        }

        const prepared = { ...item };
        if (prepared.userImageDataUrl && !prepared.userImage && !prepared.imageS3Key) {
            const blob = dataURLToBlob(prepared.userImageDataUrl);
            if (!blob) {
                actions.updateQueueItem(item.id, {
                    status: QUEUE_STATUS.ERROR,
                    completedAt: Date.now(),
                    error: 'Failed to restore image - please re-upload'
                });
                return null;
            }
            prepared.userImage = blob;
        }

        return prepared;
    }

    function isRecoverableNetworkErrorMessage(error) {
        if (!error || typeof error !== 'string') return false;
        const msg = error.toLowerCase();
        return (
            msg.includes('failed to fetch') ||
            msg.includes('networkerror') ||
            msg.includes('network request failed') ||
            msg.includes('load failed')
        );
    }

    function scheduleQueueWork(state) {
        state.queue
            .filter(
                (item) =>
                    item.status === QUEUE_STATUS.ERROR &&
                    isRecoverableNetworkErrorMessage(item.error) &&
                    (item.backendJobSubmitted || item.imageS3Key || item.userImageDataUrl)
            )
            .forEach((item) => {
                actions.updateQueueItem(item.id, {
                    status: QUEUE_STATUS.PROCESSING,
                    error: null
                });
            });

        const activeState = store.getState();
        activeState.queue
            .filter(
                (item) =>
                    item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING
            )
            .forEach((item) => {
                processQueueItem(item);
            });
    }

    async function processQueueItem(item) {
        const id = item.id;
        if (inFlightById.has(id)) return inFlightById.get(id);

        const prepared = prepareQueueItemForProcessing(item);
        if (!prepared) return;

        if (!tryClaimQueueItem(id)) return;

        const work = runQueueItemWork(prepared);
        inFlightById.set(id, work);
        try {
            await work;
        } finally {
            releaseQueueItem(id);
        }
    }

    async function runQueueItemWork(item) {
        const id = item.id;
        const mergedConfig = { ...(store.getState().config || {}), ...(item.config || {}) };
        const { userImage, userImageDataUrl, imageS3Key } = item;

        let imageToUse = null;
        if (!imageS3Key || !item.userImageUrl) {
            imageToUse = userImage;
            if (!imageToUse || !(imageToUse instanceof File || imageToUse instanceof Blob)) {
                if (userImageDataUrl) {
                    imageToUse = dataURLToBlob(userImageDataUrl);
                    if (imageToUse) actions.updateQueueItem(id, { userImage: imageToUse });
                }
            }
        }
        if (!imageS3Key && !imageToUse) {
            actions.updateQueueItem(id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: 'Image data lost - please re-upload'
            });
            return;
        }

        if (imageToUse && !userImageDataUrl && !imageS3Key) {
            try {
                const dataUrl = await fileToDataURL(imageToUse);
                persistQueueProgress(id, { userImageDataUrl: dataUrl });
            } catch (e) {
                debugLog('Could not persist room photo before upload', e?.message || e);
            }
        }

        const apiEndpoint = getApiEndpoint(mergedConfig);
        const domainForApi = getDomainForItem(item, mergedConfig);
        const domainIdForApi = getDomainIdForApi(mergedConfig);
        const sessionIdForApi = getSessionIdForApi(mergedConfig);

        try {
            actions.updateQueueItem(id, {
                status: QUEUE_STATUS.PROCESSING,
                startedAt: item.startedAt || Date.now(),
                error: null
            });

            let uploaded = imageS3Key ? { s3Key: imageS3Key, imageUrl: item.userImageUrl || null } : null;

            if (!uploaded?.s3Key && imageToUse) {
                debugLog(`Uploading via backend /upload for ${id.slice(0, 8)}`);
                try {
                    uploaded = await uploadImageViaBackend({
                        apiEndpoint,
                        domain: domainForApi,
                        domainId: domainIdForApi,
                        sessionId: sessionIdForApi,
                        fileOrBlob: imageToUse
                    });
                    persistQueueProgress(id, {
                        imageS3Key: uploaded.s3Key,
                        userImageUrl: uploaded.imageUrl || item.userImageUrl || null,
                        jobDomain: domainForApi
                    });
                } catch (uploadErr) {
                    if (isTransientFetchError(uploadErr)) {
                        debugLog(`Upload interrupted for ${id.slice(0, 8)} — will resume`, uploadErr?.message || uploadErr);
                        scheduleQueueRetry();
                        return;
                    }
                    debugLog('Backend /upload failed, sending image with /generate', uploadErr?.message || uploadErr);
                }
            }

            const latest = getFreshQueueItem(id) || item;
            const pollDomain = getDomainForItem(latest, mergedConfig);

            // Resume: poll an already-submitted backend job (safe across page navigation).
            if (latest.backendJobSubmitted) {
                const pollOutcome = await pollAsyncJobUntilComplete(
                    id,
                    latest,
                    apiEndpoint,
                    pollDomain,
                    domainIdForApi,
                    uploaded,
                    mergedConfig
                );
                if (pollOutcome === 'completed' || pollOutcome === 'failed') return;
                if (pollOutcome === 'interrupted' || pollOutcome === 'polling') {
                    scheduleQueueRetry(600);
                    return;
                }
                if (pollOutcome === 'missing') {
                    if (latest.backendJobSubmitted) {
                        handleMissingJobStatus(id, getFreshQueueItem(id) || latest);
                        return;
                    }
                }
            } else if (uploaded?.s3Key || latest.imageS3Key) {
                // Another tab/page may have submitted while we were uploading — check once before creating a job.
                const existingStatus = await fetchAsyncJobStatusOnce(id, apiEndpoint, pollDomain, domainIdForApi);
                if (existingStatus) {
                    const existingOutcome = handleAsyncJobStatus(
                        id,
                        latest,
                        existingStatus,
                        uploaded,
                        mergedConfig
                    );
                    if (existingOutcome === 'completed' || existingOutcome === 'failed') return;
                    if (existingStatus.status === BACKEND_JOB_STATUS.PROCESSING) {
                        persistQueueProgress(id, {
                            backendJobSubmitted: true,
                            pollMissCount: 0,
                            jobDomain: pollDomain
                        });
                        const pollOutcome = await pollAsyncJobUntilComplete(
                            id,
                            getFreshQueueItem(id) || latest,
                            apiEndpoint,
                            pollDomain,
                            domainIdForApi,
                            uploaded,
                            mergedConfig
                        );
                        if (pollOutcome === 'completed' || pollOutcome === 'failed') return;
                        if (pollOutcome === 'interrupted' || pollOutcome === 'polling') {
                            scheduleQueueRetry(600);
                            return;
                        }
                        if (pollOutcome === 'missing') {
                            handleMissingJobStatus(id, getFreshQueueItem(id) || latest);
                            return;
                        }
                    }
                }
            }

            if (!uploaded?.s3Key) {
                const imageForGenerate = imageToUse ? await compressRoomImage(imageToUse) : null;
                const result = await runSyncGenerate(
                    id,
                    latest,
                    apiEndpoint,
                    domainForApi,
                    domainIdForApi,
                    sessionIdForApi,
                    uploaded,
                    imageForGenerate,
                    mergedConfig
                );
                applyCompletedResult(id, latest, { result }, uploaded, mergedConfig);
                return;
            }

            const beforeSubmit = getFreshQueueItem(id) || latest;
            const submitDomain = getDomainForItem(beforeSubmit, mergedConfig);
            if (!beforeSubmit.backendJobSubmitted) {
                await submitAsyncJob(id, beforeSubmit, apiEndpoint, submitDomain, domainIdForApi, sessionIdForApi, uploaded, mergedConfig);
            }

            const finalOutcome = await pollAsyncJobUntilComplete(
                id,
                getFreshQueueItem(id) || beforeSubmit,
                apiEndpoint,
                submitDomain,
                domainIdForApi,
                uploaded,
                mergedConfig
            );
            if (finalOutcome === 'completed' || finalOutcome === 'failed') return;
            if (finalOutcome === 'interrupted' || finalOutcome === 'polling' || finalOutcome === 'timeout') {
                scheduleQueueRetry(finalOutcome === 'timeout' ? 2000 : 600);
                return;
            }
            if (finalOutcome === 'missing') {
                handleMissingJobStatus(id, getFreshQueueItem(id) || beforeSubmit);
                return;
            }

            actions.updateQueueItem(id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: 'Generation failed - please retry'
            });
        } catch (error) {
            if (isTransientFetchError(error)) {
                debugLog(`Generation interrupted for ${id.slice(0, 8)} — will resume`, error?.message || error);
                scheduleQueueRetry();
                return;
            }
            console.error(`Generation failed for ${id.slice(0, 8)}:`, error);
            actions.updateQueueItem(id, {
                status: QUEUE_STATUS.ERROR,
                completedAt: Date.now(),
                error: error.message || 'Generation failed'
            });
        }
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
            isPageUnloading = true;
            processingItems.clear();
            pollingItems.clear();
            inFlightById.clear();
        });

        window.addEventListener('pageshow', () => {
            resumeQueueAfterNavigation();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                resumeQueueAfterNavigation();
            }
        });
    }

    /**
     * Centralized styles for the widget
     * Injected into the head to avoid external CSS dependencies
     */

    const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650&family=DM+Sans:wght@400;500;600;700&display=swap');

  :root {
    --aif-primary: #8b6914;
    --aif-primary-hover: #6f5310;
    --aif-primary-dark: #4a3810;
    --aif-accent-soft: #f3ead8;
    --aif-accent-glow: rgba(184, 134, 20, 0.28);
    --aif-bg-overlay: transparent;
    --aif-bg-panel: #faf8f5;
    --aif-bg-elevated: #ffffff;
    --aif-text-main: #2c241c;
    --aif-text-muted: #6b5f54;
    --aif-border: #e8dfd2;
    --aif-shadow: 0 28px 56px -16px rgba(44, 36, 28, 0.22);
    --aif-radius: 20px;
    --aif-radius-sm: 12px;
    --aif-font: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
    --aif-font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
    --aif-safe-top: env(safe-area-inset-top, 0px);
    --aif-safe-bottom: env(safe-area-inset-bottom, 0px);
    --aif-safe-left: env(safe-area-inset-left, 0px);
    --aif-safe-right: env(safe-area-inset-right, 0px);
    --aif-vvh: 100dvh;
    --aif-drawer-height: 100dvh;
  }

  /*
   * Wrapper uses display:contents when open (no extra fullscreen box — avoids blurring the store).
   * Desktop: flat tint scrim behind the drawer (no backdrop-filter). Clicks outside the panel close the widget.
   */
  #ai-furniture-modal {
    display: none;
    font-family: var(--aif-font);
  }

  #ai-furniture-modal.open {
    display: contents;
  }

  .aif-drawer-scrim {
    display: none;
  }

  @media (min-width: 769px) {
    #ai-furniture-modal.open .aif-drawer-scrim {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 999998;
      pointer-events: auto;
      background: rgba(44, 36, 28, 0.32);
    }
  }

  .aif-container {
    position: fixed;
    z-index: 999999;
    background: var(--aif-bg-panel);
    box-shadow: var(--aif-shadow);
    overflow: hidden;
    isolation: isolate;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    pointer-events: auto; /* re-enable interactions inside the panel */
    box-sizing: border-box;
    height: 100%;
    max-height: 100dvh;
  }

  /* Desktop Styles */
  @media (min-width: 769px) {
    .aif-container {
      top: 0;
      right: 0;
      height: 100%;
      width: var(--aif-drawer-width, clamp(360px, 34vw, 520px));
      border-radius: var(--aif-radius) 0 0 var(--aif-radius);
      border-left: 1px solid var(--aif-border);
      transform: translateX(100%);
    }

    /* Results: wider default drawer so before/after uses full panel width */
    .aif-container[data-aif-view="RESULTS"] {
      width: var(--aif-drawer-width, min(96vw, 640px));
    }
    
    #ai-furniture-modal.open .aif-container {
      transform: translateX(0);
    }
  }

  /* Mobile Styles */
  @media (max-width: 768px) {
    .aif-container {
      top: var(--aif-safe-top, 0px);
      left: var(--aif-safe-left, 0px);
      right: var(--aif-safe-right, 0px);
      width: auto;
      height: var(--aif-drawer-height, var(--aif-vvh, 100dvh));
      max-height: var(--aif-drawer-height, var(--aif-vvh, 100dvh));
      border-radius: 0;
      transform: translateY(100%);
    }

    #ai-furniture-modal.open .aif-container {
      transform: translateY(0);
    }
  }

  .aif-drawer-resize {
    display: none;
  }

  @media (min-width: 769px) {
    .aif-drawer-resize {
      display: none;
      align-items: center;
      justify-content: center;
      position: fixed;
      z-index: 10000001;
      width: 36px;
      height: 72px;
      margin: 0;
      padding: 0;
      border: 2px solid var(--aif-primary);
      border-radius: 999px;
      background: linear-gradient(180deg, #fffaf2 0%, var(--aif-accent-soft) 100%);
      color: var(--aif-primary-dark);
      box-shadow:
        0 0 0 3px rgba(255, 250, 242, 0.98),
        -6px 0 20px rgba(44, 36, 28, 0.22),
        0 10px 28px rgba(44, 36, 28, 0.18);
      cursor: ew-resize;
      touch-action: none;
      pointer-events: auto;
      transition: color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .aif-drawer-resize svg {
      display: block;
      flex-shrink: 0;
      filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.65));
    }

    .aif-drawer-resize:hover,
    .aif-drawer-resize--active {
      color: var(--aif-primary);
      border-color: var(--aif-primary-hover);
      background: linear-gradient(180deg, #ffffff 0%, #f8edd4 100%);
      box-shadow:
        0 0 0 3px rgba(255, 250, 242, 1),
        -8px 0 24px var(--aif-accent-glow),
        0 12px 30px rgba(44, 36, 28, 0.2);
    }

    .aif-drawer-resize:focus-visible {
      outline: 2px solid var(--aif-primary);
      outline-offset: 2px;
    }
  }

  .aif-drawer-chrome {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 48px;
    padding: 10px 12px 6px;
    box-sizing: border-box;
    position: relative;
    z-index: 12;
  }

  @media (prefers-reduced-motion: reduce) {
    .aif-container {
      transition-duration: 0.01ms !important;
      transition-delay: 0s !important;
    }

    .aif-close-btn,
    .aif-btn-primary,
    .aif-btn-secondary,
    .aif-btn-text {
      transition: none !important;
    }

    .aif-fade-in,
    .aif-pulse {
      animation: none !important;
    }
  }

  .aif-close-btn {
    position: relative;
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    padding: 0;
    margin: 0;
    background: #f9fafb;
    color: #6b7280;
    border: none;
    border-radius: 50%;
    font-family: var(--aif-font);
    line-height: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    -webkit-tap-highlight-color: transparent;
  }

  .aif-close-btn svg {
    display: block;
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    pointer-events: none;
    flex-shrink: 0;
  }

  .aif-close-btn:hover {
    background: #111827;
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  .aif-close-btn:active {
    transform: scale(0.95);
  }

  .aif-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 18px 18px 12px;
    gap: 10px;
    overflow-x: hidden;
    overflow-y: hidden;
    box-sizing: border-box;
  }

  /* Fill the panel: one view root per screen, no outer scroll */
  .aif-content > :first-child:not(.aif-results-view) {
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .aif-content > .aif-results-view {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    margin: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .aif-header {
    padding-top: 8px;
  }

  .aif-eyebrow {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--aif-primary);
    margin-bottom: 6px;
  }

  .aif-header h2 {
    font-family: var(--aif-font-display);
    font-size: 22px;
    font-weight: 650;
    margin: 0 0 4px 0;
    color: var(--aif-text-main);
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  .aif-header p {
    font-size: 13px;
    color: var(--aif-text-muted);
    margin: 0;
    line-height: 1.45;
  }

  .aif-results-lede {
    flex-shrink: 0;
    width: 100%;
    line-height: 1.3;
    padding: 0 0 8px;
    margin: 0 0 2px;
    border-bottom: 1px solid var(--aif-border);
  }

  .aif-results-lede__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 10px;
    margin: 0 0 4px;
    min-height: 36px;
  }

  .aif-results-close {
    grid-column: 2;
    grid-row: 1;
    width: 34px;
    height: 34px;
    min-width: 34px;
    min-height: 34px;
    margin: 0;
    justify-self: end;
  }

  .aif-results-eyebrow {
    display: block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--aif-primary);
    margin: 0 0 4px;
  }

  .aif-results-title {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--aif-font-display);
    font-size: 19px;
    font-weight: 650;
    letter-spacing: -0.02em;
    color: var(--aif-text-main);
    line-height: 1.2;
  }

  .aif-results-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 5px 0 0;
    font-size: 12px;
    color: var(--aif-text-muted);
    line-height: 1.35;
  }

  .aif-results-hint__icon {
    display: inline-flex;
    color: var(--aif-primary);
    opacity: 0.85;
    flex-shrink: 0;
  }

  .aif-results-disclaimer {
    flex-shrink: 0;
    margin: 0;
    padding: 6px 8px;
    font-size: 10px;
    line-height: 1.4;
    color: var(--aif-text-muted);
    background: var(--aif-accent-soft);
    border: 1px solid var(--aif-border);
    border-radius: 8px;
  }

  /* Results: drawer chrome removed — close lives in results header */
  .aif-container[data-aif-view="RESULTS"] .aif-drawer-chrome {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-content {
    padding: 8px 8px max(8px, var(--aif-safe-bottom, 0px));
    overflow-x: hidden;
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    -webkit-overflow-scrolling: touch;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-widget-footer {
    display: none !important;
  }

  .aif-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--aif-accent-soft);
    color: var(--aif-primary-dark);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 8px;
    box-shadow: 0 2px 10px var(--aif-accent-glow);
  }

  .aif-container::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.45;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  }

  .aif-container > :not(.aif-close-btn):not(.aif-drawer-chrome) {
    position: relative;
    z-index: 1;
  }

  .aif-upload-view .aif-dropzone {
    flex: 1 1 0;
    min-height: 0;
    padding: 28px 18px;
  }

  .aif-upload-view .aif-upload-stage {
    flex: 1 1 0;
    min-height: 0;
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .aif-upload-view .aif-upload-stage img {
    max-width: 100%;
    max-height: min(36dvh, 220px);
    width: auto;
    height: auto;
    object-fit: contain;
  }

  .aif-queue-tabs {
    flex-shrink: 0;
  }

  .aif-queue-card {
    flex-shrink: 0;
  }

  .aif-dropzone {
    border: 2px dashed #d1d5db;
    border-radius: var(--aif-radius-sm);
    padding: 32px 20px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    cursor: pointer;
    text-align: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: visible;
    pointer-events: none;
  }

  .aif-dropzone > div:last-child {
    pointer-events: auto;
  }

  .aif-dropzone::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(145deg, rgba(184, 134, 20, 0.06), rgba(107, 127, 106, 0.05));
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none; /* Allow clicks to pass through to buttons */
  }

  .aif-dropzone-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--aif-accent-soft);
    border: 1px solid var(--aif-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--aif-primary);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  .aif-dropzone-icon svg {
    width: 24px;
    height: 24px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .aif-dropzone-title {
    margin: 14px 0 4px;
    font-family: var(--aif-font-display);
    font-weight: 600;
    font-size: 17px;
    color: var(--aif-text-main);
    letter-spacing: -0.02em;
  }

  .aif-dropzone-note {
    font-size: 12px;
    color: var(--aif-text-muted);
    margin: 0;
    line-height: 1.5;
    max-width: 26ch;
  }

  .aif-upload-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: 20px;
    position: relative;
    z-index: 2;
  }

  .aif-upload-cta {
    width: 100%;
    padding: 16px 20px;
    border: none;
    border-radius: var(--aif-radius-sm);
    font-weight: 600;
    font-size: 15px;
    font-family: var(--aif-font);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 52px;
    box-sizing: border-box;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }

  .aif-upload-cta--primary {
    background: linear-gradient(165deg, #a67c1a 0%, var(--aif-primary) 55%, var(--aif-primary-hover) 100%);
    color: #fffaf2;
    box-shadow: 0 6px 20px var(--aif-accent-glow);
  }

  .aif-upload-cta--primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 28px var(--aif-accent-glow);
  }

  .aif-upload-cta--secondary {
    background: var(--aif-bg-elevated);
    border: 2px solid var(--aif-border);
    color: var(--aif-primary-hover);
  }

  .aif-upload-cta--secondary:hover {
    border-color: var(--aif-primary);
    background: var(--aif-accent-soft);
  }

  .aif-upload-privacy {
    font-size: 11px;
    color: var(--aif-text-muted);
    text-align: center;
    margin-top: 8px;
    line-height: 1.45;
  }

  .aif-dropzone:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border-color: var(--aif-primary);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }

  .aif-dropzone:hover::before {
    opacity: 1;
  }

  .aif-dropzone:active {
    transform: translateY(0);
  }

  .aif-btn-primary {
    width: 100%;
    border: none;
    border-radius: var(--aif-radius-sm);
    padding: 16px 24px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    background: linear-gradient(135deg, var(--aif-primary), var(--aif-primary-hover));
    color: white;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    letter-spacing: 0.01em;
  }

  .aif-btn-primary:disabled {
    background: linear-gradient(135deg, #e5e7eb, #d1d5db);
    color: #9ca3af;
    cursor: not-allowed;
    box-shadow: none;
    opacity: 0.6;
  }

  .aif-btn-primary:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
    background: linear-gradient(135deg, var(--aif-primary-hover), var(--aif-primary-dark));
  }

  .aif-btn-primary:not(:disabled):active {
    transform: translateY(0);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  /* Spinner */
  .aif-spinner {
    width: 20px;
    height: 20px;
    border: 2.5px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    border-top-color: white;
    animation: aif-spin 0.7s linear infinite;
  }

  @keyframes aif-spin {
    to { transform: rotate(360deg); }
  }

  /* Card */
  .aif-card {
    background: #ffffff;
    border: 1px solid var(--aif-border);
    border-radius: var(--aif-radius-sm);
    padding: 16px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .aif-card:hover {
    border-color: #d1d5db;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }

  /* Banner */
  .aif-banner {
    padding: 14px 16px;
    border-radius: var(--aif-radius-sm);
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .aif-banner-info {
    background: linear-gradient(135deg, #eff6ff, #dbeafe);
    color: #1e40af;
    border: 1px solid #93c5fd;
  }

  .aif-banner-success {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #065f46;
    border: 1px solid #6ee7b7;
  }

  .aif-banner-error {
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  .aif-banner-warning {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #92400e;
    border: 1px solid #fcd34d;
  }

  /* Image Preview */
  .aif-image-preview {
    position: relative;
    border-radius: var(--aif-radius-sm);
    overflow: hidden;
    background: #f9fafb;
    border: 1px solid var(--aif-border);
  }

  .aif-image-preview img {
    width: 100%;
    height: auto;
    display: block;
  }

  .aif-image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%);
    display: flex;
    align-items: flex-end;
    padding: 16px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .aif-image-preview:hover .aif-image-overlay {
    opacity: 1;
  }

  /* Secondary Button */
  .aif-btn-secondary {
    width: 100%;
    border: 2px solid var(--aif-border);
    background: white;
    border-radius: var(--aif-radius-sm);
    padding: 14px 24px;
    font-size: 15px;
    font-weight: 600;
    color: var(--aif-text-main);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .aif-btn-secondary:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    transform: translateY(-1px);
  }

  .aif-btn-secondary:active {
    transform: translateY(0);
  }

  /* Text Button */
  .aif-btn-text {
    background: none;
    border: none;
    color: var(--aif-primary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .aif-btn-text:hover {
    background: rgba(16, 185, 129, 0.1);
    color: var(--aif-primary-hover);
  }

  /* Progress Bar */
  .aif-progress {
    width: 100%;
    height: 6px;
    background: #e5e7eb;
    border-radius: 999px;
    overflow: hidden;
  }

  .aif-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--aif-primary), var(--aif-primary-hover));
    border-radius: 999px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  }

  /* Divider */
  .aif-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--aif-border), transparent);
    margin: 16px 0;
  }

  /* Label */
  .aif-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--aif-text-main);
    margin-bottom: 8px;
    display: block;
  }

  /* Helper Text */
  .aif-helper-text {
    font-size: 12px;
    color: var(--aif-text-muted);
    line-height: 1.5;
  }

  /* Fade In Animation */
  @keyframes aif-fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .aif-fade-in {
    animation: aif-fade-in 0.3s ease;
  }

  /* Pulse Animation */
  @keyframes aif-pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .aif-pulse {
    animation: aif-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .aif-widget-footer {
    flex-shrink: 0;
    padding: 8px 18px max(12px, calc(var(--aif-safe-bottom, 0px) + 8px));
    border-top: 1px solid var(--aif-border);
    background: linear-gradient(180deg, #fafbfc 0%, #f1f5f9 100%);
  }

  .aif-widget-footer__details {
    margin: 0;
    padding: 0;
    border: none;
  }

  .aif-widget-footer__summary {
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: var(--aif-text-muted);
    list-style: none;
    padding: 2px 0 4px;
    user-select: none;
    line-height: 1.4;
  }

  .aif-widget-footer__summary::-webkit-details-marker {
    display: none;
  }

  .aif-widget-footer__details[open] .aif-widget-footer__summary {
    color: var(--aif-text-main);
    margin-bottom: 2px;
  }

  .aif-widget-footer__label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--aif-text-muted);
    margin-bottom: 6px;
  }

  .aif-widget-footer__row {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }

  /* Override width:100% below — otherwise the input steals the full row and the Save button collapses to 0 width. */
  .aif-widget-footer__row .aif-widget-footer__input {
    flex: 1 1 0;
    min-width: 0;
    width: auto;
    max-width: 100%;
  }

  .aif-widget-footer__submit {
    flex: 0 0 auto;
    align-self: stretch;
    min-height: 42px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: #059669;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-family: var(--aif-font);
    line-height: 1.2;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .aif-widget-footer__submit:hover:not(:disabled) {
    background: #047857;
  }

  .aif-widget-footer__submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .aif-widget-footer__input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    font-size: 14px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #fff;
    color: var(--aif-text-main);
    font-family: var(--aif-font);
  }

  .aif-widget-footer__input:focus {
    outline: none;
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
  }

  .aif-widget-footer__hint {
    margin: 8px 0 0;
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
  }

  .aif-widget-footer__saved {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-widget-footer__saved-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--aif-text-muted);
  }

  .aif-widget-footer__saved-link {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: #059669;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-family: var(--aif-font);
    text-align: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .aif-widget-footer__saved-link:hover {
    background: #047857;
  }

  /* Results actions (Save / Share) */
  .aif-results-panel {
    padding: 10px;
    border-radius: var(--aif-radius-sm);
    background: var(--aif-bg-elevated);
    border: 1px solid var(--aif-border);
    box-shadow: 0 2px 12px rgba(44, 36, 28, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-results-panel__label {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--aif-text-muted);
  }

  .aif-result-actions__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .aif-result-actions__label {
    line-height: 1.2;
  }

  .aif-result-actions__btn--icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .aif-result-actions__grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-result-actions__split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .aif-result-actions__row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .aif-result-actions__btn {
    width: 100%;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    border: 1px solid var(--aif-border);
    background: var(--aif-bg-elevated);
    color: var(--aif-text-main);
    font-family: var(--aif-font);
    line-height: 1.2;
    text-align: center;
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 44px;
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease;
  }

  .aif-result-actions__btn:hover:not(:disabled) {
    border-color: #d4c4ae;
    background: #fffdf9;
  }

  .aif-result-actions__btn:active:not(:disabled) {
    background: var(--aif-accent-soft);
    transform: scale(0.98);
  }

  .aif-result-actions__btn--full {
    width: 100%;
  }

  .aif-result-actions__btn--primary {
    border: 1px solid var(--aif-primary-hover);
    background: linear-gradient(165deg, #a67c1a 0%, var(--aif-primary) 55%, var(--aif-primary-hover) 100%);
    color: #fffaf2;
    box-shadow: 0 4px 14px var(--aif-accent-glow);
  }

  .aif-result-actions__btn--primary:hover:not(:disabled) {
    background: linear-gradient(165deg, #b8891f 0%, #967515 55%, var(--aif-primary-hover) 100%);
    border-color: var(--aif-primary-hover);
  }

  .aif-result-actions__btn--primary:active:not(:disabled) {
    background: var(--aif-primary-hover);
  }

  .aif-result-actions__btn--secondary {
    border: 2px solid var(--aif-primary);
    color: var(--aif-primary-hover);
    background: var(--aif-bg-elevated);
    font-weight: 600;
  }

  .aif-result-actions__btn--secondary:active:not(:disabled) {
    background: var(--aif-accent-soft);
  }

  .aif-result-actions__btn--save {
    border: 1px solid var(--aif-border);
    color: var(--aif-text-main);
    background: var(--aif-bg-panel);
    font-weight: 600;
    font-size: 12px;
    padding: 10px 12px;
  }

  .aif-result-actions__btn--save .aif-result-actions__icon {
    color: var(--aif-primary);
  }

  .aif-result-actions__btn--save:hover:not(:disabled) {
    border-color: var(--aif-primary);
    background: var(--aif-accent-soft);
  }

  .aif-result-actions__btn--save:active:not(:disabled) {
    background: var(--aif-accent-soft);
  }

  .aif-result-actions__btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .aif-save-fallback {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding: 10px;
    border-radius: 10px;
    background: var(--aif-accent-soft);
    border: 1px solid var(--aif-border);
  }

  .aif-save-fallback__text {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: var(--aif-text-muted);
  }

  .aif-save-fallback__btn {
    width: 100%;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--aif-font);
    color: var(--aif-primary-hover);
    background: var(--aif-bg-elevated);
    border: 1px solid var(--aif-border);
    border-radius: 8px;
    cursor: pointer;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
  }

  /* Results: block layout — preview grows to fill leftover drawer space */
  .aif-results-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
    box-sizing: border-box;
  }

  .aif-results-view > * + * {
    margin-top: 10px;
  }

  @keyframes aif-results-in {
    from {
      transform: translateY(6px);
    }
    to {
      transform: translateY(0);
    }
  }

  .aif-results-lede {
    animation: aif-results-in 0.45s ease forwards;
  }

  .aif-results-grid {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    opacity: 1;
    visibility: visible;
  }

  .aif-results-save {
    flex-shrink: 0;
    width: 100%;
    overflow: visible;
    animation: aif-results-in 0.5s ease 0.12s forwards;
  }

  .aif-results-training {
    flex-shrink: 0;
    width: 100%;
    margin-bottom: 10px;
    animation: aif-results-in 0.5s ease 0.1s forwards;
  }

  .aif-results-training__info {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--aif-text-muted, #64748b);
  }

  .aif-results-training__done {
    margin: 0;
    font-size: 13px;
    color: #b45309;
    font-weight: 600;
  }

  .aif-results-training__actions {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .aif-results-training__actions .aif-result-actions__btn {
    flex: 1;
  }

  .aif-results-footer {
    flex-shrink: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    animation: aif-results-in 0.5s ease 0.18s forwards;
  }

  .aif-result-preview-block {
    position: relative;
    flex: 1 1 auto;
    min-height: 180px;
    width: 100%;
    padding: 0;
    border-radius: var(--aif-radius-sm);
    background: var(--aif-bg-elevated);
    box-shadow: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* Height driven by Slider JS — fills the flex preview area */
  .aif-result-preview-block .aif-slider,
  .aif-slider--results {
    display: block;
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    min-height: 120px;
    margin: 0 auto;
    opacity: 1;
    visibility: visible;
    border-radius: var(--aif-radius-sm);
  }

  .aif-result-preview-block .aif-results-fallback-img {
    display: block;
    flex: 1 1 auto;
    width: 100%;
    min-height: 160px;
    object-fit: cover;
    object-position: center;
    border-radius: var(--aif-radius-sm);
    background: #f5f0e8;
    margin: 0 auto;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-results-footer {
    gap: 4px;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-results-disclaimer {
    padding: 5px 7px;
    font-size: 9px;
    line-height: 1.35;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-results-panel {
    padding: 8px;
    gap: 6px;
  }

  /* Before / after slider */
  .aif-slider {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: var(--aif-radius-sm);
    background: var(--aif-bg-elevated);
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    box-shadow: none;
  }

  .aif-slider--results {
    background: var(--aif-bg-elevated);
  }

  .aif-slider__img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    object-fit: contain;
    object-position: center center;
  }

  .aif-slider--results .aif-slider__img {
    object-fit: contain;
    object-position: center center;
  }

  .aif-slider__img--before {
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .aif-slider__img--after {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    max-width: none;
  }

  .aif-slider__after-clip {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 50%;
    overflow: hidden;
    pointer-events: none;
    will-change: width;
  }

  .aif-slider__label {
    position: absolute;
    top: 12px;
    z-index: 5;
    pointer-events: none;
    padding: 5px 10px;
    border-radius: 6px;
    font-family: var(--aif-font);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  .aif-slider__label--before {
    right: 12px;
    background: rgba(44, 36, 28, 0.72);
    color: #faf8f5;
  }

  .aif-slider__label--after {
    left: 12px;
    background: rgba(139, 105, 20, 0.88);
    color: #fffaf2;
  }

  .aif-slider__divider-wrap {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: ew-resize;
    z-index: 10;
    will-change: left;
  }

  .aif-slider__divider {
    width: 2px;
    height: 100%;
    background: linear-gradient(
      180deg,
      rgba(255, 250, 242, 0.5),
      rgba(255, 250, 242, 1),
      rgba(255, 250, 242, 0.5)
    );
    box-shadow: 0 0 8px rgba(44, 36, 28, 0.25);
    pointer-events: none;
  }

  .aif-slider__handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
    background: #fffdf9;
    border: 1px solid var(--aif-border);
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(44, 36, 28, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    color: var(--aif-primary);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    pointer-events: none;
  }

  .aif-slider__handle svg:last-child {
    margin-left: -6px;
  }

  .aif-slider__handle--active,
  .aif-slider--dragging .aif-slider__handle {
    transform: translate(-50%, -50%) scale(1.08);
    box-shadow: 0 6px 20px rgba(44, 36, 28, 0.22);
  }

  .aif-queue-list {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-queue-view .aif-header {
    flex-shrink: 0;
  }

  .aif-history {
    margin-bottom: 16px;
  }

  .aif-history__title {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    margin: 0 0 10px 0;
  }

  .aif-history__row {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
    -webkit-overflow-scrolling: touch;
  }

  .aif-history__card {
    flex: 0 0 auto;
    width: 88px;
    cursor: pointer;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .aif-history__card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }

  .aif-history__card img {
    width: 100%;
    height: 64px;
    object-fit: cover;
    display: block;
  }

  .aif-history__meta {
    padding: 4px 6px;
    font-size: 9px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Mobile Optimizations */
  @media (max-width: 768px) {
    .aif-drawer-chrome {
      min-height: 52px;
      padding: 8px 10px 6px;
    }

    .aif-close-btn {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      margin: 0;
    }

    .aif-close-btn svg {
      width: 16px;
      height: 16px;
    }

    .aif-content {
      padding: 12px 14px 10px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-content {
      padding: 8px 12px 10px;
    }

    .aif-results-lede {
      padding-bottom: 8px;
    }

    .aif-results-title {
      font-size: 17px;
    }

    .aif-result-preview-block .aif-slider,
    .aif-result-preview-block .aif-results-fallback-img {
      min-height: 140px;
    }

    .aif-content > .aif-results-view {
      max-width: 100%;
    }

    /* Compact the action stack on phones so the preview + buttons fit
       inside the drawer without scrolling. */
    .aif-container[data-aif-view="RESULTS"] .aif-results-view > * + * {
      margin-top: 8px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-results-panel {
      padding: 7px;
      gap: 5px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-result-actions__btn {
      padding: 9px 10px;
      min-height: 40px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-results-hint {
      margin-top: 3px;
      font-size: 11px;
    }

    .aif-widget-footer {
      padding: 8px 14px max(10px, calc(var(--aif-safe-bottom, 0px) + 8px));
    }

    .aif-header h2 {
      font-size: 18px;
    }

    .aif-btn-primary,
    .aif-btn-secondary {
      padding: 12px 16px;
      font-size: 14px;
    }

    .aif-dropzone {
      padding: 28px 16px;
    }
  }

  /* Desktop: reclaim vertical space for results */
  @media (min-width: 769px) {
    /* Compact the per-result action block. */
    .aif-result-actions {
      padding: 6px 0 2px;
    }

    .aif-result-actions__btn {
      padding: 11px 12px;
      font-size: 13px;
    }
  }

  /* Floating launcher — matches drawer showroom palette */
  #ai-furniture-trigger-btn.aif-trigger-btn {
    position: fixed;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 22px;
    border: 1px solid rgba(255, 250, 242, 0.35);
    border-radius: 999px;
    font-family: var(--aif-font);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #fffaf2;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 48px;
    min-width: 48px;
    opacity: 0;
    transform: translateY(18px) scale(0.94);
    pointer-events: none;
    transition:
      opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 0.25s ease,
      background 0.35s ease;
    background: linear-gradient(155deg, #3d3228 0%, #2c241c 48%, #1f1914 100%);
    box-shadow:
      0 14px 36px rgba(44, 36, 28, 0.38),
      0 0 0 1px rgba(184, 134, 20, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }

  #ai-furniture-trigger-btn.aif-trigger-btn.is-visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }

  #ai-furniture-trigger-btn.aif-trigger-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow:
      0 18px 44px rgba(44, 36, 28, 0.42),
      0 0 0 1px rgba(201, 162, 39, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }

  #ai-furniture-trigger-btn.aif-trigger-btn[data-aif-state="processing"] {
    background: linear-gradient(155deg, #4a5d4a 0%, #3a4a3a 55%, #2d3a2d 100%);
    box-shadow: 0 12px 32px rgba(58, 74, 58, 0.35);
  }

  #ai-furniture-trigger-btn.aif-trigger-btn[data-aif-state="ready"] {
    background: linear-gradient(155deg, #a67c1a 0%, var(--aif-primary) 50%, var(--aif-primary-hover) 100%);
    box-shadow: 0 14px 36px var(--aif-accent-glow);
  }

  .aif-trigger-btn__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 250, 242, 0.12);
    flex-shrink: 0;
  }

  .aif-trigger-btn__icon svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .aif-trigger-btn__label {
    line-height: 1.2;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    #ai-furniture-trigger-btn.aif-trigger-btn {
      font-size: 14px;
      padding: 14px 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #ai-furniture-trigger-btn.aif-trigger-btn {
      transition-duration: 0.01ms !important;
    }
  }

  /* —— Measure / scale cue —— */
  .aif-measure-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    animation: aif-fade-in 0.35s ease;
  }

  .aif-measure-stage {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 4px;
  }

  .aif-measure-thumb {
    position: relative;
    border-radius: var(--aif-radius-sm);
    overflow: hidden;
    background: #efe8dc;
    border: 1px solid var(--aif-border);
    aspect-ratio: 16 / 10;
    max-height: 160px;
  }

  .aif-measure-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    filter: saturate(0.95);
  }

  .aif-measure-span {
    position: absolute;
    left: 14%;
    right: 14%;
    top: 52%;
    display: flex;
    align-items: center;
    gap: 0;
    pointer-events: none;
  }

  .aif-measure-span__line {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, transparent, #fff 12%, #fff 88%, transparent);
    box-shadow: 0 0 0 1px rgba(44, 36, 28, 0.2);
  }

  .aif-measure-span__cap {
    width: 2px;
    height: 14px;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(44, 36, 28, 0.25);
    flex-shrink: 0;
  }

  .aif-measure-span__label {
    position: absolute;
    left: 50%;
    top: -22px;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #fff;
    background: rgba(44, 36, 28, 0.72);
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .aif-measure-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .aif-measure-chip {
    border: 1px solid var(--aif-border);
    background: var(--aif-bg-elevated);
    color: var(--aif-text-main);
    border-radius: 999px;
    padding: 9px 14px;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--aif-font);
    cursor: pointer;
    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.15s ease;
  }

  .aif-measure-chip:hover {
    border-color: #cbb894;
    transform: translateY(-1px);
  }

  .aif-measure-chip.is-selected {
    background: var(--aif-primary);
    border-color: var(--aif-primary);
    color: #fff;
    box-shadow: 0 6px 16px rgba(139, 105, 20, 0.28);
  }

  .aif-measure-chip--ghost {
    font-weight: 500;
    color: var(--aif-text-muted);
  }

  .aif-measure-chip--ghost.is-selected {
    background: var(--aif-accent-soft);
    border-color: #d8c7a4;
    color: var(--aif-primary-dark);
    box-shadow: none;
  }

  .aif-measure-unit {
    font-size: 12px;
    font-weight: 600;
    color: var(--aif-text-muted);
    margin-left: 2px;
  }

  .aif-measure-custom {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .aif-measure-custom__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--aif-text-muted);
  }

  .aif-measure-custom__field {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--aif-bg-elevated);
    border: 1px solid var(--aif-border);
    border-radius: var(--aif-radius-sm);
    padding: 4px 12px 4px 14px;
    max-width: 200px;
  }

  .aif-measure-custom__field:focus-within {
    border-color: var(--aif-primary);
    box-shadow: 0 0 0 3px var(--aif-accent-glow);
  }

  .aif-measure-custom__input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 16px;
    font-weight: 600;
    font-family: var(--aif-font);
    color: var(--aif-text-main);
    min-width: 0;
    padding: 8px 0;
  }

  .aif-measure-custom__suffix {
    font-size: 13px;
    font-weight: 600;
    color: var(--aif-text-muted);
  }

  .aif-measure-tip {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--aif-text-muted);
  }

  .aif-measure-footer {
    margin-top: auto;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
  }

  .aif-measure-back {
    align-self: center;
    color: var(--aif-text-muted) !important;
  }

  /* —— Room analysis / processing —— */
  .aif-analyze-view {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    min-height: 0;
    overflow: auto;
    animation: aif-fade-in 0.4s ease;
    padding-bottom: 8px;
  }

  .aif-analyze-header h2 {
    font-family: var(--aif-font-display);
  }

  .aif-analyze-visual {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .aif-analyze-room {
    position: relative;
    border-radius: var(--aif-radius-sm);
    overflow: hidden;
    border: 1px solid var(--aif-border);
    background: #2c241c;
    aspect-ratio: 16 / 10;
    max-height: 180px;
  }

  .aif-analyze-room img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0.88;
  }

  .aif-analyze-room--empty {
    background:
      linear-gradient(135deg, #3a3126 0%, #2c241c 50%, #1a1510 100%);
  }

  .aif-analyze-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(243, 234, 216, 0.12) 1px, transparent 1px),
      linear-gradient(90deg, rgba(243, 234, 216, 0.12) 1px, transparent 1px);
    background-size: 28px 28px;
    mix-blend-mode: screen;
    pointer-events: none;
    opacity: 0.55;
  }

  .aif-analyze-scan {
    position: absolute;
    left: 0;
    right: 0;
    height: 28%;
    background: linear-gradient(
      180deg,
      transparent,
      rgba(243, 234, 216, 0.22),
      transparent
    );
    animation: aif-analyze-scan 2.8s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes aif-analyze-scan {
    0% { top: -30%; }
    100% { top: 100%; }
  }

  .aif-analyze-meter {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .aif-analyze-meter__track {
    height: 7px;
    border-radius: 999px;
    background: #ebe3d6;
    overflow: hidden;
  }

  .aif-analyze-meter__fill {
    height: 100%;
    width: 0%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--aif-primary), #c4a35a);
    box-shadow: 0 0 12px var(--aif-accent-glow);
    transition: width 0.45s ease;
  }

  .aif-analyze-meter__label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--aif-text-muted);
  }

  .aif-analyze-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-analyze-step {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    border-radius: var(--aif-radius-sm);
    border: 1px solid transparent;
    transition: background 0.25s ease, border-color 0.25s ease, opacity 0.25s ease;
  }

  .aif-analyze-step.is-pending {
    opacity: 0.45;
  }

  .aif-analyze-step.is-active {
    background: var(--aif-accent-soft);
    border-color: #e0d2b6;
  }

  .aif-analyze-step.is-done {
    opacity: 0.85;
  }

  .aif-analyze-step__mark {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #cbb894;
    margin-top: 2px;
    flex-shrink: 0;
    position: relative;
    box-sizing: border-box;
  }

  .aif-analyze-step.is-active .aif-analyze-step__mark {
    border-color: var(--aif-primary);
    box-shadow: 0 0 0 3px var(--aif-accent-glow);
    animation: aif-analyze-pulse 1.4s ease-in-out infinite;
  }

  .aif-analyze-step.is-done .aif-analyze-step__mark {
    background: var(--aif-primary);
    border-color: var(--aif-primary);
  }

  .aif-analyze-step.is-done .aif-analyze-step__mark::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  @keyframes aif-analyze-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }

  .aif-analyze-step__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .aif-analyze-step__label {
    font-size: 13px;
    font-weight: 650;
    color: var(--aif-text-main);
  }

  .aif-analyze-step__detail {
    font-size: 12px;
    color: var(--aif-text-muted);
    line-height: 1.35;
  }

  .aif-analyze-hint {
    margin: 0;
    font-size: 12px;
    color: var(--aif-text-muted);
    text-align: center;
    line-height: 1.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .aif-analyze-scan,
    .aif-analyze-step.is-active .aif-analyze-step__mark {
      animation: none !important;
    }
  }
`;

    const injectStyles = () => {
        if (typeof document === 'undefined') return;
        if (document.getElementById('ai-furniture-styles')) return;

        const styleEl = document.createElement('style');
        styleEl.id = 'ai-furniture-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        initMobileLayout();
    };

    // src/init.js

    // Track if widget has been initialized - use sessionStorage to persist across script reloads
    function getWidgetInitKey() {
        try {
            const config = window.__AIFurnitureConfig || {};
            return 'aif_widget_init_' + (config.domain || 'default');
        } catch {
            return 'aif_widget_init_default';
        }
    }

    function isWidgetInitialized() {
        try {
            // Check if widget button exists in DOM - most reliable check
            const widgetButton = document.getElementById('ai-furniture-trigger-btn');
            if (widgetButton) {
                return true;
            }
            // Fallback to sessionStorage check
            return sessionStorage.getItem(getWidgetInitKey()) === 'true';
        } catch {
            return false;
        }
    }

    function setWidgetInitialized(value) {
        try {
            if (value) {
                sessionStorage.setItem(getWidgetInitKey(), 'true');
            } else {
                sessionStorage.removeItem(getWidgetInitKey());
            }
        } catch (e) {
            debugLog('Failed to update widget init state in sessionStorage', e);
        }
    }

    function hasActiveGeneration() {
        return store.getState().queue.some(
            (item) =>
                item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING
        );
    }

    function isProductPageContext() {
        return isFurnitureProductPage() || hasActiveGeneration();
    }

    function shouldShowWidgetUi() {
        return isProductPageContext();
    }

    function shouldShowWidgetButton() {
        return isFurnitureProductPage();
    }

    function ensureWidgetUiMounted() {
        if (!shouldShowWidgetUi()) return;
        if (!document.getElementById('ai-furniture-modal')) {
            document.body.appendChild(Modal());
        }
    }

    function ensureWidgetRuntimeActive() {
        if (window.__AIFurnitureRuntimeReady) return;
        window.__AIFurnitureRuntimeReady = true;
        injectStyles();
        initQueueProcessor();
        window.AIFurniture = {
            open: (options) => actions.openModal(options),
            close: actions.closeModal,
            getState: () => store.getState()
        };

        if (!window.__AIFurniturePopstateBound) {
            window.__AIFurniturePopstateBound = true;
            window.addEventListener('popstate', () => {
                syncWidgetUiForPage();
                const state = store.getState();
                if (state.isOpen && shouldShowWidgetUi()) {
                    actions.openModal();
                }
            });
        }

        if (!window.__AIFurnitureTriggersBound) {
            window.__AIFurnitureTriggersBound = true;
            document.querySelectorAll('[data-ai-furniture-trigger]').forEach((el) => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    actions.openModal();
                });
            });
        }
    }

    function syncWidgetUiForPage() {
        if (!shouldShowWidgetUi()) {
            removeWidgetButton();
            removeWidgetModal();
            if (store.getState().isOpen) {
                actions.closeModal();
            }
            return;
        }

        ensureWidgetRuntimeActive();
        ensureWidgetUiMounted();
        showWidgetModalShell();

        if (shouldShowWidgetButton()) {
            createWidgetButton();
        } else {
            removeWidgetButton();
        }
    }

    function syncWidgetButtonVisibility() {
        syncWidgetUiForPage();
    }

    function scheduleWidgetVisibilityRecheck() {
        if (window.__AIFurnitureVisibilityRecheckScheduled) return;
        window.__AIFurnitureVisibilityRecheckScheduled = true;
        [0, 50, 200, 500, 1000, 2000, 4000].forEach((ms) => {
            setTimeout(() => syncWidgetUiForPage(), ms);
        });
    }

    async function initializeWidget(isInitialLoad = false) {
        syncWidgetUiForPage();

        if (!shouldShowWidgetUi()) {
            debugLog('Not a product page — widget runtime skipped');
            return;
        }

        debugLog('Initializing widget', {
            isInitialLoad,
            currentUrl: window.location.href,
            currentPage: window.location.pathname + window.location.search,
            alreadyInitialized: isWidgetInitialized(),
            hasConfig: !!window.__AIFurnitureConfig
        });

        // After first init, only refresh tracking + button visibility on SPA navigation
        if (!isInitialLoad && isWidgetInitialized()) {
            debugLog('Widget already initialized, updating for navigation');
            updatePageTracking();
            syncWidgetButtonVisibility();
            return;
        }

        debugLog('Initializing AI Furniture widget', { isInitialLoad });

        verifyDomain();

        try {
            actions.syncThemeConfig();
        } catch (e) {
            debugLog('syncThemeConfig failed', e);
        }
        initSession();

        const trackingDisconnected = sessionStorage.getItem('tracking_disconnected') === 'true';
        const orderCompletedAt = sessionStorage.getItem('order_completed_at');

        if (trackingDisconnected && orderCompletedAt) {
            debugLog('Tracking disconnected due to completed order - checking if should re-enable');
            const isFurniturePage = isFurnitureProductPage();
            if (isFurniturePage) {
                debugLog('Product page detected after order completion - re-enabling tracking');
                resetWidget();
                setWidgetInitialized(false); // Allow reinitialization
            } else {
                debugLog('Non-product page after order completion - keeping tracking disabled');
                return;
            }
        } else if (trackingDisconnected) {
            debugLog('Tracking already disconnected - skipping widget initialization');
            return;
        }

        const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';

        if (isAIFurnitureUser) {
            const orderConfirmed = trackOrderConfirmationPage();

            if (orderConfirmed) {
                debugLog('Order confirmed - stopping widget initialization');
                return;
            }
        } else {
            debugLog('Skipping order confirmation check - user has not used AI Furniture');
        }

        syncWidgetButtonVisibility();

        if (isAIFurnitureUser) {
            trackEvent('page_view', {
                title: document.title,
                url: window.location.href,
                isProductPage: isFurnitureProductPage(),
                aiFurnitureUser: true
            });

            detectCartAndOrderPages();
        } else {
            debugLog('First time visitor - no tracking until AI Furniture usage');
        }

        // allow tracking module to recreate widget after reset
        setRecreateWidgetButton(syncWidgetUiForPage);

        // expose backend hook
        window.onOrderAddedToDatabase = onOrderAddedToDatabase;

        // Mark as initialized (persist in sessionStorage)
        setWidgetInitialized(true);
        debugLog('Widget fully initialized');
    }

    /**
     * Update page tracking without reinitializing entire widget
     */
    function updatePageTracking() {
        try {
            flushSessionSnapshot();
        } catch (e) {
            debugLog('flushSessionSnapshot failed', e);
        }

        try {
            actions.syncThemeConfig();
        } catch (e) {
            debugLog('syncThemeConfig failed', e);
        }

        // Resume in-flight previews after Shopify / SPA navigation (fetch may abort as "Failed to fetch").
        try {
            resumeQueueAfterNavigation();
        } catch (e) {
            debugLog('resumeQueueAfterNavigation failed', e);
        }

        const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';

        if (isAIFurnitureUser) {
            debugLog('Updating page tracking for new URL');
            trackEvent('page_view', {
                title: document.title,
                url: window.location.href,
                isProductPage: isFurnitureProductPage(),
                aiFurnitureUser: true
            });

            detectCartAndOrderPages();
        }
    }

    function attachDeferredProductPageBootstrap(onReady) {
        if (window.__AIFurnitureDeferredBootstrapAttached) return;
        window.__AIFurnitureDeferredBootstrapAttached = true;

        const tryReady = () => {
            if (window.__AIFurnitureInitialized) return;
            if (!isProductPageContext()) return;
            onReady();
        };

        if (!window.__AIFurniturePushStatePatched) {
            window.__AIFurniturePushStatePatched = true;
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = function (...args) {
                originalPushState.apply(history, args);
                setTimeout(tryReady, 0);
            };

            history.replaceState = function (...args) {
                originalReplaceState.apply(history, args);
                setTimeout(tryReady, 0);
            };

            window.addEventListener('popstate', tryReady);
        }

        [0, 250, 750, 1500, 3000, 5000].forEach((ms) => {
            setTimeout(tryReady, ms);
        });
    }

    function attachDomListeners() {
        // Prevent duplicate listeners if script reloads
        if (window.__AIFurnitureListenersAttached) {
            debugLog('Listeners already attached, skipping...');
            // Still initialize widget if needed
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => initializeWidget(true));
            } else {
                initializeWidget(true);
            }
            return;
        }
        
        window.__AIFurnitureListenersAttached = true;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => initializeWidget(true));
        } else {
            initializeWidget(true);
        }

        // Track URL changes for SPA navigation
        let lastUrl = window.location.href;
        
        // Use both MutationObserver and popstate for better SPA support
        const urlChangeHandler = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                const previousUrl = lastUrl;
                lastUrl = currentUrl;
                debugLog('URL changed, updating widget...', { from: previousUrl, to: currentUrl });
                window.__AIFurnitureVisibilityRecheckScheduled = false;
                try {
                    flushSessionSnapshot();
                    resumeQueueAfterNavigation();
                } catch (e) {
                    debugLog('Navigation queue resume failed', e);
                }
                setTimeout(() => {
                    initializeWidget(false);
                    scheduleWidgetVisibilityRecheck();
                }, 100);
            }
        };

        // Watch for DOM changes (for SPAs that don't use pushState)
        // Only create one observer
        if (!window.__AIFurnitureMutationObserver) {
            window.__AIFurnitureMutationObserver = new MutationObserver(() => {
                urlChangeHandler();
            });
            window.__AIFurnitureMutationObserver.observe(document, { subtree: true, childList: true });
        }

        // Watch for pushState/replaceState (for SPAs)
        // Only override if not already overridden
        if (!window.__AIFurniturePushStatePatched) {
            window.__AIFurniturePushStatePatched = true;
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            history.pushState = function(...args) {
                originalPushState.apply(history, args);
                setTimeout(urlChangeHandler, 0);
            };
            
            history.replaceState = function(...args) {
                originalReplaceState.apply(history, args);
                setTimeout(urlChangeHandler, 0);
            };
        }

        // Also listen to popstate (back/forward)
        // Use named function to allow removal if needed
        if (!window.__AIFurniturePopstateHandler) {
            window.__AIFurniturePopstateHandler = urlChangeHandler;
            window.addEventListener('popstate', window.__AIFurniturePopstateHandler);
        }

        debugLog('Navigation listeners attached');
        scheduleWidgetVisibilityRecheck();
    }

    // src/index.js

    function bootstrapWidget() {
        attachDomListeners();
        if (!window.__AIFurnitureInitialized) {
            window.__AIFurnitureInitialized = true;
        }
        syncWidgetUiForPage();
    }

    function initAIFurnitureWidget(userConfig = {}) {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        if (!userConfig.domain && window.FURNITURE_AI_CONFIG) {
            userConfig = { ...window.FURNITURE_AI_CONFIG, ...userConfig };
        }

        const config = createConfig(userConfig);
        setConfig(config);
        window.__AIFurnitureConfig = config;

        if (window.__AIFurnitureInitialized) {
            syncWidgetUiForPage();
            return;
        }

        if (isProductPageContext()) {
            bootstrapWidget();
            return;
        }

        attachDeferredProductPageBootstrap(bootstrapWidget);
    }

    exports.initAIFurnitureWidget = initAIFurnitureWidget;

    return exports;

})({});
//# sourceMappingURL=widget.dev.js.map
