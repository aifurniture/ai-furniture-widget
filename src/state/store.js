/**
 * Simple pub/sub store for widget state management
 */

const STORAGE_KEY = 'ai_furniture_widget_state';

const loadState = () => {
    try {
        const serialized = localStorage.getItem(STORAGE_KEY);
        return serialized ? JSON.parse(serialized) : undefined;
    } catch (e) {
        console.warn('Failed to load state', e);
        return undefined;
    }
};

const saveState = (state) => {
    try {
        // Only persist essential data (no blobs/files)
        const { queue, generatedImages } = state;

        // Filter out any items with userImage blobs (they can't be stored)
        const cleanQueue = queue.map(item => ({
            ...item,
            userImage: null // Don't try to store blobs
        }));

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            queue: cleanQueue,
            generatedImages
        }));
    } catch (e) {
        console.warn('Failed to save state', e);
    }
};

export const createStore = (initialState) => {
    const loaded = loadState();
    let state = loaded ? { ...initialState, ...loaded } : initialState;
    const listeners = new Set();

    return {
        getState: () => state,
        setState: (newState) => {
            state = { ...state, ...newState };
            saveState(state);
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
};

export const store = createStore(initialState);

// Actions
export const actions = {
    openModal: (config = {}) => {
        store.setState({
            isOpen: true,
            config: { ...store.getState().config, ...config }
        });
    },
    closeModal: () => {
        store.setState({ isOpen: false });
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
        store.setState({
            queue: [...queue, { ...item, status: QUEUE_STATUS.PENDING, timestamp: Date.now() }]
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
    }
};
