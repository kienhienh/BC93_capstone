import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserSessionStore, SESSION_STORAGE_KEY } from "./session-store";

afterEach(() => {
  localStorage.clear();
});

describe("createBrowserSessionStore", () => {
  it("reads and parses a stored session", async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: "abc" }));
    const store = createBrowserSessionStore();
    await expect(store.read()).resolves.toEqual({ token: "abc" });
  });

  it("reads null when nothing is stored", async () => {
    const store = createBrowserSessionStore();
    await expect(store.read()).resolves.toBeNull();
  });

  it("reads undefined when the stored value is malformed JSON", async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "{not json");
    const store = createBrowserSessionStore();
    await expect(store.read()).resolves.toBeUndefined();
  });

  it("saves a session under the storage key", () => {
    const store = createBrowserSessionStore();
    store.save({ token: "xyz" } as never);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe(JSON.stringify({ token: "xyz" }));
  });

  it("clears the stored session", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: "abc" }));
    const store = createBrowserSessionStore();
    store.clear();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("notifies subscribers on a matching storage event", () => {
    const store = createBrowserSessionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    window.dispatchEvent(new StorageEvent("storage", {
      storageArea: localStorage,
      key: SESSION_STORAGE_KEY,
      newValue: JSON.stringify({ token: "new" }),
    }));
    expect(listener).toHaveBeenCalledWith({ token: "new" });

    unsubscribe();
  });

  it("ignores storage events for a different key", () => {
    const store = createBrowserSessionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    window.dispatchEvent(new StorageEvent("storage", {
      storageArea: localStorage,
      key: "other-key",
      newValue: "irrelevant",
    }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores storage events from a different storage area", () => {
    const store = createBrowserSessionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    window.dispatchEvent(new StorageEvent("storage", {
      storageArea: sessionStorage,
      key: SESSION_STORAGE_KEY,
      newValue: "irrelevant",
    }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const store = createBrowserSessionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    window.dispatchEvent(new StorageEvent("storage", {
      storageArea: localStorage,
      key: SESSION_STORAGE_KEY,
      newValue: JSON.stringify({ token: "new" }),
    }));
    expect(listener).not.toHaveBeenCalled();
  });
});
