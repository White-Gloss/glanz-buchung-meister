// Run with the existing server environment. Never prints credentials or customers.
import { setTimeout as delay } from "node:timers/promises";
import { createInterface } from "node:readline/promises";
let key = process.env.ROAPP_API_KEY;
if (process.argv.includes("--stdin-key")) {
  const reader = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  key = (await reader.question("RO credential input ready: ")).trim();
  reader.close();
}
if (!key) throw new Error("ROAPP_API_KEY missing");
const get = async (path) => {
  await delay(350);
  const response = await fetch(`https://api.roapp.io/v2${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = (await response.text()).replaceAll(key, "[redacted]").replace(/[a-f0-9]{32,}/gi, "[redacted]");
    throw new Error(`RO ${path}: HTTP ${response.status}: ${detail.slice(0,400)}`);
  }
  return response.json();
};
const list = (data) => Array.isArray(data) ? data : data.data || data.items || [];
for (const path of ["/company/locations", "/orders/types", "/orders/statuses"]) {
  const data = await get(path);
  console.log(path, JSON.stringify(list(data).map(row => ({ id: row.id, name: row.name || row.title, group: row.group }))));
}
console.log("configured_ids", JSON.stringify(Object.fromEntries(["ROAPP_BRANCH_ID","ROAPP_ASSIGNEE_ID","ROAPP_ORDER_TYPE_ID"].map(k => [k, process.env[k] || null]))));
const orders = await get("/orders");
console.log("orders_metadata", JSON.stringify(Object.fromEntries(Object.entries(orders).filter(([k,v]) => !Array.isArray(v) && typeof v !== "object"))));
const rows = list(orders);
console.log("orders_first_page_count", rows.length);
if (rows[0]?.id) {
  const data = await get(`/orders/${rows[0].id}`);
  const row = data.data || data;
  console.log("order_keys", JSON.stringify(Object.keys(row)));
  for (const [key,value] of Object.entries(row)) {
    if (/status|total|price|amount|sum|approval|scheduled|branch|type|modified/i.test(key)) {
      console.log("order_field", key, JSON.stringify(value));
    }
  }
}
