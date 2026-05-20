import { useEffect, useState } from "react";

function readStoredValue<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") return initialValue;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return initialValue;
    const parsed = JSON.parse(stored);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      initialValue &&
      typeof initialValue === "object" &&
      !Array.isArray(initialValue)
    ) {
      return { ...initialValue, ...parsed };
    }
    return parsed as T;
  } catch {
    return initialValue;
  }
}

export function clearPersistentState(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures; persistence should never block the form.
  }
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => readStoredValue(key, initialValue));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore storage failures; the in-memory state still works normally.
    }
  }, [key, state]);

  return [state, setState] as const;
}
