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
    --aif-drawer-height: 100dvh;
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
    overscroll-behavior: none;
    touch-action: manipulation;
  }

  /* Prevent storefront scroll while the drawer is open */
  html.aif-drawer-open,
  html.aif-drawer-open body {
    overflow: hidden !important;
    overscroll-behavior: none;
  }

  /* Desktop Styles */
  @media (min-width: 769px) {
    .aif-container {
      top: 0;
      right: 0;
      height: 100%;
      width: var(--aif-drawer-width, clamp(360px, 34vw, 520px));
      border-radius: var(--aif-radius) 0 0 var(--aif-radius);
      border-left: 1px solid var(--aif-border);
      transform: translateX(100%);
    }

    /* Results: wider default drawer so before/after uses full panel width */
    .aif-container[data-aif-view="RESULTS"] {
      width: var(--aif-drawer-width, min(96vw, 640px));
    }
    
    #ai-furniture-modal.open .aif-container {
      transform: translateX(0);
    }
  }

  /* Mobile Styles — edge-to-edge; safe areas via inner padding (no side gaps / ghost borders) */
  @media (max-width: 768px) {
    .aif-container {
      top: var(--aif-vv-offset-top, 0px);
      left: 0;
      right: 0;
      bottom: auto;
      width: 100%;
      height: var(--aif-drawer-height, var(--aif-vvh, 100dvh));
      max-height: var(--aif-drawer-height, var(--aif-vvh, 100dvh));
      border: none;
      border-radius: 0;
      box-shadow: none;
      transform: translateY(100%);
      padding-top: var(--aif-safe-top, 0px);
      padding-bottom: var(--aif-safe-bottom, 0px);
      padding-left: max(0px, var(--aif-safe-left, 0px));
      padding-right: max(0px, var(--aif-safe-right, 0px));
      background-clip: padding-box;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }

    #ai-furniture-modal.open .aif-container {
      transform: translateY(0);
    }

    /* Kill hairline / subpixel seams against the storefront */
    .aif-container::after {
      content: none;
    }
  }

  .aif-drawer-resize {
    display: none;
  }

  @media (min-width: 769px) {
    .aif-drawer-resize {
      display: none;
      align-items: center;
      justify-content: center;
      position: fixed;
      z-index: 10000001;
      width: 36px;
      height: 72px;
      margin: 0;
      padding: 0;
      border: 2px solid var(--aif-primary);
      border-radius: 999px;
      background: linear-gradient(180deg, #fffaf2 0%, var(--aif-accent-soft) 100%);
      color: var(--aif-primary-dark);
      box-shadow:
        0 0 0 3px rgba(255, 250, 242, 0.98),
        -6px 0 20px rgba(44, 36, 28, 0.22),
        0 10px 28px rgba(44, 36, 28, 0.18);
      cursor: ew-resize;
      touch-action: none;
      pointer-events: auto;
      transition: color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .aif-drawer-resize svg {
      display: block;
      flex-shrink: 0;
      filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.65));
    }

    .aif-drawer-resize:hover,
    .aif-drawer-resize--active {
      color: var(--aif-primary);
      border-color: var(--aif-primary-hover);
      background: linear-gradient(180deg, #ffffff 0%, #f8edd4 100%);
      box-shadow:
        0 0 0 3px rgba(255, 250, 242, 1),
        -8px 0 24px var(--aif-accent-glow),
        0 12px 30px rgba(44, 36, 28, 0.2);
    }

    .aif-drawer-resize:focus-visible {
      outline: 2px solid var(--aif-primary);
      outline-offset: 2px;
    }
  }

  .aif-drawer-chrome {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 48px;
    padding: 10px 12px 6px;
    box-sizing: border-box;
    position: relative;
    z-index: 12;
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
  .aif-content > :first-child:not(.aif-results-view) {
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .aif-content > .aif-results-view {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    margin: 0;
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
    width: 100%;
    line-height: 1.3;
    padding: 0 0 8px;
    margin: 0 0 2px;
    border-bottom: 1px solid var(--aif-border);
  }

  .aif-results-lede__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 10px;
    margin: 0 0 4px;
    min-height: 36px;
  }

  .aif-results-close {
    grid-column: 2;
    grid-row: 1;
    width: 34px;
    height: 34px;
    min-width: 34px;
    min-height: 34px;
    margin: 0;
    justify-self: end;
  }

  .aif-results-eyebrow {
    display: block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--aif-primary);
    margin: 0 0 4px;
  }

  .aif-results-title {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--aif-font-display);
    font-size: 19px;
    font-weight: 650;
    letter-spacing: -0.02em;
    color: var(--aif-text-main);
    line-height: 1.2;
  }

  .aif-results-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 5px 0 0;
    font-size: 12px;
    color: var(--aif-text-muted);
    line-height: 1.35;
  }

  .aif-results-hint__icon {
    display: inline-flex;
    color: var(--aif-primary);
    opacity: 0.85;
    flex-shrink: 0;
  }

  .aif-results-disclaimer {
    flex-shrink: 0;
    margin: 0;
    padding: 6px 8px;
    font-size: 10px;
    line-height: 1.4;
    color: var(--aif-text-muted);
    background: var(--aif-accent-soft);
    border: 1px solid var(--aif-border);
    border-radius: 8px;
  }

  /* Results: drawer chrome removed — close lives in results header */
  .aif-container[data-aif-view="RESULTS"] .aif-drawer-chrome {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-content {
    padding: 8px 8px max(8px, var(--aif-safe-bottom, 0px));
    overflow-x: hidden;
    overflow-y: hidden;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-widget-footer {
    display: none !important;
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
  .aif-results-panel {
    padding: 10px;
    border-radius: var(--aif-radius-sm);
    background: var(--aif-bg-elevated);
    border: 1px solid var(--aif-border);
    box-shadow: 0 2px 12px rgba(44, 36, 28, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aif-results-panel__label {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--aif-text-muted);
  }

  .aif-result-actions__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .aif-result-actions__label {
    line-height: 1.2;
  }

  .aif-result-actions__btn--icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
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
    padding: 10px 12px;
    font-size: 12px;
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
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease;
  }

  .aif-result-actions__btn:hover:not(:disabled) {
    border-color: #d4c4ae;
    background: #fffdf9;
  }

  .aif-result-actions__btn:active:not(:disabled) {
    background: var(--aif-accent-soft);
    transform: scale(0.98);
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

  .aif-result-actions__btn--primary:hover:not(:disabled) {
    background: linear-gradient(165deg, #b8891f 0%, #967515 55%, var(--aif-primary-hover) 100%);
    border-color: var(--aif-primary-hover);
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

  .aif-result-actions__btn--save {
    border: 1px solid var(--aif-border);
    color: var(--aif-text-main);
    background: var(--aif-bg-panel);
    font-weight: 600;
    font-size: 12px;
    padding: 10px 12px;
  }

  .aif-result-actions__btn--save .aif-result-actions__icon {
    color: var(--aif-primary);
  }

  .aif-result-actions__btn--save:hover:not(:disabled) {
    border-color: var(--aif-primary);
    background: var(--aif-accent-soft);
  }

  .aif-result-actions__btn--save:active:not(:disabled) {
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

  /* Results: block layout — preview grows to fill leftover drawer space */
  .aif-results-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
    box-sizing: border-box;
  }

  .aif-results-view > * + * {
    margin-top: 10px;
  }

  @keyframes aif-results-in {
    from {
      transform: translateY(6px);
    }
    to {
      transform: translateY(0);
    }
  }

  .aif-results-lede {
    animation: aif-results-in 0.45s ease forwards;
  }

  .aif-results-grid {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    opacity: 1;
    visibility: visible;
  }

  .aif-results-save {
    flex-shrink: 0;
    width: 100%;
    overflow: visible;
    animation: aif-results-in 0.5s ease 0.12s forwards;
  }

  .aif-results-training {
    flex-shrink: 0;
    width: 100%;
    margin-bottom: 10px;
    animation: aif-results-in 0.5s ease 0.1s forwards;
  }

  .aif-results-training__info {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--aif-text-muted, #64748b);
  }

  .aif-results-training__done {
    margin: 0;
    font-size: 13px;
    color: #b45309;
    font-weight: 600;
  }

  .aif-results-training__actions {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .aif-results-training__actions .aif-result-actions__btn {
    flex: 1;
  }

  .aif-results-footer {
    flex-shrink: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    animation: aif-results-in 0.5s ease 0.18s forwards;
  }

  .aif-result-preview-block {
    position: relative;
    flex: 1 1 auto;
    min-height: 180px;
    width: 100%;
    padding: 0;
    border-radius: var(--aif-radius-sm);
    background: var(--aif-bg-elevated);
    box-shadow: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* Height driven by Slider JS — fills the flex preview area */
  .aif-result-preview-block .aif-slider,
  .aif-slider--results {
    display: block;
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    min-height: 120px;
    margin: 0 auto;
    opacity: 1;
    visibility: visible;
    border-radius: var(--aif-radius-sm);
  }

  .aif-result-preview-block .aif-results-fallback-img {
    display: block;
    flex: 1 1 auto;
    width: 100%;
    min-height: 160px;
    object-fit: cover;
    object-position: center;
    border-radius: var(--aif-radius-sm);
    background: #f5f0e8;
    margin: 0 auto;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-results-footer {
    gap: 4px;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-results-disclaimer {
    padding: 5px 7px;
    font-size: 9px;
    line-height: 1.35;
  }

  .aif-container[data-aif-view="RESULTS"] .aif-results-panel {
    padding: 8px;
    gap: 6px;
  }

  /* Before / after slider */
  .aif-slider {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: var(--aif-radius-sm);
    background: var(--aif-bg-elevated);
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    box-shadow: none;
  }

  .aif-slider--results {
    background: var(--aif-bg-elevated);
  }

  .aif-slider__img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    object-fit: contain;
    object-position: center center;
  }

  .aif-slider--results .aif-slider__img {
    object-fit: contain;
    object-position: center center;
  }

  .aif-slider__img--before {
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .aif-slider__img--after {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    max-width: none;
  }

  .aif-slider__after-clip {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 50%;
    overflow: hidden;
    pointer-events: none;
    will-change: width;
  }

  .aif-slider__label {
    position: absolute;
    top: 12px;
    z-index: 5;
    pointer-events: none;
    padding: 5px 10px;
    border-radius: 6px;
    font-family: var(--aif-font);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  .aif-slider__label--before {
    right: 12px;
    background: rgba(44, 36, 28, 0.72);
    color: #faf8f5;
  }

  .aif-slider__label--after {
    left: 12px;
    background: rgba(139, 105, 20, 0.88);
    color: #fffaf2;
  }

  .aif-slider__divider-wrap {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: ew-resize;
    z-index: 10;
    will-change: left;
  }

  .aif-slider__divider {
    width: 2px;
    height: 100%;
    background: linear-gradient(
      180deg,
      rgba(255, 250, 242, 0.5),
      rgba(255, 250, 242, 1),
      rgba(255, 250, 242, 0.5)
    );
    box-shadow: 0 0 8px rgba(44, 36, 28, 0.25);
    pointer-events: none;
  }

  .aif-slider__handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
    background: #fffdf9;
    border: 1px solid var(--aif-border);
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(44, 36, 28, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    color: var(--aif-primary);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    pointer-events: none;
  }

  .aif-slider__handle svg:last-child {
    margin-left: -6px;
  }

  .aif-slider__handle--active,
  .aif-slider--dragging .aif-slider__handle {
    transform: translate(-50%, -50%) scale(1.08);
    box-shadow: 0 6px 20px rgba(44, 36, 28, 0.22);
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
      min-height: 44px;
      padding: 6px 10px 4px;
    }

    .aif-close-btn {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      margin: 0;
    }

    .aif-close-btn svg {
      width: 15px;
      height: 15px;
    }

    .aif-content {
      padding: 10px 14px 8px;
      overflow: hidden;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-content {
      padding: 6px 10px 8px;
      overflow: hidden;
    }

    .aif-results-lede {
      padding-bottom: 6px;
    }

    .aif-results-title {
      font-size: 16px;
    }

    .aif-result-preview-block .aif-slider,
    .aif-result-preview-block .aif-results-fallback-img {
      min-height: 120px;
    }

    .aif-content > .aif-results-view {
      max-width: 100%;
      overflow: hidden;
    }

    /* Compact the action stack on phones so the preview + buttons fit
       inside the drawer without scrolling. */
    .aif-container[data-aif-view="RESULTS"] .aif-results-view > * + * {
      margin-top: 6px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-results-panel {
      padding: 6px;
      gap: 4px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-result-actions__btn {
      padding: 8px 10px;
      min-height: 40px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-results-hint {
      margin-top: 2px;
      font-size: 11px;
    }

    .aif-container[data-aif-view="RESULTS"] .aif-results-disclaimer {
      display: none;
    }

    .aif-widget-footer {
      padding: 6px 14px 8px;
    }

    .aif-header h2 {
      font-size: 17px;
    }

    .aif-header p {
      font-size: 13px;
      line-height: 1.35;
    }

    .aif-btn-primary,
    .aif-btn-secondary {
      padding: 11px 14px;
      font-size: 14px;
    }

    .aif-dropzone {
      padding: 20px 14px;
    }

    /* Measure / analyse: fit one screen — no outer scroll */
    .aif-measure-view,
    .aif-analyze-view,
    .aif-upload-view {
      overflow: hidden;
    }

    .aif-measure-stage {
      overflow: hidden;
      gap: 10px;
    }

    .aif-measure-thumb {
      max-height: 110px;
      aspect-ratio: 16 / 9;
      flex-shrink: 0;
    }

    .aif-measure-chips {
      gap: 6px;
    }

    .aif-measure-chip {
      padding: 8px 10px;
      font-size: 13px;
      min-height: 40px;
    }

    .aif-measure-tip {
      display: none;
    }

    .aif-analyze-view {
      overflow: hidden;
      gap: 10px;
      padding-bottom: 0;
    }

    .aif-analyze-room {
      max-height: 120px;
      aspect-ratio: 16 / 9;
      flex-shrink: 0;
    }

    .aif-upload-view .aif-dropzone {
      padding: 18px 12px;
    }

    .aif-upload-view .aif-upload-stage img {
      max-height: min(28dvh, 180px);
    }
  }

  /* Extra-short phones / landscape */
  @media (max-width: 768px) and (max-height: 700px) {
    .aif-measure-thumb {
      max-height: 72px;
    }

    .aif-analyze-room {
      max-height: 88px;
    }

    .aif-drawer-chrome {
      min-height: 40px;
      padding: 4px 8px 2px;
    }

    .aif-header h2 {
      font-size: 15px;
    }

    .aif-measure-chip-heading,
    .aif-upload-privacy {
      display: none;
    }
  }

  /* Desktop: reclaim vertical space for results */
  @media (min-width: 769px) {
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
    z-index: 999998;
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

  #ai-furniture-trigger-btn.aif-trigger-btn.aif-trigger-btn--hidden {
    opacity: 0 !important;
    pointer-events: none !important;
    transform: translateY(14px) scale(0.96) !important;
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

  /* —— Measure / scale cue —— */
  .aif-measure-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    animation: aif-fade-in 0.35s ease;
  }

  .aif-measure-stage {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 4px;
  }

  .aif-measure-thumb {
    position: relative;
    border-radius: var(--aif-radius-sm);
    overflow: hidden;
    background: #efe8dc;
    border: 1px solid var(--aif-border);
    aspect-ratio: 16 / 10;
    max-height: 160px;
  }

  .aif-measure-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    filter: saturate(0.95);
  }

  .aif-measure-span {
    position: absolute;
    left: 14%;
    right: 14%;
    top: 52%;
    display: flex;
    align-items: center;
    gap: 0;
    pointer-events: none;
  }

  .aif-measure-span__line {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, transparent, #fff 12%, #fff 88%, transparent);
    box-shadow: 0 0 0 1px rgba(44, 36, 28, 0.2);
  }

  .aif-measure-span__cap {
    width: 2px;
    height: 14px;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(44, 36, 28, 0.25);
    flex-shrink: 0;
  }

  .aif-measure-span__label {
    position: absolute;
    left: 50%;
    top: -22px;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #fff;
    background: rgba(44, 36, 28, 0.72);
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .aif-measure-chip-heading {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--aif-text-muted);
  }

  .aif-measure-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .aif-measure-view .aif-header p strong {
    font-weight: 650;
    color: var(--aif-text-main);
  }

  .aif-measure-chip {
    border: 1px solid var(--aif-border);
    background: var(--aif-bg-elevated);
    color: var(--aif-text-main);
    border-radius: 999px;
    padding: 9px 14px;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--aif-font);
    cursor: pointer;
    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.15s ease;
  }

  .aif-measure-chip:hover {
    border-color: #cbb894;
    transform: translateY(-1px);
  }

  .aif-measure-chip.is-selected {
    background: var(--aif-primary);
    border-color: var(--aif-primary);
    color: #fff;
    box-shadow: 0 6px 16px rgba(139, 105, 20, 0.28);
  }

  .aif-measure-chip--ghost {
    font-weight: 500;
    color: var(--aif-text-muted);
  }

  .aif-measure-chip--ghost.is-selected {
    background: var(--aif-accent-soft);
    border-color: #d8c7a4;
    color: var(--aif-primary-dark);
    box-shadow: none;
  }

  .aif-measure-unit {
    font-size: 12px;
    font-weight: 600;
    color: var(--aif-text-muted);
    margin-left: 2px;
  }

  .aif-measure-custom {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .aif-measure-custom__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--aif-text-muted);
  }

  .aif-measure-custom__field {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--aif-bg-elevated);
    border: 1px solid var(--aif-border);
    border-radius: var(--aif-radius-sm);
    padding: 4px 12px 4px 14px;
    max-width: 200px;
  }

  .aif-measure-custom__field:focus-within {
    border-color: var(--aif-primary);
    box-shadow: 0 0 0 3px var(--aif-accent-glow);
  }

  .aif-measure-custom__input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 16px;
    font-weight: 600;
    font-family: var(--aif-font);
    color: var(--aif-text-main);
    min-width: 0;
    padding: 8px 0;
  }

  .aif-measure-custom__suffix {
    font-size: 13px;
    font-weight: 600;
    color: var(--aif-text-muted);
  }

  .aif-measure-tip {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--aif-text-muted);
  }

  .aif-measure-footer {
    margin-top: auto;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
  }

  .aif-measure-back {
    align-self: center;
    color: var(--aif-text-muted) !important;
  }

  /* —— Room analysis / processing —— */
  .aif-analyze-view {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    animation: aif-fade-in 0.4s ease;
    padding-bottom: 0;
  }

  .aif-analyze-header h2 {
    font-family: var(--aif-font-display);
  }

  .aif-analyze-visual {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .aif-analyze-room {
    position: relative;
    border-radius: var(--aif-radius-sm);
    overflow: hidden;
    border: 1px solid var(--aif-border);
    background: #2c241c;
    aspect-ratio: 16 / 10;
    max-height: 140px;
    flex-shrink: 0;
  }

  .aif-analyze-room img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0.88;
  }

  .aif-analyze-room--empty {
    background:
      linear-gradient(135deg, #3a3126 0%, #2c241c 50%, #1a1510 100%);
  }

  .aif-analyze-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(243, 234, 216, 0.12) 1px, transparent 1px),
      linear-gradient(90deg, rgba(243, 234, 216, 0.12) 1px, transparent 1px);
    background-size: 28px 28px;
    mix-blend-mode: screen;
    pointer-events: none;
    opacity: 0.55;
  }

  .aif-analyze-scan {
    position: absolute;
    left: 0;
    right: 0;
    height: 28%;
    background: linear-gradient(
      180deg,
      transparent,
      rgba(243, 234, 216, 0.22),
      transparent
    );
    animation: aif-analyze-scan 2.8s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes aif-analyze-scan {
    0% { top: -30%; }
    100% { top: 100%; }
  }

  .aif-analyze-meter {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .aif-analyze-meter__track {
    height: 7px;
    border-radius: 999px;
    background: #ebe3d6;
    overflow: hidden;
  }

  .aif-analyze-meter__fill {
    height: 100%;
    width: 0%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--aif-primary), #c4a35a);
    box-shadow: 0 0 12px var(--aif-accent-glow);
    transition: width 0.45s ease;
  }

  .aif-analyze-meter__label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--aif-text-muted);
  }

  .aif-analyze-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }

  .aif-analyze-step {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 6px 10px;
    border-radius: var(--aif-radius-sm);
    border: 1px solid transparent;
    transition: background 0.25s ease, border-color 0.25s ease, opacity 0.25s ease;
    flex-shrink: 1;
    min-height: 0;
  }

  .aif-analyze-step.is-pending {
    opacity: 0.4;
  }

  .aif-analyze-step.is-pending .aif-analyze-step__detail {
    display: none;
  }

  .aif-analyze-step.is-active {
    background: var(--aif-accent-soft);
    border-color: #e0d2b6;
    flex-shrink: 0;
  }

  .aif-analyze-step.is-done {
    opacity: 0.75;
  }

  .aif-analyze-step.is-done .aif-analyze-step__detail {
    display: none;
  }

  .aif-analyze-step__mark {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #cbb894;
    margin-top: 2px;
    flex-shrink: 0;
    position: relative;
    box-sizing: border-box;
  }

  .aif-analyze-step.is-active .aif-analyze-step__mark {
    border-color: var(--aif-primary);
    box-shadow: 0 0 0 3px var(--aif-accent-glow);
    animation: aif-analyze-pulse 1.4s ease-in-out infinite;
  }

  .aif-analyze-step.is-done .aif-analyze-step__mark {
    background: var(--aif-primary);
    border-color: var(--aif-primary);
  }

  .aif-analyze-step.is-done .aif-analyze-step__mark::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  @keyframes aif-analyze-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }

  .aif-analyze-step__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .aif-analyze-step__label {
    font-size: 13px;
    font-weight: 650;
    color: var(--aif-text-main);
  }

  .aif-analyze-step__detail {
    font-size: 12px;
    color: var(--aif-text-muted);
    line-height: 1.35;
  }

  .aif-analyze-hint {
    margin: 0;
    font-size: 12px;
    color: var(--aif-text-muted);
    text-align: center;
    line-height: 1.35;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .aif-analyze-scan,
    .aif-analyze-step.is-active .aif-analyze-step__mark {
      animation: none !important;
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
