/**
 * Results View Component
 */
import { actions, VIEWS } from '../../state/store.js';
import { Slider } from './Slider.js';
import { Button } from './Button.js';
import { saveImageSet, saveSingleImage, getFilenameFromUrl } from '../../utils/downloadImage.js';

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

async function runSaveAction(button, items, dlOpts) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Saving…';
    try {
        return await saveImageSet(items, dlOpts);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
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

    const createActionsRow = (beforeUrl, afterUrl) => {
        const wrap = document.createElement('div');
        wrap.className = 'aif-result-actions';

        const hint = document.createElement('p');
        hint.className = 'aif-result-actions__hint';
        hint.textContent = 'Save your images';
        wrap.appendChild(hint);

        const grid = document.createElement('div');
        grid.className = 'aif-result-actions__grid';

        const beforeItem = beforeUrl
            ? {
                  url: beforeUrl,
                  filename: `before-${getFilenameFromUrl(beforeUrl, 'room.jpg')}`
              }
            : null;
        const afterItem = afterUrl
            ? {
                  url: afterUrl,
                  filename: `after-${getFilenameFromUrl(afterUrl, 'preview.png')}`
              }
            : null;

        if (beforeItem && afterItem) {
            const saveBothBtn = makeActionButton(
                'Save both images',
                'aif-result-actions__btn aif-result-actions__btn--primary aif-result-actions__btn--full',
                async () => {
                    await runSaveAction(saveBothBtn, [beforeItem, afterItem], dlOpts);
                }
            );
            grid.appendChild(saveBothBtn);

            const split = document.createElement('div');
            split.className = 'aif-result-actions__split';

            const beforeBtn = makeActionButton(
                'Before photo',
                'aif-result-actions__btn',
                async () => {
                    beforeBtn.disabled = true;
                    const label = beforeBtn.textContent;
                    beforeBtn.textContent = 'Opening…';
                    try {
                        await saveSingleImage(beforeItem, dlOpts);
                    } finally {
                        beforeBtn.disabled = false;
                        beforeBtn.textContent = label;
                    }
                }
            );

            const afterBtn = makeActionButton(
                'After photo',
                'aif-result-actions__btn',
                async () => {
                    afterBtn.disabled = true;
                    const label = afterBtn.textContent;
                    afterBtn.textContent = 'Opening…';
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
        } else if (afterItem) {
            const saveAfterBtn = makeActionButton(
                'Save after image',
                'aif-result-actions__btn aif-result-actions__btn--primary aif-result-actions__btn--full',
                async () => {
                    await runSaveAction(saveAfterBtn, [afterItem], dlOpts);
                }
            );
            grid.appendChild(saveAfterBtn);
        }

        wrap.appendChild(grid);
        return wrap;
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
                    aspectRatio: aspectRatio,
                    fillParent: true
                });
                grid.appendChild(previewBlock(slider));
            } else {
                const img = document.createElement('img');
                img.src = generatedUrl;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
                grid.appendChild(previewBlock(img));
            }
            grid.appendChild(createActionsRow(beforeUrl, generatedUrl));
        }
    });

    container.appendChild(grid);

    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.flexDirection = 'column';
    actionsDiv.style.gap = '8px';
    actionsDiv.style.flexShrink = '0';
    actionsDiv.style.marginTop = '12px';

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
