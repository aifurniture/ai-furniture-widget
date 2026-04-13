/**
 * Results View Component
 */
import { actions } from '../../state/store.js';
import { Slider } from './Slider.js';
import { Button } from './Button.js';
import { downloadUrlAsFile, fetchImageBlob, getFilenameFromUrl } from '../../utils/downloadImage.js';

export const ResultsView = (state) => {
    const uploadedBlobUrl = state.uploadedImage ? URL.createObjectURL(state.uploadedImage) : '';

    const apiEndpoint =
        state.config?.apiEndpoint ||
        (typeof window !== 'undefined' && window.__AIFurnitureConfig?.apiEndpoint) ||
        'https://ai-furniture-backend.vercel.app/api';

    const dlOpts = { apiEndpoint };

    const buildPairs = () => {
        const pairs = [];
        state.generatedImages.forEach((imgData, index) => {
            const afterUrl = imgData.url || imgData;
            const beforeUrl = imgData.originalImageUrl || uploadedBlobUrl || '';
            if (afterUrl) pairs.push({ beforeUrl, afterUrl, index });
        });
        return pairs;
    };

    /**
     * Web Share Level 2: share before/after as image files when the target supports it.
     */
    const shareBeforeAfter = async (beforeUrl, afterUrl) => {
        if (!afterUrl) return;

        const roomBase = `room-${getFilenameFromUrl(beforeUrl || 'room', 'room.jpg')}`;
        const previewBase = `preview-${getFilenameFromUrl(afterUrl, 'preview.png')}`;

        const files = [];

        if (beforeUrl) {
            const blob = await fetchImageBlob(beforeUrl, roomBase, dlOpts);
            if (blob) {
                const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
                const name = /\.[a-z0-9]+$/i.test(roomBase) ? roomBase : `${roomBase}.jpg`;
                files.push(new File([blob], name, { type }));
            }
        }

        const afterBlob = await fetchImageBlob(afterUrl, previewBase, dlOpts);
        if (afterBlob) {
            const type =
                afterBlob.type && afterBlob.type.startsWith('image/') ? afterBlob.type : 'image/png';
            const name = /\.[a-z0-9]+$/i.test(previewBase) ? previewBase : `${previewBase}.png`;
            files.push(new File([afterBlob], name, { type }));
        }

        const sharePayload = (fileList) => ({
            title: 'AI Furniture — room & preview',
            text: fileList.length > 1 ? 'Before and after images' : 'AI room preview',
            files: fileList
        });

        if (typeof navigator.share === 'function' && files.length > 0) {
            const shareFiles = async (list) => {
                await navigator.share(sharePayload(list));
            };

            try {
                await shareFiles(files);
                return;
            } catch (e) {
                if (e && e.name === 'AbortError') return;
            }

            if (files.length > 1) {
                try {
                    await shareFiles([files[files.length - 1]]);
                    return;
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                }
            }
        }

        try {
            if (typeof navigator.share === 'function') {
                await navigator.share({
                    title: 'AI Furniture Result',
                    text: 'Check out my room preview',
                    url: afterUrl
                });
                return;
            }
        } catch (e) {
            if (e && e.name === 'AbortError') return;
        }

        try {
            await navigator.clipboard.writeText(afterUrl);
            alert('Link copied to clipboard');
        } catch (_) {
            alert(
                'Unable to share images automatically. Use Save room photo / Save AI preview, then share from your gallery.'
            );
        }
    };

    const createActionsRow = (beforeUrl, afterUrl) => {
        const wrap = document.createElement('div');
        wrap.style.flexShrink = '0';
        wrap.style.marginTop = '4px';
        wrap.style.padding = '12px 0 4px';
        wrap.style.borderTop = '1px solid #e2e8f0';
        wrap.setAttribute('data-aif-actions', 'download-share');

        const hint = document.createElement('p');
        hint.style.margin = '0 0 10px 0';
        hint.style.fontSize = '12px';
        hint.style.fontWeight = '600';
        hint.style.color = '#334155';
        hint.textContent = beforeUrl
            ? 'Save both images — tap each button:'
            : 'Save your preview:';

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.flexWrap = 'wrap';
        row.style.alignItems = 'center';

        const makeBtn = (text, onClick, primary = false) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            btn.style.padding = '10px 12px';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '600';
            btn.style.borderRadius = '8px';
            btn.style.cursor = 'pointer';
            btn.style.border = primary ? '1px solid #047857' : '1px solid #cbd5e1';
            btn.style.background = primary ? '#059669' : '#ffffff';
            btn.style.color = primary ? '#ffffff' : '#334155';
            btn.onclick = onClick;
            return btn;
        };

        const saveRoomBtn = makeBtn('Save room photo', () => {
            downloadUrlAsFile(beforeUrl, `room-${getFilenameFromUrl(beforeUrl)}`, dlOpts);
        });
        if (!beforeUrl) {
            saveRoomBtn.disabled = true;
            saveRoomBtn.style.opacity = '0.5';
            saveRoomBtn.style.cursor = 'not-allowed';
        }

        const savePreviewBtn = makeBtn(
            'Save AI preview',
            () => downloadUrlAsFile(afterUrl, `preview-${getFilenameFromUrl(afterUrl)}`, dlOpts),
            true
        );
        const shareBtn = makeBtn('Share', () => shareBeforeAfter(beforeUrl, afterUrl));

        row.appendChild(saveRoomBtn);
        row.appendChild(savePreviewBtn);
        row.appendChild(shareBtn);

        wrap.appendChild(hint);
        wrap.appendChild(row);
        return wrap;
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
    <p style="margin:4px 0 0; font-size:12px; color:#64748b;">Drag the slider to compare, then save your photos below.</p>
  `;
    container.appendChild(header);

    const remote = state.remoteGenerations || [];
    if (state.userEmail && remote.length > 0) {
        const histWrap = document.createElement('div');
        histWrap.className = 'aif-history';
        const ht = document.createElement('h4');
        ht.className = 'aif-history__title';
        ht.textContent = 'Your saved previews';
        const row = document.createElement('div');
        row.className = 'aif-history__row';
        remote.forEach((entry) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'aif-history__card';
            const thumb = document.createElement('img');
            thumb.src = entry.previewImageUrl;
            thumb.alt = entry.productName || 'Preview';
            thumb.loading = 'lazy';
            const meta = document.createElement('div');
            meta.className = 'aif-history__meta';
            let pathLabel = 'Preview';
            try {
                if (entry.productUrl) {
                    pathLabel = new URL(entry.productUrl).pathname.split('/').filter(Boolean).pop() || pathLabel;
                }
            } catch {
                /* ignore */
            }
            const label =
                (entry.productName && entry.productName.slice(0, 40)) || pathLabel;
            meta.textContent = label;
            card.appendChild(thumb);
            card.appendChild(meta);
            card.onclick = () => {
                actions.setGenerationResults([
                    {
                        url: entry.previewImageUrl,
                        originalImageUrl: entry.originalImageUrl || '',
                        originalAspectRatio: entry.metadata?.originalAspectRatio,
                        originalWidth: entry.metadata?.originalWidth,
                        originalHeight: entry.metadata?.originalHeight
                    }
                ]);
            };
            row.appendChild(card);
        });
        histWrap.appendChild(ht);
        histWrap.appendChild(row);
        container.appendChild(histWrap);
    }

    const pairs = buildPairs();

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
