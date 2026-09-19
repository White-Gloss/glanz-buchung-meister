// Administrator-run setup. Credentials are read from hidden stdin, never logged.
import { readFile, writeFile, copyFile, mkdir, chmod } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";
const reader = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const key = (await reader.question("RO key (hidden by stty -echo): ")).trim();
reader.close();
if (!/^[a-zA-Z0-9_-]{16,200}$/.test(key)) throw new Error("Invalid key format");
const api = async (path, body) => {
  await delay(350);
  const result = await fetch(`https://api.roapp.io/v2${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) throw new Error(`RO ${path}: ${result.status}`);
  return result.json();
};
const list = (result) => Array.isArray(result) ? result : result.data || result.items || [];
const one = (rows, label) => { if (rows.length !== 1 || !rows[0].id) throw new Error(`Ambiguous ${label}`); return rows[0].id; };
const locations = list(await api("/company/locations"));
const types = list(await api("/orders/types"));
const employees = list(await api("/company/employees"));
const statuses = list(await api("/orders/statuses"));
console.log("employee_identity_fields", JSON.stringify(employees.map(e => ({ id:e.id, name:e.name, first_name:e.first_name, last_name:e.last_name, full_name:e.full_name }))));
const owner = employees.filter(e => /lars/i.test([e.name,e.first_name,e.full_name].filter(Boolean).join(" ")));
const configured = {
  ROAPP_API_KEY: key,
  ROAPP_BRANCH_ID: one(locations,"location"),
  ROAPP_ORDER_TYPE_ID: one(types,"type"),
  ROAPP_ASSIGNEE_ID: one(owner,"owner"),
  ROAPP_APPROVED_STATUS_ID: one(statuses.filter(s => s.name === "Fixpreis bestätigt"),"approval status"),
};
console.log("verified_config", JSON.stringify({ ...configured, ROAPP_API_KEY: "configured" }));
const filename = "/etc/white-gloss/environment";
const existing = await readFile(filename,"utf8");
await mkdir("/var/backups/white-gloss", { recursive:true, mode:0o700 });
const backup = `/var/backups/white-gloss/environment-before-roapp-${Date.now()}`;
await copyFile(filename,backup);
await chmod(backup,0o600);
const names = new Set(Object.keys(configured));
const lines = existing.split(/\r?\n/).filter(line => !names.has(line.split("=")[0].trim()));
for (const [name,value] of Object.entries(configured)) lines.push(`${name}=${JSON.stringify(String(value))}`);
await writeFile(`${filename}.roapp-new`,lines.join("\n")+"\n", {mode:0o600});
const { rename } = await import("node:fs/promises");
await rename(`${filename}.roapp-new`,filename);
console.log("credentials_updated_backup_created_service_not_restarted");
// One clearly labelled internal draft only. Persist ids before continuing.
const testFile = "/var/tmp/white-gloss-roapp-setup-test.json";
let testState = JSON.parse(await readFile(testFile,"utf8").catch(() => "{}"));
const id = (result) => result.id || result.data?.id;
if (!testState.person) {
  if (testState.personStarted) throw new Error("Reconcile previous contact creation first");
  testState.personStarted = true;
  await writeFile(testFile,JSON.stringify(testState),{mode:0o600});
  testState.person = id(await api("/contacts/people", { first_name:"INTERNER", last_name:"INTEGRATIONSTEST", email:"integration-test@example.invalid", phones:[], notes:"Technischer Test, keine Kundenkommunikation, keine Rechnung." }));
  if (!testState.person) throw new Error("Contact response missing id");
  await writeFile(testFile,JSON.stringify(testState),{mode:0o600});
}
if (!testState.order) {
  if (testState.orderStarted) throw new Error("Reconcile previous order creation first");
  testState.orderStarted=true;
  await writeFile(testFile,JSON.stringify(testState),{mode:0o600});
  testState.order=id(await api("/orders", { branch_id:configured.ROAPP_BRANCH_ID,order_type_id:configured.ROAPP_ORDER_TYPE_ID,client_id:testState.person,assignee_id:configured.ROAPP_ASSIGNEE_ID,malfunction:"INTERNER INTEGRATIONSTEST – NICHT AUSFÜHREN. Keine Rechnung. Foto- und Freigabefluss prüfen.",manager_notes:"Technischer Test von White Gloss. Keine echte Buchung.",estimated_price:"149.00 EUR" }));
  if (!testState.order) throw new Error("Order response missing id");
  await writeFile(testFile,JSON.stringify(testState),{mode:0o600});
}
const response=await api(`/orders/${testState.order}`);
const order=response.data || response;
console.log("test_ids",JSON.stringify(testState));
console.log("order_keys",JSON.stringify(Object.keys(order)));
for (const [name,value] of Object.entries(order)) {
  if (/status|total|price|amount|sum|approval|scheduled|branch|type|modified/i.test(name)) console.log("order_field",name,JSON.stringify(value));
}
