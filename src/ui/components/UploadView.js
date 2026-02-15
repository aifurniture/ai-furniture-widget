/**
 * Upload View Component
 */
import { actions, VIEWS, store, QUEUE_STATUS } from '../../state/store.js';
import { Button } from './Button.js';
import { trackEvent } from '../../tracking.js';


export const UploadView = (state) => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    container.style.height = '100%';

    // Header
    const header = document.createElement('div');
    header.className = 'aif-header';
    header.innerHTML = `
    <div class="aif-badge">
      <span style="width:6px; height:6px; border-radius:50%; background:#22c55e;"></span>
      Room Visualiser
    </div>
    <h2>See this in your own room</h2>
    <p>Upload a photo of your room. We'll swap your current furniture for this one, matching the angle and lighting.</p>
  `;
    container.appendChild(header);

    // Queue status banner (if items exist)
    const queueCount = state.queue.length;
    if (queueCount > 0) {
        const queueBanner = document.createElement('div');
        queueBanner.style.padding = '12px';
        queueBanner.style.background = '#eff6ff';
        queueBanner.style.border = '1px solid #3b82f6';
        queueBanner.style.borderRadius = '8px';
        queueBanner.style.display = 'flex';
        queueBanner.style.alignItems = 'center';
        queueBanner.style.justifyContent = 'space-between';
        queueBanner.style.cursor = 'pointer';
        queueBanner.onclick = () => actions.setView('QUEUE');

        const completedCount = state.queue.filter(i => i.status === 'COMPLETED').length;
        const processingCount = state.queue.filter(i => i.status === 'PROCESSING').length;

        let statusText = `${queueCount} item${queueCount > 1 ? 's' : ''} in queue`;
        if (completedCount > 0) statusText += ` • ${completedCount} ready`;
        if (processingCount > 0) statusText += ` • ${processingCount} processing`;

        queueBanner.innerHTML = `
            <span style="color:#1e40af; font-size:13px; font-weight:500;">📋 ${statusText}</span>
            <span style="color:#3b82f6; font-size:12px;">View →</span>
        `;
        container.appendChild(queueBanner);
    }

    // Error message
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

    // Main Upload Area
    const uploadArea = document.createElement('div');
    uploadArea.style.flex = '1';
    uploadArea.style.display = 'flex';
    uploadArea.style.flexDirection = 'column';

    if (state.uploadedImage) {
        // Preview Mode
        const previewContainer = document.createElement('div');
        previewContainer.style.position = 'relative';
        previewContainer.style.borderRadius = '12px';
        previewContainer.style.overflow = 'hidden';
        previewContainer.style.background = '#f1f5f9';
        previewContainer.style.maxHeight = '300px';
        previewContainer.style.display = 'flex';
        previewContainer.style.justifyContent = 'center';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(state.uploadedImage);
        img.style.maxWidth = '100%';
        img.style.maxHeight = '300px';
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
        // Dropzone Mode
        const dropzone = document.createElement('div');
        dropzone.className = 'aif-dropzone';
        dropzone.innerHTML = `
      <div style="width:40px; height:40px; border-radius:50%; background:#dcfce7; display:flex; align-items:center; justify-content:center; color:#166534; font-size:20px;">
        📸
      </div>
      <div>
        <span style="font-weight:600; color:#166534;">Upload or Take a Photo</span>
        <span style="color:#64748b; margin:0 4px;">of your room</span>
      </div>
      <p style="font-size:11px; color:#94a3b8; margin:0;">JPG or PNG, up to 10 MB</p>
    `;

        // Create hidden file input for gallery
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => {
            if (e.target.files[0]) {
                const file = e.target.files[0];
                actions.setUploadedImage(file);
                
                const currentState = store.getState();
                const productUrl = currentState.config?.productUrl || window.location.href;
                const productName = currentState.config?.productTitle || document.title;
                
                // Track image upload
                trackEvent('image_uploaded', {
                    productUrl: productUrl,
                    productName: productName,
                    imageSize: file.size,
                    imageType: file.type,
                    fileName: file.name,
                    source: 'gallery'
                });
            }
        };

        // Create hidden file input for camera
        const cameraInput = document.createElement('input');
        cameraInput.type = 'file';
        cameraInput.accept = 'image/*';
        cameraInput.capture = 'environment'; // Use rear camera by default
        cameraInput.style.display = 'none';
        cameraInput.onchange = (e) => {
            if (e.target.files[0]) {
                const file = e.target.files[0];
                actions.setUploadedImage(file);
                
                const currentState = store.getState();
                const productUrl = currentState.config?.productUrl || window.location.href;
                const productName = currentState.config?.productTitle || document.title;
                
                // Track camera capture
                trackEvent('image_uploaded', {
                    productUrl: productUrl,
                    productName: productName,
                    imageSize: file.size,
                    imageType: file.type,
                    fileName: file.name,
                    source: 'camera'
                });
            }
        };

        // Detect if device has camera (mobile)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                         window.innerWidth <= 768;

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '12px';
        buttonContainer.style.width = '100%';
        buttonContainer.style.marginTop = '16px';

        // Upload from gallery button
        const uploadBtn = document.createElement('button');
        uploadBtn.innerHTML = `
            <span style="font-size:18px; margin-right:6px;">📁</span>
            <span>Choose Photo</span>
        `;
        uploadBtn.style.flex = '1';
        uploadBtn.style.padding = '14px 20px';
        uploadBtn.style.background = 'white';
        uploadBtn.style.border = '2px solid #10b981';
        uploadBtn.style.borderRadius = '12px';
        uploadBtn.style.color = '#10b981';
        uploadBtn.style.fontWeight = '600';
        uploadBtn.style.fontSize = '14px';
        uploadBtn.style.cursor = 'pointer';
        uploadBtn.style.display = 'flex';
        uploadBtn.style.alignItems = 'center';
        uploadBtn.style.justifyContent = 'center';
        uploadBtn.style.transition = 'all 0.2s';
        uploadBtn.onmouseover = () => {
            uploadBtn.style.background = '#f0fdf4';
            uploadBtn.style.transform = 'translateY(-2px)';
        };
        uploadBtn.onmouseout = () => {
            uploadBtn.style.background = 'white';
            uploadBtn.style.transform = 'translateY(0)';
        };
        uploadBtn.onclick = () => fileInput.click();

        // Camera button (only show on mobile)
        if (isMobile) {
            const cameraBtn = document.createElement('button');
            cameraBtn.innerHTML = `
                <span style="font-size:18px; margin-right:6px;">📷</span>
                <span>Take Photo</span>
            `;
            cameraBtn.style.flex = '1';
            cameraBtn.style.padding = '14px 20px';
            cameraBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            cameraBtn.style.border = 'none';
            cameraBtn.style.borderRadius = '12px';
            cameraBtn.style.color = 'white';
            cameraBtn.style.fontWeight = '600';
            cameraBtn.style.fontSize = '14px';
            cameraBtn.style.cursor = 'pointer';
            cameraBtn.style.display = 'flex';
            cameraBtn.style.alignItems = 'center';
            cameraBtn.style.justifyContent = 'center';
            cameraBtn.style.transition = 'all 0.2s';
            cameraBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            cameraBtn.onmousedown = () => {
                cameraBtn.style.transform = 'scale(0.95)';
            };
            cameraBtn.onmouseup = () => {
                cameraBtn.style.transform = 'scale(1)';
            };
            cameraBtn.onclick = () => cameraInput.click();
            
            buttonContainer.appendChild(cameraBtn);
        }

        buttonContainer.appendChild(uploadBtn);

        dropzone.appendChild(fileInput);
        dropzone.appendChild(cameraInput);
        dropzone.appendChild(buttonContainer);
        uploadArea.appendChild(dropzone);
    }

    container.appendChild(uploadArea);

    // Model Selection
    // Footer / Action Button
    const footer = document.createElement('div');
    footer.style.marginTop = 'auto';

    const generateBtn = Button({
        text: 'Generate Preview',
        disabled: !state.uploadedImage,
        onClick: async () => {
            if (!state.uploadedImage) return;

            // Manually update button to show loading state
            generateBtn.disabled = true;
            generateBtn.innerHTML = '';
            const spinner = document.createElement('div');
            spinner.className = 'aif-spinner';
            const loadingText = document.createElement('span');
            loadingText.textContent = ' Generating...';
            generateBtn.appendChild(spinner);
            generateBtn.appendChild(loadingText);
            generateBtn.style.display = 'flex';
            generateBtn.style.alignItems = 'center';
            generateBtn.style.justifyContent = 'center';
            generateBtn.style.gap = '8px';

            try {
                const currentState = store.getState();
                
                // Get product URL from config (Shopify) or fallback to current URL
                const productUrl = currentState.config?.productUrl || window.location.href;
                const productName = currentState.config?.productTitle || document.title || productUrl;

                // Create queue item
                const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                const queueItem = {
                    id: queueId,
                    productUrl: productUrl,
                    productName: productName,
                    userImage: state.uploadedImage, // Store the File/Blob object
                    selectedModel: 'slow', // Always use high quality model
                    config: currentState.config || {},
                    queuedAt: Date.now()
                };

                // Track AI generation started
                trackEvent('ai_generation_started', {
                    queueId,
                    productUrl: productUrl,
                    productName: productName,
                    model: 'slow', // Always use high quality model
                    imageSize: state.uploadedImage?.size || 0
                });

                // Add to queue - this will trigger the queue processor
                actions.addToQueue(queueItem);
                console.log(`✅ Added to queue: ${queueId}`);

                // Switch to queue view to show progress
                actions.setView(VIEWS.QUEUE);
                actions.setUploadedImage(null);

                // Reset button
                generateBtn.disabled = false;
                generateBtn.innerHTML = '';
                generateBtn.textContent = 'Generate Preview';
                generateBtn.style.display = '';

            } catch (error) {
                console.error('❌ Failed to add to queue:', error);
                actions.setError(error.message || 'Failed to add to queue');

                generateBtn.disabled = false;
                generateBtn.innerHTML = '';
                generateBtn.textContent = 'Generate Preview';
                generateBtn.style.display = '';
            }
        }
    });

    footer.appendChild(generateBtn);

    const note = document.createElement('p');
    note.textContent = 'We only use this photo to generate your preview.';
    note.style.fontSize = '10px';
    note.style.color = '#94a3b8';
    note.style.textAlign = 'center';
    note.style.marginTop = '8px';
    footer.appendChild(note);

    container.appendChild(footer);

    return container;
};
