import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DEFAULT_ZOOM_RANGE,
  clampZoom,
  formatZoomFactor,
  percentToZoom,
  zoomPresets,
  zoomToPercent,
  zoomUiStep,
  type ZoomRange,
} from '../utils/zoom';

type Props = {
  range?: ZoomRange;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/**
 * Custom zoom slider (no native range input) so the preset dots, the fill and
 * the thumb all use the exact same percentage mapping and stay aligned. The
 * value is controlled by the parent so the section title shows the same value.
 */
export const ZoomControl = ({ range = DEFAULT_ZOOM_RANGE, value, onChange, disabled }: Props) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const setFromClientX = (clientX: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    onChange(percentToZoom(Math.max(0, Math.min(100, percent)), range));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    draggingRef.current = true;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // pointer capture is best-effort
    }
    setFromClientX(event.clientX);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setFromClientX(event.clientX);
  };

  const endDrag = () => { draggingRef.current = false; };

  const step = zoomUiStep(range);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next: number | undefined;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown': next = value - step; break;
      case 'ArrowRight':
      case 'ArrowUp': next = value + step; break;
      case 'Home': next = range.min; break;
      case 'End': next = range.max; break;
      default: return;
    }
    event.preventDefault();
    onChange(clampZoom(next, range));
  };

  const percent = zoomToPercent(value, range);
  const presets = zoomPresets(range);

  return (
    <div className={`zoom-control${disabled ? ' is-disabled' : ''}`}>
      <div className="zoom-header">
        <span className="zoom-label">Zoom</span>
        <span className="zoom-value">{formatZoomFactor(value, range)}</span>
      </div>
      <div
        className="zoom-track-wrap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <div className="zoom-rail" ref={railRef}>
          <div className="zoom-fill" style={{ width: `${percent}%` }} />
          <div className="zoom-dots">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`zoom-preset${value === preset ? ' active' : ''}`}
                style={{ left: `${zoomToPercent(preset, range)}%` }}
                title={formatZoomFactor(preset, range)}
                aria-label={`Set zoom to ${formatZoomFactor(preset, range)}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); onChange(preset); }}
              />
            ))}
          </div>
          <div
            className="zoom-thumb"
            style={{ left: `${percent}%` }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Zoom level"
            aria-valuemin={range.min}
            aria-valuemax={range.max}
            aria-valuenow={Math.round(value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    </div>
  );
};
