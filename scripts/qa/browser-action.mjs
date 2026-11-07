// Attach error handling to the response wait and UI action together.
export async function observeBrowserAction(page, predicate, action) {
  const response = page.waitForResponse(predicate);
  const [received] = await Promise.all([response, Promise.resolve().then(action)]);
  return received;
}
