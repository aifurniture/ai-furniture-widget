/**
 * Centralized styles for the widget
 * Injected into the head to avoid external CSS dependencies
 */

export const styles = `
  :root {
    --aif-primary: #166534;
    --aif-primary-hover: #15803d;
    --aif-bg-overlay: rgba(15, 23, 42, 0.45);
    --aif-bg-panel: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    --aif-text-main: #0f172a;
    --aif-text-muted: #64748b;
    --aif-border: rgba(148, 163, 184, 0.25);
    --aif-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
    --aif-radius: 16px;
    --aif-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  #ai-furniture-modal {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    background: var(--aif-bg-overlay);
    z-index: 999999;
    opacity: 0;
    transition: opacity 0.3s ease;
    font-family: var(--aif-font);
    display: none; /* Hidden by default */
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
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
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
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.9);
    color: var(--aif-text-muted);
    border: 1px solid var(--aif-border);
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .aif-close-btn:hover {
    background: var(--aif-primary);
    color: white;
    transform: scale(1.1);
  }

  .aif-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 24px;
    gap: 20px;
    overflow-y: auto;
  }

  .aif-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: var(--aif-text-main);
  }

  .aif-header p {
    font-size: 13px;
    color: var(--aif-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .aif-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(22, 101, 52, 0.08);
    color: var(--aif-primary);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .aif-dropzone {
    border: 1px dashed rgba(148, 163, 184, 0.9);
    border-radius: 12px;
    padding: 32px 20px;
    background: rgba(248, 250, 252, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
  }

  .aif-dropzone:hover {
    background: rgba(248, 250, 252, 0.9);
    border-color: var(--aif-primary);
  }

  .aif-btn-primary {
    width: 100%;
    border: none;
    border-radius: 999px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    background: linear-gradient(135deg, var(--aif-primary), var(--aif-primary-hover));
    color: white;
    box-shadow: 0 4px 12px rgba(22, 101, 52, 0.25);
    transition: all 0.2s ease;
  }

  .aif-btn-primary:disabled {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
  }

  .aif-btn-primary:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(22, 101, 52, 0.35);
  }

  /* Spinner */
  .aif-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: aif-spin 0.8s linear infinite;
  }

  @keyframes aif-spin {
    to { transform: rotate(360deg); }
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
