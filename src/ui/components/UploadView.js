/**
 * Upload View Component
 */
import { actions, VIEWS, store, fileToDataURL, flushSessionSnapshot } from '../../state/store.js';
import { Button } from './Button.js';
import { trackEvent } from '../../tracking.js';
import { compressRoomImage } from '../../utils/compressRoomImage.js';

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
}

export const UploadView = (state) => {
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

    if (state.error) {
        const errorBox = document.createElement('div');
        errorBox.style.padding = '12px';
        errorBox.style.background = '#fee2e2';
        errorBox.style.color = '#b91c1c';
        errorBox.style.borderRadius = '8px';
        errorBox.style.fontSize = '13px';
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
        note.textContent = 'Natural light and a straight-on angle work best.';
        dropzoneContainer.appendChild(note);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.id = 'aif-file-input-' + Date.now();
        fileInput.style.display = 'none';
        fileInput.onchange = async (e) => {
            if (e.target.files[0]) {
                try {
                    await handleRoomPhotoSelected(e.target.files[0], 'gallery');
                } catch (err) {
                    console.error('Failed to process image:', err);
                    actions.setError(err.message || 'Could not process image');
                }
            }
        };

        const cameraInput = document.createElement('input');
        cameraInput.type = 'file';
        cameraInput.accept = 'image/*';
        cameraInput.setAttribute('capture', 'environment');
        cameraInput.id = 'aif-camera-input-' + Date.now();
        cameraInput.style.display = 'none';
        cameraInput.onchange = async (e) => {
            if (e.target.files[0]) {
                try {
                    await handleRoomPhotoSelected(e.target.files[0], 'camera');
                } catch (err) {
                    console.error('Failed to process image:', err);
                    actions.setError(err.message || 'Could not process image');
                }
            }
        };

        const isMobile =
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'aif-upload-actions';

        if (isMobile) {
            const cameraLabel = document.createElement('label');
            cameraLabel.htmlFor = cameraInput.id;
            cameraLabel.className = 'aif-upload-cta aif-upload-cta--primary';
            cameraLabel.innerHTML = '<span aria-hidden="true">📷</span><span>Take a photo</span>';
            buttonContainer.appendChild(cameraLabel);
        }

        const uploadLabel = document.createElement('label');
        uploadLabel.htmlFor = fileInput.id;
        uploadLabel.className = isMobile
            ? 'aif-upload-cta aif-upload-cta--secondary'
            : 'aif-upload-cta aif-upload-cta--primary';
        uploadLabel.innerHTML = isMobile
            ? '<span aria-hidden="true">🖼️</span><span>Choose from gallery</span>'
            : '<span aria-hidden="true">🖼️</span><span>Choose a photo</span>';
        buttonContainer.appendChild(uploadLabel);

        dropzoneContainer.appendChild(fileInput);
        dropzoneContainer.appendChild(cameraInput);
        dropzoneContainer.appendChild(buttonContainer);
        uploadArea.appendChild(dropzoneContainer);
    }

    container.appendChild(uploadArea);

    const footer = document.createElement('div');
    footer.style.marginTop = 'auto';

    const generateBtn = Button({
        text: 'Create preview',
        disabled: !state.uploadedImage,
        onClick: async () => {
            if (!state.uploadedImage) return;

            const image = state.uploadedImage;
            const currentState = store.getState();
            const productUrl = currentState.config?.productUrl || window.location.href;
            const productName =
                currentState.config?.productTitle || document.title || productUrl;
            const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            generateBtn.disabled = true;
            const originalLabel = generateBtn.textContent;
            generateBtn.textContent = 'Preparing…';

            try {
                const userImageDataUrl = await fileToDataURL(image);
                actions.beginPreviewGeneration({
                    id: queueId,
                    productUrl,
                    productName,
                    userImage: image,
                    userImageDataUrl,
                    selectedModel: 'slow',
                    config: currentState.config || {},
                    queuedAt: Date.now()
                });
                flushSessionSnapshot();

                trackEvent('ai_generation_started', {
                    queueId,
                    productUrl,
                    productName,
                    model: 'slow',
                    imageSize: image?.size || 0
                });
            } catch (err) {
                console.error('Failed to prepare room photo:', err);
                actions.setError(err.message || 'Could not prepare image');
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = originalLabel;
            }
        }
    });

    footer.appendChild(generateBtn);

    const note = document.createElement('p');
    note.className = 'aif-upload-privacy';
    note.textContent = 'Your photo is only used to generate this preview.';
    footer.appendChild(note);

    container.appendChild(footer);

    return container;
};
