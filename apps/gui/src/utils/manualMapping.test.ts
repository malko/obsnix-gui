import { describe, expect, it } from 'vitest';
import {
  MANUAL_MAPPING_STORAGE_KEY,
  loadManualMapping,
  removeManualMappingEntry,
  saveManualMapping,
  setManualMappingEntry,
  type StorageLike,
} from './manualMapping';

const createFakeStorage = (): StorageLike & { entries: Map<string, string> } => {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: (key) => { entries.delete(key); },
  };
};

describe('manualMapping', () => {
  it('returns an empty mapping when nothing is stored', () => {
    expect(loadManualMapping(createFakeStorage())).toEqual({});
  });

  it('persists, loads and removes entries', () => {
    const storage = createFakeStorage();

    const afterSet = setManualMappingEntry('SN1', { deviceId: 'dev-1', label: 'Camera 1' }, storage);
    expect(afterSet).toEqual({ SN1: { deviceId: 'dev-1', label: 'Camera 1' } });
    expect(loadManualMapping(storage)).toEqual({ SN1: { deviceId: 'dev-1', label: 'Camera 1' } });

    const afterRemove = removeManualMappingEntry('SN1', storage);
    expect(afterRemove).toEqual({});
    expect(loadManualMapping(storage)).toEqual({});
  });

  it('overwrites an existing entry for the same serial number', () => {
    const storage = createFakeStorage();
    setManualMappingEntry('SN1', { deviceId: 'dev-1', label: 'Camera 1' }, storage);
    setManualMappingEntry('SN1', { deviceId: 'dev-2', label: 'Camera 2' }, storage);
    expect(loadManualMapping(storage)).toEqual({ SN1: { deviceId: 'dev-2', label: 'Camera 2' } });
  });

  it('recovers from corrupted stored data', () => {
    const storage = createFakeStorage();
    storage.setItem(MANUAL_MAPPING_STORAGE_KEY, '{not json');
    expect(loadManualMapping(storage)).toEqual({});
  });

  it('is a no-op without a storage backend', () => {
    expect(loadManualMapping()).toEqual({});
    expect(() => saveManualMapping({ SN1: { deviceId: 'x', label: 'y' } })).not.toThrow();
  });
});
