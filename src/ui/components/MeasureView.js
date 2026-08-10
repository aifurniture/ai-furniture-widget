/**
 * Scale cue step — collect approximate width of the piece being replaced
 * so placement can match real-world size in the room photo.
 */
import { actions, store, VIEWS, fileToDataURL, flushSessionSnapshot } from '../../state/store.js';
import { Button } from './Button.js';
import { trackEvent } from '../../tracking.js';

const CHIP_SETS = {
    sofa: [140, 160, 180, 200, 220, 240, 280],
    bed: [90, 120, 135, 150, 180],
    diningTable: [120, 140, 160, 180, 200, 220],
    coffeeTable: [80, 100, 120, 140],
    default: [100, 120, 140, 160, 180, 200, 220],
};

function inferPieceKind(productName = '', productUrl = '') {
    const text = `${productName} ${productUrl}`.toLowerCase();
    if (/\b(sofa|couch|settee|sectional|loveseat)\b/.test(text)) return 'sofa';
    if (/\b(bed|mattress|headboard)\b/.test(text)) return 'bed';
    if (/\b(coffee\s+table|cocktail\s+table)\b/.test(text)) return 'coffeeTable';
    if (/\b(dining\s+table|kitchen\s+table|dining\s+set)\b/.test(text)) return 'diningTable';
    if (/\btable\b/.test(text)) return 'diningTable';
    return 'default';
}

function pieceLabel(kind) {
    switch (kind) {
        case 'sofa':
            return 'sofa';
        case 'bed':
            return 'bed';
        case 'coffeeTable':
            return 'coffee table';
        case 'diningTable':
            return 'table';
        default:
            return 'piece';
    }
}

function parseCustomCm(raw) {
    if (raw == null || raw === '') return null;
    const n = parseFloat(String(raw).replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 30 || n > 600) return null;
    return Math.round(n * 10) / 10;
}

async function startGeneration({ furnitureWidthCm }) {
    const currentState = store.getState();
    const image = currentState.uploadedImage;
    if (!image) {
        actions.setView(VIEWS.UPLOAD);
        return;
    }

    const productUrl = currentState.config?.productUrl || window.location.href;
    const productName = currentState.config?.productTitle || document.title || productUrl;
    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userImageDataUrl = await fileToDataURL(image);

    const payload = {
        id: queueId,
        productUrl,
        productName,
        userImage: image,
        userImageDataUrl,
        selectedModel: 'slow',
        config: currentState.config || {},
        queuedAt: Date.now(),
    };

    if (typeof furnitureWidthCm === 'number' && furnitureWidthCm > 0) {
        payload.furnitureWidthCm = furnitureWidthCm;
    }

    actions.beginPreviewGeneration(payload);
    flushSessionSnapshot();

    trackEvent('ai_generation_started', {
        queueId,
        productUrl,
        productName,
        model: 'slow',
        imageSize: image?.size || 0,
        furnitureWidthCm: payload.furnitureWidthCm || null,
        hasScaleCue: Boolean(payload.furnitureWidthCm),
    });
}

export const MeasureView = (state) => {
    const container = document.createElement('div');
    container.className = 'aif-measure-view';

    const productName = state.config?.productTitle || document.title || '';
    const productUrl = state.config?.productUrl || '';
    const kind = inferPieceKind(productName, productUrl);
    const label = pieceLabel(kind);
    const chips = CHIP_SETS[kind] || CHIP_SETS.default;
    const selected = state.furnitureWidthCm;

    const header = document.createElement('div');
    header.className = 'aif-header';
    header.innerHTML = `
      <span class="aif-eyebrow">Scale check</span>
      <h2>How wide is your current ${label}?</h2>
      <p>One quick number helps us place the new piece at a true-to-life size in your photo.</p>
    `;
    container.appendChild(header);

    const stage = document.createElement('div');
    stage.className = 'aif-measure-stage';

    if (state.uploadedImage) {
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'aif-measure-thumb';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(state.uploadedImage);
        img.alt = 'Your room photo';
        thumbWrap.appendChild(img);

        const overlay = document.createElement('div');
        overlay.className = 'aif-measure-span';
        overlay.innerHTML = `
          <span class="aif-measure-span__cap"></span>
          <span class="aif-measure-span__line"></span>
          <span class="aif-measure-span__cap"></span>
          <span class="aif-measure-span__label">${selected ? `${selected} cm` : 'width'}</span>
        `;
        thumbWrap.appendChild(overlay);
        stage.appendChild(thumbWrap);
    }

    const chipSection = document.createElement('div');
    chipSection.className = 'aif-measure-chips';
    chipSection.setAttribute('role', 'group');
    chipSection.setAttribute('aria-label', `Approximate ${label} width in centimetres`);

    const unsureBtn = document.createElement('button');
    unsureBtn.type = 'button';
    unsureBtn.className = `aif-measure-chip aif-measure-chip--ghost${selected == null ? ' is-selected' : ''}`;
    unsureBtn.textContent = 'Not sure';
    unsureBtn.onclick = () => actions.setFurnitureWidthCm(null);
    chipSection.appendChild(unsureBtn);

    chips.forEach((cm) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `aif-measure-chip${selected === cm ? ' is-selected' : ''}`;
        btn.textContent = `${cm}`;
        btn.setAttribute('aria-pressed', selected === cm ? 'true' : 'false');
        btn.onclick = () => actions.setFurnitureWidthCm(cm);
        chipSection.appendChild(btn);
    });

    const unitHint = document.createElement('span');
    unitHint.className = 'aif-measure-unit';
    unitHint.textContent = 'cm';
    chipSection.appendChild(unitHint);

    stage.appendChild(chipSection);

    const customRow = document.createElement('div');
    customRow.className = 'aif-measure-custom';

    const customLabel = document.createElement('label');
    customLabel.className = 'aif-measure-custom__label';
    customLabel.htmlFor = 'aif-measure-custom-input';
    customLabel.textContent = 'Or type exact width';

    const customField = document.createElement('div');
    customField.className = 'aif-measure-custom__field';

    const customInput = document.createElement('input');
    customInput.id = 'aif-measure-custom-input';
    customInput.type = 'number';
    customInput.inputMode = 'decimal';
    customInput.min = '30';
    customInput.max = '600';
    customInput.step = '1';
    customInput.placeholder = 'e.g. 195';
    customInput.className = 'aif-measure-custom__input';
    if (selected != null && !chips.includes(selected)) {
        customInput.value = String(selected);
    }

    const customSuffix = document.createElement('span');
    customSuffix.className = 'aif-measure-custom__suffix';
    customSuffix.textContent = 'cm';

    const commitCustom = () => {
        const parsed = parseCustomCm(customInput.value);
        actions.setFurnitureWidthCm(parsed);
    };
    customInput.addEventListener('change', commitCustom);
    customInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitCustom();
        }
    });

    customField.appendChild(customInput);
    customField.appendChild(customSuffix);
    customRow.appendChild(customLabel);
    customRow.appendChild(customField);
    stage.appendChild(customRow);

    const tip = document.createElement('p');
    tip.className = 'aif-measure-tip';
    tip.textContent =
        'Tip: measure the piece you’re replacing (left to right), or estimate — even a close guess improves scale.';
    stage.appendChild(tip);

    container.appendChild(stage);

    const footer = document.createElement('div');
    footer.className = 'aif-measure-footer';

    let busy = false;
    const run = async (widthCm) => {
        if (busy) return;
        if (!state.uploadedImage) {
            actions.setView(VIEWS.UPLOAD);
            return;
        }
        busy = true;
        continueBtn.disabled = true;
        skipBtn.disabled = true;
        continueBtn.textContent = 'Starting…';
        try {
            await startGeneration({ furnitureWidthCm: widthCm });
        } catch (err) {
            console.error('Failed to start generation:', err);
            actions.setError(err.message || 'Could not start preview');
            busy = false;
            continueBtn.disabled = false;
            skipBtn.disabled = false;
            continueBtn.textContent = selected ? 'Place at this size' : 'Continue';
        }
    };

    const continueBtn = Button({
        text: selected ? 'Place at this size' : 'Continue',
        onClick: () => run(selected),
    });

    const skipBtn = Button({
        text: 'Skip — estimate from photo',
        variant: 'text',
        onClick: () => run(null),
    });

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'aif-btn-text aif-measure-back';
    backBtn.textContent = '← Change photo';
    backBtn.onclick = () => actions.setUploadedImage(null);

    footer.appendChild(continueBtn);
    footer.appendChild(skipBtn);
    footer.appendChild(backBtn);
    container.appendChild(footer);

    return container;
};
