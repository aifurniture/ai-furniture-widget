/**
 * Centralized styles for the widget
 * Injected into the head to avoid external CSS dependencies
 */
import { initMobileLayout } from './safeArea.js';

export const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650&family=DM+Sans:wght@400;500;600;700&display=swap');

  :root {
    --aif-primary: #8b6914;
    --aif-primary-hover: #6f5310;
    --aif-primary-dark: #4a3810;
    --aif-accent-soft: #f3ead8;
    --aif-accent-glow: rgba(184, 134, 20, 0.28);
    --aif-bg-overlay: transparent;
    --aif-bg-panel: #faf8f5;
    --aif-bg-elevated: #ffffff;
    --aif-text-main: #2c241c;
    --aif-text-muted: #6b5f54;
    --aif-border: #e8dfd2;
    --aif-shadow: 0 28px 56px -16px rgba(44, 36, 28, 0.22);
    --aif-radius: 20px;
    --aif-radius-sm: 12px;
    --aif-font: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
    --aif-font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
    --aif-safe-top: env(safe-area-inset-top, 0px);
    --aif-safe-bottom: env(safe-area-inset-bottom, 0px);
    --aif-safe-left: env(safe-area-inset-left, 0px);
    --aif-safe-right: env(safe-area-inset-right, 0px);
    --aif-vvh: 100dvh;
  }

  /*
   * Wrapper uses display:contents when open (no extra fullscreen box — avoids blurring the store).
   * Desktop: flat tint scrim behind the drawer (no backdrop-filter). Clicks outside the panel close the widget.
   */
  #ai-furniture-modal {
    display: none;
    font-family: var(--aif-font);
  }

  #ai-furniture-modal.open {
    display: contents;
  }

  .aif-drawer-scrim {
    display: none;
  }

  @media (min-width: 769px) {
    #ai-furniture-modal.open .aif-drawer-scrim {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 999998;
      pointer-events: auto;
      background: rgba(44, 36, 28, 0.32);
    }
  }

  .aif-container {
    position: fixed;
    z-index: 999999;
    background: var(--aif-bg-panel);
    box-shadow: var(--aif-shadow);
    overflow: hidden;
    isolation: isolate;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    pointer-events: auto; /* re-enable interactions inside the panel */
    box-sizing: border-box;
    height: 100%;
    max-height: 100dvh;
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

    /* Room for before/after on the results step */
    .aif-container[data-aif-view="RESULTS"] {
      width: min(92vw, 600px);
    }
    
    #ai-furniture-modal.open .aif-container {
      transform: translateX(0);
    }
  }

  /* Mobile Styles */
  @media (max-width: 768px) {
    .aif-container {
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: var(--aif-vvh, 100dvh);
      max-height: var(--aif-vvh, 100dvh);
      border-radius: 0;
      transform: translateY(100%);
    }

    #ai-furniture-modal.open .aif-container {
      transform: translateY(0);
    }
  }

  .aif-drawer-chrome {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 48px;
    padding: 8px 14px 4px;
    padding-top: max(8px, var(--aif-safe-top, 0px));
    padding-left: max(14px, calc(var(--aif-safe-left, 0px) + 10px));
    padding-right: max(14px, calc(var(--aif-safe-right, 0px) + 10px));
    box-sizing: border-box;
  }

  @media (prefers-reduced-motion: reduce) {
    .aif-container {
      transition-duration: 0.01ms !important;
      transition-delay: 0s !important;
    }

    .aif-close-btn,
    .aif-btn-primary,
    .aif-btn-secondary,
    .aif-btn-text {
      transition: none !important;
    }

    .aif-fade-in,
    .aif-pulse {
      animation: none !important;
    }
  }

  .aif-close-btn {
    position: relative;
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    padding: 0;
    margin: 0;
    background: #f9fafb;
    color: #6b7280;
    border: none;
    border-radius: 50%;
    font-family: var(--aif-font);
    line-height: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    -webkit-tap-highlight-color: transparent;
  }

  .aif-close-btn svg {
    display: block;
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    pointer-events: none;
    flex-shrink: 0;
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
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 18px 18px 12px;
    gap: 10px;
    overflow-x: hidden;
    overflow-y: hidden;
    box-sizing: border-box;
  }

  /* Fill the panel: one view root per screen, no outer scroll */
  .aif-content > :first-child {
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .aif-header {
    padding-top: 8px;
  }

  .aif-eyebrow {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--aif-primary);
    margin-bottom: 6px;
  }

  .aif-header h2 {
    font-family: var(--aif-font-display);
    font-size: 22px;
    font-weight: 650;
    margin: 0 0 4px 0;
    color: var(--aif-text-main);
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  .aif-header p {
    font-size: 13px;
    color: var(--aif-text-muted);
    margin: 0;
    line-height: 1.45;
  }

  .aif-results-lede {
    flex-shrink: 0;
    line-height: 1.35;
  }

  .aif-results-disclaimer {
    flex-shrink: 0;
    margin: 0;
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--aif-text-muted);
    background: var(--aif-accent-soft);
    border: 1px solid var(--aif-border);
    border-radius: 8px;
  }

  .aif-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--aif-accent-soft);
    color: var(--aif-primary-dark);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 8px;
    box-shadow: 0 2px 10px var(--aif-accent-glow);
  }

  .aif-container::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.45;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  }

  .aif-container > :not(.aif-close-btn):not(.aif-drawer-chrome) {
    position: relative;
    z-index: 1;
  }

  .aif-upload-view .aif-dropzone {
    flex: 1 1 0;
    min-height: 0;
    padding: 28px 18px;
  }

  .aif-upload-view .aif-upload-stage {
    flex: 1 1 0;
    min-height: 0;
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .aif-upload-view .aif-upload-stage img {
    max-width: 100%;
    max-height: min(36dvh, 220px);
    width: auto;
    height: auto;
    object-fit: contain;
  }

  .aif-queue-tabs {
    flex-shrink: 0;
  }

  .aif-queue-card {
    flex-shrink: 0;
  }

  .aif-dropzone {
    border: 2px dashed #d1d5db;
    border-radius: var(--aif-radius-sm);
    padding: 32px 20px;
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
    background: linear-gradient(145deg, rgba(184, 134, 20, 0.06), rgba(107, 127, 106, 0.05));
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none; /* Allow clicks to pass through to buttons */
  }

  .aif-dropzone-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--aif-accent-soft);
    border: 1px solid var(--aif-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--aif-primary);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  .aif-dropzone-icon svg {
    width: 24px;
    height: 24px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .aif-dropzone-title {
    margin: 14px 0 4px;
    font-family: var(--aif-font-display);
    font-weight: 600;
    font-size: 17px;
    color: var(--aif-text-main);
    letter-spacing: -0.02em;
  }

  .aif-dropzone-note {
    font-size: 12px;
    color: var(--aif-text-muted);
    margin: 0;
    line-height: 1.5;
    max-width: 26ch;
  }

  .aif-upload-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: 20px;
    position: relative;
    z-index: 2;
  }

  .aif-upload-cta {
    width: 100%;
    padding: 16px 20px;
    border: none;
    border-radius: var(--aif-radius-sm);
    font-weight: 600;
    font-size: 15px;
    font-family: var(--aif-font);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 52px;
    box-sizing: border-box;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }

  .aif-upload-cta--primary {
    background: linear-gradient(165deg, #a67c1a 0%, var(--aif-primary) 55%, var(--aif-primary-hover) 100%);
    color: #fffaf2;
    box-shadow: 0 6px 20px var(--aif-accent-glow);
  }

  .aif-upload-cta--primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 28px var(--aif-accent-glow);
  }

  .aif-upload-cta--secondary {
    background: var(--aif-bg-elevated);
    border: 2px solid var(--aif-border);
    color: var(--aif-primary-hover);
  }

  .aif-upload-cta--secondary:hover {
    border-color: var(--aif-primary);
    background: var(--aif-accent-soft);
  }

  .aif-upload-privacy {
    font-size: 11px;
    color: var(--aif-text-muted);
    text-align: center;
    margin-top: 8px;
    line-height: 1.45;
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

  .aif-widget-footer {
    flex-shrink: 0;
    padding: 8px 18px max(12px, calc(var(--aif-safe-bottom, 0px) + 8px));
    border-top: 1px solid var(--aif-border);
    background: linear-gradient(180deg, #fafbfc 0%, #f1f5f9 100%);
  }

  .aif-widget-footer__details {
    margin: 0;
    padding: 0;
    border: none;
  }

  .aif-widget-footer__summary {
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: var(--aif-text-muted);
    list-style: none;
    padding: 2px 0 4px;
    user-select: none;
    line-height: 1.4;
  }

  .aif-widget-footer__summary::-webkit-details-marker {
    display: none;
  }

  .aif-widget-footer__details[open] .aif-widget-footer__summary {
    color: var(--aif-text-main);
    margin-bottom: 2px;
  }

  .aif-widget-footer__label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--aif-text-muted);
    margin-bottom: 6px;
  }

  .aif-widget-footer__row {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }

  /* Override width:100% below — otherwise the input steals the full row and the Save button collapses to 0 width. */
  .aif-widget-footer__row .aif-widget-footer__input {
    flex: 1 1 0;
    min-width: 0;
    width: auto;
    max-width: 100%;
  }

  .aif-widget-footer__submit {
    flex: 0 0 auto;
    align-self: stretch;
    min-height: 42px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: #059669;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-family: var(--aif-font);
    line-height: 1.2;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .aif-widget-footer__submit:hover:not(:disabled) {
    background: #047857;
  }

  .aif-widget-footer__submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .aif-widget-footer__input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    font-size: 14px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #fff;
    color: var(--aif-text-main);
    font-family: var(--aif-font);
  }

  .aif-widget-footer__input:focus {
    outline: none;
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
  }

  .aif-widget-footer__hint {
    margin: 8px 0 0;
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
  }

  .aif-widget-footer__saved {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-widget-footer__saved-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--aif-text-muted);
  }

  .aif-widget-footer__saved-link {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: #059669;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-family: var(--aif-font);
    text-align: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .aif-widget-footer__saved-link:hover {
    background: #047857;
  }

  /* Results actions (Save / Share) */
  .aif-result-actions {
    flex-shrink: 0;
    margin-top: 2px;
    padding: 6px 0 2px;
    border-top: 1px solid #e2e8f0;
  }

  .aif-result-actions__hint {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--aif-text-main);
  }

  .aif-result-actions__grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-result-actions__split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .aif-result-actions__row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .aif-result-actions__btn {
    width: 100%;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    border: 1px solid var(--aif-border);
    background: var(--aif-bg-elevated);
    color: var(--aif-text-main);
    font-family: var(--aif-font);
    line-height: 1.2;
    text-align: center;
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 44px;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .aif-result-actions__btn:active:not(:disabled) {
    background: var(--aif-accent-soft);
  }

  .aif-result-actions__btn--full {
    width: 100%;
  }

  .aif-result-actions__btn--primary {
    border: 1px solid var(--aif-primary-hover);
    background: linear-gradient(165deg, #a67c1a 0%, var(--aif-primary) 55%, var(--aif-primary-hover) 100%);
    color: #fffaf2;
    box-shadow: 0 4px 14px var(--aif-accent-glow);
  }

  .aif-result-actions__btn--primary:active:not(:disabled) {
    background: var(--aif-primary-hover);
  }

  .aif-result-actions__btn--secondary {
    border: 2px solid var(--aif-primary);
    color: var(--aif-primary-hover);
    background: var(--aif-bg-elevated);
    font-weight: 600;
  }

  .aif-result-actions__btn--secondary:active:not(:disabled) {
    background: var(--aif-accent-soft);
  }

  .aif-result-actions__btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .aif-save-fallback {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding: 10px;
    border-radius: 10px;
    background: var(--aif-accent-soft);
    border: 1px solid var(--aif-border);
  }

  .aif-save-fallback__text {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: var(--aif-text-muted);
  }

  .aif-save-fallback__btn {
    width: 100%;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--aif-font);
    color: var(--aif-primary-hover);
    background: var(--aif-bg-elevated);
    border: 1px solid var(--aif-border);
    border-radius: 8px;
    cursor: pointer;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
  }

  .aif-results-save {
    flex-shrink: 0;
    overflow: visible;
  }

  .aif-results-save .aif-result-actions {
    border-top: none;
    padding-top: 0;
    margin-top: 0;
  }

  .aif-results-footer {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Results: locked viewport — preview row gets leftover height; save buttons stay visible */
  .aif-results-view {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    gap: 6px;
    height: 100%;
    max-height: 100%;
  }

  .aif-results-grid {
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    align-self: stretch;
  }

  .aif-result-preview-block {
    position: relative;
    width: 100%;
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    max-height: 100%;
    overflow: hidden;
  }

  /* Results slider: hug parent cell — images stay fully visible via object-fit: contain */
  .aif-result-preview-block .aif-slider.aif-slider--fill {
    flex: 1 1 0 !important;
    min-height: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-height: 100% !important;
    aspect-ratio: unset !important;
  }

  .aif-result-preview-block > img {
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    align-self: center;
  }

  .aif-queue-list {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-queue-view .aif-header {
    flex-shrink: 0;
  }

  .aif-history {
    margin-bottom: 16px;
  }

  .aif-history__title {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    margin: 0 0 10px 0;
  }

  .aif-history__row {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
    -webkit-overflow-scrolling: touch;
  }

  .aif-history__card {
    flex: 0 0 auto;
    width: 88px;
    cursor: pointer;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .aif-history__card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }

  .aif-history__card img {
    width: 100%;
    height: 64px;
    object-fit: cover;
    display: block;
  }

  .aif-history__meta {
    padding: 4px 6px;
    font-size: 9px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Mobile Optimizations */
  @media (max-width: 768px) {
    .aif-drawer-chrome {
      min-height: 52px;
    }

    .aif-close-btn {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
    }

    .aif-close-btn svg {
      width: 16px;
      height: 16px;
    }

    .aif-content {
      padding: 12px 14px 10px;
    }

    /* Results: edge-to-edge preview; height from flex (no fixed min-height — avoids panel scroll) */
    .aif-container[data-aif-view="RESULTS"] .aif-content {
      padding-left: 12px;
      padding-right: 12px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-result-preview-block {
      margin-left: -12px;
      margin-right: -12px;
      width: calc(100% + 24px);
    }

    .aif-widget-footer {
      padding: 8px 14px max(10px, calc(var(--aif-safe-bottom, 0px) + 8px));
    }

    .aif-header h2 {
      font-size: 18px;
    }

    .aif-btn-primary,
    .aif-btn-secondary {
      padding: 12px 16px;
      font-size: 14px;
    }

    .aif-dropzone {
      padding: 28px 16px;
    }
  }

  /* Desktop: reclaim vertical space for results */
  @media (min-width: 769px) {
    /* Results: keep footer visible; email block stays a compact disclosure. */
    .aif-container[data-aif-view="RESULTS"] .aif-widget-footer:not(.aif-widget-footer--has-email) {
      display: block;
      padding: 6px 18px 10px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-widget-footer.aif-widget-footer--has-email {
      display: block;
      padding: 6px 18px 10px;
    }

    /* Compact the per-result action block. */
    .aif-result-actions {
      padding: 6px 0 2px;
    }

    .aif-result-actions__btn {
      padding: 11px 12px;
      font-size: 13px;
    }
  }

  /* Floating launcher — matches drawer showroom palette */
  #ai-furniture-trigger-btn.aif-trigger-btn {
    position: fixed;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 22px;
    border: 1px solid rgba(255, 250, 242, 0.35);
    border-radius: 999px;
    font-family: var(--aif-font);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #fffaf2;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 48px;
    min-width: 48px;
    opacity: 0;
    transform: translateY(18px) scale(0.94);
    pointer-events: none;
    transition:
      opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 0.25s ease,
      background 0.35s ease;
    background: linear-gradient(155deg, #3d3228 0%, #2c241c 48%, #1f1914 100%);
    box-shadow:
      0 14px 36px rgba(44, 36, 28, 0.38),
      0 0 0 1px rgba(184, 134, 20, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }

  #ai-furniture-trigger-btn.aif-trigger-btn.is-visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }

  #ai-furniture-trigger-btn.aif-trigger-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow:
      0 18px 44px rgba(44, 36, 28, 0.42),
      0 0 0 1px rgba(201, 162, 39, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }

  #ai-furniture-trigger-btn.aif-trigger-btn[data-aif-state="processing"] {
    background: linear-gradient(155deg, #4a5d4a 0%, #3a4a3a 55%, #2d3a2d 100%);
    box-shadow: 0 12px 32px rgba(58, 74, 58, 0.35);
  }

  #ai-furniture-trigger-btn.aif-trigger-btn[data-aif-state="ready"] {
    background: linear-gradient(155deg, #a67c1a 0%, var(--aif-primary) 50%, var(--aif-primary-hover) 100%);
    box-shadow: 0 14px 36px var(--aif-accent-glow);
  }

  .aif-trigger-btn__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 250, 242, 0.12);
    flex-shrink: 0;
  }

  .aif-trigger-btn__icon svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .aif-trigger-btn__label {
    line-height: 1.2;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    #ai-furniture-trigger-btn.aif-trigger-btn {
      font-size: 14px;
      padding: 14px 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #ai-furniture-trigger-btn.aif-trigger-btn {
      transition-duration: 0.01ms !important;
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
    initMobileLayout();
};
