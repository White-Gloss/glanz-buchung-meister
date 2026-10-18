import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/data/site";

function escapeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function contactCard(): string {
  const [givenName, ...familyName] = site.owner.split(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeValue(familyName.join(" "))};${escapeValue(givenName)};;;`,
    `FN:${escapeValue(site.owner)}`,
    `ORG:${escapeValue(site.legalName)}`,
    `TEL;TYPE=CELL,WORK:${site.phoneHref.slice(4)}`,
    `EMAIL;TYPE=WORK:${site.email}`,
    `URL:${site.origin}`,
    `ADR;TYPE=WORK:;;${escapeValue(site.street)};${escapeValue(site.city)};;${escapeValue(site.postalCode)};${escapeValue(site.country)}`,
    `X-SOCIALPROFILE;TYPE=instagram:${site.instagram}`,
    ...(site.facebook ? [`X-SOCIALPROFILE;TYPE=facebook:${site.facebook}`] : []),
    `IMPP;X-SERVICE-TYPE=WhatsApp:${site.whatsappHref}`,
    "END:VCARD",
    "",
  ];
  return lines.join("\r\n");
}

export const Route = createFileRoute("/kontakt.vcf")({
  server: {
    handlers: {
      GET: () =>
        new Response(contactCard(), {
          headers: {
            "content-type": "text/vcard; charset=utf-8",
            "content-disposition": 'attachment; filename="White-Gloss.vcf"',
            "cache-control": "public, max-age=300",
          },
        }),
    },
  },
});
