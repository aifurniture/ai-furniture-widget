/**
 * Simple pub/sub store for widget state management
 * Uses sessionStorage for cross-page persistence within the same session
 */

const STORAGE_KEY = 'ai_furniture_widget_state';
const MODAL_STATE_KEY = 'ai_furniture_modal_state';

const loadState = () => {
    try {
        const serialized = sessionStorage.getItem(STORAGE_KEY);
        return serialized ? JSON.parse(serialized) : undefined;
    } catch (e) {
        console.warn('Failed to load state', e);
        return undefined;
    }
};

const saveState = async (state) => {
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

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
            queue: cleanQueue,
            generatedImages,
            selectedModel,
            queueTab
        }));
    } catch (e) {
        console.warn('Failed to save state', e);
    }
};

// Helper to convert File/Blob to data URL
const fileToDataURL = (file) => {
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

export const createStore = (initialState) => {
    const loaded = loadState();
    const modalState = loadModalState();
    
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
    selectedModel: 'fast', // Default to fast model
    queueTab: 'all', // Active tab in queue view
};

export const store = createStore(initialState);

// Actions
export const actions = {
    openModal: (config = {}) => {
        const currentState = store.getState();
        // Merge configs, ensuring we preserve all existing config properties
        const mergedConfig = {
            ...currentState.config,
            ...config
        };

        // Ensure apiEndpoint is always defined after merge
        if (!mergedConfig.apiEndpoint) {
            const isLocalMode = typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '0.0.0.0');
            mergedConfig.apiEndpoint = isLocalMode
                ? 'http://localhost:3000/api'
                : 'https://ai-furniture-backend.vercel.app/api';
        }

        store.setState({
            isOpen: true,
            config: mergedConfig
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
        // Ensure image is stored as data URL for persistence
        const queueItem = { ...item, status: QUEUE_STATUS.PENDING, timestamp: Date.now() };
        
        // If userImage is a File/Blob, convert to data URL asynchronously
        if (item.userImage && (item.userImage instanceof File || item.userImage instanceof Blob)) {
            fileToDataURL(item.userImage).then(dataUrl => {
                queueItem.userImageDataUrl = dataUrl;
                // Update the item with data URL
                const currentQueue = store.getState().queue;
                const updatedQueue = currentQueue.map(qi => 
                    qi.id === queueItem.id ? { ...qi, userImageDataUrl: dataUrl } : qi
                );
                store.setState({ queue: updatedQueue });
            }).catch(e => {
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
