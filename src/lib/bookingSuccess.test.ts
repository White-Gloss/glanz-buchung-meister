import { describe, expect, it, vi } from "vitest";

import { navigateAfterBooking } from "./bookingSuccess";

describe("navigateAfterBooking", () => {
  it("uses a privacy-conscious thank-you URL", async () => {
    const navigate = vi.fn().mockResolvedValue(undefined);
    const hardRedirect = vi.fn();

    await navigateAfterBooking(
      { invoiceNumber: "WGD-2026-1001", customerName: "Max Mustermann" },
      navigate,
      hardRedirect,
    );

    expect(navigate).toHaveBeenCalledWith("/danke?nr=WGD-2026-1001&name=Max");
    expect(hardRedirect).not.toHaveBeenCalled();
  });

  it("falls back to a hard redirect when router navigation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const navigate = vi.fn().mockRejectedValue(new Error("router failed"));
    const hardRedirect = vi.fn();

    await expect(
      navigateAfterBooking(
        { invoiceNumber: "WGD-2026-1001", customerName: "Max Mustermann" },
        navigate,
        hardRedirect,
      ),
    ).resolves.toBeUndefined();

    expect(hardRedirect).toHaveBeenCalledWith("/danke?nr=WGD-2026-1001&name=Max");
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
