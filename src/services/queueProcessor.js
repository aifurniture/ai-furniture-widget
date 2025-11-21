import { store, actions, QUEUE_STATUS } from '../state/store.js';

// Track polling intervals by job ID
const pollingIntervals = new Map();
const POLL_INTERVAL = 3000; // Poll every 3 seconds

export function initQueueProcessor() {
    // Subscribe to queue changes
    store.subscribe((state) => {
        checkQueue(state);
    });

    // Initial check
    checkQueue(store.getState());
}

function checkQueue(state) {
    // Start polling for any PENDING or PROCESSING jobs
    state.queue.forEach(item => {
        if ((item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.PROCESSING) &&
            !pollingIntervals.has(item.id)) {
            startPolling(item.id);
        }
    });

    // Stop polling for completed/failed jobs
    pollingIntervals.forEach((intervalId, jobId) => {
        const job = state.queue.find(j => j.id === jobId);
        if (!job || job.status === QUEUE_STATUS.COMPLETED || job.status === QUEUE_STATUS.FAILED) {
            stopPolling(jobId);
        }
    });
}

function startPolling(jobId) {
    console.log(`🔄 Starting to poll job ${jobId.slice(0, 8)}`);

    // Poll immediately
    pollJobStatus(jobId);

    // Then poll every 3 seconds
    const intervalId = setInterval(() => {
        pollJobStatus(jobId);
    }, POLL_INTERVAL);

    pollingIntervals.set(jobId, intervalId);
}

function stopPolling(jobId) {
    const intervalId = pollingIntervals.get(jobId);
    if (intervalId) {
        clearInterval(intervalId);
        pollingIntervals.delete(jobId);
        console.log(`⏹️ Stopped polling job ${jobId.slice(0, 8)}`);
    }
}

async function pollJobStatus(jobId) {
    try {
        const { config } = store.getState();
        
        // Ensure apiEndpoint is defined - use fallback if missing
        let apiEndpoint = config?.apiEndpoint;
        if (!apiEndpoint) {
            // Fallback to default production endpoint if config is missing
            const isLocalMode = typeof window !== 'undefined' && 
                               (window.location.hostname === 'localhost' || 
                                window.location.hostname === '127.0.0.1' || 
                                window.location.hostname === '0.0.0.0');
            apiEndpoint = isLocalMode 
                ? 'http://localhost:3000/api' 
                : 'https://ai-furniture-backend.vercel.app/api';
            console.warn('⚠️ apiEndpoint was undefined in queueProcessor, using fallback:', apiEndpoint);
        }

        // Validate apiEndpoint is a valid URL
        if (!apiEndpoint || typeof apiEndpoint !== 'string') {
            console.error('❌ Invalid API endpoint, cannot poll job status');
            return;
        }

        const response = await fetch(`${apiEndpoint}/jobs/${jobId}`);

        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`⚠️ Job ${jobId.slice(0, 8)} not found on backend`);
                actions.updateQueueItem(jobId, {
                    status: QUEUE_STATUS.FAILED,
                    error: 'Job not found'
                });
                stopPolling(jobId);
            }
            return;
        }

        const data = await response.json();

        // Update local queue based on backend status
        if (data.status === 'COMPLETED') {
            console.log(`✅ Job ${jobId.slice(0, 8)} completed`);
            actions.updateQueueItem(jobId, {
                status: QUEUE_STATUS.COMPLETED,
                result: data.result?.generatedImages || []
            });
            stopPolling(jobId);
        } else if (data.status === 'FAILED') {
            console.error(`❌ Job ${jobId.slice(0, 8)} failed:`, data.error);
            actions.updateQueueItem(jobId, {
                status: QUEUE_STATUS.FAILED,
                error: data.error || 'Generation failed'
            });
            stopPolling(jobId);
        } else if (data.status === 'PROCESSING') {
            // Update to processing if not already
            const currentItem = store.getState().queue.find(j => j.id === jobId);
            if (currentItem && currentItem.status !== QUEUE_STATUS.PROCESSING) {
                actions.updateQueueItem(jobId, {
                    status: QUEUE_STATUS.PROCESSING
                });
            }
        }

    } catch (error) {
        console.error(`❌ Failed to poll job ${jobId.slice(0, 8)}:`, error.message);
        // Don't stop polling on network errors - might be temporary
    }
}

// Clean up on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        pollingIntervals.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        pollingIntervals.clear();
    });
}
