/**
 * Upload View Component
 */
import { actions, store } from '../../state/store.js';
import { Button } from './Button.js';
import { createModelPicker } from './ModelPicker.js';
import { trackEvent } from '../../tracking.js';
import { compressRoomImage } from '../../utils/compressRoomImage.js';

function isMobileViewport() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

async function handleRoomPhotoSelected(file, source) {
    const compressed = await compressRoomImage(file);
    actions.setUploadedImage(compressed);

    const currentState = store.getState();
    const productUrl = currentState.config?.productUrl || window.location.href;
    const productName = currentState.config?.productTitle || document.title;

    trackEvent('image_uploaded', {
        productUrl,
        productName,
        imageSize: compressed.size,
        imageType: compressed.type,
        fileName: file.name,
        source,
        originalSize: file.size
    });

    trackEvent('measure_step_opened', { productUrl, source });
    actions.goToMeasure();
}

function createPhotoCta({ capture, source, className, label, ariaLabel }) {
    const wrap = document.createElement('label');
    wrap.className = className;
    wrap.setAttribute('aria-label', ariaLabel || label);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.className = 'aif-upload-file';
    input.setAttribute('tabindex', '-1');
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            await handleRoomPhotoSelected(file, source);
        } catch (err) {
            console.error('Failed to process image:', err);
            actions.setError(err.message || 'Could not process image');
        }
    };

    const text = document.createElement('span');
    text.textContent = label;

    wrap.appendChild(input);
    wrap.appendChild(text);
    return wrap;
}

export const UploadView = (state) => {
    const mobile = isMobileViewport();
    const container = document.createElement('div');
    container.className = 'aif-upload-view';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.height = '100%';
    container.style.minHeight = '0';
    container.style.overflow = 'hidden';

    const header = document.createElement('div');
    header.className = 'aif-header';
    header.innerHTML = `
    <span class="aif-eyebrow">Room preview</span>
    <h2>See it in your space</h2>
    <p>Snap your room once — we'll place this piece where it belongs.</p>
  `;
    container.appendChild(header);

    container.appendChild(createModelPicker(state.selectedModel, { compact: mobile }));

    if (state.error) {
        const errorBox = document.createElement('div');
        errorBox.style.padding = '12px';
        errorBox.style.background = '#fee2e2';
        errorBox.style.color = '#b91c1c';
        errorBox.style.borderRadius = '8px';
        errorBox.style.fontSize = '13px';
        errorBox.style.flexShrink = '0';
        errorBox.textContent = state.error;
        container.appendChild(errorBox);
    }

    const uploadArea = document.createElement('div');
    uploadArea.style.flex = '1';
    uploadArea.style.minHeight = '0';
    uploadArea.style.overflow = 'hidden';
    uploadArea.style.display = 'flex';
    uploadArea.style.flexDirection = 'column';

    if (state.uploadedImage) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'aif-upload-stage';
        previewContainer.style.position = 'relative';
        previewContainer.style.borderRadius = '12px';
        previewContainer.style.overflow = 'hidden';
        previewContainer.style.background = '#f1f5f9';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(state.uploadedImage);
        img.style.objectFit = 'contain';

        const changeBtn = document.createElement('button');
        changeBtn.textContent = 'Change photo';
        changeBtn.style.position = 'absolute';
        changeBtn.style.bottom = '12px';
        changeBtn.style.right = '12px';
        changeBtn.style.padding = '6px 12px';
        changeBtn.style.background = 'rgba(255,255,255,0.9)';
        changeBtn.style.border = '1px solid rgba(0,0,0,0.1)';
        changeBtn.style.borderRadius = '6px';
        changeBtn.style.fontSize = '12px';
        changeBtn.style.cursor = 'pointer';
        changeBtn.onclick = () => actions.setUploadedImage(null);

        previewContainer.appendChild(img);
        previewContainer.appendChild(changeBtn);
        uploadArea.appendChild(previewContainer);
    } else {
        const dropzoneContainer = document.createElement('div');
        dropzoneContainer.className = 'aif-dropzone';

        const icon = document.createElement('div');
        icon.className = 'aif-dropzone-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v12H4V7z"/><circle cx="12" cy="13" r="3.25"/></svg>`;
        dropzoneContainer.appendChild(icon);

        const title = document.createElement('p');
        title.className = 'aif-dropzone-title';
        title.textContent = 'Add a room photo';
        dropzoneContainer.appendChild(title);

        const note = document.createElement('p');
        note.className = 'aif-dropzone-note';
        note.textContent = mobile
            ? 'Tip: a fresh camera photo usually beats an old gallery shot (lighting + sharpness).'
            : 'Natural light and a straight-on angle work best.';
        dropzoneContainer.appendChild(note);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'aif-upload-actions';

        if (mobile) {
            buttonContainer.appendChild(
                createPhotoCta({
                    capture: true,
                    source: 'camera',
                    className: 'aif-upload-cta aif-upload-cta--primary',
                    label: 'Take a photo',
                })
            );
        }

        buttonContainer.appendChild(
            createPhotoCta({
                capture: false,
                source: 'gallery',
                className: mobile
                    ? 'aif-upload-cta aif-upload-cta--secondary'
                    : 'aif-upload-cta aif-upload-cta--primary',
                label: mobile ? 'Choose from gallery' : 'Choose a photo',
            })
        );

        dropzoneContainer.appendChild(buttonContainer);
        uploadArea.appendChild(dropzoneContainer);
    }

    container.appendChild(uploadArea);

    const footer = document.createElement('div');
    footer.className = 'aif-upload-footer';
    footer.style.marginTop = 'auto';

    if (state.uploadedImage) {
        const continueBtn = Button({
            text: 'Continue',
            onClick: () => {
                trackEvent('measure_step_opened', {
                    productUrl: store.getState().config?.productUrl || window.location.href,
                });
                actions.goToMeasure();
            },
        });
        footer.appendChild(continueBtn);
    }

    const privacy = document.createElement('p');
    privacy.className = 'aif-upload-privacy';
    privacy.textContent = state.uploadedImage
        ? 'Next: a quick size check so placement matches your room.'
        : 'Your photo is only used to generate this preview.';
    footer.appendChild(privacy);

    container.appendChild(footer);

    return container;
};
