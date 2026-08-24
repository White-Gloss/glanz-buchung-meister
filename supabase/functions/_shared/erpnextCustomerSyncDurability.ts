export const CUSTOMER_CREATE_UNCERTAIN_MARKER = "uncertain_customer_create_started";

type CustomerCreateExecution<T> = {
  assertLease: () => Promise<void>;
  persistUncertainIntent: (marker: string) => Promise<void>;
  createCustomer: () => Promise<T>;
};

type CustomerSyncCompletion = {
  persistBookingCustomerId: () => Promise<void>;
  publishMappingSynced: () => Promise<void>;
};

export async function createCustomerDurably<T>({
  assertLease,
  persistUncertainIntent,
  createCustomer,
}: CustomerCreateExecution<T>): Promise<T> {
  await assertLease();
  await persistUncertainIntent(CUSTOMER_CREATE_UNCERTAIN_MARKER);
  await assertLease();
  return await createCustomer();
}

export async function completeCustomerSyncDurably({
  persistBookingCustomerId,
  publishMappingSynced,
}: CustomerSyncCompletion) {
  await persistBookingCustomerId();
  await publishMappingSynced();
}
