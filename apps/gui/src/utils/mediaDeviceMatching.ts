import type {
  FrontEndDevice,
  FrontEndDeviceWithMediaInfo,
  MediaDeviceCandidate,
  MediaMatchSource,
} from '../../types';

export type EnumeratedMediaDevice = {
  deviceId: string;
  label: string;
};

export type LinkMediaDevicesOptions = {
  salts?: string[];
  origin?: string;
  manualMapping?: Record<string, MediaDeviceCandidate>;
};

const textEncoder = new TextEncoder();

/**
 * Ask the user/browser for camera permission with a throwaway stream.
 * Without a prior grant Chromium returns blank labels and device IDs from
 * `enumerateDevices()`, which makes any matching impossible.
 */
export const primeCameraPermission = async (): Promise<void> => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  stream.getTracks().forEach((track) => track.stop());
};

export const enumerateVideoInputs = async (): Promise<EnumeratedMediaDevice[]> => {
  try {
    await primeCameraPermission();
  } catch (error) {
    console.warn('Unable to prime camera permission, device labels may be empty', error);
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device) => ({ deviceId: device.deviceId, label: device.label }));
};

/**
 * Chromium derives the Web-exposed video `deviceId` as
 *   hex(HMAC-SHA256(key = origin, message = rawDeviceId + salt))
 * where `rawDeviceId` is the OS device path (e.g. `/dev/video0` on Linux).
 * Reproducing it lets us map SDK devices to `enumerateDevices()` entries
 * exactly, including several units of the same model.
 */
export const hmacHex = async (key: string, message: string): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const computeDeviceIdCandidates = async (
  rawIds: string[],
  salts: string[],
  origin: string,
): Promise<Set<string>> => {
  const candidates = new Set<string>();
  if (!globalThis.crypto?.subtle) {
    console.warn('Web Crypto unavailable, skipping exact device id matching');
    return candidates;
  }
  for (const salt of salts) {
    for (const rawId of rawIds) {
      if (!rawId) continue;
      candidates.add(await hmacHex(origin, rawId + salt));
    }
  }
  return candidates;
};

export const normalizeLabel = (label: string): string =>
  label
    .toLowerCase()
    .replace(/\([0-9a-f]{4}:[0-9a-f]{4}\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildLabelHints = (device: FrontEndDevice): string[] => {
  const hints = new Set<string>();
  const addHint = (value?: string) => {
    if (!value) return;
    const normalized = normalizeLabel(value);
    if (normalized.length >= 3) hints.add(normalized);
  };
  addHint(device.product);
  addHint(device.productTypeName ? `obsbot ${device.productTypeName}` : '');
  addHint(device.productTypeName);
  return Array.from(hints);
};

export const labelMatchScore = (label: string, device: FrontEndDevice): number => {
  const normalizedLabel = normalizeLabel(label);
  if (!normalizedLabel) return 0;
  return buildLabelHints(device).reduce(
    (score, hint) => (normalizedLabel.includes(hint) ? Math.max(score, hint.length) : score),
    0,
  );
};

export const toMediaDeviceCandidates = (devices: EnumeratedMediaDevice[]): MediaDeviceCandidate[] =>
  devices.map((device) => ({ deviceId: device.deviceId, label: device.label || 'Unknown camera' }));

type Resolution = {
  matched?: EnumeratedMediaDevice;
  matchSource: MediaMatchSource;
  matchCandidates?: MediaDeviceCandidate[];
  staleManualMapping?: boolean;
};

const maxHintLength = (device: FrontEndDevice): number =>
  buildLabelHints(device).reduce((max, hint) => Math.max(max, hint.length), 0);

export const linkMediaDevicesToRealDevices = async (
  devices: Record<string, FrontEndDevice>,
  enumerated: EnumeratedMediaDevice[],
  options: LinkMediaDevicesOptions = {},
): Promise<Record<string, FrontEndDeviceWithMediaInfo>> => {
  const { salts = [], origin, manualMapping = {} } = options;
  const available = new Map<string, EnumeratedMediaDevice>();
  for (const device of enumerated) {
    if (device.deviceId) available.set(device.deviceId, device);
  }

  const entries = Object.entries(devices);
  const resolutions = new Map<string, Resolution>();

  // Pre-compute the exact (HMAC) device id candidates for every device. A given
  // physical OS path can only be claimed by one device, which prevents a stale
  // manual mapping from stealing a camera that definitively belongs to another
  // connected device (e.g. after swapping cameras on the same USB port).
  const exactCandidates = new Map<string, Set<string>>();
  const exactOwner = new Map<string, string>();
  if (salts.length > 0 && origin) {
    for (const [key, device] of entries) {
      const rawIds = (device.videoPaths?.length ? device.videoPaths : [device.videoPath]).filter(Boolean);
      const candidates = await computeDeviceIdCandidates(rawIds, salts, origin);
      exactCandidates.set(key, candidates);
      for (const deviceId of candidates) {
        if (available.has(deviceId) && !exactOwner.has(deviceId)) {
          exactOwner.set(deviceId, key);
        }
      }
    }
  }

  // Pass 1: deterministic matches. Manual mapping wins only when it does not
  // conflict with another device's exact match, then exact HMAC.
  for (const [key, device] of entries) {
    const resolution: Resolution = { matchSource: 'none' };

    const manualEntry = manualMapping[device.sn];
    if (manualEntry) {
      const owner = exactOwner.get(manualEntry.deviceId);
      if (available.has(manualEntry.deviceId) && (!owner || owner === key)) {
        resolution.matched = available.get(manualEntry.deviceId);
        resolution.matchSource = 'manual';
      } else {
        // The saved assignment no longer points to a usable camera for this
        // device (camera moved path, was replaced, or another device owns it).
        resolution.staleManualMapping = true;
      }
    }

    if (!resolution.matched && exactCandidates.has(key)) {
      const candidates = exactCandidates.get(key)!;
      for (const [deviceId, info] of available) {
        if (candidates.has(deviceId) && exactOwner.get(deviceId) === key) {
          resolution.matched = info;
          resolution.matchSource = 'exact';
          break;
        }
      }
    }

    if (resolution.matched) available.delete(resolution.matched.deviceId);
    resolutions.set(key, resolution);
  }

  // Pass 2: heuristic label matching, most specific devices first so that
  // e.g. "Tiny 4k" claims its label before "Tiny" can consume it.
  const unresolved = entries
    .filter(([key]) => !resolutions.get(key)?.matched)
    .sort((a, b) => maxHintLength(b[1]) - maxHintLength(a[1]));

  for (const [key, device] of unresolved) {
    const scored = Array.from(available.values())
      .map((info) => ({ info, score: labelMatchScore(info.label, device) }))
      .filter((entry) => entry.score > 0);
    if (scored.length === 0) continue;

    const bestScore = Math.max(...scored.map((entry) => entry.score));
    const best = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.info);

    if (best.length === 1) {
      resolutions.set(key, { ...resolutions.get(key), matched: best[0], matchSource: 'label' });
      available.delete(best[0].deviceId);
    } else {
      resolutions.set(key, {
        ...resolutions.get(key),
        matchSource: 'ambiguous',
        matchCandidates: toMediaDeviceCandidates(best),
      });
    }
  }

  const linked: Record<string, FrontEndDeviceWithMediaInfo> = {};
  for (const [key, device] of entries) {
    const resolution = resolutions.get(key) ?? { matchSource: 'none' as MediaMatchSource };
    linked[key] = {
      ...device,
      mediaDeviceId: resolution.matched?.deviceId ?? '',
      mediaDeviceLabel: resolution.matched?.label ?? '',
      matchSource: resolution.matchSource,
      matchCandidates: resolution.matchCandidates,
      staleManualMapping: resolution.staleManualMapping,
    };
  }

  return linked;
};
