/**
 * Before/After Slider Component
 */
export const Slider = ({ beforeImage, afterImage, aspectRatio, fillParent = false }) => {
    const container = document.createElement('div');
    container.className = fillParent ? 'aif-slider aif-slider--fill' : 'aif-slider';

    const numericRatio = typeof aspectRatio === 'number' ? aspectRatio : null;
    const initialAspectRatio = numericRatio != null ? String(numericRatio) : '3/4';

    const imgBefore = document.createElement('img');
    imgBefore.src = beforeImage;
    imgBefore.decoding = 'async';

    const afterClip = document.createElement('div');
    afterClip.className = 'aif-slider__after-clip';

    const imgAfter = document.createElement('img');
    imgAfter.src = afterImage;
    imgAfter.decoding = 'async';

    const applyAspectFromNatural = (w, h) => {
        if (fillParent) return;
        if (w > 0 && h > 0) {
            container.style.aspectRatio = String(w / h);
        }
    };

    const syncAspectFromImages = () => {
        if (fillParent) return;
        const wb = imgBefore.naturalWidth;
        const hb = imgBefore.naturalHeight;
        const wa = imgAfter.naturalWidth;
        const ha = imgAfter.naturalHeight;
        if (wb > 0 && hb > 0 && wa > 0 && ha > 0) {
            const rb = wb / hb;
            const ra = wa / ha;
            container.style.aspectRatio = String(Math.min(rb, ra));
        } else if (wb > 0 && hb > 0) {
            applyAspectFromNatural(wb, hb);
        } else if (wa > 0 && ha > 0) {
            applyAspectFromNatural(wa, ha);
        }
    };

    const boxStyle = {
        position: 'relative',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        background: '#f9fafb',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
    };
    if (!fillParent) {
        boxStyle.aspectRatio = initialAspectRatio;
    }
    Object.assign(container.style, boxStyle);

    Object.assign(imgBefore.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none'
    });

    Object.assign(afterClip.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        bottom: '0',
        width: '50%',
        overflow: 'hidden',
        pointerEvents: 'none',
        willChange: 'width'
    });

    Object.assign(imgAfter.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        height: '100%',
        maxWidth: 'none',
        objectFit: 'contain',
        pointerEvents: 'none'
    });

    const syncAfterImageWidth = () => {
        const w = container.offsetWidth;
        if (w > 0) {
            imgAfter.style.width = `${w}px`;
        }
    };

    imgBefore.onload = () => {
        syncAspectFromImages();
        syncAfterImageWidth();
    };
    imgAfter.onload = () => {
        syncAspectFromImages();
        syncAfterImageWidth();
    };

    const labelBefore = document.createElement('div');
    labelBefore.textContent = 'BEFORE';
    Object.assign(labelBefore.style, {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'rgba(0, 0, 0, 0.82)',
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
        background: 'rgba(5, 150, 105, 0.95)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.05em',
        zIndex: '5',
        pointerEvents: 'none'
    });

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
        zIndex: '10',
        willChange: 'left'
    });

    const divider = document.createElement('div');
    Object.assign(divider.style, {
        width: '3px',
        height: '100%',
        background:
            'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,1), rgba(255,255,255,0.9))',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 0, 0, 0.2)',
        pointerEvents: 'none'
    });

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
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        pointerEvents: 'none'
    });

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

    let isDragging = false;
    let cachedRect = null;
    let rafId = 0;
    let pendingClientX = null;

    const applyPosition = (percentage) => {
        afterClip.style.width = `${percentage}%`;
        dividerWrapper.style.left = `${percentage}%`;
    };

    const flushPosition = () => {
        rafId = 0;
        if (pendingClientX == null || !cachedRect) return;
        const { left, width } = cachedRect;
        let percentage = ((pendingClientX - left) / width) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        applyPosition(percentage);
    };

    const schedulePosition = (clientX) => {
        pendingClientX = clientX;
        if (!rafId) {
            rafId = requestAnimationFrame(flushPosition);
        }
    };

    const setHandleActive = (active) => {
        handle.style.transition = active ? 'none' : 'transform 0.15s ease, box-shadow 0.15s ease';
        handle.style.transform = active
            ? 'translate(-50%, -50%) scale(1.1)'
            : 'translate(-50%, -50%) scale(1)';
        handle.style.boxShadow = active
            ? '0 6px 20px rgba(0, 0, 0, 0.25)'
            : '0 4px 16px rgba(0, 0, 0, 0.2)';
    };

    const beginDrag = () => {
        isDragging = true;
        cachedRect = container.getBoundingClientRect();
        syncAfterImageWidth();
        container.style.cursor = 'ew-resize';
        setHandleActive(true);
    };

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        cachedRect = null;
        pendingClientX = null;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
        container.style.cursor = '';
        setHandleActive(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    };

    const onMouseDown = (e) => {
        beginDrag();
        schedulePosition(e.clientX);
        e.preventDefault();
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        schedulePosition(e.clientX);
    };

    const onMouseUp = () => endDrag();

    const onTouchStart = (e) => {
        beginDrag();
        if (e.touches[0]) schedulePosition(e.touches[0].clientX);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    };

    const onTouchMove = (e) => {
        if (!isDragging || !e.touches[0]) return;
        schedulePosition(e.touches[0].clientX);
        e.preventDefault();
    };

    const onTouchEnd = () => endDrag();

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

    dividerWrapper.addEventListener('mousedown', onMouseDown);
    dividerWrapper.addEventListener('touchstart', onTouchStart, { passive: true });

    const resizeObserver =
        typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => syncAfterImageWidth())
            : null;
    if (resizeObserver) {
        resizeObserver.observe(container);
    }

    container._cleanup = () => {
        endDrag();
        resizeObserver?.disconnect();
    };

    afterClip.appendChild(imgAfter);
    container.appendChild(imgBefore);
    container.appendChild(afterClip);
    container.appendChild(labelBefore);
    container.appendChild(labelAfter);
    container.appendChild(dividerWrapper);

    if (!fillParent) {
        if (imgBefore.complete) syncAspectFromImages();
        if (imgAfter.complete) syncAspectFromImages();
    }
    syncAfterImageWidth();

    return container;
};
