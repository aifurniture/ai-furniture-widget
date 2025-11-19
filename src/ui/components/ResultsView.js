/**
 * Results View Component
 */
import { actions } from '../../state/store.js';
import { Slider } from './Slider.js';
import { Button } from './Button.js';

export const ResultsView = (state) => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    container.style.height = '100%';

    // Header
    const header = document.createElement('div');
    header.innerHTML = `
    <h3 style="margin:0; font-size:16px; font-weight:600;">✨ Your room preview</h3>
    <p style="margin:4px 0 0; font-size:12px; color:#64748b;">Drag the slider to compare.</p>
  `;
    container.appendChild(header);

    // Results Grid
    const grid = document.createElement('div');
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '16px';
    grid.style.overflowY = 'auto';
    grid.style.flex = '1';
    grid.style.paddingRight = '4px'; // Space for scrollbar

    // Try to get original image from state, or fallback (maybe from the result metadata if we had it)
    // For queue items, we might not have the original blob if page refreshed.
    // Ideally, the backend should return the original image URL too, or we store it in session (as base64? heavy).
    // For now, if no original image, we might just show the result or a placeholder.

    let originalUrl = '';
    if (state.uploadedImage) {
        originalUrl = URL.createObjectURL(state.uploadedImage);
    } else if (state.generatedImages && state.generatedImages.length > 0 && state.generatedImages[0].originalImageUrl) {
        // If backend returns original URL (it should!)
        originalUrl = state.generatedImages[0].originalImageUrl;
    }

    // If still no original URL, we can't use the slider effectively. 
    // We should just show the generated image.

    state.generatedImages.forEach((imgData) => {
        const generatedUrl = imgData.url || imgData;
        if (generatedUrl) {
            if (originalUrl) {
                const slider = Slider({
                    beforeImage: originalUrl,
                    afterImage: generatedUrl
                });
                grid.appendChild(slider);
            } else {
                // Fallback: just show the generated image
                const img = document.createElement('img');
                img.src = generatedUrl;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
                grid.appendChild(img);
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
    closeBtn.onmouseover = () => closeBtn.style.background = '#f8fafc';
    closeBtn.onmouseout = () => closeBtn.style.background = 'white';

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
