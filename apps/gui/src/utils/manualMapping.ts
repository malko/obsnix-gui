import type { MediaDeviceCandidate } from '../../types';

export type ManualMapping = Record<string, MediaDeviceCandidate>;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const MANUAL_MAPPING_STORAGE_KEY = 'obsnix:media-device-mapping';

const resolveStorage = (storage?: StorageLike): StorageLike | undefined => {
  if (storage) return storage;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
};

export const loadManualMapping = (storage?: StorageLike): ManualMapping => {
  const store = resolveStorage(storage);
  if (!store) return {};
  try {
    const raw = store.getItem(MANUAL_MAPPING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as ManualMapping;
  } catch {
    return {};
  }
};

export const saveManualMapping = (mapping: ManualMapping, storage?: StorageLike): void => {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(MANUAL_MAPPING_STORAGE_KEY, JSON.stringify(mapping));
  } catch {
    // ignore storage errors (quota, disabled storage, ...)
  }
};

export const setManualMappingEntry = (sn: string, entry: MediaDeviceCandidate, storage?: StorageLike): ManualMapping => {
  const mapping = loadManualMapping(storage);
  mapping[sn] = entry;
  saveManualMapping(mapping, storage);
  return mapping;
};

export const removeManualMappingEntry = (sn: string, storage?: StorageLike): ManualMapping => {
  const mapping = loadManualMapping(storage);
  delete mapping[sn];
  saveManualMapping(mapping, storage);
  return mapping;
};
