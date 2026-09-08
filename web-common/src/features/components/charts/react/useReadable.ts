import { useCallback, useRef, useSyncExternalStore } from "react";
import type { Readable } from "svelte/store";

/**
 * Bridges a Svelte `Readable` (or writable) store into React by subscribing
 * to it and re-rendering whenever it emits.
 *
 * Svelte stores emit synchronously on `subscribe`, so the current value is
 * captured before React reads the snapshot. This mirrors the semantics of
 * Svelte's `$store` auto-subscription without requiring an explicit
 * unsubscribe in every component.
 *
 * Pass `undefined`/`null` to opt out (returns `undefined`); this matches the
 * optional-store pattern used throughout the pivot tables.
 */
export function useReadable<T>(
  store: Readable<T> | null | undefined,
): T | undefined {
  // Keep the current store in a ref so the subscription callback stays stable
  // without being re-created on every render (stores can be reassigned).
  const storeRef = useRef<Readable<T> | null | undefined>(store);
  storeRef.current = store;

  // Mirror of the store's latest value, updated synchronously on subscribe.
  const valueRef = useRef<T | undefined>(undefined);

  const subscribe = useCallback((onStoreChange: () => void) => {
    const current = storeRef.current;
    if (!current) {
      return () => {};
    }
    const unsubscribe = current.subscribe((value) => {
      valueRef.current = value;
      onStoreChange();
    });
    return unsubscribe;
  }, []);

  const getSnapshot = useCallback(() => valueRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
