import { describe, expect, it } from 'vitest';
import { readPersisted, writePersisted, type StorageLike } from './persistentState';

const createFakeStorage = (): StorageLike & { entries: Map<string, string> } => {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
  };
};

describe('persistentState', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(readPersisted('missing', true, createFakeStorage())).toBe(true);
    expect(readPersisted('missing', { a: 1 }, createFakeStorage())).toEqual({ a: 1 });
  });

  it('round-trips values', () => {
    const storage = createFakeStorage();
    writePersisted('key', { vertical: true }, storage);
    expect(readPersisted('key', { vertical: false }, storage)).toEqual({ vertical: true });
  });

  it('recovers from corrupted stored data', () => {
    const storage = createFakeStorage();
    storage.setItem('key', '{not json');
    expect(readPersisted('key', 'fallback', storage)).toBe('fallback');
  });

  it('is a no-op without a storage backend', () => {
    expect(readPersisted('key', 42)).toBe(42);
    expect(() => writePersisted('key', 1)).not.toThrow();
  });
});
