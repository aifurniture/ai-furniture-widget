// src/ui/modal.js
import { debugLog } from '../debug.js';
import { trackEvent, trackOrderCompletion } from '../tracking.js';

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
        See this sofa in your own room
      </h2>
      <p style="font-size:12px; color:#64748b; max-width:320px;">
        Upload a quick photo of your living room. We’ll swap your current sofa for this one, matching
        the angle, lighting and flooring.
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

        // Disable button during upload
        setPrimaryEnabled(false);
        primaryButton.textContent = 'Generating...';
        primaryButton.style.opacity = '0.6';
        primaryButton.style.cursor = 'not-allowed';

        try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('productUrl', window.location.href);
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
                productUrl: window.location.href
            });

            // Track upload start
            trackEvent('ai_furniture_upload_started', {
                sessionId,
                productUrl: window.location.href,
                sourceDomain: config?.domain || window.location.hostname,
                fileName: selectedFile.name,
                fileSize: selectedFile.size
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

            // Track successful upload
            trackEvent('ai_furniture_upload_confirmed', {
                sessionId,
                productUrl: window.location.href,
                sourceDomain: config?.domain || window.location.hostname,
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                generatedImageCount: result.generatedImages?.length || 0
            });

            // Store result in sessionStorage for widget to use
            sessionStorage.setItem('ai_furniture_generated_images', JSON.stringify(result.generatedImages || []));
            sessionStorage.setItem('ai_furniture_user', 'true');

            // Display generated images in the modal
            displayGeneratedImages(result.generatedImages || [], uploadSection, footer);
            
            // Hide upload section and show results
            dropZone.style.display = 'none';
            previewWrapper.style.display = 'none';
            primaryButton.style.display = 'none';
            footerNote.style.display = 'none';

        } catch (error) {
            console.error('❌ Image upload error:', error);
            
            // Track error
            trackEvent('ai_furniture_upload_error', {
                sessionId,
                productUrl: window.location.href,
                sourceDomain: config?.domain || window.location.hostname,
                error: error.message
            });

            // Re-enable button
            setPrimaryEnabled(true);
            primaryButton.textContent = 'Generate Preview';
            primaryButton.style.opacity = '1';
            primaryButton.style.cursor = 'pointer';

            // Show error message
            showErrorMessage(error.message || 'Failed to generate images. Please try again.');
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
    content.appendChild(footer);

    modalContainer.appendChild(closeButton);
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

// Helper function to display generated images in the modal
function displayGeneratedImages(generatedImages, uploadSection, footer) {
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
        ">Here's how this furniture looks in your room</p>
    `;

    // Images grid
    const imagesGrid = document.createElement('div');
    imagesGrid.style.cssText = `
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-top: 4px;
    `;

    // Display each generated image
    generatedImages.forEach((imageData, index) => {
        const imageUrl = imageData.url || imageData;
        if (!imageUrl) return;

        const imageCard = document.createElement('div');
        imageCard.style.cssText = `
            position: relative;
            width: 100%;
            border-radius: 12px;
            overflow: hidden;
            background: #f8fafc;
            border: 1px solid rgba(226, 232, 240, 0.9);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        `;

        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = `Generated preview ${index + 1}`;
        image.style.cssText = `
            width: 100%;
            height: auto;
            display: block;
            object-fit: contain;
        `;

        // Add loading state
        image.onload = () => {
            image.style.opacity = '1';
        };
        image.style.opacity = '0';
        image.style.transition = 'opacity 0.3s ease';

        imageCard.appendChild(image);
        imagesGrid.appendChild(imageCard);
    });

    // Add download/view actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    `;

    // Close button to dismiss results
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

    // Add to upload section (which now acts as container)
    uploadSection.appendChild(resultsContainer);

    // Add fade-in animation
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
