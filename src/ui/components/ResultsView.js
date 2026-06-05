/**
 * Results View Component
 */
import { actions, VIEWS } from '../../state/store.js';
import { Slider } from './Slider.js';
import { Button } from './Button.js';
import {
    saveImageSet,
    saveSingleImage,
    openImageSaveTarget,
    isMobileDevice,
    getFilenameFromUrl
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

function showMobileSaveFallback(container, items, dlOpts) {
    const existing = container.querySelector('.aif-save-fallback');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.className = 'aif-save-fallback';

    const text = document.createElement('p');
    text.className = 'aif-save-fallback__text';
    text.textContent = isMobileDevice()
        ? 'Tap each image to open it, then use Save to Photos (iPhone) or Download (Android).'
        : 'Tap each button to open the image in a new tab.';
    wrap.appendChild(text);

    items.forEach((item, index) => {
        const label =
            items.length > 1
                ? index === 0
                    ? 'Open before photo'
                    : 'Open after photo'
                : 'Open image';
        wrap.appendChild(
            makeActionButton(label, 'aif-save-fallback__btn', () => {
                openImageSaveTarget(item.url, item.filename, dlOpts);
            })
        );
    });

    container.appendChild(wrap);
}

async function runSaveAction(button, container, items, dlOpts) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Saving…';
    try {
        const result = await saveImageSet(items, dlOpts);
        if (result.ok || result.reason === 'cancelled') return result;
        if (result.reason === 'mobile_fallback' || result.reason === 'fetch_failed') {
            showMobileSaveFallback(container, items, dlOpts);
        }
        return result;
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

function createSaveSection(beforeUrl, afterUrl, dlOpts) {
    const section = document.createElement('div');
    section.className = 'aif-results-save';

    const beforeItem = beforeUrl
        ? { url: beforeUrl, filename: `before-${getFilenameFromUrl(beforeUrl, 'room.jpg')}` }
        : null;
    const afterItem = afterUrl
        ? { url: afterUrl, filename: `after-${getFilenameFromUrl(afterUrl, 'preview.png')}` }
        : null;

    const actions = document.createElement('div');
    actions.className = 'aif-result-actions';

    const hint = document.createElement('p');
    hint.className = 'aif-result-actions__hint';
    hint.textContent = 'Save your preview';
    actions.appendChild(hint);

    const grid = document.createElement('div');
    grid.className = 'aif-result-actions__grid';

    if (beforeItem && afterItem) {
        const split = document.createElement('div');
        split.className = 'aif-result-actions__split';

        const beforeBtn = makeActionButton(
            'Save before',
            'aif-result-actions__btn aif-result-actions__btn--secondary',
            async () => {
                beforeBtn.disabled = true;
                const label = beforeBtn.textContent;
                beforeBtn.textContent = 'Saving…';
                try {
                    await saveSingleImage(beforeItem, dlOpts);
                } finally {
                    beforeBtn.disabled = false;
                    beforeBtn.textContent = label;
                }
            }
        );

        const afterBtn = makeActionButton(
            'Save after',
            'aif-result-actions__btn aif-result-actions__btn--secondary',
            async () => {
                afterBtn.disabled = true;
                const label = afterBtn.textContent;
                afterBtn.textContent = 'Saving…';
                try {
                    await saveSingleImage(afterItem, dlOpts);
                } finally {
                    afterBtn.disabled = false;
                    afterBtn.textContent = label;
                }
            }
        );

        split.appendChild(beforeBtn);
        split.appendChild(afterBtn);
        grid.appendChild(split);

        const saveBothBtn = makeActionButton(
            'Save both images',
            'aif-result-actions__btn aif-result-actions__btn--primary aif-result-actions__btn--full',
            async () => {
                await runSaveAction(saveBothBtn, actions, [beforeItem, afterItem], dlOpts);
            }
        );
        grid.appendChild(saveBothBtn);
    } else if (afterItem) {
        const saveBtn = makeActionButton(
            'Save preview',
            'aif-result-actions__btn aif-result-actions__btn--primary aif-result-actions__btn--full',
            async () => {
                await runSaveAction(saveBtn, actions, [afterItem], dlOpts);
            }
        );
        grid.appendChild(saveBtn);
    }

    actions.appendChild(grid);
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
            const beforeUrl = imgData.originalImageUrl || uploadedBlobUrl || '';
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
            saveSection = createSaveSection(beforeUrl, generatedUrl, dlOpts);
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
