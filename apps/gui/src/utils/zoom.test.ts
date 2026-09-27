import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ZOOM_RANGE,
  clampZoom,
  deviceRangeToUiRange,
  formatZoomFactor,
  isValidZoomRange,
  normalizeZoomRange,
  percentToZoom,
  toRawZoom,
  zoomFactorFromValue,
  zoomPresets,
  zoomToPercent,
  zoomUiStep,
  zoomValueForFactor,
} from './zoom';

const TINY_RANGE = { min: 1, max: 1.12, step: 0.01, default: 1, factorMax: 4 };

describe('zoom helpers', () => {
  describe('normalizeZoomRange / isValidZoomRange', () => {
    it('keeps a valid range and defaults the step', () => {
      expect(normalizeZoomRange({ min: 1, max: 2 })).toEqual({ min: 1, max: 2, step: 0.01, default: 1 });
    });

    it('falls back for invalid ranges', () => {
      expect(normalizeZoomRange(null)).toEqual(DEFAULT_ZOOM_RANGE);
      expect(normalizeZoomRange({ min: 2, max: 2 })).toEqual(DEFAULT_ZOOM_RANGE);
      expect(isValidZoomRange({ min: 1, max: 2 })).toBe(true);
      expect(isValidZoomRange({ min: 2, max: 1 })).toBe(false);
    });
  });

  describe('deviceRangeToUiRange', () => {
    it('converts a raw UVC range into the settable 1+raw/100 domain with the real max factor', () => {
      expect(deviceRangeToUiRange({ min: 0, max: 12, step: 1, default: 0 }))
        .toEqual({ min: 1, max: 1.12, step: 0.01, default: 1, factorMax: 4 });
    });

    it('leaves an already-normalized range untouched', () => {
      expect(deviceRangeToUiRange({ min: 1, max: 2, step: 0.05 })).toEqual({ min: 1, max: 2, step: 0.05 });
    });
  });

  it('clamps values into the range', () => {
    expect(clampZoom(0.5, DEFAULT_ZOOM_RANGE)).toBe(1);
    expect(clampZoom(3, DEFAULT_ZOOM_RANGE)).toBe(2);
    expect(clampZoom(1.5, DEFAULT_ZOOM_RANGE)).toBe(1.5);
  });

  describe('zoomUiStep', () => {
    it('uses a fine step when the device step is too coarse', () => {
      expect(zoomUiStep({ min: 1, max: 2, step: 1 })).toBeCloseTo(0.01);
    });

    it('keeps a device step that already gives fine control', () => {
      expect(zoomUiStep({ min: 100, max: 400, step: 1 })).toBe(1);
    });
  });

  it('converts between value and track percent', () => {
    expect(zoomToPercent(1, DEFAULT_ZOOM_RANGE)).toBe(0);
    expect(zoomToPercent(2, DEFAULT_ZOOM_RANGE)).toBe(100);
    expect(zoomToPercent(1.5, DEFAULT_ZOOM_RANGE)).toBe(50);
    expect(percentToZoom(50, DEFAULT_ZOOM_RANGE)).toBeCloseTo(1.5);
    expect(percentToZoom(75, DEFAULT_ZOOM_RANGE)).toBeCloseTo(1.75);
    expect(percentToZoom(50, TINY_RANGE)).toBeCloseTo(1.06);
  });

  describe('zoom factor conversion', () => {
    it('maps the max settable value to the real max factor', () => {
      expect(zoomFactorFromValue(1, TINY_RANGE)).toBe(1);
      expect(zoomFactorFromValue(1.04, TINY_RANGE)).toBeCloseTo(2);
      expect(zoomFactorFromValue(1.12, TINY_RANGE)).toBeCloseTo(4);
    });

    it('maps a real factor back to a settable value', () => {
      expect(zoomValueForFactor(1, TINY_RANGE)).toBeCloseTo(1);
      expect(zoomValueForFactor(2, TINY_RANGE)).toBeCloseTo(1.04);
      expect(zoomValueForFactor(4, TINY_RANGE)).toBeCloseTo(1.12);
    });
  });

  describe('zoomPresets', () => {
    it('uses integer zoom factors on the real scale', () => {
      expect(zoomPresets(TINY_RANGE)).toEqual([1, 1.04, 1.08, 1.12]);
    });

    it('gives every integer factor on the x100 scale without a known factor', () => {
      expect(zoomPresets({ min: 100, max: 400, step: 1 })).toEqual([100, 200, 300, 400]);
    });
  });

  describe('formatZoomFactor', () => {
    it('shows the real zoom factor when the range is known', () => {
      expect(formatZoomFactor(1, TINY_RANGE)).toBe('1×');
      expect(formatZoomFactor(1.06, TINY_RANGE)).toBe('2.5×');
      expect(formatZoomFactor(1.12, TINY_RANGE)).toBe('4×');
    });

    it('falls back to the raw value without a range', () => {
      expect(formatZoomFactor(250)).toBe('2.5×');
      expect(formatZoomFactor(400)).toBe('4×');
      expect(formatZoomFactor(undefined)).toBe('—');
    });
  });

  describe('toRawZoom', () => {
    it('keeps values that already fit the range', () => {
      expect(toRawZoom(1.4, DEFAULT_ZOOM_RANGE)).toBe(1.4);
    });

    it('maps a normalized value onto an x100 range', () => {
      expect(toRawZoom(1.5, { min: 100, max: 400, step: 1 })).toBe(250);
    });

    it('clamps out-of-range values', () => {
      expect(toRawZoom(5, DEFAULT_ZOOM_RANGE)).toBe(2);
      expect(toRawZoom(undefined, DEFAULT_ZOOM_RANGE)).toBeUndefined();
    });
  });
});
