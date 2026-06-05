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

function makeActionButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
}

async function runShare(button, beforeUrl, afterUrl, dlOpts) {
    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Preparing…';
    try {
        const result = await shareBeforeAfter(beforeUrl, afterUrl, dlOpts);
        if (!result.ok && result.reason === 'mobile_fallback') {
            alert('Could not open the share sheet. Use Save room photo / Save preview, then share from your gallery.');
        }
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

async function saveOneImage(button, item, dlOpts) {
    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Saving…';
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
        button.textContent = label;
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

    const actions = document.createElement('div');
    actions.className = 'aif-result-actions';

    const hint = document.createElement('p');
    hint.className = 'aif-result-actions__hint';
    hint.textContent = 'Share or save your preview';
    actions.appendChild(hint);

    if (afterItem) {
        const shareBtn = makeActionButton(
            'Share before & after',
            'aif-result-actions__btn aif-result-actions__btn--primary aif-result-actions__btn--full',
            () => runShare(shareBtn, resolvedBefore, afterUrl, dlOpts)
        );
        actions.appendChild(shareBtn);

        const split = document.createElement('div');
        split.className = 'aif-result-actions__split';

        const beforeBtn = makeActionButton(
            'Save room photo',
            'aif-result-actions__btn aif-result-actions__btn--save',
            () => {
                if (beforeItem) saveOneImage(beforeBtn, beforeItem, dlOpts);
            }
        );
        if (!beforeItem) {
            beforeBtn.disabled = true;
            beforeBtn.title = 'Original room photo unavailable';
        }

        const afterBtn = makeActionButton(
            'Save preview',
            'aif-result-actions__btn aif-result-actions__btn--save',
            () => saveOneImage(afterBtn, afterItem, dlOpts)
        );

        split.appendChild(beforeBtn);
        split.appendChild(afterBtn);
        actions.appendChild(split);
    }

    section.appendChild(actions);
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

    const header = document.createElement('div');
    header.className = 'aif-results-lede';
    header.innerHTML = `
    <h3 style="margin:0; font-size:16px; font-weight:600;">Your preview</h3>
    <p style="margin:4px 0 0; font-size:12px; color:#64748b;line-height:1.4;">
      Drag the slider to compare before and after.
    </p>
  `;
    container.appendChild(header);

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
                            fillParent: true
                        })
                    )
                );
            } else {
                const img = document.createElement('img');
                img.src = generatedUrl;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
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
