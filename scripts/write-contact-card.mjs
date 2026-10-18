import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contactCard } from "../src/data/contact-card.ts";
import { renderContactCard, renderVCard } from "./contact-card-template.mjs";

const publicDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public",
);

for (const field of [
  "website",
  "whatsapp",
  "instagram",
  "facebook",
  "cardUrl",
]) {
  const value = contactCard[field];
  if (field === "facebook" && !value) continue;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`Contact card requires a public HTTPS URL for ${field}.`);
  }
}
if (!/^\+[1-9][0-9]{6,14}$/.test(contactCard.phone)) {
  throw new Error("Contact card requires an international telephone number.");
}

mkdirSync(publicDirectory, { recursive: true });
writeFileSync(
  resolve(publicDirectory, "visitenkarte.html"),
  renderContactCard(contactCard),
  "utf8",
);
writeFileSync(
  resolve(publicDirectory, "visitenkarte.vcf"),
  renderVCard(contactCard),
  "utf8",
);
console.log(
  "Public contact page and vCard generated from shared contact details.",
);
