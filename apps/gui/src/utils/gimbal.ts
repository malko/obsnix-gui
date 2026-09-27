export type GimbalDirection = 'up' | 'down' | 'left' | 'right';
export type GimbalSpeed = 'slow' | 'normal' | 'fast';

export type GimbalAttitude = {
  roll?: number;
  pitch?: number;
  pan?: number;
};

export type GimbalSpeedVector = {
  pitch: number;
  pan: number;
};

export type GimbalInvert = {
  vertical: boolean;
  horizontal: boolean;
};

/** Absolute limits accepted by the SDK for the gimbal rotation speed. */
export const GIMBAL_PITCH_LIMIT = 90;
export const GIMBAL_PAN_LIMIT = 180;

/**
 * Speed values sent to the device for the "move" command. Pitch and pan have
 * different valid ranges (-90..90 vs -180..180), so they use different values.
 */
export const GIMBAL_SPEEDS: Record<GimbalSpeed, GimbalSpeedVector> = {
  slow: { pitch: 20, pan: 40 },
  normal: { pitch: 50, pan: 100 },
  fast: { pitch: 90, pan: 180 },
};

export const DEFAULT_GIMBAL_INVERT: GimbalInvert = { vertical: false, horizontal: false };

const clamp = (value: number, limit: number): number => {
  const clamped = Math.max(-limit, Math.min(limit, value));
  return clamped === 0 ? 0 : clamped; // normalize -0
};

/**
 * The device's raw speed axes are inverted with respect to what feels natural:
 * a positive pitch speed tilts the camera down and a positive pan speed turns
 * it left. `intentPitch`/`intentPan` are expressed in natural terms (+1 = up /
 * right) and the invert flags let the user flip each axis if their unit differs.
 */
export const intentToSpeeds = (
  intentPitch: number,
  intentPan: number,
  speed: GimbalSpeedVector,
  invert: GimbalInvert = DEFAULT_GIMBAL_INVERT,
): GimbalSpeedVector => {
  const pitchSign = invert.vertical ? 1 : -1;
  const panSign = invert.horizontal ? 1 : -1;
  return {
    pitch: clamp(intentPitch * speed.pitch * pitchSign, GIMBAL_PITCH_LIMIT),
    pan: clamp(intentPan * speed.pan * panSign, GIMBAL_PAN_LIMIT),
  };
};

/** Combine held directions into a natural intent vector, then to speed values. */
export const directionsToSpeeds = (
  directions: Iterable<GimbalDirection>,
  speed: GimbalSpeedVector,
  invert: GimbalInvert = DEFAULT_GIMBAL_INVERT,
): GimbalSpeedVector => {
  let intentPitch = 0;
  let intentPan = 0;
  for (const direction of directions) {
    switch (direction) {
      case 'up': intentPitch += 1; break;
      case 'down': intentPitch -= 1; break;
      case 'right': intentPan += 1; break;
      case 'left': intentPan -= 1; break;
    }
  }
  return intentToSpeeds(intentPitch, intentPan, speed, invert);
};

export const formatAngle = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}°` : '—';
