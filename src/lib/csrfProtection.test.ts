import { describe, expect, it } from "vitest";
import { shouldValidateCsrf } from "./csrfProtection";

describe("shouldValidateCsrf", () => {
  it("does not require origin headers for read-only public server-function requests", () => {
    expect(shouldValidateCsrf("serverFn", "GET")).toBe(false);
    expect(shouldValidateCsrf("serverFn", "HEAD")).toBe(false);
  });

  it("keeps CSRF validation enabled for state-changing server functions", () => {
    expect(shouldValidateCsrf("serverFn", "POST")).toBe(true);
    expect(shouldValidateCsrf("serverFn", "PUT")).toBe(true);
    expect(shouldValidateCsrf("serverFn", "PATCH")).toBe(true);
    expect(shouldValidateCsrf("serverFn", "DELETE")).toBe(true);
  });

  it("does not apply server-function CSRF validation to page requests", () => {
    expect(shouldValidateCsrf("route", "POST")).toBe(false);
  });
});
