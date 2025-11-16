(function() {
  'use strict';
  
  // Configuration - customer sets these
  const config = {
    domain: 'CUSTOMER_DOMAIN_HERE', // Customer replaces this
    apiEndpoint: 'https://aifurniture.app/api/tracking/pixel',
    widgetEndpoint: 'https://aifurniture.app/furniture',
    debug: false // Set to true for testing
  };
  
  // Generate unique session ID
  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Get or create session ID
  let sessionId = sessionStorage.getItem('ai_furniture_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('ai_furniture_session_id', sessionId);
  }
  
  // Debug logging function
  function debugLog(message, data) {
    if (config.debug) {
      console.log('[AI Furniture Widget]', message, data || '');
    }
  }
  
  debugLog('Widget script loaded', { domain: config.domain, sessionId });

  // Quick domain verification - prevent unauthorized usage
  function verifyDomain() {
    const currentHostname = window.location.hostname;
    const configuredDomain = config.domain;
    
    // If domain is still placeholder, show error
    if (configuredDomain === 'CUSTOMER_DOMAIN_HERE') {
      console.error('🚫 AI Furniture Widget: Domain not configured. Please set your domain in the widget configuration.');
      return false;
    }
    
    // Check if current domain matches configured domain (handle www variants)
    const normalizedCurrent = currentHostname.replace(/^www\./, '');
    const normalizedConfigured = configuredDomain.replace(/^www\./, '').replace(/^https?:\/\//, '');
    
    if (normalizedCurrent !== normalizedConfigured) {
      console.error('🚫 AI Furniture Widget: Unauthorized domain. Widget is configured for "' + configuredDomain + '" but running on "' + currentHostname + '"');
      return false;
    }
    
    return true;
  }

  // Verify domain before proceeding
  if (!verifyDomain()) {
    return; // Stop widget initialization
  }

  // Additional server-side verification (optional - for extra security)
  async function verifyDomainWithServer() {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`https://aifurniture.app/api/tracking/script?domain=${encodeURIComponent(window.location.hostname)}&debug=${config.debug}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/javascript',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error('🚫 AI Furniture Widget: Domain not authorized by server. Status:', response.status);
        return false;
      }
      
      console.log('✅ AI Furniture Widget: Domain verified by server');
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('⚠️ AI Furniture Widget: Server verification timeout, proceeding with client-side verification only');
      } else {
        console.warn('⚠️ AI Furniture Widget: Could not verify domain with server, proceeding with client-side verification only:', error.message);
      }
      return true; // Proceed if server check fails (network issues, etc.)
    }
  }
  
  // Track data to server
  function trackEvent(eventType, data = {}) {
    console.log('📡 TRACK EVENT CALLED:', {
      eventType: eventType,
      currentUrl: window.location.href,
      currentPage: window.location.pathname + window.location.search
    });
    
    // Check if tracking has been disconnected due to session timeout
    const trackingDisconnected = sessionStorage.getItem('tracking_disconnected') === 'true';
    console.log('🔍 TRACKING STATUS CHECK:', {
      trackingDisconnected: trackingDisconnected,
      eventType: eventType,
      willSendEvent: !trackingDisconnected
    });
    
    if (trackingDisconnected) {
      console.log('❌ Tracking already disconnected - skipping event:', eventType);
      debugLog('Skipping tracking - session has timed out and tracking disconnected');
      return;
    }
    
    // Build URL with parameters for pixel tracking
    const params = new URLSearchParams({
      sessionId: sessionId,
      domain: config.domain,
      eventType: eventType,
      page: window.location.pathname + window.location.search,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      title: document.title,
      url: window.location.href
    });
    
    // Add custom data parameters
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        params.append(`data_${key}`, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    }
    
    const pixelUrl = `${config.apiEndpoint}?${params.toString()}`;
    
    console.log('📤 SENDING PIXEL REQUEST TO BACKEND:', {
      url: pixelUrl,
      eventType: eventType,
      paramsCount: params.toString().split('&').length
    });
    
    debugLog('Pixel tracking URL', pixelUrl);
    
    // Create and load pixel image (no CORS issues!)
    const img = new Image();
    img.onload = function() {
      debugLog('Pixel loaded successfully', { eventType });
      console.log('✅ Pixel tracking successful:', eventType);
      
      // For order confirmation events, we need to handle the special response
      // Since pixels can't return JSON, we'll use a different approach
      if (eventType === 'order_confirmation_detected' || eventType === 'order_page_visit') {
        // Check if this is an order confirmation page
        const currentUrl = window.location.href;
        const isOrderConfirmation = currentUrl.includes('confirmation') || 
                                   currentUrl.includes('success') || 
                                   currentUrl.includes('thank') ||
                                   currentUrl.includes('complete');
        
        if (isOrderConfirmation) {
          // Extract order ID from URL if possible
          const orderMatch = currentUrl.match(/[?&]order[=_-]([A-Z0-9-]+)/i);
          const orderId = orderMatch ? orderMatch[1] : null;
          
          if (orderId) {
            console.log('✅ Order confirmation detected via pixel - waiting for backend processing');
            debugLog('Order confirmation detected via pixel - waiting for backend processing', { orderId });
            
            // Wait for backend to process the order before disconnecting
            setTimeout(() => {
              console.log('⏰ Delaying tracking disconnection by 10 seconds to allow order processing...');
              onOrderAddedToDatabase({
                orderId: orderId,
                amount: 0, // Will be updated by backend
                currency: 'USD',
                productUrl: currentUrl,
                status: 'completed'
              });
            }, 10000); // 10 second delay to allow backend processing
          }
        }
      }
    };
    
    img.onerror = function() {
      debugLog('Pixel failed to load', { eventType });
      console.error('❌ Pixel tracking failed:', eventType);
    };
    
    // Set source to trigger the request
    img.src = pixelUrl;
  }
  
  // Check if current page is a furniture product page
  function isFurnitureProductPage() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = document.body.textContent.toLowerCase();
    
    // Check for furniture-related keywords
    const furnitureKeywords = [
      'sofa', 'couch', 'chair', 'table', 'bed', 'desk', 'cabinet', 'shelf',
      'dresser', 'nightstand', 'wardrobe', 'ottoman', 'bench', 'stool',
      'armchair', 'dining', 'bedroom', 'living', 'furniture', 'product'
    ];
    
    // Check if page has product indicators
    const hasProductIndicators = 
      document.querySelector('[data-product-id]') ||
      document.querySelector('.product') ||
      document.querySelector('#product') ||
      document.querySelector('[class*="product"]') ||
      document.querySelector('[id*="product"]');
    
    // Check for price indicators
    const hasPrice = 
      document.querySelector('[class*="price"]') ||
      document.querySelector('[id*="price"]') ||
      /\$[\d,]+/.test(bodyText) ||
      /£[\d,]+/.test(bodyText) ||
      /€[\d,]+/.test(bodyText);
    
    // Check for furniture keywords in URL, title, or content
    const hasFurnitureKeywords = furnitureKeywords.some(keyword => 
      url.includes(keyword) || title.includes(keyword) || bodyText.includes(keyword)
    );
    
    return hasProductIndicators && hasPrice && hasFurnitureKeywords;
  }
  
  // Create AI Furniture widget button
  function createWidgetButton() {
    // Check if button already exists
    if (document.querySelector('#ai-furniture-widget')) {
      return;
    }
    
    // Only show on furniture product pages
    if (!isFurnitureProductPage()) {
      debugLog('Not a furniture product page, skipping widget');
      return;
    }
    
    debugLog('Creating AI Furniture widget');
    
    // Create button element
    const button = document.createElement('button');
    button.id = 'ai-furniture-widget';
    button.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #f59e0b, #ea580c);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 12px 20px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        See in Your Room
      </div>
    `;
    
    // Add hover effects
    button.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
    });
    
    // Handle click
    button.addEventListener('click', function() {
      handleWidgetClick();
    });
    
    // Find best position to insert button
    const productContainer = 
      document.querySelector('.product-details') ||
      document.querySelector('.product-info') ||
      document.querySelector('.product-description') ||
      document.querySelector('[class*="product"]') ||
      document.querySelector('main') ||
      document.querySelector('#main') ||
      document.body;
    
    // Insert button
    if (productContainer) {
      productContainer.appendChild(button);
      debugLog('Widget button added to page');
      
      // No tracking of widget display - only track after AI Furniture usage
    }
  }
  
  // Handle widget click
  function handleWidgetClick() {
    debugLog('Widget clicked');
    
    // Store original product URL in session storage for return tracking
    sessionStorage.setItem('ai_furniture_original_url', window.location.href);
    
    // Don't track initial widget click - only track when user returns
    debugLog('Widget clicked - no tracking until user returns from AI Furniture');
    
    // Get current product information
    const productInfo = {
      url: window.location.href,
      title: document.title,
      domain: config.domain,
      sessionId: sessionId,
      referrer: document.referrer
    };
    
    // Create AI Furniture URL with product info
    const aiFurnitureUrl = new URL(config.widgetEndpoint);
    aiFurnitureUrl.searchParams.set('ref', config.domain);
    aiFurnitureUrl.searchParams.set('product_url', encodeURIComponent(productInfo.url));
    aiFurnitureUrl.searchParams.set('product_title', encodeURIComponent(productInfo.title));
    aiFurnitureUrl.searchParams.set('session_id', sessionId);
    
    // Open AI Furniture page in modal instead of new window
    openFurnitureModal(aiFurnitureUrl.toString());
    
    // No tracking of redirect - only track when user returns
  }

  // Open AI Furniture page in modal
  function openFurnitureModal(url) {
    debugLog('Opening furniture modal with URL:', url);
    
    // Check if modal already exists
    if (document.querySelector('#ai-furniture-modal')) {
      debugLog('Modal already exists, removing it first');
      closeFurnitureModal();
    }
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'ai-furniture-modal';
    modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    // Create modal container - compact and stylish
    const modalContainer = document.createElement('div');
    modalContainer.style.cssText = `
      position: relative;
      width: 90%;
      max-width: 900px;
      height: 80%;
      max-height: 600px;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 20px;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
      overflow: hidden;
      transform: scale(0.9);
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    // Add mobile responsiveness
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      modalContainer.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        border-radius: 0;
        box-shadow: none;
        overflow: hidden;
        transform: scale(0.9);
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        backdrop-filter: blur(20px);
        border: none;
      `;
    }
    
    // Create stylish close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.9));
      color: #64748b;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 50%;
      font-size: 20px;
      font-weight: 300;
      cursor: pointer;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    `;
    
    // Make close button larger on mobile
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
    }
    
    closeButton.addEventListener('mouseenter', function() {
      this.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))';
      this.style.color = 'white';
      this.style.transform = 'scale(1.1)';
      this.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.3)';
    });
    
    closeButton.addEventListener('mouseleave', function() {
      this.style.background = isMobile ? 
        'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95))' :
        'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.9))';
      this.style.color = '#64748b';
      this.style.transform = 'scale(1)';
      this.style.boxShadow = isMobile ? '0 6px 16px rgba(0, 0, 0, 0.15)' : '0 4px 12px rgba(0, 0, 0, 0.1)';
    });
    
    closeButton.addEventListener('click', closeFurnitureModal);
    
    // Create iframe with compact styling
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 16px;
      background: white;
    `;
    
    // Add stylish loading indicator
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
    
    // Assemble modal
    modalContainer.appendChild(closeButton);
    modalContainer.appendChild(loadingDiv);
    modalContainer.appendChild(iframe);
    modalOverlay.appendChild(modalContainer);
    
    // Add to document
    document.body.appendChild(modalOverlay);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Animate in
    setTimeout(() => {
      modalOverlay.style.opacity = '1';
      modalContainer.style.transform = 'scale(1)';
    }, 10);
    
    // Remove loading indicator when iframe loads
    iframe.addEventListener('load', function() {
      setTimeout(() => {
        if (loadingDiv.parentNode) {
          loadingDiv.remove();
        }
      }, 500);
    });
    
    // Listen for messages from iframe (for when user completes AI furniture process)
    const handleMessage = function(event) {
      // Only accept messages from our AI furniture domain
      if (event.origin !== 'https://aifurniture.app' && event.origin !== 'http://localhost:3000') {
        return;
      }
      
      debugLog('Received message from iframe:', event.data);
      
      if (event.data && event.data.type === 'ai_furniture_completed') {
        debugLog('AI Furniture process completed, closing modal and handling return');
        
        // Mark user as having used AI Furniture
        sessionStorage.setItem('ai_furniture_user', 'true');
        
        // Close the modal
        closeFurnitureModal();
        
        // Handle the return flow (same as when user returns from new window)
        if (event.data.orderData) {
          trackOrderCompletion(event.data.orderData);
        } else {
          // Just mark as returned from AI Furniture
          const returnData = {
            sessionId: sessionId,
            returnTimestamp: new Date().toISOString(),
            productUrl: window.location.href,
            sourceDomain: config.domain
          };
          
          trackEvent('ai_furniture_return', returnData);
        }
      } else if (event.data && event.data.type === 'ai_furniture_close') {
        debugLog('AI Furniture modal close requested');
        
        // Just close the modal without tracking
        closeFurnitureModal();
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Store message handler for cleanup
    modalOverlay._messageHandler = handleMessage;
    
    // Handle escape key
    const handleEscape = function(e) {
      if (e.key === 'Escape') {
        closeFurnitureModal();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    // Store escape handler for cleanup
    modalOverlay._escapeHandler = handleEscape;
    
    // Handle clicks outside modal
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) {
        closeFurnitureModal();
      }
    });
    
    debugLog('Furniture modal opened successfully');
  }

  // Close AI Furniture modal
  function closeFurnitureModal() {
    const modal = document.querySelector('#ai-furniture-modal');
    if (!modal) return;
    
    debugLog('Closing furniture modal');
    
    // Remove escape key listener
    if (modal._escapeHandler) {
      document.removeEventListener('keydown', modal._escapeHandler);
    }
    
    // Remove message handler
    if (modal._messageHandler) {
      window.removeEventListener('message', modal._messageHandler);
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Animate out
    modal.style.opacity = '0';
    const modalContainer = modal.querySelector('div');
    if (modalContainer) {
      modalContainer.style.transform = 'scale(0.9)';
    }
    
    // Remove modal after animation
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
    
    debugLog('Furniture modal closed successfully');
  }
  
  // Track order completion (called when user returns from AI Furniture)
  function trackOrderCompletion(orderData) {
    debugLog('Order completion tracked', orderData);
    
    // Only track if user has used AI Furniture
    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';
    if (!isAIFurnitureUser) {
      console.log('❌ Skipping order completion tracking - user has not used AI Furniture');
      debugLog('Skipping order completion tracking - user has not used AI Furniture');
      return;
    }
    
    const eventData = {
      orderAmount: orderData.amount,
      orderId: orderData.orderId,
      currency: orderData.currency || 'USD',
      productUrl: orderData.productUrl,
      sessionId: sessionId
    };
    
    // Add AI Furniture user tracking
    const aiFurnitureSessionId = sessionStorage.getItem('ai_furniture_session_id');
      eventData.aiFurnitureUser = true;
      eventData.aiFurnitureSessionId = aiFurnitureSessionId;
      eventData.eventType = 'ai_furniture_user_order_completed';
    
    trackEvent('order_completed', eventData);
    
    
    // Don't disconnect tracking immediately - wait for order to be added to database
    debugLog('Order completion tracked - continuing to track until order confirmed in database');
  }
  
  // Function to disconnect all tracking immediately
  function disconnectAllTracking() {
    console.log('🔌 DISCONNECTING ALL TRACKING - ORDER COMPLETED!');
    debugLog('Disconnecting all tracking - order completed');
    
    // Mark tracking as disconnected
    sessionStorage.setItem('tracking_disconnected', 'true');
    sessionStorage.setItem('order_completed_at', new Date().toISOString());
    sessionStorage.setItem('order_completion_reason', 'order_placed');
    console.log('✅ Tracking marked as disconnected in sessionStorage');
    
    // No event listeners to remove - simplified tracking
    
    // Reset widget after a short delay to allow order tracking to complete
    setTimeout(() => {
      resetWidget();
    }, 2000); // 2 second delay to ensure order is tracked
  }
  
  // Function to reset the widget completely
  function resetWidget() {
    console.log('🔄 RESETTING WIDGET - CLEARING ALL TRACKING STATE!');
    debugLog('Resetting widget - clearing all tracking state');
    
    // Clear all tracking-related session storage
    sessionStorage.removeItem('ai_furniture_user');
    sessionStorage.removeItem('ai_furniture_session_id');
    sessionStorage.removeItem('aifurniture_session_id');
    sessionStorage.removeItem('tracking_disconnected');
    sessionStorage.removeItem('order_completed_at');
    sessionStorage.removeItem('order_completion_reason');
    sessionStorage.removeItem('session_ended_at');
    sessionStorage.removeItem('ai_furniture_original_url');
    
    // Remove any existing widget button to start fresh
    const existingWidget = document.querySelector('#ai-furniture-widget');
    if (existingWidget) {
      existingWidget.remove();
      console.log('🗑️ Removed existing widget button');
    }
    
    // Generate new session ID for fresh start
    sessionId = generateSessionId();
    sessionStorage.setItem('ai_furniture_session_id', sessionId);
    
    debugLog('Widget reset complete - user can now use AI Furniture widget again', {
      newSessionId: sessionId
    });
    
    // Show a brief success message
    showResetMessage();
    
    // Re-create the widget button for the new session
    setTimeout(() => {
      createWidgetButton();
      console.log('🔄 Widget button recreated for new session');
    }, 1000);
  }
  
  // Function to show reset success message
  function showResetMessage() {
    // Create a temporary success message
    const message = document.createElement('div');
    message.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: slideIn 0.3s ease-out;
      ">
        ✅ Order completed! AI Furniture widget refreshed for new session
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    
    document.body.appendChild(message);
    
    // Remove message after 4 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 4000);
  }
  
  // Function to be called when order is successfully added to database
  function onOrderAddedToDatabase(orderData) {
    console.log('🎉 ORDER CONFIRMED IN DATABASE - disconnecting tracking immediately', orderData);
    debugLog('Order successfully added to database - disconnecting tracking immediately', orderData);
    
    // Disconnect tracking immediately when order is confirmed in database
    disconnectAllTracking();
  }
  
  // Make the function globally available for backend to call
  window.onOrderAddedToDatabase = onOrderAddedToDatabase;
  

  
  // Detect cart and order pages
  function detectCartAndOrderPages() {
    // Only track if user has used AI Furniture
    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';
    if (!isAIFurnitureUser) {
      console.log('❌ Skipping cart/order page detection - user has not used AI Furniture');
      debugLog('Skipping cart/order page detection - user has not used AI Furniture');
      return;
    }
    
    const currentUrl = window.location.href.toLowerCase();
    const currentPath = window.location.pathname.toLowerCase();
    const pageTitle = document.title.toLowerCase();
    const bodyText = document.body.textContent.toLowerCase();
    
    // Cart page detection patterns
    const cartPatterns = [
      // URL patterns
      /\/cart/,
      /\/basket/,
      /\/shopping-cart/,
      /\/checkout\/cart/,
      /\/cart\.html/,
      /\/basket\.html/,
      /\/shopping-cart\.html/,
      // Query parameters
      /[?&]cart/,
      /[?&]basket/,
      /[?&]add-to-cart/,
      // Page title patterns
      /cart/,
      /basket/,
      /shopping cart/,
      /your cart/,
      /shopping bag/,
      // Body text patterns
      /cart total/,
      /basket total/,
      /shopping cart/,
      /proceed to checkout/,
      /update cart/,
      /remove from cart/,
      /empty cart/,
      /cart is empty/
    ];
    
    // Order/checkout page detection patterns
    const orderPatterns = [
      // URL patterns
      /\/checkout/,
      /\/order/,
      /\/payment/,
      /\/billing/,
      /\/shipping/,
      /\/review/,
      /\/confirm/,
      /\/success/,
      /\/thank-you/,
      /\/order-confirmation/,
      /\/checkout\/success/,
      /\/order\/success/,
      /\/payment\/success/,
      /\/checkout\.html/,
      /\/order\.html/,
      /\/payment\.html/,
      /\/success\.html/,
      /\/thank-you\.html/,
      // Query parameters
      /[?&]checkout/,
      /[?&]order/,
      /[?&]payment/,
      /[?&]success/,
      /[?&]order_id/,
      /[?&]transaction_id/,
      // Page title patterns
      /checkout/,
      /order/,
      /payment/,
      /billing/,
      /shipping/,
      /review order/,
      /order confirmation/,
      /payment confirmation/,
      /thank you/,
      /order successful/,
      /payment successful/,
      // Body text patterns
      /billing information/,
      /shipping information/,
      /payment method/,
      /order summary/,
      /total amount/,
      /place order/,
      /complete purchase/,
      /order confirmed/,
      /payment successful/,
      /thank you for your order/,
      /order number/,
      /confirmation number/,
      /transaction id/
    ];
    
    // Check for cart page
    const isCartPage = cartPatterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(currentUrl) || pattern.test(currentPath) || 
               pattern.test(pageTitle) || pattern.test(bodyText);
      }
      return false;
    });
    
    // Check for order/checkout page
    const isOrderPage = orderPatterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(currentUrl) || pattern.test(currentPath) || 
               pattern.test(pageTitle) || pattern.test(bodyText);
      }
      return false;
    });
    
    // Determine page type
    let pageType = 'product';
    if (isCartPage) {
      pageType = 'cart';
    } else if (isOrderPage) {
      pageType = 'order';
    }
    
    // Track cart/order page visits
    if (isCartPage || isOrderPage) {
      const eventData = {
        pageType: pageType,
        url: window.location.href,
        title: document.title,
        detectedBy: 'generalized_detection'
      };
      
      // Add AI Furniture user tracking (we already know user has used AI Furniture)
      const aiFurnitureSessionId = sessionStorage.getItem('ai_furniture_session_id');
        eventData.aiFurnitureUser = true;
        eventData.aiFurnitureSessionId = aiFurnitureSessionId;
        eventData.eventType = `ai_furniture_user_${pageType}_page_visit`;
      
      trackEvent(`${pageType}_page_visit`, eventData);
      
      debugLog(`${pageType} page detected:`, {
        url: window.location.href,
        title: document.title,
        pageType: pageType,
        aiFurnitureUser: isAIFurnitureUser
      });
      
      // If this is an order confirmation page, continue tracking until order is in database
      if (isOrderPage && (currentUrl.includes('success') || currentUrl.includes('thank') || 
          currentUrl.includes('confirmation') || currentUrl.includes('complete'))) {
        debugLog('Order confirmation page detected - continuing to track until order confirmed in database');
      }
    }
    
    return {
      isCartPage,
      isOrderPage,
      pageType
    };
  }
  
  // Helper functions removed to prevent issues

  // Check for order completion in URL parameters (when user returns from AI Furniture)
  function checkForOrderCompletion() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderAmount = urlParams.get('order_amount');
    const orderId = urlParams.get('order_id');
    const currency = urlParams.get('currency');
    const productUrl = urlParams.get('product_url');
    const aiFurnitureReturned = urlParams.get('ai_furniture_returned');
    const aiFurnitureSession = urlParams.get('ai_furniture_session');
    
    // Track return from AI Furniture - THIS IS WHERE TRACKING STARTS
    if (aiFurnitureReturned === 'true' && aiFurnitureSession) {
      debugLog('User returned from AI Furniture - starting tracking');
      
      // Mark this session as having used AI Furniture
      sessionStorage.setItem('ai_furniture_user', 'true');
      sessionStorage.setItem('ai_furniture_session_id', aiFurnitureSession);
      
      // NOW start tracking - this is the first tracking event
      trackEvent('ai_furniture_return', {
        sessionId: aiFurnitureSession,
        returnTimestamp: urlParams.get('ai_furniture_timestamp'),
        productUrl: window.location.href,
        sourceDomain: config.domain
      });
      
      
      // AI Furniture user tracking simplified
      
      // Clean up AI Furniture tracking parameters
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('ai_furniture_returned');
      newUrl.searchParams.delete('ai_furniture_session');
      newUrl.searchParams.delete('ai_furniture_timestamp');
      window.history.replaceState({}, '', newUrl.toString());
    }
    
    // Track order completion
    if (orderAmount && orderId) {
      trackOrderCompletion({
        amount: parseFloat(orderAmount),
        orderId: orderId,
        currency: currency || 'USD',
        productUrl: productUrl
      });
      
      // Clean up order parameters
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('order_amount');
      newUrl.searchParams.delete('order_id');
      newUrl.searchParams.delete('currency');
      newUrl.searchParams.delete('product_url');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }
  
  // Track order confirmation pages with order IDs to let backend create orders
  function trackOrderConfirmationPage() {
    // This function is only called if user has already used AI Furniture
    const currentPage = window.location.pathname + window.location.search;
    const fullUrl = window.location.href;
    
    console.log('🔍 CHECKING FOR ORDER CONFIRMATION PAGE:', {
      currentPage: currentPage,
      fullUrl: fullUrl,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    });
    
    // Only check for actual order confirmation pages with order numbers
    const orderConfirmationPatterns = [
      /\/confirmation\?order=[A-Z0-9-]+/i,
      /\/success\?order=[A-Z0-9-]+/i,
      /\/thank-you\?order=[A-Z0-9-]+/i,
      /\/order-confirmation\?order=[A-Z0-9-]+/i,
      /\/checkout\/success\?order=[A-Z0-9-]+/i,
      /\/order\/success\?order=[A-Z0-9-]+/i,
      /\/payment\/success\?order=[A-Z0-9-]+/i
    ];
    
    console.log('🔍 TESTING ORDER CONFIRMATION PATTERNS:', {
      patterns: orderConfirmationPatterns.map(p => p.toString()),
      currentPage: currentPage
    });
    
    const isOrderConfirmation = orderConfirmationPatterns.some(pattern => pattern.test(currentPage));
    
    console.log('🔍 ORDER CONFIRMATION CHECK RESULT:', {
      isOrderConfirmation: isOrderConfirmation,
      currentPage: currentPage
    });
    
    if (isOrderConfirmation) {
      // Extract order ID from URL
      const orderMatch = currentPage.match(/[?&]order[=_-]([A-Z0-9-]+)/i);
      const orderId = orderMatch ? orderMatch[1] : null;
      
      if (orderId) {
        
        console.log('🎯 ORDER CONFIRMATION PAGE DETECTED - SENDING TO BACKEND!', {
          page: currentPage,
          orderId: orderId
        });
        
        // CRITICAL: Clear tracking disconnected flag to allow order events to be sent
        console.log('🔓 CLEARING TRACKING DISCONNECTED FLAG TO ALLOW ORDER EVENTS');
        sessionStorage.removeItem('tracking_disconnected');
        sessionStorage.removeItem('order_completed_at');
        sessionStorage.removeItem('order_completion_reason');
        
        // Send order confirmation event to backend
        console.log('📤 SENDING ORDER CONFIRMATION EVENT TO BACKEND...');
        trackEvent('order_confirmation_detected', {
          orderId: orderId,
          confirmationPage: currentPage,
          isOrderConfirmation: true
        });
        
        // Also send a regular page visit event to ensure backend gets the confirmation page
        console.log('📤 SENDING ORDER PAGE VISIT EVENT TO BACKEND...');
        trackEvent('order_page_visit', {
          orderId: orderId,
          page: currentPage,
          isOrderConfirmation: true
        });
        
        console.log('✅ BOTH ORDER EVENTS SENT TO BACKEND - waiting for backend processing...');
        
        // Delay disconnection to allow backend to process the order confirmation event
        console.log('⏰ Delaying tracking disconnection by 10 seconds to allow order processing...');
        setTimeout(() => {
          console.log('🔌 Now disconnecting tracking after order processing delay');
          disconnectAllTracking();
        }, 10000); // 10 second delay
        
        return true;
      }
    }
    
    return false;
  }

  // Initialize widget
  async function initializeWidget(isInitialLoad = false) {
    console.log('🚀 INITIALIZING WIDGET:', {
      isInitialLoad: isInitialLoad,
      currentUrl: window.location.href,
      currentPage: window.location.pathname + window.location.search
    });
    
    debugLog('Initializing AI Furniture widget', { isInitialLoad });
    
    // Additional server-side domain verification
    const serverVerification = await verifyDomainWithServer();
    if (!serverVerification) {
      console.error('🚫 AI Furniture Widget: Server verification failed. Widget will not initialize.');
      return;
    }
    
    // Check if tracking is already disconnected due to completed order
    const trackingDisconnected = sessionStorage.getItem('tracking_disconnected') === 'true';
    const orderCompletedAt = sessionStorage.getItem('order_completed_at');
    
    if (trackingDisconnected && orderCompletedAt) {
      console.log('🔌 Tracking disconnected due to completed order - checking if should re-enable');
      
      // Check if this is a product page - if so, re-enable tracking for new session
      const isFurniturePage = isFurnitureProductPage();
      if (isFurniturePage) {
        console.log('🔄 PRODUCT PAGE DETECTED - re-enabling tracking for new session');
        debugLog('Product page detected after order completion - re-enabling tracking');
        
        // Reset tracking state for new session
        resetWidget();
        
        // Continue with normal initialization below
      } else {
        console.log('❌ Non-product page after order completion - keeping tracking disabled');
        debugLog('Non-product page after order completion - keeping tracking disabled');
        return; // Keep tracking disabled
      }
    } else if (trackingDisconnected) {
      console.log('🔌 Tracking already disconnected - skipping widget initialization');
      debugLog('Tracking already disconnected - skipping widget initialization');
      return;
    }
    
    // Only check for order confirmation pages if user has used AI Furniture
    const isAIFurnitureUser = sessionStorage.getItem('ai_furniture_user') === 'true';
    if (isAIFurnitureUser) {
    console.log('🔍 CALLING trackOrderConfirmationPage()...');
    const orderConfirmed = trackOrderConfirmationPage();
    
    console.log('🔍 trackOrderConfirmationPage() RESULT:', {
      orderConfirmed: orderConfirmed,
      willStopWidget: orderConfirmed
    });
    
    if (orderConfirmed) {
      console.log('🎯 Order confirmed - stopping widget initialization');
      return; // Stop here if order was confirmed
      }
    } else {
      console.log('❌ Skipping order confirmation check - user has not used AI Furniture');
      debugLog('Skipping order confirmation check - user has not used AI Furniture');
    }
    
    // Create widget button
    createWidgetButton();
    
    // Only track page view if user has used AI Furniture (not on initial visit)
    if (isAIFurnitureUser) {
      // User has used AI Furniture, now track their behavior
      trackEvent('page_view', {
        title: document.title,
        url: window.location.href,
        isProductPage: isFurnitureProductPage(),
        aiFurnitureUser: true
      });
      
      // Detect cart and order pages for AI Furniture users
      detectCartAndOrderPages();
    } else {
      // First time visitor - no tracking until they use AI Furniture
      debugLog('First time visitor - no tracking until AI Furniture usage');
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeWidget(true));
  } else {
    initializeWidget(true);
  }
  
  // Re-initialize on navigation (for SPAs)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(() => initializeWidget(false), 1000); // Delay to allow page to load, ALWAYS check for order confirmation
    }
  }).observe(document, { subtree: true, childList: true });
  
  debugLog('AI Furniture widget initialized successfully');
  
})();
