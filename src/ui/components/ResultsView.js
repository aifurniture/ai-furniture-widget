/**
 * Results View Component
 */
import { actions } from '../../state/store.js';
import { Slider } from './Slider.js';
import { Button } from './Button.js';
import { downloadUrlAsFile, delay, getFilenameFromUrl } from '../../utils/downloadImage.js';

export const ResultsView = (state) => {
    const uploadedBlobUrl = state.uploadedImage ? URL.createObjectURL(state.uploadedImage) : '';

    const buildPairs = () => {
        const pairs = [];
        state.generatedImages.forEach((imgData, index) => {
            const afterUrl = imgData.url || imgData;
            const beforeUrl = imgData.originalImageUrl || uploadedBlobUrl || '';
            if (afterUrl) pairs.push({ beforeUrl, afterUrl, index });
        });
        return pairs;
    };

    const shareImage = async (url) => {
        if (!url) return;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'AI Furniture Result',
                    text: 'Check out my room preview',
                    url
                });
                return;
            }
        } catch (_) {
            // Fall back to clipboard below.
        }

        try {
            await navigator.clipboard.writeText(url);
            alert('Share link copied to clipboard');
        } catch (_) {
            alert('Unable to share automatically. Please copy this URL:\n' + url);
        }
    };

    const createActionsRow = (beforeUrl, afterUrl) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.flexWrap = 'wrap';
        row.style.flexShrink = '0';
        row.style.marginTop = '4px';
        row.style.padding = '12px 0 4px';
        row.style.borderTop = '1px solid #e2e8f0';
        row.setAttribute('data-aif-actions', 'download-share');

        const makeBtn = (text, onClick, primary = false) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.padding = '8px 10px';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '600';
            btn.style.borderRadius = '8px';
            btn.style.cursor = 'pointer';
            btn.style.border = primary ? '1px solid #059669' : '1px solid #cbd5e1';
            btn.style.background = primary ? '#10b981' : '#ffffff';
            btn.style.color = primary ? '#ffffff' : '#334155';
            btn.onclick = onClick;
            return btn;
        };

        const downloadBeforeBtn = makeBtn('Download Before', () => {
            downloadUrlAsFile(beforeUrl, `before-${getFilenameFromUrl(beforeUrl)}`);
        });
        if (!beforeUrl) {
            downloadBeforeBtn.disabled = true;
            downloadBeforeBtn.style.opacity = '0.5';
            downloadBeforeBtn.style.cursor = 'not-allowed';
        }

        const downloadAfterBtn = makeBtn('Download After', () => {
            downloadUrlAsFile(afterUrl, `after-${getFilenameFromUrl(afterUrl)}`);
        }, true);
        const shareBtn = makeBtn('Share Result', () => shareImage(afterUrl));

        row.appendChild(downloadBeforeBtn);
        row.appendChild(downloadAfterBtn);
        row.appendChild(shareBtn);
        return row;
    };

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    container.style.height = '100%';
    container.style.minHeight = '0'; /* flex: allow scroll area to shrink */

    // Header
    const header = document.createElement('div');
    header.innerHTML = `
    <h3 style="margin:0; font-size:16px; font-weight:600;">✨ Your room preview</h3>
    <p style="margin:4px 0 0; font-size:12px; color:#64748b;">Drag the slider to compare.</p>
  `;
    container.appendChild(header);

    const pairs = buildPairs();

    // Download all (every before/after as files)
    const downloadAllBar = document.createElement('div');
    downloadAllBar.style.display = 'flex';
    downloadAllBar.style.flexWrap = 'wrap';
    downloadAllBar.style.gap = '8px';
    downloadAllBar.style.alignItems = 'center';

    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.textContent = 'Download all';
    downloadAllBtn.type = 'button';
    Object.assign(downloadAllBtn.style, {
        padding: '10px 14px',
        fontSize: '13px',
        fontWeight: '600',
        borderRadius: '8px',
        cursor: 'pointer',
        border: '1px solid #047857',
        background: 'linear-gradient(135deg, #059669, #047857)',
        color: '#ffffff',
        boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)'
    });
    downloadAllBtn.disabled = pairs.length === 0;
    if (downloadAllBtn.disabled) {
        downloadAllBtn.style.opacity = '0.5';
        downloadAllBtn.style.cursor = 'not-allowed';
    }
    downloadAllBtn.onclick = async () => {
        if (!pairs.length) return;
        downloadAllBtn.disabled = true;
        const prevText = downloadAllBtn.textContent;
        downloadAllBtn.textContent = 'Downloading…';
        try {
            const multi = pairs.length > 1;
            for (let i = 0; i < pairs.length; i++) {
                const { beforeUrl, afterUrl } = pairs[i];
                const suf = multi ? `-${i + 1}` : '';
                if (beforeUrl) {
                    await downloadUrlAsFile(beforeUrl, `before${suf}-${getFilenameFromUrl(beforeUrl)}`);
                    await delay(280);
                }
                await downloadUrlAsFile(afterUrl, `after${suf}-${getFilenameFromUrl(afterUrl)}`);
                if (i < pairs.length - 1) await delay(280);
            }
        } finally {
            downloadAllBtn.textContent = prevText;
            downloadAllBtn.disabled = false;
        }
    };

    const downloadAllHint = document.createElement('span');
    downloadAllHint.textContent = 'Saves each image as a file (not a link).';
    downloadAllHint.style.fontSize = '11px';
    downloadAllHint.style.color = '#64748b';

    downloadAllBar.appendChild(downloadAllBtn);
    downloadAllBar.appendChild(downloadAllHint);
    container.appendChild(downloadAllBar);

    // Results Grid
    const grid = document.createElement('div');
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '16px';
    grid.style.overflowY = 'auto';
    grid.style.flex = '1';
    grid.style.minHeight = '0';
    grid.style.paddingRight = '4px'; // Space for scrollbar

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
                const slider = Slider({
                    beforeImage: beforeUrl,
                    afterImage: generatedUrl,
                    aspectRatio: aspectRatio
                });
                grid.appendChild(slider);
                grid.appendChild(createActionsRow(beforeUrl, generatedUrl));
            } else {
                const img = document.createElement('img');
                img.src = generatedUrl;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
                grid.appendChild(img);
                grid.appendChild(createActionsRow('', generatedUrl));
            }
        }
    });

    container.appendChild(grid);

    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.flexDirection = 'column';
    actionsDiv.style.gap = '8px';
    actionsDiv.style.marginTop = 'auto';

    const closeBtn = Button({
        text: 'Close',
        variant: 'secondary',
        onClick: actions.closeModal,
        className: 'aif-btn-secondary' // We need to define this style or inline it
    });
    // Quick inline style fix for secondary button since we didn't define it in styles.js yet
    closeBtn.style.background = 'white';
    closeBtn.style.border = '1px solid #cbd5e1';
    closeBtn.style.color = '#475569';
    closeBtn.onmouseover = () => (closeBtn.style.background = '#f8fafc');
    closeBtn.onmouseout = () => (closeBtn.style.background = 'white');

    const tryAgainBtn = document.createElement('button');
    tryAgainBtn.textContent = 'Try another photo';
    tryAgainBtn.style.background = 'none';
    tryAgainBtn.style.border = 'none';
    tryAgainBtn.style.color = '#64748b';
    tryAgainBtn.style.fontSize = '12px';
    tryAgainBtn.style.cursor = 'pointer';
    tryAgainBtn.style.textDecoration = 'underline';
    tryAgainBtn.onclick = actions.reset;

    actionsDiv.appendChild(closeBtn);
    actionsDiv.appendChild(tryAgainBtn);

    container.appendChild(actionsDiv);

    return container;
};
