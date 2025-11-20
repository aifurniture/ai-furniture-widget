/**
 * Upload View Component
 */
import { actions, VIEWS, store } from '../../state/store.js';
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
                actions.setUploadedImage(e.target.files[0]);
            }
        };

        dropzone.appendChild(fileInput);
        uploadArea.appendChild(dropzone);
    }

    container.appendChild(uploadArea);

    // Footer / Action Button
    const footer = document.createElement('div');
    footer.style.marginTop = 'auto';

    const generateBtn = Button({
        text: state.view === VIEWS.GENERATING ? 'Generating Preview...' : 'Generate Preview',
        loading: state.view === VIEWS.GENERATING,
        disabled: !state.uploadedImage || state.view === VIEWS.GENERATING,
        onClick: async () => {
            if (!state.uploadedImage) return;

            try {
                // Step 1: Upload image to S3
                console.log('📤 Uploading image to S3...');
                const formData = new FormData();
                formData.append('image', state.uploadedImage);

                const currentState = store.getState();
                const apiEndpoint = currentState.config.apiEndpoint;

                const uploadResponse = await fetch(`${apiEndpoint}/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image');
                }

                const { imageUrl } = await uploadResponse.json();
                console.log('✅ Image uploaded:', imageUrl);

                // Step 2: Create job
                console.log('📝 Creating job...');
                const jobResponse = await fetch(`${apiEndpoint}/jobs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productUrl: window.location.href,
                        userImageUrl: imageUrl,
                        sessionId: currentState.sessionId
                    })
                });

                if (!jobResponse.ok) {
                    throw new Error('Failed to create job');
                }

                const { jobId } = await jobResponse.json();
                console.log('✅ Job created:', jobId);

                // Step 3: Add to local queue
                const queueItem = {
                    id: jobId,
                    productUrl: window.location.href,
                    userImageUrl: imageUrl,
                    status: 'PENDING'
                };

                actions.addToQueue(queueItem);

                // Clear uploaded image
                actions.setUploadedImage(null);

                // Switch to queue view
                actions.setView('QUEUE');

            } catch (error) {
                console.error('❌ Upload/Job creation failed:', error);
                actions.setError(error.message || 'Failed to start generation');
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
