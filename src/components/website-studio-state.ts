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
  draftRevisionId: number | null;
  publishedRevisionId: number | null;
}): boolean {
  return (
    !input.dirty &&
    !input.busy &&
    input.draftRevisionId !== null &&
    input.draftRevisionId !== input.publishedRevisionId
  );
}
