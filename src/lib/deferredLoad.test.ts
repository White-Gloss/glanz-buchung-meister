import { describe, expect, it, vi } from "vitest";
import { deferUntilNearViewport } from "./deferredLoad";

describe("deferUntilNearViewport", () => {
  it("waits until the element approaches the viewport and loads only once", () => {
    let callback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const Observer = class {
      constructor(next: typeof callback, options: { rootMargin: string }) {
        callback = next;
        expect(options.rootMargin).toBe("500px 0px");
      }
      observe = observe;
      disconnect = disconnect;
    };
    const load = vi.fn();

    const cleanup = deferUntilNearViewport({} as Element, load, Observer);
    expect(observe).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();

    callback?.([{ isIntersecting: false }]);
    expect(load).not.toHaveBeenCalled();

    callback?.([{ isIntersecting: true }]);
    callback?.([{ isIntersecting: true }]);
    expect(load).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalled();

    cleanup();
  });

  it("loads immediately when IntersectionObserver is unavailable", () => {
    const load = vi.fn();
    deferUntilNearViewport({} as Element, load, undefined);
    expect(load).toHaveBeenCalledOnce();
  });
});
