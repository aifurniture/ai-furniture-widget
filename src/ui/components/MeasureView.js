/**
 * Scale cue step — ask for width of a piece in the room photo (matching
 * piece to replace, or a room ruler when adding). Collision-prone kinds
 * also pick placement intent (replace / add / unsure).
 */
import { actions, store, VIEWS, fileToDataURL, flushSessionSnapshot } from '../../state/store.js';
import { Button } from './Button.js';
import { createModelPicker } from './ModelPicker.js';
import { trackEvent } from '../../tracking.js';
import {
    assessSizeFit,
    assessChoseProductWidth,
    getAddPlacementSpec,
    getMeasureChips,
    getMeasureCopy,
    getPlacementIntentCopy,
    inferMeasureKind,
    isAccessoryMeasureKind,
    isCollisionMeasureKind,
    defaultPlacementIntent,
    normalizeAddAnchor,
    normalizePlacementCount,
    normalizePlacementIntent,
    parseCatalogWidthCm,
} from '../../utils/measureCue.js';
import { widgetUsesInches } from '../theme.js';
import {
    chipDisplayValue,
    cmToInches,
    formatLength,
    parseCustomLengthToCm,
    selectedMatchesChip,
} from '../../utils/widgetUnits.js';

function appendRoomThumb(stage, file, overlayHtml = null, overlayClass = '') {
    if (!file) return;
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'aif-measure-thumb';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = 'Your room photo';
    thumbWrap.appendChild(img);
    if (overlayHtml) {
        const overlay = document.createElement('div');
        overlay.className = overlayClass
            ? `aif-measure-span ${overlayClass}`
            : 'aif-measure-span';
        overlay.innerHTML = overlayHtml;
        thumbWrap.appendChild(overlay);
    }
    stage.appendChild(thumbWrap);
}

async function startGeneration({
    furnitureWidthCm,
    sizeFitMode = null,
    placementIntent = null,
    addAnchor = null,
    placementCount = null,
}) {
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
    const intent = normalizePlacementIntent(placementIntent);
    const selectedModel = currentState.selectedModel === 'fast' ? 'fast' : 'slow';
    const anchor = intent === 'add' ? normalizeAddAnchor(addAnchor) : null;
    const count = intent === 'add' ? normalizePlacementCount(placementCount) : null;

    const payload = {
        id: queueId,
        productUrl,
        productName,
        userImage: image,
        userImageDataUrl,
        selectedModel,
        config: currentState.config || {},
        queuedAt: Date.now(),
    };

    if (typeof furnitureWidthCm === 'number' && furnitureWidthCm > 0) {
        payload.furnitureWidthCm = furnitureWidthCm;
    }
    if (sizeFitMode === 'room_adapt') {
        payload.sizeFitMode = 'room_adapt';
    }
    if (intent) {
        payload.placementIntent = intent;
    }
    if (anchor) {
        payload.addAnchor = anchor;
    }
    if (count) {
        payload.placementCount = count;
    }

    actions.beginPreviewGeneration(payload);
    flushSessionSnapshot();

    trackEvent('ai_generation_started', {
        queueId,
        productUrl,
        productName,
        model: selectedModel,
        imageSize: image?.size || 0,
        furnitureWidthCm: payload.furnitureWidthCm || null,
        hasScaleCue: Boolean(payload.furnitureWidthCm),
        sizeFitMode: payload.sizeFitMode || null,
        placementIntent: intent || null,
        addAnchor: anchor || null,
        placementCount: count || null,
        measureKind: inferMeasureKind(currentState.config || {}),
    });
}

export const MeasureView = (state) => {
    const container = document.createElement('div');
    container.className = 'aif-measure-view';

    const config = state.config || {};
    const imperial = widgetUsesInches(config);
    const unit = imperial ? 'in' : 'cm';
    const productTitle = config.productTitle || document.title || '';
    const kind = inferMeasureKind(config);
    const accessory = isAccessoryMeasureKind(kind);
    const collision = !accessory && isCollisionMeasureKind(kind);
    const intentCopy = collision ? getPlacementIntentCopy(kind) : null;
    const explicitIntent = normalizePlacementIntent(state.placementIntent);
    const implicitIntent = defaultPlacementIntent(kind);
    const placementIntent = explicitIntent || implicitIntent;
    const visualIntent = explicitIntent || (implicitIntent === 'replace' ? 'replace' : null);
    const isAdd = collision && placementIntent === 'add';
    const addSpec = isAdd ? getAddPlacementSpec(kind) : null;
    const asSurfaceHeight = addSpec?.addAnchor === 'surfaceHeight';
    const asRoomRuler = isAdd && !asSurfaceHeight;
    const copy = getMeasureCopy(kind, productTitle, {
        asRoomRuler,
        intent: placementIntent,
        addSpec,
    });
    if (imperial) {
        const dim = asSurfaceHeight ? 'high' : 'wide';
        copy.spanSelected = (cm) => `${formatLength(cm, true)} ${dim}`;
        copy.continueWith = (cm) => (cm ? `Use ${formatLength(cm, true)}` : 'Place in my room');
        copy.ariaGroup = String(copy.ariaGroup || '').replace(/centimetres/gi, 'inches');
        copy.examplePlaceholder = String(copy.examplePlaceholder || '').replace(/\d+/, (n) =>
            String(cmToInches(Number(n)) || n)
        );
    }
    const chips = getMeasureChips(kind, { asRoomRuler, addSpec });
    const selected = state.furnitureWidthCm;
    const selectedCount = normalizePlacementCount(state.placementCount);
    const catalogWidthCm = parseCatalogWidthCm(config);
    // Don't compare sofa-ruler / counter-height cm to catalog product width.
    const skipFitCheck = isAdd;
    const fitOpts = { imperial };
    const fit =
        !skipFitCheck && selected != null && catalogWidthCm != null
            ? assessSizeFit(selected, catalogWidthCm, fitOpts)
            : null;
    const choseProductWidth =
        !skipFitCheck &&
        (!fit || fit.severity === 'ok') &&
        selected != null &&
        catalogWidthCm != null
            ? assessChoseProductWidth(selected, catalogWidthCm, kind, fitOpts)
            : null;

    const header = document.createElement('div');
    header.className = 'aif-header';
    header.innerHTML = `
      <span class="aif-eyebrow">${copy.eyebrow}</span>
      <h2>${copy.title}</h2>
      <p>${copy.body}</p>
    `;
    container.appendChild(header);

    // Accessories: no confusing width question — still show the photo + continue.
    if (accessory) {
        const stage = document.createElement('div');
        stage.className = 'aif-measure-stage';
        appendRoomThumb(stage, state.uploadedImage);
        const note = document.createElement('div');
        note.className = 'aif-measure-fit aif-measure-fit--notice';
        note.setAttribute('role', 'status');
        note.innerHTML = `
          <p class="aif-measure-fit__title">Your photo is ready</p>
          <p class="aif-measure-fit__body">Tap Place in my room — we’ll fit this piece in naturally.</p>
        `;
        stage.appendChild(note);
        container.appendChild(stage);

        const footer = document.createElement('div');
        footer.className = 'aif-measure-footer';

        let busy = false;
        const continueBtn = Button({
            text: 'Place in my room',
            onClick: async () => {
                if (busy) return;
                if (!state.uploadedImage) {
                    actions.setView(VIEWS.UPLOAD);
                    return;
                }
                busy = true;
                continueBtn.disabled = true;
                continueBtn.textContent = 'Starting…';
                try {
                    await startGeneration({ furnitureWidthCm: null });
                } catch (err) {
                    console.error('Failed to start generation:', err);
                    actions.setError(err.message || 'Could not start preview');
                    busy = false;
                    continueBtn.disabled = false;
                    continueBtn.textContent = 'Place in my room';
                }
            },
        });

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'aif-btn-text aif-measure-back';
        backBtn.textContent = '← Change photo';
        backBtn.onclick = () => actions.setUploadedImage(null);

        footer.appendChild(createModelPicker(state.selectedModel, { compact: true }));
        footer.appendChild(continueBtn);
        footer.appendChild(backBtn);
        container.appendChild(footer);
        return container;
    }

    const stage = document.createElement('div');
    stage.className = 'aif-measure-stage';

    appendRoomThumb(
        stage,
        state.uploadedImage,
        `
              <span class="aif-measure-span__cap"></span>
              <span class="aif-measure-span__line"></span>
              <span class="aif-measure-span__cap"></span>
              <span class="aif-measure-span__label">${
                  selected != null ? copy.spanSelected(selected) : copy.spanIdle
              }</span>
            `,
        asSurfaceHeight ? 'aif-measure-span--height' : ''
    );

    if (intentCopy) {
        const intentHeading = document.createElement('p');
        intentHeading.className = 'aif-measure-chip-heading';
        intentHeading.textContent = intentCopy.heading;
        stage.appendChild(intentHeading);

        const intentSection = document.createElement('div');
        intentSection.className = 'aif-measure-chips aif-measure-chips--intent';
        intentSection.setAttribute('role', 'radiogroup');
        intentSection.setAttribute('aria-label', intentCopy.heading);

        intentCopy.options.forEach((opt) => {
            const selectedIntent = visualIntent === opt.id;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `aif-measure-chip aif-measure-chip--intent${
                selectedIntent ? ' is-selected' : ''
            }`;
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', selectedIntent ? 'true' : 'false');
            btn.setAttribute('aria-label', opt.meta ? `${opt.label}, ${opt.meta}` : opt.label);

            const label = document.createElement('span');
            label.className = 'aif-measure-choice__label';
            label.textContent = opt.label;
            btn.appendChild(label);
            if (opt.meta) {
                const meta = document.createElement('span');
                meta.className = 'aif-measure-choice__meta';
                meta.textContent = opt.meta;
                btn.appendChild(meta);
            }

            btn.onclick = () => actions.setPlacementIntent(opt.id);
            intentSection.appendChild(btn);
        });
        stage.appendChild(intentSection);
    }

    const chipHeading = document.createElement('p');
    chipHeading.className = 'aif-measure-chip-heading';
    chipHeading.textContent = copy.chipHeading;
    stage.appendChild(chipHeading);

    const chipSection = document.createElement('div');
    chipSection.className = 'aif-measure-chips';
    chipSection.setAttribute('role', 'group');
    chipSection.setAttribute('aria-label', copy.ariaGroup);

    chips.forEach((cm) => {
        const btn = document.createElement('button');
        const isOn = selectedMatchesChip(selected, cm, imperial);
        btn.type = 'button';
        btn.className = `aif-measure-chip${isOn ? ' is-selected' : ''}`;
        btn.textContent = chipDisplayValue(cm, imperial);
        btn.title = asSurfaceHeight ? `${formatLength(cm, imperial)} high` : `${formatLength(cm, imperial)} wide`;
        btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        btn.onclick = () => actions.setFurnitureWidthCm(cm);
        chipSection.appendChild(btn);
    });

    const unitHint = document.createElement('span');
    unitHint.className = 'aif-measure-unit';
    unitHint.textContent = unit;
    chipSection.appendChild(unitHint);

    stage.appendChild(chipSection);

    const customRow = document.createElement('div');
    customRow.className = 'aif-measure-custom';

    const customLabel = document.createElement('label');
    customLabel.className = 'aif-measure-custom__label';
    customLabel.htmlFor = 'aif-measure-custom-input';
    customLabel.textContent = copy.customLabel;

    const customField = document.createElement('div');
    customField.className = 'aif-measure-custom__field';

    const customInput = document.createElement('input');
    customInput.id = 'aif-measure-custom-input';
    customInput.type = 'number';
    customInput.inputMode = 'decimal';
    customInput.min = imperial ? '6' : '15';
    customInput.max = imperial ? '240' : '600';
    customInput.step = '1';
    customInput.placeholder = copy.examplePlaceholder;
    customInput.className = 'aif-measure-custom__input';
    if (selected != null && !chips.some((cm) => selectedMatchesChip(selected, cm, imperial))) {
        customInput.value = imperial ? String(cmToInches(selected)) : String(selected);
    }

    const customSuffix = document.createElement('span');
    customSuffix.className = 'aif-measure-custom__suffix';
    customSuffix.textContent = unit;

    const commitCustom = () => {
        const parsed = parseCustomLengthToCm(customInput.value, imperial);
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

    if (addSpec?.count?.chips?.length) {
        const countHeading = document.createElement('p');
        countHeading.className = 'aif-measure-chip-heading';
        countHeading.textContent = addSpec.count.heading;
        stage.appendChild(countHeading);

        const countSection = document.createElement('div');
        countSection.className = 'aif-measure-chips';
        countSection.setAttribute('role', 'group');
        countSection.setAttribute('aria-label', addSpec.count.heading);

        addSpec.count.chips.forEach((n) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `aif-measure-chip${selectedCount === n ? ' is-selected' : ''}`;
            btn.textContent = String(n);
            btn.title = `${n} ${addSpec.count.noun}`;
            btn.setAttribute('aria-pressed', selectedCount === n ? 'true' : 'false');
            btn.onclick = () => actions.setPlacementCount(n);
            countSection.appendChild(btn);
        });
        stage.appendChild(countSection);
    }

    if (fit && fit.severity !== 'ok') {
        const banner = document.createElement('div');
        banner.className = `aif-measure-fit aif-measure-fit--${fit.severity}`;
        banner.setAttribute('role', 'status');
        banner.innerHTML = `
              <p class="aif-measure-fit__title">${fit.title}</p>
              <p class="aif-measure-fit__body">${fit.body}</p>
            `;
        stage.appendChild(banner);
    } else if (choseProductWidth) {
        const banner = document.createElement('div');
        banner.className = 'aif-measure-fit aif-measure-fit--notice';
        banner.setAttribute('role', 'status');
        banner.innerHTML = `
              <p class="aif-measure-fit__title">${choseProductWidth.title}</p>
              <p class="aif-measure-fit__body">${choseProductWidth.body}</p>
            `;
        stage.appendChild(banner);
    }

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
        const nextFit =
            !skipFitCheck && widthCm != null && catalogWidthCm != null
                ? assessSizeFit(widthCm, catalogWidthCm, fitOpts)
                : null;
        busy = true;
        continueBtn.disabled = true;
        if (skipBtn) skipBtn.disabled = true;
        continueBtn.textContent = 'Starting…';
        try {
            await startGeneration({
                furnitureWidthCm: widthCm,
                sizeFitMode: nextFit?.mode === 'room_adapt' ? 'room_adapt' : null,
                placementIntent,
                addAnchor: addSpec?.addAnchor || null,
                placementCount: selectedCount,
            });
        } catch (err) {
            console.error('Failed to start generation:', err);
            actions.setError(err.message || 'Could not start preview');
            busy = false;
            continueBtn.disabled = false;
            if (skipBtn) skipBtn.disabled = false;
            continueBtn.textContent = continueLabel;
        }
    };

    const continueLabel =
        fit && fit.severity !== 'ok' && selected != null
            ? fit.cta
            : copy.continueWith(selected);

    const continueBtn = Button({
        text: continueLabel,
        onClick: () => run(selected),
    });

    const skipBtn = isAdd
        ? null
        : Button({
              text: copy.skipLabel,
              variant: 'text',
              onClick: () => run(null),
          });

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'aif-btn-text aif-measure-back';
    backBtn.textContent = '← Change photo';
    backBtn.onclick = () => actions.setUploadedImage(null);

    footer.appendChild(createModelPicker(state.selectedModel, { compact: true }));
    footer.appendChild(continueBtn);
    if (skipBtn) footer.appendChild(skipBtn);
    footer.appendChild(backBtn);
    container.appendChild(footer);

    return container;
};
