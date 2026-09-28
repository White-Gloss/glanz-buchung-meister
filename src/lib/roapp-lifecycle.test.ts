import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lifecyclePlan,
  lifecycleKey,
  approvedRoLifecycleMessage,
  RO_REMINDER,
  RO_REVIEW,
} from "./roapp-lifecycle.ts";
process.env.BOOKING_OPERATIONS = "roapp";
process.env.ROAPP_ACCOUNT_SCOPE = "new-test-account";
process.env.ROAPP_LIFECYCLE_MAIL_ENABLED = "true";
process.env.ROAPP_CONFIRMED_STATUS_IDS = "20,21";
process.env.ROAPP_COMPLETED_STATUS_IDS = "30,31";
const now = Date.parse("2026-09-28T12:00:00Z");
const row = {
  id: 1,
  customer_name: "Test",
  email: "test@example.invalid",
  pickup_cents: 0,
  city_slug: null,
  review_email_consent: false,
  ro_order_id: 11,
  fixed_price: true,
  status_id: 20,
  scheduled_for: "2026-10-02T12:00:00Z",
  owner_confirmed_at: "2026-09-28T11:00:00Z",
  completed_at: null,
};

test("a request, price approval or customer acceptance alone never schedules a reminder", () => {
  for (const change of [
    { fixed_price: false },
    { owner_confirmed_at: null },
    { status_id: 10 },
    { scheduled_for: null },
    { email: null },
  ])
    assert.deepEqual(lifecyclePlan({ ...row, ...change }, now), []);
  const [reminder] = lifecyclePlan(row, now);
  assert.equal(reminder.due, Date.parse(row.scheduled_for) - 3 * 86400000);
  assert.match(reminder.body, /Übergabe/);
  assert.doesNotMatch(reminder.body, /bezahlt/);
});
test("review is due seven days after completion with consent, regardless of satisfaction", () => {
  const done = { ...row, status_id: 30, completed_at: "2026-09-28T11:00:00Z" };
  assert.deepEqual(lifecyclePlan(done, now), []);
  const [review] = lifecyclePlan({ ...done, review_email_consent: true }, now);
  assert.equal(review.event, RO_REVIEW);
  assert.equal(review.due, Date.parse(done.completed_at) + 7 * 86400000);
  assert.match(review.body, /unabhängig/);
  assert.match(review.body, /placeid=ChIJt4HmUJZNl0cRclCPAX64s1Y/);
  assert.deepEqual(lifecyclePlan({ ...done, review_email_consent: true, status_id: 99 }, now), []);
});
test("rescheduling creates a distinct capability; retired accounts and mismatched events remain blocked", () => {
  const key = lifecycleKey(1, "reminder", row.scheduled_for);
  assert.equal(approvedRoLifecycleMessage(key, RO_REMINDER), true);
  assert.equal(approvedRoLifecycleMessage(key, RO_REVIEW), false);
  assert.equal(
    approvedRoLifecycleMessage(key.replace("new-test-account", "legacy"), RO_REMINDER),
    false,
  );
  assert.notEqual(key, lifecycleKey(1, "reminder", "2026-10-03T12:00:00Z"));
});
