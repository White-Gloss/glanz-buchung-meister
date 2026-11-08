export type StudioActivity = { dirty: boolean; busy: boolean };

/** Track independent media cards and uploads. Clearing one operation must not
 * discard the unsaved work or pending request owned by another card. */
export function createStudioActivityRegistry() {
  const entries = new Map<string, StudioActivity>();
  return {
    update(key: string, next: StudioActivity | null): StudioActivity {
      if (next && (next.dirty || next.busy)) entries.set(key, next);
      else entries.delete(key);
      return {
        dirty: [...entries.values()].some((entry) => entry.dirty),
        busy: [...entries.values()].some((entry) => entry.busy),
      };
    },
  };
}
