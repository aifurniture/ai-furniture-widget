// src/state.js

let config = null;
let sessionId = null;
let furnitureQueue = [];
let isMinimized = false;

export function setConfig(newConfig) {
    config = newConfig;
}

export function getConfig() {
    if (!config) {
        throw new Error('AI Furniture: config not set. Call initAIFurnitureWidget first.');
    }
    return config;
}

export function setSessionId(id) {
    sessionId = id;
}

export function getSessionId() {
    return sessionId;
}

// Queue management
export function addToQueue(productInfo, status = 'pending') {
    const queueItem = {
        id: Date.now() + Math.random(),
        url: productInfo.url || window.location.href,
        title: productInfo.title || document.title,
        image: productInfo.image || null,
        roomImage: productInfo.roomImage || null,
        status: status, // 'pending', 'processing', 'completed', 'error'
        result: null, // Generated image URL when completed
        error: null, // Error message if failed
        addedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null
    };
    
    // Check if already in queue (allow if different status or not completed)
    const existing = furnitureQueue.find(item => item.url === queueItem.url);
    if (existing) {
        // If it's completed or processing, don't add duplicate
        if (existing.status === 'completed' || existing.status === 'processing') {
            return false;
        }
        // If pending, update it
        existing.status = status;
        updateQueueStorage();
        return existing;
    }
    
    furnitureQueue.push(queueItem);
    updateQueueStorage();
    return queueItem;
}

export function updateQueueItem(itemId, updates) {
    const item = furnitureQueue.find(i => i.id === itemId);
    if (item) {
        Object.assign(item, updates);
        updateQueueStorage();
        return item;
    }
    return null;
}

export function getQueueItem(itemId) {
    return furnitureQueue.find(item => item.id === itemId);
}

export function getProcessingItem() {
    return furnitureQueue.find(item => item.status === 'processing');
}

export function removeFromQueue(itemId) {
    furnitureQueue = furnitureQueue.filter(item => item.id !== itemId);
    updateQueueStorage();
}

export function getQueue() {
    return furnitureQueue;
}

export function clearQueue() {
    furnitureQueue = [];
    updateQueueStorage();
}

function updateQueueStorage() {
    try {
        sessionStorage.setItem('ai_furniture_queue', JSON.stringify(furnitureQueue));
    } catch (e) {
        console.warn('Failed to save queue to sessionStorage', e);
    }
}

export function loadQueueFromStorage() {
    try {
        const stored = sessionStorage.getItem('ai_furniture_queue');
        if (stored) {
            furnitureQueue = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load queue from sessionStorage', e);
    }
}

// Minimize state
export function setMinimized(value) {
    isMinimized = value;
}

export function getMinimized() {
    return isMinimized;
}
