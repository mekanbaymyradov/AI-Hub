import { useState } from "react";

/**
 * Return state that is also saved in localStorage, so it outlives a reload.
 *
 * Args:
 *   isValid: Checks a saved value, which may be stale or edited by hand; one
 *     that fails is ignored for `initial`.
 *
 * Storage that throws, as in some private windows, leaves the value unsaved.
 */
export function useStoredState<T>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      const parsed: unknown = saved === null ? undefined : JSON.parse(saved);
      return isValid(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });

  const update = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Unsaved: it still holds for this visit.
    }
  };

  return [value, update];
}
