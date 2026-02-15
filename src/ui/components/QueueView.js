/**
 * Queue View Component - Enhanced with tabs and better UI
 */
import { actions, QUEUE_STATUS, VIEWS } from '../../state/store.js';
import { Button } from './Button.js';
import { trackEvent } from '../../tracking.js';

export const QueueView = (state) => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    container.style.height = '100%';

    // Header
    const header = document.createElement('div');
    header.className = 'aif-header';

    const processingCount = state.queue.filter(i => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING).length;
    const completedCount = state.queue.filter(i => i.status === QUEUE_STATUS.COMPLETED).length;
    const failedCount = state.queue.filter(i => i.status === QUEUE_STATUS.ERROR).length;

    header.innerHTML = `
    <div class="aif-badge">
      <span style="width:6px; height:6px; border-radius:50%; background:${processingCount > 0 ? '#3b82f6' : '#22c55e'};"></span>
      Your Visualizations
    </div>
    <h2>Queue & Results</h2>
    <p>${processingCount} processing • ${completedCount} completed ${failedCount > 0 ? `• ${failedCount} failed` : ''}</p>
  `;
    container.appendChild(header);

    // Tabs
    const activeTab = state.queueTab || 'all';
    const tabs = document.createElement('div');
    tabs.style.display = 'flex';
    tabs.style.gap = '8px';
    tabs.style.borderBottom = '1px solid #e2e8f0';
    tabs.style.marginBottom = '8px';

    const tabOptions = [
        { id: 'all', label: 'All', count: state.queue.length },
        { id: 'processing', label: 'Processing', count: processingCount },
        { id: 'completed', label: 'Completed', count: completedCount }
    ];

    if (failedCount > 0) {
        tabOptions.push({ id: 'failed', label: 'Failed', count: failedCount });
    }

    tabOptions.forEach(tab => {
        const tabBtn = document.createElement('button');
        tabBtn.textContent = `${tab.label} (${tab.count})`;
        tabBtn.style.padding = '8px 16px';
        tabBtn.style.background = 'none';
        tabBtn.style.border = 'none';
        tabBtn.style.borderBottom = activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent';
        tabBtn.style.color = activeTab === tab.id ? '#3b82f6' : '#64748b';
        tabBtn.style.fontWeight = activeTab === tab.id ? '600' : '400';
        tabBtn.style.cursor = 'pointer';
        tabBtn.style.fontSize = '13px';
        tabBtn.style.transition = 'all 0.2s';

        tabBtn.onclick = () => {
            actions.setQueueTab(tab.id);
        };

        tabs.appendChild(tabBtn);
    });

    container.appendChild(tabs);

    // Filter queue based on active tab
    let filteredQueue = state.queue;
    if (activeTab === 'processing') {
        filteredQueue = state.queue.filter(i => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING);
    } else if (activeTab === 'completed') {
        filteredQueue = state.queue.filter(i => i.status === QUEUE_STATUS.COMPLETED);
    } else if (activeTab === 'failed') {
        filteredQueue = state.queue.filter(i => i.status === QUEUE_STATUS.ERROR);
    }

    // Queue List
    const list = document.createElement('div');
    list.style.flex = '1';
    list.style.overflowY = 'auto';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '12px';

    if (filteredQueue.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#94a3b8; margin-top:20px;">No items in this category.</p>`;
    } else {
        filteredQueue.forEach(item => {
            const itemEl = createQueueItem(item);
            list.appendChild(itemEl);
        });
    }

    container.appendChild(list);

    // Footer
    const footer = document.createElement('div');
    footer.style.marginTop = 'auto';
    footer.style.display = 'flex';
    footer.style.gap = '8px';

    const backBtn = Button({
        text: 'Back to Upload',
        variant: 'secondary',
        onClick: () => actions.setView(VIEWS.UPLOAD)
    });

    footer.appendChild(backBtn);

    // Clear completed button
    if (completedCount > 0) {
        const clearBtn = Button({
            text: 'Clear Completed',
            variant: 'secondary',
            onClick: () => {
                if (confirm('Clear all completed items?')) {
                    actions.clearCompleted();
                }
            }
        });
        footer.appendChild(clearBtn);
    }

    container.appendChild(footer);

    return container;
};

function createQueueItem(item) {
    const itemEl = document.createElement('div');
    itemEl.style.padding = '16px';
    itemEl.style.background = '#ffffff';
    itemEl.style.borderRadius = '12px';
    itemEl.style.border = '1px solid #e2e8f0';
    itemEl.style.display = 'flex';
    itemEl.style.gap = '12px';
    itemEl.style.transition = 'all 0.2s';
    itemEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

    // Thumbnail (if available)
    const thumbnail = document.createElement('div');
    thumbnail.style.width = '60px';
    thumbnail.style.height = '60px';
    thumbnail.style.borderRadius = '8px';
    thumbnail.style.background = '#f1f5f9';
    thumbnail.style.flexShrink = '0';
    thumbnail.style.display = 'flex';
    thumbnail.style.alignItems = 'center';
    thumbnail.style.justifyContent = 'center';
    thumbnail.style.overflow = 'hidden';

    if (item.userImageUrl) {
        const img = document.createElement('img');
        img.src = item.userImageUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        thumbnail.appendChild(img);
    } else {
        thumbnail.innerHTML = '<span style="font-size:24px;">🖼️</span>';
    }

    itemEl.appendChild(thumbnail);

    // Content
    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '4px';

    // Product name/URL
    const productName = document.createElement('div');
    productName.style.fontWeight = '600';
    productName.style.fontSize = '14px';
    productName.style.color = '#1e293b';
    productName.textContent = item.productName || `Product #${item.id.slice(0, 8)}`;
    content.appendChild(productName);

    // Status
    const statusEl = document.createElement('div');
    statusEl.style.display = 'flex';
    statusEl.style.alignItems = 'center';
    statusEl.style.gap = '6px';
    statusEl.style.fontSize = '12px';
    statusEl.style.marginTop = '4px';

    if (item.status === QUEUE_STATUS.PENDING) {
        statusEl.innerHTML = `<span style="color:#64748b;">⏳ Waiting in queue...</span>`;
    } else if (item.status === QUEUE_STATUS.PROCESSING) {
        const elapsed = item.startedAt ? Math.floor((Date.now() - item.startedAt) / 1000) : 0;
        const estimated = 75; // High quality model takes ~75 seconds
        const remaining = Math.max(0, estimated - elapsed);

        statusEl.innerHTML = `
            <span style="color:#3b82f6; display:flex; align-items:center; gap:4px;">
                <span class="spinner" style="width:12px; height:12px; border:2px solid #3b82f6; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></span>
                Processing... ${elapsed}s elapsed • ~${remaining}s remaining
            </span>
        `;
    } else if (item.status === QUEUE_STATUS.COMPLETED) {
        const duration = item.result?.generationTime || 'N/A';
        statusEl.innerHTML = `<span style="color:#22c55e;">✅ Completed in ${duration}s</span>`;
    } else if (item.status === QUEUE_STATUS.ERROR) {
        statusEl.innerHTML = `<span style="color:#ef4444;">❌ ${item.error || 'Failed'}</span>`;
    }

    content.appendChild(statusEl);
    itemEl.appendChild(content);

    // Actions
    const actions_div = document.createElement('div');
    actions_div.style.display = 'flex';
    actions_div.style.flexDirection = 'column';
    actions_div.style.gap = '6px';
    actions_div.style.alignSelf = 'center';

    if (item.status === QUEUE_STATUS.COMPLETED) {
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View';
        viewBtn.style.padding = '8px 16px';
        viewBtn.style.background = '#3b82f6';
        viewBtn.style.color = 'white';
        viewBtn.style.border = 'none';
        viewBtn.style.borderRadius = '6px';
        viewBtn.style.cursor = 'pointer';
        viewBtn.style.fontSize = '12px';
        viewBtn.style.fontWeight = '600';
        viewBtn.onclick = () => {
            // Track results viewed
            trackEvent('results_viewed', {
                queueId: item.id,
                productUrl: item.productUrl,
                productName: item.productName,
                model: item.selectedModel,
                generationTime: item.result?.generationTime
            });
            
            // Convert queue item result to the format expected by ResultsView
            // ResultsView expects: [{ url, originalImageUrl, originalAspectRatio, originalWidth, originalHeight }]
            const resultForView = {
                url: item.result?.generatedImageUrl, // S3 URL for generated image
                originalImageUrl: item.result?.originalImageUrl || item.userImageUrl, // S3 URL for original image
                originalAspectRatio: item.result?.originalAspectRatio,
                originalWidth: item.result?.originalWidth,
                originalHeight: item.result?.originalHeight
            };
            actions.setGenerationResults([resultForView]);
        };
        actions_div.appendChild(viewBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.padding = '6px 12px';
        deleteBtn.style.background = 'transparent';
        deleteBtn.style.color = '#64748b';
        deleteBtn.style.border = '1px solid #e2e8f0';
        deleteBtn.style.borderRadius = '6px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '11px';
        deleteBtn.onclick = () => {
            actions.removeFromQueue(item.id);
        };
        actions_div.appendChild(deleteBtn);
    } else if (item.status === QUEUE_STATUS.ERROR) {
        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'Retry';
        retryBtn.style.padding = '8px 16px';
        retryBtn.style.background = '#f59e0b';
        retryBtn.style.color = 'white';
        retryBtn.style.border = 'none';
        retryBtn.style.borderRadius = '6px';
        retryBtn.style.cursor = 'pointer';
        retryBtn.style.fontSize = '12px';
        retryBtn.onclick = () => {
            // Retry logic would go here
            actions.updateQueueItem(item.id, { status: QUEUE_STATUS.PENDING, error: null });
        };
        actions_div.appendChild(retryBtn);
    } else if (item.status === QUEUE_STATUS.PROCESSING || item.status === QUEUE_STATUS.PENDING) {
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '6px 12px';
        cancelBtn.style.background = 'transparent';
        cancelBtn.style.color = '#ef4444';
        cancelBtn.style.border = '1px solid #fee2e2';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontSize = '11px';
        cancelBtn.onclick = () => {
            if (confirm('Cancel this generation?')) {
                actions.removeFromQueue(item.id);
            }
        };
        actions_div.appendChild(cancelBtn);
    }

    itemEl.appendChild(actions_div);

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
