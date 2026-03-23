/**
 * AI Furniture Widget - Standalone Loader
 * No build required - loads all modules dynamically
 */

(function() {
  'use strict';
  
  console.log('🔧 AI Furniture Widget Loader: Starting...');
  
  // Check if config exists
  if (!window.FURNITURE_AI_CONFIG) {
    console.error('❌ FURNITURE_AI_CONFIG not found');
    return;
  }
  
  console.log('✅ Config found:', window.FURNITURE_AI_CONFIG);
  
  // Determine API endpoint based on environment
  const config = window.FURNITURE_AI_CONFIG;
  const isLocalMode = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
  
  const apiEndpoint = config.apiEndpoint || (isLocalMode 
    ? 'http://localhost:3000/api' 
    : 'https://ai-furniture-backend.vercel.app/api');
  
  console.log('🔗 API Endpoint:', apiEndpoint);
  
  // Load the bundled widget from CDN
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { initAIFurnitureWidget } from 'https://cdn.jsdelivr.net/gh/YOUR_USERNAME/ai-furniture-widget@main/src/index.js';
    
    console.log('📦 Widget module loaded via CDN');
    
    // Initialize with config
    if (window.FURNITURE_AI_CONFIG) {
      initAIFurnitureWidget(window.FURNITURE_AI_CONFIG);
    }
  `;
  
  document.head.appendChild(script);
  
})();
