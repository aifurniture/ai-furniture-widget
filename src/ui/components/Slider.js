/**
 * Before/After Slider Component
 */
export const Slider = ({ beforeImage, afterImage, aspectRatio, fillParent = false, variant = '' }) => {
    const isResults = variant === 'results';
    const useFillParent = isResults ? false : fillParent;

    const container = document.createElement('div');
    container.className = useFillParent
        ? 'aif-slider aif-slider--fill'
        : isResults
          ? 'aif-slider aif-slider--results'
          : 'aif-slider';

    const numericRatio = typeof aspectRatio === 'number' ? aspectRatio : null;
    const initialAspectRatio = numericRatio != null ? String(numericRatio) : '3/4';

    const imgBefore = document.createElement('img');
    imgBefore.className = 'aif-slider__img aif-slider__img--before';
    imgBefore.src = beforeImage;
    imgBefore.alt = 'Room before';
    imgBefore.decoding = 'async';

    const afterClip = document.createElement('div');
    afterClip.className = 'aif-slider__after-clip';

    const imgAfter = document.createElement('img');
    imgAfter.className = 'aif-slider__img aif-slider__img--after';
    imgAfter.src = afterImage;
    imgAfter.alt = 'Room after';
    imgAfter.decoding = 'async';

    const applyAspectFromNatural = (w, h) => {
        if (useFillParent) return;
        if (w > 0 && h > 0) {
            container.style.aspectRatio = String(w / h);
        }
    };

    const syncAspectFromImages = () => {
        if (useFillParent) return;
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

    container.style.aspectRatio = initialAspectRatio;
    if (!useFillParent) {
        container.style.maxHeight = 'min(34dvh, 320px)';
        container.style.minHeight = isResults ? '200px' : 'min(22dvh, 180px)';
        if (isResults) {
            container.style.width = '100%';
            container.style.display = 'block';
        }
    }

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
    labelBefore.className = 'aif-slider__label aif-slider__label--before';
    labelBefore.textContent = 'Before';

    const labelAfter = document.createElement('div');
    labelAfter.className = 'aif-slider__label aif-slider__label--after';
    labelAfter.textContent = 'After';

    const dividerWrapper = document.createElement('div');
    dividerWrapper.className = 'aif-slider__divider-wrap';

    const divider = document.createElement('div');
    divider.className = 'aif-slider__divider';

    const handle = document.createElement('div');
    handle.className = 'aif-slider__handle';
    handle.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
        handle.classList.toggle('aif-slider__handle--active', active);
    };

    const beginDrag = () => {
        isDragging = true;
        cachedRect = container.getBoundingClientRect();
        syncAfterImageWidth();
        container.classList.add('aif-slider--dragging');
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
        container.classList.remove('aif-slider--dragging');
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

    if (!useFillParent) {
        if (imgBefore.complete) syncAspectFromImages();
        if (imgAfter.complete) syncAspectFromImages();
    }
    syncAfterImageWidth();

    return container;
};
