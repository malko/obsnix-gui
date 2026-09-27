import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DEFAULT_GIMBAL_INVERT,
  GIMBAL_SPEEDS,
  intentToSpeeds,
  type GimbalDirection,
  type GimbalInvert,
  type GimbalSpeed,
} from '../utils/gimbal';
import { usePersistentState } from '../hooks/usePersistentState';
import { ToggleButton } from './ToggleButton';

type Props = {
  deviceSn: string;
  /** Called when the parent should refresh the device status (angles). */
  onRefreshStatus?: () => void;
};

const PAD_SIZE = 160;
const KNOB_SIZE = 56;
const TRAVEL = (PAD_SIZE - KNOB_SIZE) / 2;

const KEY_DIRECTIONS: Record<string, GimbalDirection> = {
  arrowup: 'up', w: 'up', k: 'up',
  arrowdown: 'down', s: 'down', j: 'down',
  arrowleft: 'left', a: 'left', h: 'left',
  arrowright: 'right', d: 'right', l: 'right',
};

const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

/**
 * Drag-based gimbal joystick. Drag inside the circle to move proportionally to
 * the distance from the center; also works with arrow keys / hjkl. The first
 * move disables AI tracking on the device (manual control requirement).
 */
export const GimbalControl = ({ deviceSn, onRefreshStatus }: Props) => {
  const [speed, setSpeed] = useState<GimbalSpeed>('normal');
  const [invert, setInvert] = usePersistentState<GimbalInvert>('obsnix:gimbal-invert', DEFAULT_GIMBAL_INVERT);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const padRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const pointerRef = useRef({ pitch: 0, pan: 0 });
  const heldKeysRef = useRef<Set<GimbalDirection>>(new Set());
  const lastSentRef = useRef('');
  const refreshRef = useRef(onRefreshStatus);
  const speedRef = useRef(speed);
  const invertRef = useRef(invert);
  refreshRef.current = onRefreshStatus;
  speedRef.current = speed;
  invertRef.current = invert;

  const send = useCallback((pitch: number, pan: number) => {
    const key = `${pitch}:${pan}`;
    if (lastSentRef.current === key) return;
    lastSentRef.current = key;
    window.ipcRenderer.moveGimbal(deviceSn, pitch, pan);
  }, [deviceSn]);

  const syncActive = () => {
    setActive(draggingRef.current || heldKeysRef.current.size > 0);
  };

  const apply = useCallback(() => {
    let intentPitch = pointerRef.current.pitch;
    let intentPan = pointerRef.current.pan;
    for (const direction of heldKeysRef.current) {
      if (direction === 'up') intentPitch += 1;
      else if (direction === 'down') intentPitch -= 1;
      else if (direction === 'right') intentPan += 1;
      else if (direction === 'left') intentPan -= 1;
    }
    intentPitch = clampUnit(intentPitch);
    intentPan = clampUnit(intentPan);

    const { pitch, pan } = intentToSpeeds(intentPitch, intentPan, GIMBAL_SPEEDS[speedRef.current], invertRef.current);
    send(pitch, pan);
    setKnob({ x: intentPan, y: -intentPitch });
  }, [send]);

  // Poll the status while moving and for a moment after, until the gimbal
  // settles, so the angle readout converges (instead of lagging a click behind).
  const [settling, setSettling] = useState(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startSettling = useCallback((duration: number) => {
    setSettling(true);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => setSettling(false), duration);
  }, []);
  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  useEffect(() => {
    if (!active && !settling) return;
    refreshRef.current?.();
    const id = setInterval(() => refreshRef.current?.(), 200);
    return () => clearInterval(id);
  }, [active, settling]);

  // Re-apply with the new speed / inversion while a direction is held.
  useEffect(() => {
    if (active) apply();
  }, [speed, invert, active, apply]);

  // Make sure the gimbal stops when the device changes or we unmount.
  useEffect(() => {
    return () => {
      window.ipcRenderer.moveGimbal(deviceSn, 0, 0);
    };
  }, [deviceSn]);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const radius = rect.width / 2;
    if (radius <= 0) return;
    let dx = (clientX - (rect.left + radius)) / radius;
    let dy = (clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    pointerRef.current = { pitch: -dy, pan: dx };
    apply();
  };

  const releasePointer = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    pointerRef.current = { pitch: 0, pan: 0 };
    apply();
    syncActive();
    startSettling(800);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // pointer capture is best-effort
    }
    draggingRef.current = true;
    syncActive();
    updateFromPointer(event.clientX, event.clientY);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromPointer(event.clientX, event.clientY);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'enter' || key === 'escape') {
      event.preventDefault();
      void reset();
      return;
    }
    const direction = KEY_DIRECTIONS[key];
    if (!direction) return;
    event.preventDefault();
    if (heldKeysRef.current.has(direction)) return;
    heldKeysRef.current.add(direction);
    apply();
    syncActive();
  };

  const onKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction = KEY_DIRECTIONS[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    heldKeysRef.current.delete(direction);
    apply();
    syncActive();
    if (heldKeysRef.current.size === 0) startSettling(800);
  };

  const onBlur = () => {
    if (heldKeysRef.current.size === 0) return;
    heldKeysRef.current.clear();
    apply();
    syncActive();
  };

  const reset = async () => {
    heldKeysRef.current.clear();
    draggingRef.current = false;
    pointerRef.current = { pitch: 0, pan: 0 };
    apply();
    syncActive();
    startSettling(2000);
    await window.ipcRenderer.resetGimbal(deviceSn);
  };

  const setInvertAxis = (axis: keyof GimbalInvert) => {
    setInvert({ ...invert, [axis]: !invert[axis] });
  };

  return (
    <div className="gimbal-control">
      <div
        ref={padRef}
        className={`gimbal-joystick ${active ? 'is-active' : ''}`}
        style={{ width: PAD_SIZE, height: PAD_SIZE }}
        tabIndex={0}
        role="application"
        aria-label="Gimbal joystick. Drag, or use arrow keys or H J K L. Space, Enter or Escape to center."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onLostPointerCapture={releasePointer}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={onBlur}
      >
        <span className="gimbal-crosshair" aria-hidden="true" />
        <span
          className="gimbal-knob"
          aria-hidden="true"
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            transform: `translate(calc(-50% + ${knob.x * TRAVEL}px), calc(-50% + ${knob.y * TRAVEL}px))`,
          }}
        />
      </div>

      <div className="gimbal-actions">
        <button type="button" className="gimbal-reset" onClick={reset}>Center</button>
        <label className="gimbal-speed">
          Speed
          <select value={speed} onChange={(event) => setSpeed(event.target.value as GimbalSpeed)}>
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
      </div>

      <div className="gimbal-invert">
        <ToggleButton
          label="Invert tilt (up/down)"
          isActive={invert.vertical}
          tooltip="Reverse the camera's up/down movement."
          onToggle={() => setInvertAxis('vertical')}
        />
        <ToggleButton
          label="Invert pan (left/right)"
          isActive={invert.horizontal}
          tooltip="Reverse the camera's left/right movement."
          onToggle={() => setInvertAxis('horizontal')}
        />
      </div>
    </div>
  );
};
