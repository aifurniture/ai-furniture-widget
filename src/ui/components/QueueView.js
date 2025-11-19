/**
 * Queue View Component
 */
import { actions, QUEUE_STATUS, VIEWS } from '../../state/store.js';
import { Button } from './Button.js';

export const QueueView = (state) => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    container.style.height = '100%';

    // Header
    const header = document.createElement('div');
    header.className = 'aif-header';
    header.innerHTML = `
    <div class="aif-badge">
      <span style="width:6px; height:6px; border-radius:50%; background:#3b82f6;"></span>
      Your Visualizations
    </div>
    <h2>Queue & Results</h2>
    <p>We're generating your previews in the background. Feel free to browse.</p>
  `;
    container.appendChild(header);

    // Queue List
    const list = document.createElement('div');
    list.style.flex = '1';
    list.style.overflowY = 'auto';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '12px';

    if (state.queue.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#94a3b8; margin-top:20px;">No items in queue.</p>`;
    } else {
        state.queue.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.style.padding = '12px';
            itemEl.style.background = '#f8fafc';
            itemEl.style.borderRadius = '8px';
            itemEl.style.border = '1px solid #e2e8f0';
            itemEl.style.display = 'flex';
            itemEl.style.alignItems = 'center';
            itemEl.style.gap = '12px';

            // Status Icon/Text
            let statusHtml = '';
            if (item.status === QUEUE_STATUS.PENDING) {
                statusHtml = `<span style="color:#64748b; font-size:12px;">Waiting...</span>`;
            } else if (item.status === QUEUE_STATUS.PROCESSING) {
                statusHtml = `<span style="color:#3b82f6; font-size:12px;">Generating...</span>`;
            } else if (item.status === QUEUE_STATUS.COMPLETED) {
                statusHtml = `<span style="color:#22c55e; font-size:12px;">Ready!</span>`;
            } else if (item.status === QUEUE_STATUS.ERROR) {
                statusHtml = `<span style="color:#ef4444; font-size:12px;">Failed</span>`;
            }

            itemEl.innerHTML = `
                <div style="flex:1">
                    <div style="font-weight:500; font-size:14px; margin-bottom:4px;">Product #${item.id.slice(0, 4)}</div>
                    ${statusHtml}
                </div>
            `;

            // Action Button
            if (item.status === QUEUE_STATUS.COMPLETED) {
                const viewBtn = document.createElement('button');
                viewBtn.textContent = 'View';
                viewBtn.style.padding = '6px 12px';
                viewBtn.style.background = '#3b82f6';
                viewBtn.style.color = 'white';
                viewBtn.style.border = 'none';
                viewBtn.style.borderRadius = '6px';
                viewBtn.style.cursor = 'pointer';
                viewBtn.onclick = () => {
                    actions.setGenerationResults(item.result);
                };
                itemEl.appendChild(viewBtn);
            }

            list.appendChild(itemEl);
        });
    }

    container.appendChild(list);

    // Footer
    const footer = document.createElement('div');
    footer.style.marginTop = 'auto';

    const backBtn = Button({
        text: 'Back to Upload',
        variant: 'secondary',
        onClick: () => actions.setView(VIEWS.UPLOAD)
    });

    footer.appendChild(backBtn);
    container.appendChild(footer);

    return container;
};
