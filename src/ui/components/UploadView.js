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
        const dropzone = document.createElement('label');
        dropzone.className = 'aif-dropzone';
        dropzone.innerHTML = `
      <div style="width:40px; height:40px; border-radius:50%; background:#dcfce7; display:flex; align-items:center; justify-content:center; color:#166534; font-size:20px;">
        ⬆
      </div>
      <div>
        <span style="font-weight:600; color:#166534;">Upload a room photo</span>
        <span style="color:#64748b; margin:0 4px;">or drag & drop</span>
      </div>
      <p style="font-size:11px; color:#94a3b8; margin:0;">JPG or PNG, up to 10 MB</p>
    `;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => {
            if (e.target.files[0]) {
                const file = e.target.files[0];
                actions.setUploadedImage(file);
                
                // Track image upload
                trackEvent('image_uploaded', {
                    productUrl: window.location.href,
                    productName: document.title,
                    imageSize: file.size,
                    imageType: file.type,
                    fileName: file.name
                });
            }
        };

        dropzone.appendChild(fileInput);
        uploadArea.appendChild(dropzone);
    }

    container.appendChild(uploadArea);

    // Model Selection
    const modelSection = document.createElement('div');
    modelSection.style.display = 'flex';
    modelSection.style.flexDirection = 'column';
    modelSection.style.gap = '8px';
    modelSection.style.marginTop = '12px';

    const modelLabel = document.createElement('label');
    modelLabel.textContent = 'Generation Speed';
    modelLabel.style.fontSize = '13px';
    modelLabel.style.fontWeight = '600';
    modelLabel.style.color = '#1e293b';
    modelSection.appendChild(modelLabel);

    const modelOptions = document.createElement('div');
    modelOptions.style.display = 'flex';
    modelOptions.style.gap = '12px';

    // Fast model option
    const fastOption = document.createElement('label');
    fastOption.style.flex = '1';
    fastOption.style.padding = '12px';
    fastOption.style.border = state.selectedModel === 'fast' ? '2px solid #22c55e' : '1px solid #e2e8f0';
    fastOption.style.borderRadius = '8px';
    fastOption.style.cursor = 'pointer';
    fastOption.style.background = state.selectedModel === 'fast' ? '#f0fdf4' : '#fff';
    fastOption.style.transition = 'all 0.2s';
    fastOption.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <input type="radio" name="model" value="fast" ${state.selectedModel === 'fast' ? 'checked' : ''} 
                   style="accent-color:#22c55e;">
            <div>
                <div style="font-weight:600; font-size:13px; color:#1e293b;">⚡ Fast</div>
                <div style="font-size:11px; color:#64748b;">~30 seconds</div>
            </div>
        </div>
    `;
    fastOption.onclick = () => actions.setSelectedModel('fast');

    // Slow model option
    const slowOption = document.createElement('label');
    slowOption.style.flex = '1';
    slowOption.style.padding = '12px';
    slowOption.style.border = state.selectedModel === 'slow' ? '2px solid #22c55e' : '1px solid #e2e8f0';
    slowOption.style.borderRadius = '8px';
    slowOption.style.cursor = 'pointer';
    slowOption.style.background = state.selectedModel === 'slow' ? '#f0fdf4' : '#fff';
    slowOption.style.transition = 'all 0.2s';
    slowOption.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <input type="radio" name="model" value="slow" ${state.selectedModel === 'slow' ? 'checked' : ''} 
                   style="accent-color:#22c55e;">
            <div>
                <div style="font-weight:600; font-size:13px; color:#1e293b;">✨ Slow but Better</div>
                <div style="font-size:11px; color:#64748b;">~60-90 seconds</div>
            </div>
        </div>
    `;
    slowOption.onclick = () => actions.setSelectedModel('slow');

    modelOptions.appendChild(fastOption);
    modelOptions.appendChild(slowOption);
    modelSection.appendChild(modelOptions);

    container.appendChild(modelSection);

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

                // Create queue item
                const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const productName = document.title || window.location.href;

                const queueItem = {
                    id: queueId,
                    productUrl: window.location.href,
                    productName: productName,
                    userImage: state.uploadedImage, // Store the File/Blob object
                    selectedModel: currentState.selectedModel || 'fast',
                    config: currentState.config || {},
                    queuedAt: Date.now()
                };

                // Track AI generation started
                trackEvent('ai_generation_started', {
                    queueId,
                    productUrl: window.location.href,
                    productName: productName,
                    model: currentState.selectedModel || 'fast',
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
