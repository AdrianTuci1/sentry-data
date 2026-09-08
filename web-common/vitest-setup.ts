import "@testing-library/jest-dom";
import { vi } from "vitest";
import { Settings } from "luxon";

// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  enumerable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  enumerable: true,
  value: vi.fn(),
});

Settings.defaultWeekSettings = {
  minimalDays: 4,
  firstDay: 1,
  weekend: [6, 7],
};

// The paraglide i18n runtime (src/lib/i18n/gen/runtime.js) resolves the active locale
// by reading window.localStorage (and can write sessionStorage). Some tests run outside
// jsdom, where these globals are undefined, which throws during locale resolution.
// Provide a minimal in-memory shim so those tests can resolve any locale strategy.
function createStorageShim() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (typeof globalThis[name] === "undefined") {
    Object.defineProperty(globalThis, name, {
      writable: true,
      enumerable: true,
      value: createStorageShim(),
    });
  }
}
