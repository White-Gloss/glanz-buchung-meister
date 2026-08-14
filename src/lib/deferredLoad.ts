type VisibilityEntry = { isIntersecting: boolean };
type VisibilityObserver = {
  observe: (element: Element) => void;
  disconnect: () => void;
};

export type VisibilityObserverConstructor = new (
  callback: (entries: VisibilityEntry[]) => void,
  options: { rootMargin: string },
) => VisibilityObserver;

export function deferUntilNearViewport(
  element: Element,
  onLoad: () => void,
  Observer:
    VisibilityObserverConstructor | undefined = globalThis.IntersectionObserver as unknown as
    VisibilityObserverConstructor | undefined,
): () => void {
  if (!Observer) {
    onLoad();
    return () => undefined;
  }

  let loaded = false;
  const observer = new Observer(
    (entries) => {
      if (loaded || !entries.some((entry) => entry.isIntersecting)) return;
      loaded = true;
      onLoad();
      observer.disconnect();
    },
    { rootMargin: "500px 0px" },
  );

  observer.observe(element);
  return () => observer.disconnect();
}
