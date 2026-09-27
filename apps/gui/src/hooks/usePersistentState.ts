import { useCallback, useState } from 'react';
import { readPersisted, writePersisted } from '../utils/persistentState';

/**
 * Like `useState`, but persisted to localStorage under `key` so the value
 * survives restarts (used for section open/closed state and gimbal settings).
 */
export const usePersistentState = <T>(key: string, defaultValue: T): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => readPersisted(key, defaultValue));

  const update = useCallback((next: T) => {
    setValue(next);
    writePersisted(key, next);
  }, [key]);

  return [value, update];
};
