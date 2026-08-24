import { describe, expect, it, vi } from "vitest";

import {
  completeCustomerSyncDurably,
  createCustomerDurably,
  CUSTOMER_CREATE_UNCERTAIN_MARKER,
} from "../../supabase/functions/_shared/erpnextCustomerSyncDurability";

describe("ERPNext customer synchronization durability", () => {
  it("persists an uncertain-outcome marker between two lease checks", async () => {
    const events: string[] = [];

    const result = await createCustomerDurably({
      assertLease: async () => {
        events.push("lease");
      },
      persistUncertainIntent: async (marker) => {
        events.push(marker);
      },
      createCustomer: async () => {
        events.push("customer_post");
        return "ERP-CUSTOMER-1";
      },
    });

    expect(events).toEqual(["lease", CUSTOMER_CREATE_UNCERTAIN_MARKER, "lease", "customer_post"]);
    expect(result).toBe("ERP-CUSTOMER-1");
  });

  it("does not create a Customer when the uncertain-outcome marker is not durable", async () => {
    const assertLease = vi.fn(async () => undefined);
    const createCustomer = vi.fn(async () => undefined);

    await expect(
      createCustomerDurably({
        assertLease,
        persistUncertainIntent: async () => {
          throw new Error("mapping_write_failed");
        },
        createCustomer,
      }),
    ).rejects.toThrow("mapping_write_failed");

    expect(assertLease).toHaveBeenCalledTimes(1);
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it("does not create a Customer when the final lease check fails", async () => {
    const assertLease = vi
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("customer_sync_lease_lost_before_write"));
    const createCustomer = vi.fn(async () => undefined);

    await expect(
      createCustomerDurably({
        assertLease,
        persistUncertainIntent: async () => undefined,
        createCustomer,
      }),
    ).rejects.toThrow("customer_sync_lease_lost_before_write");

    expect(assertLease).toHaveBeenCalledTimes(2);
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it("publishes synced state only after the booking mapping is durable", async () => {
    const events: string[] = [];

    await completeCustomerSyncDurably({
      persistBookingCustomerId: async () => {
        events.push("booking_mapping");
      },
      publishMappingSynced: async () => {
        events.push("mapping_synced");
      },
    });

    expect(events).toEqual(["booking_mapping", "mapping_synced"]);
  });

  it("does not publish synced state when the booking mapping fails", async () => {
    const publishMappingSynced = vi.fn(async () => undefined);

    await expect(
      completeCustomerSyncDurably({
        persistBookingCustomerId: async () => {
          throw new Error("booking_mapping_update_failed");
        },
        publishMappingSynced,
      }),
    ).rejects.toThrow("booking_mapping_update_failed");

    expect(publishMappingSynced).not.toHaveBeenCalled();
  });
});
