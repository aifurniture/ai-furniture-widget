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
    sideboard: [100, 120, 140, 160, 180, 200],
    diningChair: [40, 45, 50, 55],
    default: [100, 120, 140, 160, 180, 200, 220],
};

function inferPieceKind(productName = '', productUrl = '') {
    const text = `${productName} ${productUrl}`.toLowerCase();
    if (/\b(sofa|couch|settee|sectional|loveseat)\b/.test(text)) return 'sofa';
    if (/\b(bed|mattress|headboard)\b/.test(text)) return 'bed';
    if (/\b(coffee\s+table|cocktail\s+table)\b/.test(text)) return 'coffeeTable';
    if (/\b(dining\s+table|kitchen\s+table|dining\s+set)\b/.test(text)) return 'diningTable';
    if (/\b(sideboard|credenza|buffet|dresser|chest\s+of\s+drawers|tv\s+stand|media)\b/.test(text)) {
        return 'sideboard';
    }
    if (/\b(dining\s+chair|kitchen\s+chair|bar\s+stool)\b/.test(text)) return 'diningChair';
    if (/\btable\b/.test(text)) return 'diningTable';
    return 'default';
}

/** Short noun for the product they’re buying (shown in copy). */
function productNoun(kind) {
    switch (kind) {
        case 'sofa':
            return 'sofa';
        case 'bed':
            return 'bed';
        case 'coffeeTable':
            return 'coffee table';
        case 'diningTable':
            return 'dining table';
        case 'sideboard':
            return 'sideboard';
        case 'diningChair':
            return 'dining chair';
        default:
            return 'item';
    }
}

/** What to measure in their photo. */
function measureTarget(kind) {
    switch (kind) {
        case 'sofa':
            return 'the sofa in your photo';
        case 'bed':
            return 'the bed in your photo';
        case 'coffeeTable':
            return 'the coffee table in your photo';
        case 'diningTable':
            return 'the dining table in your photo';
        case 'sideboard':
            return 'the sideboard or chest in your photo';
        case 'diningChair':
            return 'one dining chair in your photo';
        default:
            return 'the furniture you’re replacing in your photo';
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
    const noun = productNoun(kind);
    const target = measureTarget(kind);
    const chips = CHIP_SETS[kind] || CHIP_SETS.default;
    const selected = state.furnitureWidthCm;

    const header = document.createElement('div');
    header.className = 'aif-header';
    header.innerHTML = `
      <span class="aif-eyebrow">Size check</span>
      <h2>Roughly how wide is ${target}?</h2>
      <p>Measure <strong>left to right</strong> across the furniture you’ll replace — in centimetres. A close guess is fine; we use it so this ${noun} isn’t shown too big or too small.</p>
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
          <span class="aif-measure-span__label">${selected ? `${selected} cm wide` : 'left → right'}</span>
        `;
        thumbWrap.appendChild(overlay);
        stage.appendChild(thumbWrap);
    }

    const chipHeading = document.createElement('p');
    chipHeading.className = 'aif-measure-chip-heading';
    chipHeading.textContent = 'Width (cm)';
    stage.appendChild(chipHeading);

    const chipSection = document.createElement('div');
    chipSection.className = 'aif-measure-chips';
    chipSection.setAttribute('role', 'group');
    chipSection.setAttribute('aria-label', `Width of ${target} in centimetres`);

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
        btn.title = `${cm} cm wide`;
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
    customLabel.textContent = 'Or type the width';

    const customField = document.createElement('div');
    customField.className = 'aif-measure-custom__field';

    const customInput = document.createElement('input');
    customInput.id = 'aif-measure-custom-input';
    customInput.type = 'number';
    customInput.inputMode = 'decimal';
    customInput.min = '30';
    customInput.max = '600';
    customInput.step = '1';
    customInput.placeholder = kind === 'diningChair' ? 'e.g. 48' : 'e.g. 180';
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
        'Only the width — left edge to right edge of that furniture in your photo. Height is worked out from the product pictures.';
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
            continueBtn.textContent = selected ? `Use ${selected} cm` : 'Continue';
        }
    };

    const continueBtn = Button({
        text: selected ? `Use ${selected} cm` : 'Continue',
        onClick: () => run(selected),
    });

    const skipBtn = Button({
        text: 'Skip — I’ll let you estimate',
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
