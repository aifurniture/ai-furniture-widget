/**
 * Centralized styles for the widget
 * Injected into the head to avoid external CSS dependencies
 */

export const styles = `
  :root {
    --aif-primary: #10b981;
    --aif-primary-hover: #059669;
    --aif-primary-dark: #047857;
    --aif-bg-overlay: rgba(0, 0, 0, 0.6);
    --aif-bg-panel: #ffffff;
    --aif-text-main: #111827;
    --aif-text-muted: #6b7280;
    --aif-border: #e5e7eb;
    --aif-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    --aif-radius: 20px;
    --aif-radius-sm: 12px;
    --aif-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  #ai-furniture-modal {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    background: var(--aif-bg-overlay);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 999999;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: var(--aif-font);
    display: none;
  }

  #ai-furniture-modal.open {
    display: block;
    opacity: 1;
  }

  .aif-container {
    position: fixed;
    background: var(--aif-bg-panel);
    box-shadow: var(--aif-shadow);
    overflow: hidden;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
  }

  /* Desktop Styles */
  @media (min-width: 769px) {
    .aif-container {
      top: 0;
      right: 0;
      height: 100%;
      width: clamp(360px, 34vw, 520px);
      border-radius: var(--aif-radius) 0 0 var(--aif-radius);
      border-left: 1px solid var(--aif-border);
      transform: translateX(100%);
    }
    
    #ai-furniture-modal.open .aif-container {
      transform: translateX(0);
    }
  }

  /* Mobile Styles */
  @media (max-width: 768px) {
    .aif-container {
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: 0;
      transform: translateY(100%);
    }

    #ai-furniture-modal.open .aif-container {
      transform: translateY(0);
    }
  }

  .aif-close-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    background: #f9fafb;
    color: #6b7280;
    border: none;
    border-radius: 50%;
    font-size: 24px;
    font-weight: 300;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .aif-close-btn:hover {
    background: #111827;
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  .aif-close-btn:active {
    transform: scale(0.95);
  }

  .aif-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 32px 24px 24px;
    gap: 24px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .aif-content::-webkit-scrollbar {
    width: 6px;
  }

  .aif-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .aif-content::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
  }

  .aif-content::-webkit-scrollbar-thumb:hover {
    background: #d1d5db;
  }

  .aif-header {
    padding-top: 8px;
  }

  .aif-header h2 {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: var(--aif-text-main);
    letter-spacing: -0.02em;
  }

  .aif-header p {
    font-size: 14px;
    color: var(--aif-text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .aif-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #047857;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
  }

  .aif-dropzone {
    border: 2px dashed #d1d5db;
    border-radius: var(--aif-radius-sm);
    padding: 48px 24px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    cursor: pointer;
    text-align: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: visible;
    pointer-events: none;
  }

  .aif-dropzone > div:last-child {
    pointer-events: auto;
  }

  .aif-dropzone::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.05));
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none; /* Allow clicks to pass through to buttons */
  }

  .aif-dropzone:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border-color: var(--aif-primary);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }

  .aif-dropzone:hover::before {
    opacity: 1;
  }

  .aif-dropzone:active {
    transform: translateY(0);
  }

  .aif-btn-primary {
    width: 100%;
    border: none;
    border-radius: var(--aif-radius-sm);
    padding: 16px 24px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    background: linear-gradient(135deg, var(--aif-primary), var(--aif-primary-hover));
    color: white;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    letter-spacing: 0.01em;
  }

  .aif-btn-primary:disabled {
    background: linear-gradient(135deg, #e5e7eb, #d1d5db);
    color: #9ca3af;
    cursor: not-allowed;
    box-shadow: none;
    opacity: 0.6;
  }

  .aif-btn-primary:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
    background: linear-gradient(135deg, var(--aif-primary-hover), var(--aif-primary-dark));
  }

  .aif-btn-primary:not(:disabled):active {
    transform: translateY(0);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  /* Spinner */
  .aif-spinner {
    width: 20px;
    height: 20px;
    border: 2.5px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    border-top-color: white;
    animation: aif-spin 0.7s linear infinite;
  }

  @keyframes aif-spin {
    to { transform: rotate(360deg); }
  }

  /* Card */
  .aif-card {
    background: #ffffff;
    border: 1px solid var(--aif-border);
    border-radius: var(--aif-radius-sm);
    padding: 16px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .aif-card:hover {
    border-color: #d1d5db;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }

  /* Banner */
  .aif-banner {
    padding: 14px 16px;
    border-radius: var(--aif-radius-sm);
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .aif-banner-info {
    background: linear-gradient(135deg, #eff6ff, #dbeafe);
    color: #1e40af;
    border: 1px solid #93c5fd;
  }

  .aif-banner-success {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #065f46;
    border: 1px solid #6ee7b7;
  }

  .aif-banner-error {
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  .aif-banner-warning {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #92400e;
    border: 1px solid #fcd34d;
  }

  /* Image Preview */
  .aif-image-preview {
    position: relative;
    border-radius: var(--aif-radius-sm);
    overflow: hidden;
    background: #f9fafb;
    border: 1px solid var(--aif-border);
  }

  .aif-image-preview img {
    width: 100%;
    height: auto;
    display: block;
  }

  .aif-image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%);
    display: flex;
    align-items: flex-end;
    padding: 16px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .aif-image-preview:hover .aif-image-overlay {
    opacity: 1;
  }

  /* Secondary Button */
  .aif-btn-secondary {
    width: 100%;
    border: 2px solid var(--aif-border);
    background: white;
    border-radius: var(--aif-radius-sm);
    padding: 14px 24px;
    font-size: 15px;
    font-weight: 600;
    color: var(--aif-text-main);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .aif-btn-secondary:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    transform: translateY(-1px);
  }

  .aif-btn-secondary:active {
    transform: translateY(0);
  }

  /* Text Button */
  .aif-btn-text {
    background: none;
    border: none;
    color: var(--aif-primary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .aif-btn-text:hover {
    background: rgba(16, 185, 129, 0.1);
    color: var(--aif-primary-hover);
  }

  /* Progress Bar */
  .aif-progress {
    width: 100%;
    height: 6px;
    background: #e5e7eb;
    border-radius: 999px;
    overflow: hidden;
  }

  .aif-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--aif-primary), var(--aif-primary-hover));
    border-radius: 999px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  }

  /* Divider */
  .aif-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--aif-border), transparent);
    margin: 16px 0;
  }

  /* Label */
  .aif-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--aif-text-main);
    margin-bottom: 8px;
    display: block;
  }

  /* Helper Text */
  .aif-helper-text {
    font-size: 12px;
    color: var(--aif-text-muted);
    line-height: 1.5;
  }

  /* Fade In Animation */
  @keyframes aif-fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .aif-fade-in {
    animation: aif-fade-in 0.3s ease;
  }

  /* Pulse Animation */
  @keyframes aif-pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .aif-pulse {
    animation: aif-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* Mobile Optimizations */
  @media (max-width: 768px) {
    .aif-content {
      padding: 24px 20px 20px;
    }

    .aif-header h2 {
      font-size: 22px;
    }

    .aif-btn-primary,
    .aif-btn-secondary {
      padding: 14px 20px;
      font-size: 14px;
    }

    .aif-dropzone {
      padding: 40px 20px;
    }
  }
`;

export const injectStyles = () => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('ai-furniture-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'ai-furniture-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
};
