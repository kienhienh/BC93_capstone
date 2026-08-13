import type { SessionStore } from "../../features/authentication/wiring";

export const SESSION_STORAGE_KEY = "fiverr-marketplace-session";

export function createBrowserSessionStore(): SessionStore {
  return {
    read: async () => readStoredValue(localStorage.getItem(SESSION_STORAGE_KEY)),
    save: (session) => localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session)),
    clear: () => localStorage.removeItem(SESSION_STORAGE_KEY),
    subscribe(listener) {
      const onStorage = (event: StorageEvent) => {
        if (event.storageArea === localStorage && event.key === SESSION_STORAGE_KEY) {
          listener(readStoredValue(event.newValue));
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}

function readStoredValue(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
