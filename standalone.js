/**
 * AI Furniture Widget - Inline Version for Shopify
 * Self-contained, no build required, no external dependencies
 * Version: 2.0.0
 */

(function(window, document) {
  'use strict';
  
  // Check if already loaded
  if (window.__AIFurnitureLoaded) {
    console.log('AI Furniture Widget already loaded');
    return;
  }
  window.__AIFurnitureLoaded = true;
  
  // Get config
  const config = window.FURNITURE_AI_CONFIG || {};
  
  if (!config.domain || !config.domainId) {
    console.error('❌ AI Furniture Widget: Missing domain or domainId in config');
    return;
  }
  
  console.log('🚀 AI Furniture Widget: Initializing...', config);
  
  // Determine API endpoint
  const isLocal = window.location.hostname.includes('localhost') || 
                 window.location.hostname.includes('127.0.0.1');
  const apiEndpoint = config.apiEndpoint || (isLocal 
    ? 'http://localhost:3000/api' 
    : 'https://ai-furniture-backend.vercel.app/api');
  
  // Inject CSS
  const css = `
    #ai-furniture-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 14px 24px;
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      border: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #ai-furniture-btn:hover {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 12px 32px rgba(16, 185, 129, 0.45);
    }
    #ai-furniture-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #ai-furniture-modal.open {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .aif-panel {
      background: white;
      border-radius: 20px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
    }
    .aif-close {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      background: #f9fafb;
      border: none;
      border-radius: 50%;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .aif-close:hover {
      background: #111827;
      color: white;
      transform: scale(1.05);
    }
  `;
  
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  
  // Create button
  const button = document.createElement('button');
  button.id = 'ai-furniture-btn';
  button.innerHTML = '<span style="font-size: 20px;">✨</span><span>Visualize in Your Room</span>';
  button.onclick = () => {
    console.log('🎯 Widget button clicked');
    openModal();
  };
  document.body.appendChild(button);
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'ai-furniture-modal';
  modal.innerHTML = `
    <div class="aif-panel" style="position: relative;">
      <button class="aif-close" onclick="this.closest('#ai-furniture-modal').classList.remove('open')">×</button>
      <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">See This in Your Room</h2>
      <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">Upload a photo of your room and we'll show you how this furniture looks!</p>
      
      <div id="aif-upload-area" style="border: 2px dashed #d1d5db; border-radius: 12px; padding: 48px 24px; text-align: center; cursor: pointer; background: linear-gradient(135deg, #f9fafb, #ffffff);">
        <div style="font-size: 48px; margin-bottom: 16px;">📸</div>
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #111827;">Drop your room photo here</p>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">or click to browse</p>
        <input type="file" id="aif-file-input" accept="image/*" style="display: none;">
      </div>
      
      <button id="aif-generate-btn" style="width: 100%; margin-top: 24px; padding: 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; display: none;">
        Generate Preview
      </button>
      
      <div id="aif-result" style="margin-top: 24px; display: none;"></div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Modal functionality
  function openModal() {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  
  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // File upload handling
  const uploadArea = document.getElementById('aif-upload-area');
  const fileInput = document.getElementById('aif-file-input');
  const generateBtn = document.getElementById('aif-generate-btn');
  let uploadedFile = null;
  
  uploadArea.onclick = () => fileInput.click();
  
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    uploadedFile = file;
    uploadArea.innerHTML = `
      <img src="${URL.createObjectURL(file)}" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px;">
      <p style="color: #10b981; font-weight: 600; margin: 0;">✓ Room photo uploaded</p>
    `;
    generateBtn.style.display = 'block';
  };
  
  // Generate functionality
  generateBtn.onclick = async () => {
    if (!uploadedFile) return;
    
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;
    
    try {
      // Get product URL
      const productUrl = window.location.href;
      
      // Prepare form data
      const formData = new FormData();
      formData.append('userImage', uploadedFile);
      formData.append('productUrl', productUrl);
      formData.append('domain', config.domain);
      formData.append('domainId', config.domainId);
      
      console.log('🎨 Generating AI furniture visualization...');
      
      // Call API
      const response = await fetch(`${apiEndpoint}/generate`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
        credentials: 'omit',
      });
      
      if (!response.ok) {
        throw new Error('Generation failed');
      }
      
      const result = await response.json();
      console.log('✅ Generation complete:', result);
      
      // Show result
      const resultDiv = document.getElementById('aif-result');
      const originalUrl = result.generatedImages[0].originalImageUrl;
      const generatedUrl = result.generatedImages[0].url;
      
      resultDiv.innerHTML = `
        <div id="aif-slider" style="position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 4/3;">
          <img src="${originalUrl}" style="width: 100%; height: 100%; object-fit: cover; position: absolute;">
          <img src="${generatedUrl}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; clip-path: inset(0 50% 0 0);" id="aif-after-img">
          <div style="position: absolute; top: 16px; left: 16px; background: rgba(16, 185, 129, 0.9); color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700;">AFTER</div>
          <div style="position: absolute; top: 16px; right: 16px; background: rgba(0, 0, 0, 0.7); color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700;">BEFORE</div>
          <div id="aif-handle" style="position: absolute; top: 0; bottom: 0; left: 50%; width: 40px; transform: translateX(-50%); cursor: ew-resize; display: flex; align-items: center; justify-content: center;">
            <div style="width: 3px; height: 100%; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>
            <div style="position: absolute; width: 48px; height: 48px; background: white; border-radius: 50%; box-shadow: 0 4px 16px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
              <span style="color: #10b981; font-size: 20px; font-weight: bold;">⟷</span>
            </div>
          </div>
        </div>
        <p style="text-align: center; margin: 16px 0 0 0; color: #6b7280; font-size: 14px;">Drag the slider to compare</p>
      `;
      resultDiv.style.display = 'block';
      
      // Add slider functionality
      setTimeout(() => {
        const slider = document.getElementById('aif-slider');
        const afterImg = document.getElementById('aif-after-img');
        const handle = document.getElementById('aif-handle');
        let isDragging = false;
        
        const updatePosition = (clientX) => {
          const rect = slider.getBoundingClientRect();
          let percentage = ((clientX - rect.left) / rect.width) * 100;
          percentage = Math.max(0, Math.min(100, percentage));
          afterImg.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
          handle.style.left = `${percentage}%`;
        };
        
        handle.onmousedown = () => isDragging = true;
        document.onmousemove = (e) => isDragging && updatePosition(e.clientX);
        document.onmouseup = () => isDragging = false;
        
        handle.ontouchstart = () => isDragging = true;
        document.ontouchmove = (e) => isDragging && updatePosition(e.touches[0].clientX);
        document.ontouchend = () => isDragging = false;
      }, 100);
      
      generateBtn.textContent = 'Generate Another';
      generateBtn.disabled = false;
      
    } catch (error) {
      console.error('❌ Generation failed:', error);
      alert('Failed to generate. Please try again.');
      generateBtn.textContent = 'Generate Preview';
      generateBtn.disabled = false;
    }
  };
  
  console.log('✅ AI Furniture Widget: Ready!');
  
})(window, document);
