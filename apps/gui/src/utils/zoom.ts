export type ZoomRange = {
  min: number;
  max: number;
  step?: number;
  default?: number;
  /** Real optical/digital zoom factor reached at `max` (e.g. 4 for the Tiny SE). */
  factorMax?: number;
};

/**
 * Zoom is normalized (1.00 = no zoom, 1.12 = device max on the Tiny SE), but
 * the real zoom factor goes up to the device spec (1x..4x). Keep the settable
 * values in SDK units and convert to/from the real factor for display.
 */
export const DEFAULT_ZOOM_RANGE: ZoomRange = { min: 1, max: 2, step: 0.01, default: 1, factorMax: 4 };

/** Default max zoom factor for the Tiny devices this section targets. */
export const ZOOM_MAX_FACTOR = 4;

export const normalizeZoomRange = (range?: Partial<ZoomRange> | null): ZoomRange => {
  if (!range || typeof range.min !== 'number' || typeof range.max !== 'number' || !(range.max > range.min)) {
    return DEFAULT_ZOOM_RANGE;
  }
  return {
    min: range.min,
    max: range.max,
    step: typeof range.step === 'number' && range.step > 0 ? range.step : DEFAULT_ZOOM_RANGE.step,
    default: typeof range.default === 'number' ? range.default : range.min,
    factorMax: typeof range.factorMax === 'number' && range.factorMax > 1 ? range.factorMax : undefined,
  };
};

export const isValidZoomRange = (range?: Partial<ZoomRange> | null): boolean =>
  !!range && typeof range.min === 'number' && typeof range.max === 'number' && range.max > range.min;

/**
 * Some firmware reports the raw UVC zoom range (e.g. 0..12 steps) while the
 * setter expects normalized values where 1.00 = no zoom and 1.12 = the device
 * max (i.e. `1 + raw/100`). Convert that raw range into the settable domain.
 * Ranges that are already normalized (max <= 2) are returned unchanged.
 */
export const deviceRangeToUiRange = (raw: ZoomRange): ZoomRange => {
  if (raw.max <= 2) return raw;
  const step = (raw.step && raw.step > 0 ? raw.step : 1) / 100;
  return {
    min: 1 + raw.min / 100,
    max: 1 + raw.max / 100,
    step,
    default: 1 + (raw.default ?? raw.min) / 100,
    factorMax: ZOOM_MAX_FACTOR,
  };
};

export const clampZoom = (value: number, range: ZoomRange): number =>
  Math.min(range.max, Math.max(range.min, value));

/**
 * Step used by the UI. The device-reported step is often too coarse (e.g. 1 on
 * a 1..12 range, giving only a few positions), so fall back to 100 divisions.
 */
export const zoomUiStep = (range: ZoomRange): number => {
  const span = range.max - range.min;
  if (span <= 0) return 1;
  const deviceStep = range.step && range.step > 0 ? range.step : 0;
  if (deviceStep > 0 && span / deviceStep >= 10) return deviceStep;
  return span / 100;
};

/** Position of a zoom value along the track, as a percentage (0..100). */
export const zoomToPercent = (value: number, range: ZoomRange): number =>
  range.max > range.min ? ((clampZoom(value, range) - range.min) / (range.max - range.min)) * 100 : 0;

const roundToStep = (value: number, range: ZoomRange): number => {
  const step = zoomUiStep(range);
  return range.min + Math.round((value - range.min) / step) * step;
};

/** Zoom value for a position along the track, snapped to the UI step. */
export const percentToZoom = (percent: number, range: ZoomRange): number => {
  const raw = range.min + (percent / 100) * (range.max - range.min);
  const snapped = roundToStep(raw, range);
  return clampZoom(Math.round(snapped * 1000) / 1000, range);
};

/** Real zoom factor for a settable value. */
export const zoomFactorFromValue = (value: number, range?: ZoomRange): number => {
  if (!range || !range.factorMax || range.max <= range.min) {
    return value >= 100 ? value / 100 : value;
  }
  const ratio = (clampZoom(value, range) - range.min) / (range.max - range.min);
  return 1 + ratio * (range.factorMax - 1);
};

/** Settable value for a real zoom factor (1x, 2x, ...). */
export const zoomValueForFactor = (factor: number, range: ZoomRange): number => {
  if (!range.factorMax || range.factorMax <= 1 || range.max <= range.min) return factor;
  const ratio = (factor - 1) / (range.factorMax - 1);
  return clampZoom(range.min + ratio * (range.max - range.min), range);
};

export const formatZoomFactor = (value: number | undefined, range?: ZoomRange): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const factor = Math.round(zoomFactorFromValue(value, range) * 100) / 100;
  return `${factor}×`;
};

/**
 * Meaningful single-click levels: integer zoom factors (1x, 2x, 3x, 4x) when
 * the max factor is known, otherwise quarters of the range.
 */
export const zoomPresets = (range: ZoomRange): number[] => {
  const presets = new Set<number>([range.min, range.max]);
  if (range.factorMax && range.factorMax > 1) {
    for (let factor = 1; factor <= Math.floor(range.factorMax); factor++) {
      presets.add(roundToStep(zoomValueForFactor(factor, range), range));
    }
    presets.add(roundToStep(zoomValueForFactor(range.factorMax, range), range));
  } else if (range.min >= 100) {
    for (let factor = Math.ceil(range.min / 100); factor <= Math.floor(range.max / 100); factor++) {
      const value = factor * 100;
      if (value >= range.min && value <= range.max) presets.add(value);
    }
  } else {
    for (const fraction of [0.25, 0.5, 0.75]) {
      presets.add(roundToStep(range.min + fraction * (range.max - range.min), range));
    }
  }
  return Array.from(presets).sort((a, b) => a - b);
};

/**
 * The SDK is inconsistent about zoom units: the range may use raw UVC values
 * (e.g. 100..400 = 1x..4x) while reads return a normalized 1.0..2.0, or the
 * observed domain may be 1.0..2.0. Normalize any reported value into the
 * range's units so the slider and the section title always agree.
 */
export const toRawZoom = (value: number | undefined, range: ZoomRange): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value >= range.min && value <= range.max) return value;
  if (range.max > 2 && value >= 1 && value <= 2) {
    return clampZoom(range.min + (value - 1) * (range.max - range.min), range);
  }
  return clampZoom(value, range);
};
