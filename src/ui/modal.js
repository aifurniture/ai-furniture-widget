// src/ui/modal.js
import { debugLog } from '../debug.js';
import { trackEvent, trackOrderCompletion } from '../tracking.js';
import { addToQueue, getQueue, removeFromQueue, setMinimized, getMinimized, getSessionId, updateQueueItem, getProcessingItem } from '../state.js';

export function openFurnitureModal(url, sessionId, config) {
    debugLog('Opening furniture modal (upload flow)', { sessionId, config });

    // If a modal already exists, remove it first
    if (document.querySelector('#ai-furniture-modal')) {
        debugLog('Modal already exists, removing it first');
        closeFurnitureModal();
    }

    const isMobile = window.innerWidth <= 768;

    // Overlay: full-screen, panel will dock on the right
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'ai-furniture-modal';
    modalOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.45);
      z-index: 999999;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Container: FULL-SCREEN on mobile, RIGHT-SIDE PANEL on desktop
    const modalContainer = document.createElement('div');

    if (isMobile) {
        modalContainer.style.cssText = `
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          max-width: none;
          max-height: none;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border-radius: 0;
          box-shadow: none;
          overflow: hidden;
          transform: translateY(16px);
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          backdrop-filter: blur(20px);
          border: none;
        `;
    } else {
        modalContainer.style.cssText = `
          position: fixed;
          top: 0;
          right: 0;
          height: 100%;
          width: clamp(360px, 34vw, 520px);
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border-radius: 16px 0 0 16px;
          box-shadow:
            0 20px 60px rgba(15, 23, 42, 0.35),
            0 0 0 1px rgba(148, 163, 184, 0.25);
          overflow: hidden;
          transform: translateX(32px);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          backdrop-filter: blur(18px);
          border-left: 1px solid rgba(148, 163, 184, 0.35);
        `;
    }

    // Close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';

    if (isMobile) {
        closeButton.style.cssText = `
          position: absolute;
          top: 24px;
          right: 24px;
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95));
          color: #64748b;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 50%;
          font-size: 24px;
          font-weight: 300;
          cursor: pointer;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        `;
    } else {
        closeButton.style.cssText = `
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.9));
          color: #64748b;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 999px;
          font-size: 20px;
          font-weight: 300;
          cursor: pointer;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
        `;
    }

    closeButton.addEventListener('mouseenter', function () {
        this.style.background =
            'linear-gradient(135deg, rgba(22, 101, 52, 0.98), rgba(21, 128, 61, 0.98))';
        this.style.color = '#ffffff';
        this.style.transform = 'scale(1.08)';
        this.style.boxShadow = '0 8px 20px rgba(22, 101, 52, 0.35)';
    });

    closeButton.addEventListener('mouseleave', function () {
        if (isMobile) {
            this.style.background =
                'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95))';
            this.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.15)';
        } else {
            this.style.background =
                'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.9))';
            this.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.15)';
        }
        this.style.color = '#64748b';
        this.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
        closeFurnitureModal();
    });

    // Minimize button
    const minimizeButton = document.createElement('button');
    minimizeButton.innerHTML = '−';
    minimizeButton.setAttribute('aria-label', 'Minimize');
    
    if (isMobile) {
        minimizeButton.style.cssText = `
          position: absolute;
          top: 24px;
          right: 76px;
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95));
          color: #64748b;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 50%;
          font-size: 24px;
          font-weight: 300;
          cursor: pointer;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        `;
    } else {
        minimizeButton.style.cssText = `
          position: absolute;
          top: 16px;
          right: 56px;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.9));
          color: #64748b;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 999px;
          font-size: 20px;
          font-weight: 300;
          cursor: pointer;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
        `;
    }

    minimizeButton.addEventListener('mouseenter', function () {
        this.style.background = 'linear-gradient(135deg, rgba(22, 101, 52, 0.98), rgba(21, 128, 61, 0.98))';
        this.style.color = '#ffffff';
        this.style.transform = 'scale(1.08)';
    });

    minimizeButton.addEventListener('mouseleave', function () {
        if (isMobile) {
            this.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95))';
        } else {
            this.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.9))';
        }
        this.style.color = '#64748b';
        this.style.transform = 'scale(1)';
    });

    minimizeButton.addEventListener('click', () => {
        minimizeModal(modalOverlay, modalContainer, sessionId, config);
    });

    // === MAIN CONTENT (upload flow) ===
    const content = document.createElement('div');
    content.style.cssText = `
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 24px 20px 20px;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
    `;

    // Header / title
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-right: 36px;
    `;
    header.innerHTML = `
      <div style="
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:3px 9px;
        border-radius:999px;
        background:rgba(22, 101, 52, 0.08);
        color:#166534;
        font-size:10px;
        font-weight:600;
        text-transform:uppercase;
        letter-spacing:0.04em;
        width:max-content;
      ">
        <span style="
          width:6px;
          height:6px;
          border-radius:999px;
          background:#22c55e;
        "></span>
        Room visualiser
      </div>
      <h2 style="font-size:18px; font-weight:600; letter-spacing:-0.01em; margin:4px 0 2px;">
        See this in your own room
      </h2>
      <p style="font-size:12px; color:#64748b; max-width:320px;">
        Upload a quick photo of your room. We’ll swap your current sofa for this one, matching the angle, lighting and flooring.
      </p>
    `;

    // Upload section
    const uploadSection = document.createElement('div');
    uploadSection.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 4px;
    `;

    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'ai-furniture-upload-input';

    let selectedFile = null;

    // Dropzone / click area
    const dropZone = document.createElement('label');
    dropZone.setAttribute('for', 'ai-furniture-upload-input');
    dropZone.style.cssText = `
      border: 1px dashed rgba(148, 163, 184, 0.9);
      border-radius: 12px;
      padding: 16px 14px;
      background: rgba(248, 250, 252, 0.96);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    `;
    dropZone.innerHTML = `
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, #bbf7d0, #166534);
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow: 0 8px 18px rgba(22, 101, 52, 0.35);
      ">
        <span style="font-size:16px; color:#ecfdf3;">⬆</span>
      </div>
      <div>
        <span style="font-weight:600; color:#166534;">Upload a room photo</span>
        <span style="margin:0 4px;">or</span>
        <span style="text-decoration:underline; text-underline-offset:2px;">drag & drop</span>
      </div>
      <p style="font-size:11px; color:#94a3b8; max-width:260px; margin-top:2px;">
        Use a photo taken straight-on from where you’d normally view the sofa. JPG or PNG, up to 10&nbsp;MB.
      </p>
    `;

    // Preview area
    const previewWrapper = document.createElement('div');
    previewWrapper.style.cssText = `
      margin-top: 4px;
      border-radius: 10px;
      background: #0f172a0a;
      border: 1px solid rgba(226, 232, 240, 0.9);
      padding: 8px;
      display: none;
      flex-direction: column;
      gap: 6px;
    `;

    const previewLabel = document.createElement('div');
    previewLabel.textContent = 'Selected photo';
    previewLabel.style.cssText = `
      font-size: 11px;
      font-weight: 500;
      color: #475569;
      display:flex;
      align-items:center;
      justify-content:space-between;
    `;

    const changeHint = document.createElement('span');
    changeHint.textContent = 'Tap to change photo';
    changeHint.style.cssText = `
      font-size: 10px;
      color: #64748b;
    `;
    previewLabel.appendChild(changeHint);

    const previewImageContainer = document.createElement('div');
    previewImageContainer.style.cssText = `
      width: 100%;
      max-height: 220px;
      overflow: hidden;
      border-radius: 8px;
      background: #e5e7eb;
      display:flex;
      align-items:center;
      justify-content:center;
    `;

    const previewImage = document.createElement('img');
    previewImage.alt = 'Room preview';
    previewImage.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      display:block;
    `;
    previewImageContainer.appendChild(previewImage);

    previewWrapper.appendChild(previewLabel);
    previewWrapper.appendChild(previewImageContainer);

    uploadSection.appendChild(fileInput);
    uploadSection.appendChild(dropZone);
    uploadSection.appendChild(previewWrapper);

    // Tips
    const tips = document.createElement('div');
    tips.style.cssText = `
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    `;
    tips.innerHTML = `
      <span style="font-weight:500; color:#166534;">Pro tip:</span>
      Use natural daylight and stand back so we can see the floor, walls and existing sofa.
    `;
    uploadSection.appendChild(tips);

    // Queue section (create early so it's accessible)
    const queueSection = createQueueSection(sessionId, config);

    // Footer actions
    const footer = document.createElement('div');
    footer.style.cssText = `
      margin-top: auto;
      padding-top: 10px;
      border-top: 1px solid rgba(226, 232, 240, 1);
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    // Add to Queue button
    const addToQueueButton = document.createElement('button');
    addToQueueButton.textContent = 'Add to Queue';
    addToQueueButton.style.cssText = `
      width: 100%;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      background: rgba(248, 250, 252, 0.8);
      color: #475569;
      transition: all 0.2s ease;
    `;
    
    addToQueueButton.addEventListener('mouseenter', () => {
        addToQueueButton.style.background = 'rgba(22, 101, 52, 0.1)';
        addToQueueButton.style.borderColor = 'rgba(22, 101, 52, 0.3)';
        addToQueueButton.style.color = '#166534';
    });
    
    addToQueueButton.addEventListener('mouseleave', () => {
        addToQueueButton.style.background = 'rgba(248, 250, 252, 0.8)';
        addToQueueButton.style.borderColor = 'rgba(148, 163, 184, 0.3)';
        addToQueueButton.style.color = '#475569';
    });
    
    addToQueueButton.addEventListener('click', () => {
        const productInfo = {
            url: window.location.href,
            title: document.title,
            image: null
        };
        
        if (addToQueue(productInfo)) {
            addToQueueButton.textContent = 'Added to Queue ✓';
            addToQueueButton.style.background = 'rgba(22, 101, 52, 0.1)';
            addToQueueButton.style.color = '#166534';
            
            // Update queue display
            if (queueSection._render) {
                queueSection._render();
            }
            updateWidgetButton();
            
            setTimeout(() => {
                addToQueueButton.textContent = 'Add to Queue';
                addToQueueButton.style.background = 'rgba(248, 250, 252, 0.8)';
                addToQueueButton.style.color = '#475569';
            }, 2000);
            
            trackEvent('ai_furniture_added_to_queue', {
                sessionId,
                productUrl: productInfo.url
            });
        } else {
            addToQueueButton.textContent = 'Already in Queue';
            setTimeout(() => {
                addToQueueButton.textContent = 'Add to Queue';
            }, 1500);
        }
    });

    const primaryButton = document.createElement('button');
    primaryButton.textContent = 'Generate Preview';
    primaryButton.disabled = true;
    primaryButton.style.cssText = `
      width: 100%;
      border: none;
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: not-allowed;
      background: #e5e7eb;
      color: #9ca3af;
      transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
    `;

    function setPrimaryEnabled(enabled) {
        if (enabled) {
            primaryButton.disabled = false;
            primaryButton.style.cursor = 'pointer';
            primaryButton.style.background =
                'linear-gradient(135deg, #166534, #15803d)';
            primaryButton.style.color = '#f9fafb';
            primaryButton.style.boxShadow =
                '0 10px 24px rgba(22, 101, 52, 0.45)';
        } else {
            primaryButton.disabled = true;
            primaryButton.style.cursor = 'not-allowed';
            primaryButton.style.background = '#e5e7eb';
            primaryButton.style.color = '#9ca3af';
            primaryButton.style.boxShadow = 'none';
        }
    }

    primaryButton.addEventListener('mouseenter', () => {
        if (primaryButton.disabled) return;
        primaryButton.style.transform = 'translateY(-1px)';
        primaryButton.style.boxShadow =
            '0 12px 28px rgba(22, 101, 52, 0.5)';
    });

    primaryButton.addEventListener('mouseleave', () => {
        if (primaryButton.disabled) return;
        primaryButton.style.transform = 'translateY(0)';
        primaryButton.style.boxShadow =
            '0 10px 24px rgba(22, 101, 52, 0.45)';
    });

    primaryButton.addEventListener('click', async () => {
        if (!selectedFile) return;

        const currentUrl = window.location.href;
        const currentTitle = document.title;
        
        // Add or get queue item for current product
        let queueItem = getQueue().find(item => item.url === currentUrl);
        if (!queueItem) {
            queueItem = addToQueue({
                url: currentUrl,
                title: currentTitle,
                roomImage: selectedFile
            }, 'processing');
        } else {
            updateQueueItem(queueItem.id, {
                status: 'processing',
                roomImage: selectedFile,
                startedAt: new Date().toISOString()
            });
        }
        
        // Update queue display
        if (queueSection._render) {
            queueSection._render();
        }
        updateWidgetButton();

        // Disable button during upload
        setPrimaryEnabled(false);
        primaryButton.textContent = 'Generating...';
        primaryButton.style.opacity = '0.6';
        primaryButton.style.cursor = 'not-allowed';
        
        // Allow minimizing during generation
        minimizeButton.disabled = false;

        try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('productUrl', currentUrl);
            formData.append('sessionId', sessionId);
            formData.append('style', 'realistic');
            formData.append('angle', 'front');

            // Get API endpoint from config (defaults to localhost in development)
            const apiEndpoint = config?.apiEndpoint || (window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : 'https://aifurniture.app/api');
            const generateUrl = `${apiEndpoint}/generate`;

            console.log('📤 Uploading image to backend...', {
                url: generateUrl,
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                productUrl: currentUrl,
                queueItemId: queueItem.id
            });

            // Track upload start
            trackEvent('ai_furniture_upload_started', {
                sessionId,
                productUrl: currentUrl,
                sourceDomain: config?.domain || window.location.hostname,
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                queueItemId: queueItem.id
            });

            // Upload to backend
            const response = await fetch(generateUrl, {
                method: 'POST',
                body: formData,
                // Don't set Content-Type header - browser will set it with boundary
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const result = await response.json();

            console.log('✅ Image generation successful:', result);

            // Update queue item with result
            updateQueueItem(queueItem.id, {
                status: 'completed',
                result: result.generatedImages?.[0]?.url || null,
                completedAt: new Date().toISOString()
            });

            // Track successful upload
            trackEvent('ai_furniture_upload_confirmed', {
                sessionId,
                productUrl: currentUrl,
                sourceDomain: config?.domain || window.location.hostname,
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                generatedImageCount: result.generatedImages?.length || 0,
                queueItemId: queueItem.id
            });

            // Store result in sessionStorage for widget to use
            sessionStorage.setItem('ai_furniture_generated_images', JSON.stringify(result.generatedImages || []));
            sessionStorage.setItem('ai_furniture_user', 'true');

            // Update queue display
            if (queueSection._render) {
                queueSection._render();
            }
            updateWidgetButton();

            // If modal is still open and not minimized, show results
            const modalStillOpen = document.querySelector('#ai-furniture-modal') && 
                                 !document.querySelector('#ai-furniture-modal-minimized');
            
            if (modalStillOpen) {
                // Get the original image (before) from preview
                const originalImageUrl = previewImage.src;
                
                // Display generated images in the modal with before/after comparison
                displayGeneratedImages(result.generatedImages || [], originalImageUrl, uploadSection, footer);
                
                // Hide upload section and show results
                dropZone.style.display = 'none';
                previewWrapper.style.display = 'none';
                primaryButton.style.display = 'none';
                footerNote.style.display = 'none';
            } else {
                // Modal is minimized or closed - user can view results from queue
                // Reset button for next generation
                setPrimaryEnabled(true);
                primaryButton.textContent = 'Generate Preview';
                primaryButton.style.opacity = '1';
                selectedFile = null;
                previewWrapper.style.display = 'none';
                dropZone.style.display = 'flex';
            }

        } catch (error) {
            console.error('❌ Image upload error:', error);
            
            // Update queue item with error
            if (queueItem) {
                updateQueueItem(queueItem.id, {
                    status: 'error',
                    error: error.message,
                    completedAt: new Date().toISOString()
                });
                
                // Update queue display
                if (queueSection._render) {
                    queueSection._render();
                }
                updateWidgetButton();
            }
            
            // Track error
            trackEvent('ai_furniture_upload_error', {
                sessionId,
                productUrl: currentUrl,
                sourceDomain: config?.domain || window.location.hostname,
                error: error.message,
                queueItemId: queueItem?.id
            });

            // Re-enable button
            setPrimaryEnabled(true);
            primaryButton.textContent = 'Generate Preview';
            primaryButton.style.opacity = '1';
            primaryButton.style.cursor = 'pointer';

            // Show error message only if modal is open
            const modalStillOpen = document.querySelector('#ai-furniture-modal') && 
                                 !document.querySelector('#ai-furniture-modal-minimized');
            if (modalStillOpen) {
                showErrorMessage(error.message || 'Failed to generate images. Please try again.');
            }
        }
    });

    const footerNote = document.createElement('p');
    footerNote.textContent =
        'We only use this photo to generate your preview – it isn’t shown to other shoppers.';
    footerNote.style.cssText = `
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.4;
    `;

    footer.appendChild(addToQueueButton);
    footer.appendChild(primaryButton);
    footer.appendChild(footerNote);

    // Wire up input change → preview + enable button
    fileInput.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        selectedFile = file;
        trackEvent('ai_furniture_image_selected', {
            sessionId,
            productUrl: window.location.href,
            sourceDomain: config?.domain || window.location.hostname,
            fileName: file.name,
            fileSize: file.size
        });

        const reader = new FileReader();
        reader.onload = ev => {
            previewImage.src = ev.target.result;
            previewWrapper.style.display = 'flex';
            setPrimaryEnabled(true);
        };
        reader.readAsDataURL(file);
    });

    // Assemble content
    content.appendChild(header);
    content.appendChild(uploadSection);
    content.appendChild(queueSection);
    content.appendChild(footer);
    
    modalContainer.appendChild(closeButton);
    modalContainer.appendChild(minimizeButton);
    modalContainer.appendChild(content);
    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Animate in
    setTimeout(() => {
        modalOverlay.style.opacity = '1';
        if (isMobile) {
            modalContainer.style.transform = 'translateY(0)';
        } else {
            modalContainer.style.transform = 'translateX(0)';
        }
    }, 10);

    // ESC key handler
    const handleEscape = e => {
        if (e.key === 'Escape') {
            closeFurnitureModal();
        }
    };
    document.addEventListener('keydown', handleEscape);
    modalOverlay._escapeHandler = handleEscape;

    // Click outside panel to close (click on the dimmed area)
    modalOverlay.addEventListener('click', e => {
        if (e.target === modalOverlay) {
            closeFurnitureModal();
        }
    });

    // Track open
    trackEvent('ai_furniture_modal_open', {
        sessionId,
        productUrl: window.location.href,
        sourceDomain: config?.domain || window.location.hostname
    });

    debugLog('Furniture side-panel modal (upload) opened successfully');
}

// Helper: create before/after slider card
// Helper: create before/after slider card – matches the Tailwind example
function createBeforeAfterSlider(originalImageUrl, generatedImageUrl, index) {
    // This div is the equivalent of:
    // <div class="relative w-full rounded-lg overflow-hidden border border-dashed border-slate-300 bg-slate-50 aspect-[4/3]">
    const container = document.createElement('div');
    container.style.cssText = `
        position: relative;
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
        border: 1px dashed rgba(148, 163, 184, 0.9); /* slate-300 */
        background: #f8fafc; /* slate-50-ish */
        aspect-ratio: 4 / 3;
    `;

    // BEFORE (bottom image)
    const beforeImage = document.createElement('img');
    beforeImage.src = originalImageUrl;
    beforeImage.alt = 'Customer room - before';
    beforeImage.style.cssText = `
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    `;

    // AFTER (top image, clipped)
    const afterImage = document.createElement('img');
    afterImage.src = generatedImageUrl;
    afterImage.alt = `Customer room with sofa swapped by AI`;
    afterImage.setAttribute('data-after', '');
    afterImage.style.cssText = `
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        pointer-events: none;
        clip-path: inset(0 50% 0 0); /* start at 50% */
        transition: clip-path 0.08s ease-out;
    `;

    // Divider line
    const divider = document.createElement('div');
    divider.setAttribute('data-divider', '');
    divider.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        border-left: 1px solid rgba(255, 255, 255, 0.7);
        box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.25);
        pointer-events: none;
        transition: left 0.08s ease-out;
    `;

    // Slider (range input) – same behaviour as your inline oninput
    const rangeInput = document.createElement('input');
    rangeInput.type = 'range';
    rangeInput.min = '0';
    rangeInput.max = '100';
    rangeInput.value = '50';
    rangeInput.setAttribute('aria-label', 'Before/after slider');

    // Equivalent of: class="absolute bottom-3 left-1/2 -translate-x-1/2 w-2/3 accent-slate-500"
    rangeInput.style.cssText = `
        position: absolute;
        bottom: 12px;           /* bottom-3 */
        left: 50%;
        transform: translateX(-50%);
        width: 66%;
        accent-color: #64748b;  /* slate-500 */
    `;

    // Let the browser keep its native track/thumb style – looks closer to your Tailwind example
    rangeInput.addEventListener('input', function () {
        const v = Number(this.value || 50);
        // Same logic as your inline JS:
        // after.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
        // divider.style.left = v + '%';
        afterImage.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
        divider.style.left = `${v}%`;
    });

    // Assemble
    container.appendChild(beforeImage);
    container.appendChild(afterImage);
    container.appendChild(divider);
    container.appendChild(rangeInput);

    return container;
}


// Helper function to display generated images in the modal with before/after comparison
function displayGeneratedImages(generatedImages, originalImageUrl, uploadSection, footer) {
    // Remove any existing results section
    const existingResults = uploadSection.querySelector('#ai-furniture-results');
    if (existingResults) {
        existingResults.remove();
    }

    if (!generatedImages || generatedImages.length === 0) {
        console.warn('No generated images to display');
        return;
    }

    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'ai-furniture-results';
    resultsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 8px;
        animation: fadeIn 0.4s ease-out;
    `;

    // Results header
    const resultsHeader = document.createElement('div');
    resultsHeader.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
    `;
    resultsHeader.innerHTML = `
        <h3 style="
            font-size: 16px;
            font-weight: 600;
            color: #0f172a;
            margin: 0;
        ">✨ Your room preview</h3>
        <p style="
            font-size: 12px;
            color: #64748b;
            margin: 0;
        ">Drag the slider to compare your original photo with the AI-generated version.</p>
    `;

    // Images grid (one slider per generated image)
    const imagesGrid = document.createElement('div');
    imagesGrid.style.cssText = `
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        margin-top: 4px;
    `;

    generatedImages.forEach((imageData, index) => {
        const generatedImageUrl = imageData.url || imageData;
        if (!generatedImageUrl) return;

        const comparisonCard = createBeforeAfterSlider(originalImageUrl, generatedImageUrl, index);
        imagesGrid.appendChild(comparisonCard);
    });

    // Actions (for now just close)
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    `;

    const closeResultsButton = document.createElement('button');
    closeResultsButton.textContent = 'Close';
    closeResultsButton.style.cssText = `
        width: 100%;
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 999px;
        padding: 9px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        background: #ffffff;
        color: #475569;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    closeResultsButton.addEventListener('mouseenter', () => {
        closeResultsButton.style.background = '#f8fafc';
        closeResultsButton.style.borderColor = 'rgba(148, 163, 184, 0.5)';
    });

    closeResultsButton.addEventListener('mouseleave', () => {
        closeResultsButton.style.background = '#ffffff';
        closeResultsButton.style.borderColor = 'rgba(148, 163, 184, 0.3)';
    });

    closeResultsButton.addEventListener('click', () => {
        closeFurnitureModal();
    });

    actionsContainer.appendChild(closeResultsButton);

    // Assemble results
    resultsContainer.appendChild(resultsHeader);
    resultsContainer.appendChild(imagesGrid);
    resultsContainer.appendChild(actionsContainer);

    uploadSection.appendChild(resultsContainer);

    // Add fade-in animation (re-use if not present)
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(8px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    if (!document.querySelector('#ai-furniture-results-style')) {
        style.id = 'ai-furniture-results-style';
        document.head.appendChild(style);
    }

    // Scroll to results
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

// Helper function to show success message
function showSuccessMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: slideIn 0.3s ease-out;
        max-width: 320px;
      ">
        ✅ ${message}
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(messageEl);

    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 4000);
}

// Helper function to show error message
function showErrorMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        animation: slideIn 0.3s ease-out;
        max-width: 320px;
      ">
        ❌ ${message}
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(messageEl);

    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 5000);
}

export function closeFurnitureModal() {
    const modal = document.querySelector('#ai-furniture-modal');
    if (!modal) return;

    debugLog('Closing furniture modal');

    // Remove ESC handler
    if (modal._escapeHandler) {
        document.removeEventListener('keydown', modal._escapeHandler);
    }

    // Restore scroll
    document.body.style.overflow = '';

    const isMobile = window.innerWidth <= 768;
    const modalContainer = modal.querySelector('div');

    // Animate out
    modal.style.opacity = '0';
    if (modalContainer) {
        if (isMobile) {
            modalContainer.style.transform = 'translateY(16px)';
        } else {
            modalContainer.style.transform = 'translateX(32px)';
        }
    }

    // Remove after animation
    setTimeout(() => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }, 320);

    debugLog('Furniture modal closed successfully');
}

// Create queue section
function createQueueSection(sessionId, config) {
    const queueSection = document.createElement('div');
    queueSection.id = 'ai-furniture-queue-section';
    queueSection.style.cssText = `
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(226, 232, 240, 0.8);
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    `;

    function renderQueue() {
        const queue = getQueue();
        queueSection.innerHTML = '';
        
        if (queue.length === 0) {
            queueSection.style.display = 'none';
            return;
        }
        
        queueSection.style.display = 'flex';
        
        const queueHeader = document.createElement('div');
        queueHeader.style.cssText = `
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        `;
        queueHeader.textContent = `Queue (${queue.length})`;
        queueSection.appendChild(queueHeader);
        
        queue.forEach(item => {
            const queueItem = document.createElement('div');
            const statusColors = {
                pending: { bg: 'rgba(148, 163, 184, 0.1)', color: '#64748b', text: 'Pending' },
                processing: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', text: 'Generating...' },
                completed: { bg: 'rgba(22, 101, 52, 0.1)', color: '#166534', text: '✓ Done' },
                error: { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', text: '✗ Error' }
            };
            const statusStyle = statusColors[item.status] || statusColors.pending;
            
            queueItem.style.cssText = `
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 10px 12px;
              background: ${statusStyle.bg};
              border-radius: 8px;
              border: 1px solid rgba(226, 232, 240, 0.6);
              font-size: 11px;
              gap: 8px;
            `;
            
            const itemContent = document.createElement('div');
            itemContent.style.cssText = `
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 4px;
              min-width: 0;
            `;
            
            const itemTitle = document.createElement('span');
            itemTitle.textContent = item.title || 'Furniture item';
            itemTitle.style.cssText = `
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              color: #475569;
              font-weight: 500;
            `;
            
            const itemStatus = document.createElement('span');
            itemStatus.textContent = statusStyle.text;
            itemStatus.style.cssText = `
              font-size: 10px;
              color: ${statusStyle.color};
              font-weight: 600;
            `;
            
            itemContent.appendChild(itemTitle);
            itemContent.appendChild(itemStatus);
            
            const actions = document.createElement('div');
            actions.style.cssText = `
              display: flex;
              align-items: center;
              gap: 4px;
              flex-shrink: 0;
            `;
            
            // View result button if completed
            if (item.status === 'completed' && item.result) {
                const viewBtn = document.createElement('button');
                viewBtn.innerHTML = '👁';
                viewBtn.setAttribute('aria-label', 'View result');
                viewBtn.style.cssText = `
                  width: 24px;
                  height: 24px;
                  border: none;
                  background: rgba(22, 101, 52, 0.1);
                  color: #166534;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                `;
                viewBtn.addEventListener('click', () => {
                    // Open result in new tab or show in modal
                    if (item.result.startsWith('data:') || item.result.startsWith('http')) {
                        window.open(item.result, '_blank');
                    }
                });
                actions.appendChild(viewBtn);
            }
            
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '×';
            removeBtn.style.cssText = `
              width: 20px;
              height: 20px;
              border: none;
              background: rgba(239, 68, 68, 0.1);
              color: #dc2626;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
            `;
            removeBtn.addEventListener('click', () => {
                removeFromQueue(item.id);
                renderQueue();
                updateWidgetButton();
            });
            
            actions.appendChild(removeBtn);
            queueItem.appendChild(itemContent);
            queueItem.appendChild(actions);
            queueSection.appendChild(queueItem);
        });
    }
    
    renderQueue();
    queueSection._render = renderQueue;
    
    return queueSection;
}

// Minimize modal
function minimizeModal(modalOverlay, modalContainer, sessionId, config) {
    setMinimized(true);
    
    // Create minimized widget
    const minimizedWidget = document.createElement('div');
    minimizedWidget.id = 'ai-furniture-modal-minimized';
    minimizedWidget.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 280px;
      max-height: 400px;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(148, 163, 184, 0.25);
      z-index: 999998;
      overflow: hidden;
      transform: translateY(20px);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    `;
    
    const queue = getQueue();
    
    const statusColors = {
        pending: { bg: 'rgba(148, 163, 184, 0.1)', color: '#64748b', text: 'Pending' },
        processing: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', text: 'Generating...' },
        completed: { bg: 'rgba(22, 101, 52, 0.1)', color: '#166534', text: '✓ Done' },
        error: { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', text: '✗ Error' }
    };
    
    minimizedWidget.innerHTML = `
      <div style="
        padding: 16px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.8);
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="font-size: 13px; font-weight: 600; color: #0f172a;">
          Furniture Queue ${queue.length > 0 ? `(${queue.length})` : ''}
        </div>
        <div style="display: flex; gap: 4px;">
          <button id="ai-furniture-restore-btn" style="
            width: 24px;
            height: 24px;
            border: none;
            background: rgba(22, 101, 52, 0.1);
            color: #166534;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">□</button>
          <button id="ai-furniture-close-minimized-btn" style="
            width: 24px;
            height: 24px;
            border: none;
            background: rgba(239, 68, 68, 0.1);
            color: #dc2626;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        </div>
      </div>
      <div id="ai-furniture-minimized-queue-list" style="
        padding: 12px;
        max-height: 300px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      ">
        ${queue.length === 0 ? `
          <div style="
            text-align: center;
            padding: 20px;
            color: #64748b;
            font-size: 12px;
          ">
            No items in queue
          </div>
        ` : queue.map(item => {
            const statusStyle = statusColors[item.status] || statusColors.pending;
            return `
              <div data-item-id="${item.id}" style="
                padding: 10px;
                background: ${statusStyle.bg};
                border-radius: 8px;
                font-size: 11px;
                color: #475569;
                border: 1px solid rgba(226, 232, 240, 0.6);
                cursor: ${item.status === 'completed' && item.result ? 'pointer' : 'default'};
              ">
                <div style="
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  font-weight: 500;
                  margin-bottom: 4px;
                ">${item.title || 'Furniture item'}</div>
                <div style="
                  font-size: 10px;
                  color: ${statusStyle.color};
                  font-weight: 600;
                ">${statusStyle.text}</div>
              </div>
            `;
        }).join('')}
      </div>
    `;
    
    // Add click handlers for completed items
    queue.forEach(item => {
        if (item.status === 'completed' && item.result) {
            const itemEl = minimizedWidget.querySelector(`[data-item-id="${item.id}"]`);
            if (itemEl) {
                itemEl.addEventListener('click', () => {
                    if (item.result.startsWith('data:') || item.result.startsWith('http')) {
                        window.open(item.result, '_blank');
                    }
                });
                itemEl.style.cursor = 'pointer';
            }
        }
    });
    
    document.body.appendChild(minimizedWidget);
    
    // Animate in
    setTimeout(() => {
        minimizedWidget.style.transform = 'translateY(0)';
        minimizedWidget.style.opacity = '1';
    }, 10);
    
    // Restore button
    minimizedWidget.querySelector('#ai-furniture-restore-btn').addEventListener('click', () => {
        restoreMinimizedModal();
    });
    
    // Close button
    minimizedWidget.querySelector('#ai-furniture-close-minimized-btn').addEventListener('click', () => {
        minimizedWidget.remove();
        closeFurnitureModal();
    });
    
    // Periodically update minimized widget to show status changes
    const updateInterval = setInterval(() => {
        if (!document.querySelector('#ai-furniture-modal-minimized')) {
            clearInterval(updateInterval);
            return;
        }
        updateWidgetButton(); // This will update the minimized widget too
    }, 2000); // Update every 2 seconds
    
    minimizedWidget._updateInterval = updateInterval;
    
    // Hide main modal
    modalOverlay.style.opacity = '0';
    if (window.innerWidth <= 768) {
        modalContainer.style.transform = 'translateY(16px)';
    } else {
        modalContainer.style.transform = 'translateX(32px)';
    }
    
    setTimeout(() => {
        modalOverlay.style.display = 'none';
    }, 320);
    
    trackEvent('ai_furniture_modal_minimized', { sessionId });
}

// Restore minimized modal
export function restoreMinimizedModal() {
    const minimizedWidget = document.querySelector('#ai-furniture-modal-minimized');
    if (!minimizedWidget) return;
    
    const modalOverlay = document.querySelector('#ai-furniture-modal');
    if (!modalOverlay) return;
    
    setMinimized(false);
    
    // Show main modal
    modalOverlay.style.display = 'block';
    setTimeout(() => {
        modalOverlay.style.opacity = '1';
        const modalContainer = modalOverlay.querySelector('div');
        if (modalContainer) {
            if (window.innerWidth <= 768) {
                modalContainer.style.transform = 'translateY(0)';
            } else {
                modalContainer.style.transform = 'translateX(0)';
            }
        }
    }, 10);
    
    // Remove minimized widget
    minimizedWidget.style.transform = 'translateY(20px)';
    minimizedWidget.style.opacity = '0';
    
    // Clear update interval
    if (minimizedWidget._updateInterval) {
        clearInterval(minimizedWidget._updateInterval);
    }
    
    setTimeout(() => {
        minimizedWidget.remove();
    }, 300);
    
    trackEvent('ai_furniture_modal_restored', { sessionId: getSessionId() });
}

// Update widget button queue count
function updateWidgetButton() {
    // Try widget button's update function
    const widgetButton = document.querySelector('#ai-furniture-widget');
    if (widgetButton && widgetButton._updateContent) {
        widgetButton._updateContent();
    }
    
    // Also try global function
    if (window.updateAIFurnitureWidgetButton) {
        window.updateAIFurnitureWidgetButton();
    }
    
    // Also update minimized widget if it exists
    const minimizedWidget = document.querySelector('#ai-furniture-modal-minimized');
    if (minimizedWidget) {
        const queueList = minimizedWidget.querySelector('#ai-furniture-minimized-queue-list');
        const header = minimizedWidget.querySelector('div:first-child > div:first-child');
        if (queueList) {
            const queue = getQueue();
            const statusColors = {
                pending: { bg: 'rgba(148, 163, 184, 0.1)', color: '#64748b', text: 'Pending' },
                processing: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', text: 'Generating...' },
                completed: { bg: 'rgba(22, 101, 52, 0.1)', color: '#166534', text: '✓ Done' },
                error: { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', text: '✗ Error' }
            };
            
            if (header) {
                header.textContent = `Furniture Queue ${queue.length > 0 ? `(${queue.length})` : ''}`;
            }
            
            queueList.innerHTML = queue.length === 0 ? `
              <div style="
                text-align: center;
                padding: 20px;
                color: #64748b;
                font-size: 12px;
              ">
                No items in queue
              </div>
            ` : queue.map(item => {
                const statusStyle = statusColors[item.status] || statusColors.pending;
                return `
                  <div data-item-id="${item.id}" style="
                    padding: 10px;
                    background: ${statusStyle.bg};
                    border-radius: 8px;
                    font-size: 11px;
                    color: #475569;
                    border: 1px solid rgba(226, 232, 240, 0.6);
                    cursor: ${item.status === 'completed' && item.result ? 'pointer' : 'default'};
                  ">
                    <div style="
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                      font-weight: 500;
                      margin-bottom: 4px;
                    ">${item.title || 'Furniture item'}</div>
                    <div style="
                      font-size: 10px;
                      color: ${statusStyle.color};
                      font-weight: 600;
                    ">${statusStyle.text}</div>
                  </div>
                `;
            }).join('');
            
            // Re-attach click handlers for completed items
            queue.forEach(item => {
                if (item.status === 'completed' && item.result) {
                    const itemEl = queueList.querySelector(`[data-item-id="${item.id}"]`);
                    if (itemEl) {
                        itemEl.addEventListener('click', () => {
                            if (item.result.startsWith('data:') || item.result.startsWith('http')) {
                                window.open(item.result, '_blank');
                            }
                        });
                    }
                }
            });
        }
    }
}
