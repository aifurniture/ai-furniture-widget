/**
 * Results View Component
 */
import { actions, VIEWS, QUEUE_STATUS } from '../../state/store.js';
import { Slider } from './Slider.js';
import { Button } from './Button.js';
import {
    saveSingleImage,
    openImageSaveTarget,
    getFilenameFromUrl,
    shareBeforeAfter,
} from '../../utils/downloadImage.js';

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
            alert('Could not open the share sheet. Use Save room photo / Save preview, then share from your gallery.');
        }
    } finally {
        button.disabled = false;
        setButtonLabel(button, label);
    }
}

async function saveOneImage(button, item, dlOpts) {
    button.disabled = true;
    const label = button.querySelector('.aif-result-actions__label')?.textContent || button.textContent;
    setButtonLabel(button, 'Saving…');
    try {
        const result = await saveSingleImage(item, dlOpts);
        if (
            result &&
            !result.ok &&
            result.reason !== 'cancelled' &&
            (result.reason === 'mobile_fallback' || result.reason === 'fetch_failed')
        ) {
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
        }
    });

    container.appendChild(grid);

    if (saveSection) {
        container.appendChild(saveSection);
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'aif-results-footer';

    const disclaimer = document.createElement('p');
    disclaimer.className = 'aif-results-disclaimer';
    disclaimer.textContent =
        'Sizing in the preview may vary from real life — always double-check dimensions before purchasing.';
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
