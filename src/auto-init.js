// auto-init.js
// This file automatically initializes the widget when loaded
import { initAIFurnitureWidget } from './index.js';

// Auto-initialize on script load
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Wait for DOMContentLoaded if document is still loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAIFurnitureWidget(window.FURNITURE_AI_CONFIG || {});
        });
    } else {
        initAIFurnitureWidget(window.FURNITURE_AI_CONFIG || {});
    }
}
