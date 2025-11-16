// src/ui/modal.js
import { debugLog } from '../debug.js';
import { trackEvent, trackOrderCompletion } from '../tracking.js';

export function openFurnitureModal(url, sessionId, config) {
    debugLog('Opening furniture modal with URL:', url);

    // If a modal already exists, remove it first
    if (document.querySelector('#ai-furniture-modal')) {
        debugLog('Modal already exists, removing it first');
        closeFurnitureModal();
    }

    const isMobile = window.innerWidth <= 768;

    // Overlay: full-screen, but we’ll only dock the panel on the right
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
        // keep mobile as a full-screen sheet
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
        // DESKTOP: right-hand drawer ~1/3 of the viewport
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
          z-index: 10;
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
          z-index: 10;
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
            'linear-gradient(135deg, rgba(239, 68, 68, 0.96), rgba(220, 38, 38, 0.96))';
        this.style.color = '#ffffff';
        this.style.transform = 'scale(1.08)';
        this.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.35)';
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

    // Iframe
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    `;

    // Loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #64748b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      font-weight: 500;
      z-index: 5;
      text-align: center;
      pointer-events: none;
    `;
    loadingDiv.innerHTML = `
      <div style="text-align: center;">
        <div style="
          width: 48px; 
          height: 48px; 
          border: 3px solid rgba(245, 158, 11, 0.2); 
          border-top: 3px solid #f59e0b; 
          border-radius: 50%; 
          animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite; 
          margin: 0 auto 16px;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
        "></div>
        <div style="
          background: linear-gradient(135deg, #f59e0b, #ea580c);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 600;
          font-size: 18px;
          margin-bottom: 8px;
        ">Loading AI Magic...</div>
        <div style="color: #94a3b8; font-size: 14px;">Preparing your furniture experience</div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.05); }
          100% { transform: rotate(360deg) scale(1); }
        }
      </style>
    `;

    // Assemble
    modalContainer.appendChild(closeButton);
    modalContainer.appendChild(loadingDiv);
    modalContainer.appendChild(iframe);
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

    // Remove loading indicator when iframe loads
    iframe.addEventListener('load', () => {
        setTimeout(() => {
            if (loadingDiv.parentNode) {
                loadingDiv.remove();
            }
        }, 500);
    });

    // Handle postMessage from iframe (AI Furniture app)
    const handleMessage = event => {
        // Only messages from our AI furniture domain(s)
        if (
            event.origin !== 'https://aifurniture.app' &&
            event.origin !== 'http://localhost:3000'
        ) {
            return;
        }

        debugLog('Received message from iframe:', event.data);

        if (event.data && event.data.type === 'ai_furniture_completed') {
            debugLog('AI Furniture process completed, closing modal and handling return');

            sessionStorage.setItem('ai_furniture_user', 'true');

            // Close modal
            closeFurnitureModal();

            if (event.data.orderData) {
                // Full order data provided by iframe → track completion
                trackOrderCompletion(event.data.orderData);
            } else {
                // Just a return event
                const returnData = {
                    sessionId,
                    returnTimestamp: new Date().toISOString(),
                    productUrl: window.location.href,
                    sourceDomain: config?.domain || window.location.hostname
                };

                trackEvent('ai_furniture_return', returnData);
            }
        } else if (event.data && event.data.type === 'ai_furniture_close') {
            debugLog('AI Furniture modal close requested');
            closeFurnitureModal();
        }
    };

    window.addEventListener('message', handleMessage);
    modalOverlay._messageHandler = handleMessage;

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

    debugLog('Furniture side-panel modal opened successfully');
}

export function closeFurnitureModal() {
    const modal = document.querySelector('#ai-furniture-modal');
    if (!modal) return;

    debugLog('Closing furniture modal');

    // Remove ESC handler
    if (modal._escapeHandler) {
        document.removeEventListener('keydown', modal._escapeHandler);
    }

    // Remove message handler
    if (modal._messageHandler) {
        window.removeEventListener('message', modal._messageHandler);
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
