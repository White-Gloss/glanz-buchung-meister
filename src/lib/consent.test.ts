import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  CONSENT_STORAGE_KEY,
  getStoredConsent,
  onConsentChange,
  setStoredConsent,
} from "./consent.ts";

/**
 * `consent.ts` greift ausschließlich über `window.localStorage` und
 * `window.dispatchEvent`/`addEventListener` zu. Im Node-Testkontext gibt es
 * kein echtes `window` — ein minimaler Fake reicht aus, um Speichern, Lesen
 * und Benachrichtigen zu prüfen, ohne einen Browser zu simulieren.
 */
function installFakeWindow() {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<(event: Event) => void>>();

  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
    addEventListener: (type: string, handler: (event: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(handler);
    },
    removeEventListener: (type: string, handler: (event: Event) => void) => {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((handler) => handler(event));
      return true;
    },
  };

  (globalThis as { window?: unknown }).window = fakeWindow;
  return fakeWindow;
}

function uninstallFakeWindow() {
  delete (globalThis as { window?: unknown }).window;
}

describe("getStoredConsent / setStoredConsent", () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it("liefert null ohne window (z. B. beim serverseitigen Rendern)", () => {
    assert.equal(getStoredConsent(), null);
  });

  it("liefert null ohne gespeicherte Entscheidung", () => {
    installFakeWindow();
    assert.equal(getStoredConsent(), null);
  });

  it("speichert und liest 'accepted' und 'rejected' zurück", () => {
    const fakeWindow = installFakeWindow();
    setStoredConsent("accepted");
    assert.equal(getStoredConsent(), "accepted");
    assert.equal(fakeWindow.localStorage.getItem(CONSENT_STORAGE_KEY), "accepted");

    setStoredConsent("rejected");
    assert.equal(getStoredConsent(), "rejected");
  });

  it("ignoriert fremde Werte im Speicher", () => {
    const fakeWindow = installFakeWindow();
    fakeWindow.localStorage.setItem(CONSENT_STORAGE_KEY, "maybe");
    assert.equal(getStoredConsent(), null);
  });

  it("benachrichtigt onConsentChange-Listener beim Speichern", () => {
    installFakeWindow();
    const seen: string[] = [];
    const unsubscribe = onConsentChange((choice) => seen.push(choice));

    setStoredConsent("accepted");
    setStoredConsent("rejected");
    unsubscribe();
    setStoredConsent("accepted");

    assert.deepEqual(seen, ["accepted", "rejected"]);
  });
});
