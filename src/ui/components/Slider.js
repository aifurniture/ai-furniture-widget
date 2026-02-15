/**
 * Before/After Slider Component - Premium & Smooth
 */
export const Slider = ({ beforeImage, afterImage }) => {
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'relative',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        background: '#f9fafb',
        // No fixed aspectRatio - will be set dynamically
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
    });

    // Before Image (Right side - shown fully)
    const imgBefore = document.createElement('img');
    imgBefore.src = beforeImage;
    Object.assign(imgBefore.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'contain', // Changed from 'cover' to maintain aspect ratio
        pointerEvents: 'none'
    });

    // Load image to get natural dimensions and set container aspect ratio
    imgBefore.onload = () => {
        const aspectRatio = imgBefore.naturalWidth / imgBefore.naturalHeight;
        container.style.aspectRatio = aspectRatio.toString();
        console.log(`📐 Image aspect ratio: ${aspectRatio.toFixed(2)} (${imgBefore.naturalWidth}x${imgBefore.naturalHeight})`);
    };

    // After Image (Left side - clipped)
    const imgAfter = document.createElement('img');
    imgAfter.src = afterImage;
    Object.assign(imgAfter.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'contain', // Changed from 'cover' to maintain aspect ratio
        clipPath: 'inset(0 50% 0 0)',
        pointerEvents: 'none'
    });

    // Labels
    const labelBefore = document.createElement('div');
    labelBefore.textContent = 'BEFORE';
    Object.assign(labelBefore.style, {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.05em',
        zIndex: '5',
        pointerEvents: 'none'
    });

    const labelAfter = document.createElement('div');
    labelAfter.textContent = 'AFTER';
    Object.assign(labelAfter.style, {
        position: 'absolute',
        top: '16px',
        left: '16px',
        background: 'rgba(16, 185, 129, 0.9)',
        backdropFilter: 'blur(8px)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.05em',
        zIndex: '5',
        pointerEvents: 'none'
    });

    // Divider with handle
    const dividerWrapper = document.createElement('div');
    Object.assign(dividerWrapper.style, {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '40px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'ew-resize',
        zIndex: '10'
    });

    // Divider line
    const divider = document.createElement('div');
    Object.assign(divider.style, {
        width: '3px',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,1), rgba(255,255,255,0.9))',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 0, 0, 0.2)',
        pointerEvents: 'none'
    });

    // Draggable handle
    const handle = document.createElement('div');
    Object.assign(handle.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '48px',
        height: '48px',
        background: 'white',
        borderRadius: '50%',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'none'
    });

    // Handle arrows
    handle.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: -8px;">
            <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
    `;

    dividerWrapper.appendChild(divider);
    dividerWrapper.appendChild(handle);

    // Interaction state
    let isDragging = false;
    let startPos = 50;

    const updatePosition = (clientX) => {
        const rect = container.getBoundingClientRect();
        let percentage = ((clientX - rect.left) / rect.width) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        
        imgAfter.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
        dividerWrapper.style.left = `${percentage}%`;
        
        return percentage;
    };

    // Mouse events
    const onMouseDown = (e) => {
        isDragging = true;
        container.style.cursor = 'ew-resize';
        handle.style.transform = 'translate(-50%, -50%) scale(1.1)';
        handle.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        updatePosition(e.clientX);
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = '';
        handle.style.transform = 'translate(-50%, -50%) scale(1)';
        handle.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
    };

    // Touch events for mobile
    const onTouchStart = (e) => {
        isDragging = true;
        handle.style.transform = 'translate(-50%, -50%) scale(1.1)';
        handle.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
    };

    const onTouchMove = (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        updatePosition(touch.clientX);
        e.preventDefault();
    };

    const onTouchEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        handle.style.transform = 'translate(-50%, -50%) scale(1)';
        handle.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
    };

    // Hover effect on handle
    dividerWrapper.addEventListener('mouseenter', () => {
        if (!isDragging) {
            handle.style.transform = 'translate(-50%, -50%) scale(1.05)';
        }
    });

    dividerWrapper.addEventListener('mouseleave', () => {
        if (!isDragging) {
            handle.style.transform = 'translate(-50%, -50%) scale(1)';
        }
    });

    // Attach events
    dividerWrapper.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    dividerWrapper.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    // Cleanup on removal
    container._cleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    };

    // Build structure
    container.appendChild(imgBefore);
    container.appendChild(imgAfter);
    container.appendChild(labelBefore);
    container.appendChild(labelAfter);
    container.appendChild(dividerWrapper);

    return container;
};
