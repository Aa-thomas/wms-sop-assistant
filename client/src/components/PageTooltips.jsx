import { useState, useEffect, useCallback, useRef } from 'react';
import './PageTooltips.css';

const PADDING = 8;
const TOOLTIP_GAP = 12;

function getTargetRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function getPlacement(targetRect, tooltipEl) {
  if (!tooltipEl) return { top: 0, left: 0, placement: 'bottom' };

  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const cx = targetRect.left + targetRect.width / 2;

  // Try bottom first
  const bottomTop = targetRect.bottom + TOOLTIP_GAP;
  if (bottomTop + th < vh - 16) {
    return { top: bottomTop, left: clampX(cx - tw / 2, tw, vw), placement: 'bottom' };
  }

  // Try top
  const topTop = targetRect.top - TOOLTIP_GAP - th;
  if (topTop > 16) {
    return { top: topTop, left: clampX(cx - tw / 2, tw, vw), placement: 'top' };
  }

  // Try right
  const rightLeft = targetRect.right + TOOLTIP_GAP;
  if (rightLeft + tw < vw - 16) {
    const cy = targetRect.top + targetRect.height / 2;
    return { top: Math.max(16, cy - th / 2), left: rightLeft, placement: 'right' };
  }

  // Fallback: left
  const leftLeft = targetRect.left - TOOLTIP_GAP - tw;
  const cy = targetRect.top + targetRect.height / 2;
  return { top: Math.max(16, cy - th / 2), left: Math.max(16, leftLeft), placement: 'left' };
}

function clampX(x, width, viewportWidth) {
  return Math.max(16, Math.min(x, viewportWidth - width - 16));
}

function getArrowStyle(placement, targetRect, tooltipLeft, tooltipTop) {
  const arrowSize = 8;
  if (placement === 'bottom') {
    const cx = targetRect.left + targetRect.width / 2;
    return { left: Math.max(16, Math.min(cx - tooltipLeft, 260)), top: -arrowSize };
  }
  if (placement === 'top') {
    const cx = targetRect.left + targetRect.width / 2;
    return { left: Math.max(16, Math.min(cx - tooltipLeft, 260)), bottom: -arrowSize };
  }
  if (placement === 'right') {
    const cy = targetRect.top + targetRect.height / 2;
    return { left: -arrowSize, top: Math.max(12, cy - tooltipTop) };
  }
  // left
  const cy = targetRect.top + targetRect.height / 2;
  return { right: -arrowSize, top: Math.max(12, cy - tooltipTop) };
}

export default function PageTooltips({ tooltips, onSkipTour, onPageComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [position, setPosition] = useState(null);
  const [placement, setPlacement] = useState('bottom');
  const tooltipRef = useRef(null);

  // Find the next valid tooltip (skip missing elements)
  const findValidIndex = useCallback((startFrom) => {
    for (let i = startFrom; i < tooltips.length; i++) {
      if (getTargetRect(tooltips[i].selector)) return i;
    }
    return -1; // none found
  }, [tooltips]);

  // Initialize to first valid tooltip
  useEffect(() => {
    const idx = findValidIndex(0);
    if (idx === -1) {
      // No valid tooltips on this page — just mark page done
      if (onPageComplete) onPageComplete();
      return;
    }
    setStepIndex(idx);
  }, [findValidIndex, onPageComplete]);

  // Scroll target into view when step changes
  useEffect(() => {
    if (stepIndex < 0 || stepIndex >= tooltips.length) return;
    const el = document.querySelector(tooltips[stepIndex].selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [stepIndex, tooltips]);

  // Measure target + position tooltip
  const measure = useCallback(() => {
    if (stepIndex < 0 || stepIndex >= tooltips.length) return;
    const rect = getTargetRect(tooltips[stepIndex].selector);
    if (!rect) return;
    setTargetRect(rect);

    if (tooltipRef.current) {
      const { top, left, placement: p } = getPlacement(rect, tooltipRef.current);
      setPosition({ top, left });
      setPlacement(p);
    }
  }, [stepIndex, tooltips]);

  useEffect(() => {
    // Small delay so element is in DOM
    const timer = setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  // Re-measure once tooltip ref mounts
  useEffect(() => {
    if (tooltipRef.current && targetRect) {
      const { top, left, placement: p } = getPlacement(targetRect, tooltipRef.current);
      setPosition({ top, left });
      setPlacement(p);
    }
  }, [targetRect]);

  const handleNext = useCallback(() => {
    const nextIdx = findValidIndex(stepIndex + 1);
    if (nextIdx === -1) {
      // All tooltips on this page done — mark page complete (tour stays active)
      if (onPageComplete) onPageComplete();
    } else {
      setStepIndex(nextIdx);
      setTargetRect(null);
      setPosition(null);
    }
  }, [stepIndex, findValidIndex, onPageComplete]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onSkipTour();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkipTour, handleNext]);

  if (stepIndex < 0 || !tooltips[stepIndex]) return null;

  const step = tooltips[stepIndex];
  const validCount = tooltips.filter(t => getTargetRect(t.selector)).length;
  const currentNum = tooltips.slice(0, stepIndex + 1).filter(t => getTargetRect(t.selector)).length;

  const arrowStyle = targetRect && position
    ? getArrowStyle(placement, targetRect, position.left, position.top)
    : {};

  return (
    <div className="page-tooltips-container">
      {/* SVG overlay with spotlight cutout — pointer-events: none so elements underneath are clickable */}
      <svg className="tooltip-overlay">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - PADDING}
                y={targetRect.top - PADDING}
                width={targetRect.width + PADDING * 2}
                height={targetRect.height + PADDING * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.45)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className={`page-tooltip page-tooltip--${placement}`}
        style={position ? { top: position.top, left: position.left } : { opacity: 0 }}
      >
        <div className={`page-tooltip-arrow page-tooltip-arrow--${placement}`} style={arrowStyle} />
        <div className="page-tooltip-body">
          <div className="page-tooltip-title">{step.title}</div>
          <div className="page-tooltip-desc">{step.description}</div>
        </div>
        <div className="page-tooltip-footer">
          <button className="page-tooltip-skip" onClick={onSkipTour}>
            Skip tour
          </button>
          <span className="page-tooltip-counter">
            {currentNum} of {validCount}
          </span>
          <button className="page-tooltip-next" onClick={handleNext}>
            {currentNum === validCount ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
