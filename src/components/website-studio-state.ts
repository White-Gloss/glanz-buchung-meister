/** Pure editor transitions; server revision checks remain authoritative. */
export function moveStudioItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    return result;
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

export function studioCanPublish(input: {
  dirty: boolean;
  busy: boolean;
  archived?: boolean;
  draftRevisionId: number | null;
  publishedRevisionId: number | null;
}): boolean {
  return (
    !input.dirty &&
    !input.busy &&
    !input.archived &&
    input.draftRevisionId !== null &&
    input.draftRevisionId !== input.publishedRevisionId
  );
}

export function createStudioRequestGate() {
  let current: { cancelled: boolean } | null = null;
  return {
    begin() {
      const request = { cancelled: false };
      current = request;
      return {
        isCurrent: () => current === request && !request.cancelled,
        cancel: () => {
          request.cancelled = true;
        },
      };
    },
  };
}
