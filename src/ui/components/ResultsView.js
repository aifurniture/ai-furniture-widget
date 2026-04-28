/**
 * Results View Component
 */
import { store, actions, VIEWS } from '../../state/store.js';
import { Slider } from './Slider.js';
import { Button } from './Button.js';
import { downloadUrlAsFile, fetchImageBlob, getFilenameFromUrl } from '../../utils/downloadImage.js';

function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function requestFullscreenEl(el) {
    const req =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.webkitRequestFullScreen ||
        null;
    if (req) await req.call(el);
    else throw new Error('Fullscreen not supported');
}

async function exitFullscreenDoc() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || null;
    if (exit) await exit.call(document);
}

/**
 * Wraps a slider or static preview image with a fullscreen control (keeps drag slider usable in fullscreen).
 */
function wrapPreviewWithFullscreen(previewEl) {
    const shell = document.createElement('div');
    shell.className = 'aif-result-preview-shell';
    shell.style.cssText = 'position:relative;width:100%;';

    const fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.className = 'aif-result-preview-fs-btn';
    fsBtn.textContent = 'Fullscreen';
    fsBtn.setAttribute('aria-label', 'View preview full screen');
    fsBtn.style.cssText = [
        'position:absolute',
        'top:10px',
        'right:10px',
        'z-index:25',
        'padding:8px 12px',
        'font-size:12px',
        'font-weight:600',
        'border-radius:8px',
        'border:1px solid rgba(255,255,255,0.45)',
        'background:rgba(15,23,42,0.72)',
        'color:#fff',
        'cursor:pointer',
        'font-family:inherit',
        'line-height:1.2',
        'backdrop-filter:blur(8px)',
        '-webkit-backdrop-filter:blur(8px)',
        'box-shadow:0 2px 8px rgba(0,0,0,0.2)'
    ].join(';');

    const applyFullscreenLayout = () => {
        const isFs = getFullscreenElement() === shell;
        if (isFs) {
            shell.style.width = '100%';
            shell.style.height = '100%';
            shell.style.minHeight = '100%';
            shell.style.display = 'flex';
            shell.style.alignItems = 'center';
            shell.style.justifyContent = 'center';
            shell.style.background = '#0f172a';
            shell.style.padding = '12px';
            shell.style.boxSizing = 'border-box';
            previewEl.style.maxWidth = '100%';
            previewEl.style.maxHeight = '100%';
            previewEl.style.width = 'auto';
            previewEl.style.height = 'auto';
            previewEl.style.flexShrink = '0';
            fsBtn.textContent = 'Exit';
            fsBtn.setAttribute('aria-label', 'Exit full screen');
        } else {
            shell.style.width = '100%';
            shell.style.height = '';
            shell.style.minHeight = '';
            shell.style.display = '';
            shell.style.alignItems = '';
            shell.style.justifyContent = '';
            shell.style.background = '';
            shell.style.padding = '';
            previewEl.style.maxWidth = '';
            previewEl.style.maxHeight = '';
            previewEl.style.width = '';
            previewEl.style.height = '';
            previewEl.style.flexShrink = '';
            fsBtn.textContent = 'Fullscreen';
            fsBtn.setAttribute('aria-label', 'View preview full screen');
        }
    };

    const onFsChange = () => applyFullscreenLayout();
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    fsBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            if (getFullscreenElement() === shell) {
                await exitFullscreenDoc();
            } else {
                await requestFullscreenEl(shell);
            }
        } catch {
            /* unsupported or denied */
        }
        applyFullscreenLayout();
    });

    shell.appendChild(previewEl);
    shell.appendChild(fsBtn);
    return shell;
}

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
            const s3Key = imgData.imageS3Key || imgData?.metadata?.imageS3Key || null;
            const furnitureWidthCm =
                typeof imgData.furnitureWidthCm === 'number' && Number.isFinite(imgData.furnitureWidthCm)
                    ? imgData.furnitureWidthCm
                    : null;
            if (afterUrl) pairs.push({ beforeUrl, afterUrl, index, s3Key, furnitureWidthCm });
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

    const createActionsRow = (beforeUrl, afterUrl, s3Key = null, furnitureWidthCm = null) => {
        const wrap = document.createElement('div');
        wrap.className = 'aif-result-actions';
        wrap.setAttribute('data-aif-actions', 'download-share');

        const hint = document.createElement('p');
        hint.className = 'aif-result-actions__hint';
        hint.textContent = beforeUrl
            ? 'Save both images — tap each button:'
            : 'Save your preview:';

        const row = document.createElement('div');
        row.className = 'aif-result-actions__row';

        const makeBtn = (text, onClick, primary = false) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            btn.className = primary ? 'aif-result-actions__btn aif-result-actions__btn--primary' : 'aif-result-actions__btn';
            btn.onclick = onClick;
            return btn;
        };

        const saveRoomBtn = makeBtn('Save room photo', () => {
            downloadUrlAsFile(beforeUrl, `room-${getFilenameFromUrl(beforeUrl)}`, dlOpts);
        });
        if (!beforeUrl) {
            saveRoomBtn.disabled = true;
        }

        const savePreviewBtn = makeBtn(
            'Save AI preview',
            () => downloadUrlAsFile(afterUrl, `preview-${getFilenameFromUrl(afterUrl)}`, dlOpts),
            true
        );
        const shareBtn = makeBtn('Share', () => shareBeforeAfter(beforeUrl, afterUrl));
        const retryBtn = makeBtn('Retry', () => {
            const cur = store.getState();
            const config = cur.config || {};
            const queueId = `queue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            actions.addToQueue({
                id: queueId,
                productUrl: config.productUrl || window.location.href,
                productName: config.productTitle || document.title || '',
                selectedModel: 'slow',
                config,
                queuedAt: Date.now(),
                ...(s3Key ? { imageS3Key: s3Key } : {}),
                ...(typeof furnitureWidthCm === 'number' &&
                Number.isFinite(furnitureWidthCm) &&
                furnitureWidthCm > 0
                    ? { furnitureWidthCm }
                    : {})
            });
            actions.setView(VIEWS.QUEUE);
            actions.setQueueTab('processing');
        });
        if (!s3Key) {
            retryBtn.disabled = true;
            retryBtn.title = 'Retry is unavailable for this preview. Try another photo instead.';
        }

        row.appendChild(saveRoomBtn);
        row.appendChild(savePreviewBtn);
        row.appendChild(shareBtn);
        row.appendChild(retryBtn);

        // Keep the hint for accessibility, but let CSS collapse it on desktop to save space.
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
    <p style="margin:6px 0 0; font-size:11px; color:#64748b; line-height:1.4;">
      Sizes are AI-estimated and may vary. Please measure your space and check product dimensions before purchasing.
    </p>
  `;
    container.appendChild(header);

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

    pairs.forEach(({ beforeUrl, afterUrl, index: i, s3Key, furnitureWidthCm }) => {
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
                grid.appendChild(wrapPreviewWithFullscreen(slider));
                grid.appendChild(createActionsRow(beforeUrl, generatedUrl, s3Key, furnitureWidthCm));
            } else {
                const img = document.createElement('img');
                img.src = generatedUrl;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
                grid.appendChild(wrapPreviewWithFullscreen(img));
                grid.appendChild(createActionsRow('', generatedUrl, s3Key, furnitureWidthCm));
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

    const backBtn = Button({
        text: 'Back',
        variant: 'secondary',
        onClick: () => {
            const { userEmail } = store.getState();
            if ((userEmail || '').trim()) {
                actions.setQueueTab('completed');
            }
            actions.setView(VIEWS.QUEUE);
        },
        className: 'aif-btn-secondary'
    });
    backBtn.style.background = 'white';
    backBtn.style.border = '1px solid #cbd5e1';
    backBtn.style.color = '#475569';
    backBtn.onmouseover = () => (backBtn.style.background = '#f8fafc');
    backBtn.onmouseout = () => (backBtn.style.background = 'white');

    const tryAgainBtn = document.createElement('button');
    tryAgainBtn.textContent = 'Try another photo';
    tryAgainBtn.style.background = 'none';
    tryAgainBtn.style.border = 'none';
    tryAgainBtn.style.color = '#64748b';
    tryAgainBtn.style.fontSize = '12px';
    tryAgainBtn.style.cursor = 'pointer';
    tryAgainBtn.style.textDecoration = 'underline';
    tryAgainBtn.onclick = actions.reset;

    actionsDiv.appendChild(backBtn);
    actionsDiv.appendChild(tryAgainBtn);

    container.appendChild(actionsDiv);

    return container;
};
