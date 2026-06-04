/**
 * Upload View Component
 */
import { actions, VIEWS, store } from '../../state/store.js';
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
    <h2>See it in your room</h2>
    <p>Take a photo of your room. We'll show you this product in it.</p>
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
        icon.style.width = '48px';
        icon.style.height = '48px';
        icon.style.borderRadius = '50%';
        icon.style.background = '#dcfce7';
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.color = '#166534';
        icon.style.fontSize = '24px';
        icon.textContent = '📸';
        dropzoneContainer.appendChild(icon);

        const title = document.createElement('p');
        title.style.margin = '12px 0 4px';
        title.style.fontWeight = '600';
        title.style.fontSize = '15px';
        title.style.color = '#0f172a';
        title.textContent = 'Add a room photo';
        dropzoneContainer.appendChild(title);

        const note = document.createElement('p');
        note.style.fontSize = '12px';
        note.style.color = '#64748b';
        note.style.margin = '0';
        note.textContent = 'Use your camera or pick one from your gallery.';
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
        buttonContainer.style.cssText =
            'display:flex; flex-direction:column; gap:10px; width:100%; margin-top:20px; position:relative; z-index:2;';
        const btnBase =
            'width:100%; padding:16px 20px; border:none; border-radius:12px; font-weight:600; font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; -webkit-tap-highlight-color:transparent; touch-action:manipulation; min-height:52px; box-sizing:border-box;';

        if (isMobile) {
            const cameraLabel = document.createElement('label');
            cameraLabel.htmlFor = cameraInput.id;
            cameraLabel.style.cssText =
                btnBase +
                ' background:linear-gradient(135deg, #10b981, #059669); color:white; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3);';
            cameraLabel.innerHTML = '<span>📷</span><span>Take a photo</span>';
            buttonContainer.appendChild(cameraLabel);
        }

        const uploadLabel = document.createElement('label');
        uploadLabel.htmlFor = fileInput.id;
        uploadLabel.style.cssText =
            btnBase +
            (isMobile
                ? ' background:white; border:2px solid #10b981; color:#059669;'
                : ' background:linear-gradient(135deg, #10b981, #059669); color:white; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3);');
        uploadLabel.innerHTML = isMobile
            ? '<span>🖼️</span><span>Choose from gallery</span>'
            : '<span>🖼️</span><span>Choose a photo</span>';
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
        onClick: () => {
            if (!state.uploadedImage) return;

            const image = state.uploadedImage;
            const currentState = store.getState();
            const productUrl = currentState.config?.productUrl || window.location.href;
            const productName =
                currentState.config?.productTitle || document.title || productUrl;
            const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            actions.addToQueue({
                id: queueId,
                productUrl,
                productName,
                userImage: image,
                selectedModel: 'slow',
                config: currentState.config || {},
                queuedAt: Date.now()
            });
            actions.setUploadedImage(null);
            actions.setView(VIEWS.QUEUE);

            trackEvent('ai_generation_started', {
                queueId,
                productUrl,
                productName,
                model: 'slow',
                imageSize: image?.size || 0
            });
        }
    });

    footer.appendChild(generateBtn);

    const note = document.createElement('p');
    note.textContent = 'We only use your photo to create the preview.';
    note.style.fontSize = '11px';
    note.style.color = '#94a3b8';
    note.style.textAlign = 'center';
    note.style.marginTop = '8px';
    footer.appendChild(note);

    container.appendChild(footer);

    return container;
};
