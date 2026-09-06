import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BOOKING_CONTRACT = "white-gloss-booking-workflow=1\n";

/** Called only after all production build/postprocessing commands succeeded. */
export async function writeDeployContract(outputDirectory, migrationNames) {
  for (const name of [
    "0007_booking_workflow.sql",
    "0008_notification_delivery.sql",
    "0009_whatsapp_receipts.sql",
  ]) {
    if (!Array.isArray(migrationNames) || !migrationNames.includes(name)) {
      throw new Error("Deployment contract requires the booking workflow migration manifest.");
    }
  }
  if (!(await stat(join(outputDirectory, "server", "index.mjs"))).isFile()) {
    throw new Error("Deployment contract requires the completed server build.");
  }
  await writeFile(join(outputDirectory, "booking-workflow.contract"), BOOKING_CONTRACT, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const migrationNames = JSON.parse(
    await readFile(new URL("../server/release-migrations.generated.json", import.meta.url), "utf8"),
  );
  await writeDeployContract(fileURLToPath(new URL("../.output/", import.meta.url)), migrationNames);
  console.log("[release] Booking workflow compatibility contract written.");
}
