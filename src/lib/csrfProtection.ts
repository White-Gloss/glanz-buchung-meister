const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection is required for state-changing server functions. Read-only
 * requests cannot mutate state and must remain available to crawlers and
 * auditing clients that legitimately omit browser origin headers.
 */
export function shouldValidateCsrf(handlerType: string, method: string): boolean {
  return handlerType === "serverFn" && !READ_ONLY_METHODS.has(method.toUpperCase());
}
