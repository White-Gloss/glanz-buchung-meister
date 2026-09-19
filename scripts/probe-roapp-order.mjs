// Run only for the internal test rejected with HTTP 400; never for customer orders.
import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const file = "/var/tmp/white-gloss-roapp-setup-test.json";
const state = JSON.parse(await readFile(file, "utf8"));
const key = process.env.ROAPP_API_KEY;
const api = async (path, body) => {
  await delay(400);
  const response = await fetch(`https://api.roapp.io/v2${path}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, "Content-Type":"application/json" },
    ...(body ? { body:JSON.stringify(body) } : {}), signal:AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.replaceAll(key,"[redacted]").slice(0,3000)}`);
  return JSON.parse(text);
};
const list = await api("/orders");
const rows = Array.isArray(list) ? list : list.data || list.items || [];
if (!state.order) {
  if (rows.length || !state.person) throw new Error("Reconcile orders before creating the internal test");
  const order = await api("/orders", {
    branch_id:Number(process.env.ROAPP_BRANCH_ID), order_type_id:Number(process.env.ROAPP_ORDER_TYPE_ID),
    client_id:state.person, assignee_id:Number(process.env.ROAPP_ASSIGNEE_ID),
    malfunction:"INTERNER INTEGRATIONSTEST – NICHT AUSFÜHREN. Keine Rechnung.",
    manager_notes:"Technischer Test, keine echte Buchung.", estimated_price:"149.00 EUR",
  });
  state.order = order.id || order.data?.id;
  await writeFile(file,JSON.stringify(state),{mode:0o600});
}
console.log("test_ids",JSON.stringify(state));
if (!state.order) throw new Error("Missing order id");
if (process.argv.includes("--item") && !state.item) {
  if (state.itemStarted) throw new Error("Reconcile internal test item first");
  state.itemStarted=true;
  await writeFile(file,JSON.stringify(state),{mode:0o600});
  const item = await api(`/orders/${state.order}/items`,{
    entity_id:66904352,assignee_id:Number(process.env.ROAPP_ASSIGNEE_ID),quantity:1,price:149,cost:0,
    discount:{type:"percentage",percentage:0,amount:0,sponsor:"staff"},
    warranty:{period:"0",periodUnits:"days"},comment:"Interner Preistest, kein Kundenauftrag",
  });
  state.item=item.id || item.data?.id || true;
  await writeFile(file,JSON.stringify(state),{mode:0o600});
}
const response = await api(`/orders/${state.order}`);
const order = response.data || response;
console.log("order_keys",Object.keys(order));
for (const [name,value] of Object.entries(order)) {
  if (/status|total|price|amount|sum|approval|scheduled|branch|type|modified/i.test(name)) console.log("order_field",name,JSON.stringify(value));
}
const link=await api(`/orders/${state.order}/public-url`);
console.log("public_link_shape", typeof link === "string" ? "string" : Object.keys(link));
const raw=typeof link === "string" ? link : link.url || link.data?.url;
if(raw) console.log("public_link_host",new URL(raw).hostname);
