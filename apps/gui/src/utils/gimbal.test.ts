import { describe, expect, it } from 'vitest';
import {
  directionsToSpeeds,
  formatAngle,
  GIMBAL_PAN_LIMIT,
  GIMBAL_PITCH_LIMIT,
  GIMBAL_SPEEDS,
  intentToSpeeds,
} from './gimbal';

describe('gimbal helpers', () => {
  describe('directionsToSpeeds', () => {
    it('maps up/right to natural camera movement (device axes are inverted)', () => {
      expect(directionsToSpeeds(['up'], GIMBAL_SPEEDS.normal)).toEqual({ pitch: -50, pan: 0 });
      expect(directionsToSpeeds(['down'], GIMBAL_SPEEDS.normal)).toEqual({ pitch: 50, pan: 0 });
      expect(directionsToSpeeds(['right'], GIMBAL_SPEEDS.normal)).toEqual({ pitch: 0, pan: -100 });
      expect(directionsToSpeeds(['left'], GIMBAL_SPEEDS.normal)).toEqual({ pitch: 0, pan: 100 });
    });

    it('combines held directions', () => {
      expect(directionsToSpeeds(['up', 'right'], GIMBAL_SPEEDS.slow)).toEqual({ pitch: -20, pan: -40 });
      expect(directionsToSpeeds(['up', 'down'], GIMBAL_SPEEDS.normal)).toEqual({ pitch: 0, pan: 0 });
    });

    it('returns zero when nothing is held', () => {
      expect(directionsToSpeeds([], GIMBAL_SPEEDS.fast)).toEqual({ pitch: 0, pan: 0 });
    });

    it('gives a clear spread between speed levels', () => {
      expect(Math.abs(directionsToSpeeds(['right'], GIMBAL_SPEEDS.fast).pan))
        .toBeGreaterThan(Math.abs(directionsToSpeeds(['right'], GIMBAL_SPEEDS.normal).pan));
      expect(Math.abs(directionsToSpeeds(['right'], GIMBAL_SPEEDS.normal).pan))
        .toBeGreaterThan(Math.abs(directionsToSpeeds(['right'], GIMBAL_SPEEDS.slow).pan));
    });
  });

  describe('invert axes', () => {
    it('reverses the vertical axis when requested', () => {
      expect(directionsToSpeeds(['up'], GIMBAL_SPEEDS.normal, { vertical: true, horizontal: false }))
        .toEqual({ pitch: 50, pan: 0 });
    });

    it('reverses the horizontal axis when requested', () => {
      expect(directionsToSpeeds(['right'], GIMBAL_SPEEDS.normal, { vertical: false, horizontal: true }))
        .toEqual({ pitch: 0, pan: 100 });
    });
  });

  describe('intentToSpeeds', () => {
    it('maps a natural intent vector to device speeds', () => {
      expect(intentToSpeeds(1, 1, GIMBAL_SPEEDS.normal)).toEqual({ pitch: -50, pan: -100 });
    });

    it('applies invert flags', () => {
      expect(intentToSpeeds(1, 1, GIMBAL_SPEEDS.normal, { vertical: true, horizontal: true }))
        .toEqual({ pitch: 50, pan: 100 });
    });

    it('scales proportionally for partial deflection', () => {
      expect(intentToSpeeds(0.5, -0.5, GIMBAL_SPEEDS.normal)).toEqual({ pitch: -25, pan: 50 });
    });

    it('clamps to the per-axis SDK limits', () => {
      expect(intentToSpeeds(2, 2, { pitch: GIMBAL_PITCH_LIMIT, pan: GIMBAL_PAN_LIMIT }).pitch).toBe(-GIMBAL_PITCH_LIMIT);
      expect(intentToSpeeds(2, 2, { pitch: GIMBAL_PITCH_LIMIT, pan: GIMBAL_PAN_LIMIT }).pan).toBe(-GIMBAL_PAN_LIMIT);
    });
  });

  describe('formatAngle', () => {
    it('rounds and appends a degree sign', () => {
      expect(formatAngle(12.4)).toBe('12°');
      expect(formatAngle(-7.6)).toBe('-8°');
    });

    it('renders a placeholder for missing values', () => {
      expect(formatAngle(undefined)).toBe('—');
      expect(formatAngle(Number.NaN)).toBe('—');
    });
  });
});
