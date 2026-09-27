export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const resolveStorage = (storage?: StorageLike): StorageLike | undefined => {
  if (storage) return storage;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
};

export const readPersisted = <T>(key: string, fallback: T, storage?: StorageLike): T => {
  const store = resolveStorage(storage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

export const writePersisted = <T>(key: string, value: T, storage?: StorageLike): void => {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors (quota, disabled storage, ...)
  }
};
