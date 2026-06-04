/**
 * Results View Component
 */
import { actions, VIEWS } from '../../state/store.js';
import { Slider } from './Slider.js';
import { Button } from './Button.js';
import { downloadUrlAsFile, getFilenameFromUrl } from '../../utils/downloadImage.js';

function previewBlock(el) {
    const wrap = document.createElement('div');
    wrap.className = 'aif-result-preview-block';
    wrap.appendChild(el);
    return wrap;
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

    const createActionsRow = (afterUrl) => {
        const wrap = document.createElement('div');
        wrap.className = 'aif-result-actions';
        wrap.style.marginTop = '12px';

        const savePreviewBtn = Button({
            text: 'Save preview',
            onClick: () =>
                downloadUrlAsFile(afterUrl, `preview-${getFilenameFromUrl(afterUrl)}`, dlOpts)
        });
        savePreviewBtn.style.width = '100%';

        wrap.appendChild(savePreviewBtn);
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
            grid.appendChild(createActionsRow(generatedUrl));
        }
    });

    container.appendChild(grid);

    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.flexDirection = 'column';
    actionsDiv.style.gap = '8px';
    actionsDiv.style.flexShrink = '0';
    actionsDiv.style.marginTop = '12px';

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
