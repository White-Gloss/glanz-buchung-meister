const utf8 = new TextEncoder();

function text(value) {
  return String(value ?? "");
}

function escapeHtml(value) {
  return text(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function webUrl(value, field) {
  const original = text(value);
  let parsed;
  try {
    parsed = new URL(original);
  } catch {
    throw new TypeError(`Invalid contact URL: ${field}`);
  }
  if (
    !/^https?:$/.test(parsed.protocol) ||
    /[\u0000-\u0020\u007f]/u.test(original)
  ) {
    throw new TypeError(`Invalid contact URL: ${field}`);
  }
  return parsed.href;
}

function readContact(contact) {
  if (!contact || typeof contact !== "object") {
    throw new TypeError("Contact data is required");
  }
  const result = Object.fromEntries(
    [
      "name",
      "owner",
      "tagline",
      "phone",
      "phoneDisplay",
      "email",
      "street",
      "postalCode",
      "city",
      "country",
      "instagramHandle",
    ].map((key) => [key, text(contact[key])]),
  );
  if (!result.name.trim()) throw new TypeError("Contact name is required");
  if (!/^\+?[0-9]{6,20}$/.test(result.phone)) {
    throw new TypeError("Contact phone must contain an optional + and digits");
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(result.email)) {
    throw new TypeError("Invalid contact email");
  }
  result.phoneDisplay ||= result.phone;
  for (const key of ["website", "whatsapp", "instagram", "cardUrl"]) {
    result[key] = webUrl(contact[key], key);
  }
  result.facebook = contact.facebook
    ? webUrl(contact.facebook, "facebook")
    : null;
  return result;
}

const iconPaths = {
  contact:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5 16c0-2 6-2 6 0m3-7h4m-4 4h4"/>',
  save: '<path d="M12 3v11m-4-4 4 4 4-4M5 15v5h14v-5"/>',
  chat: '<path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.7-.8L3 21l1.8-4.8a9 9 0 0 1-.8-3.7A8.5 8.5 0 0 1 12.5 4 7.5 7.5 0 0 1 20 11.5Z"/><path d="M8 9c.4 3.4 2.6 5.6 6 6l1-2-2-1-1 1-2-2 1-1-1-2Z"/>',
  phone:
    '<path d="m8 3 2 5-3 2a16 16 0 0 0 7 7l2-3 5 2v4a1 1 0 0 1-1 1C10.6 20.5 3.5 13.4 3 4a1 1 0 0 1 1-1Z"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/>',
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none"/>',
  facebook:
    '<path d="M14 21v-8h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.5a19 19 0 0 0-3-.3c-3 0-5 1.8-5 5.2V9H7v4h3v8"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
};

function icon(name, className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
}

function linkRow({
  href,
  label,
  detail,
  iconName,
  primary = false,
  download = false,
}) {
  const downloadAttribute = download
    ? ' download="White-Gloss-Detailing.vcf" type="text/vcard"'
    : "";
  return `<a class="action${primary ? " action--primary" : ""}" href="${escapeHtml(href)}"${downloadAttribute}>
        ${icon(iconName)}
        <span class="action-copy"><span class="action-label">${escapeHtml(label)}</span>${detail ? `<span class="action-detail">${escapeHtml(detail)}</span>` : ""}</span>
        ${icon(download ? "save" : "arrow", "action-arrow")}
      </a>`;
}

/** Render the public contact page. All actions work without client-side JavaScript. */
export function renderContactCard(contact) {
  const c = readContact(contact);
  const h = escapeHtml;
  const siteLabel = new URL(c.website).hostname.replace(/^www\./, "");
  const description = `${c.name}: Kontakt speichern, anrufen oder über WhatsApp erreichen. Website und Social-Media-Profile auf einen Blick.`;
  const socialLinks = [
    { href: c.website, label: "Website", detail: siteLabel, iconName: "globe" },
    {
      href: c.instagram,
      label: "Instagram",
      detail: c.instagramHandle || "Profil öffnen",
      iconName: "instagram",
    },
    ...(c.facebook
      ? [
          {
            href: c.facebook,
            label: "Facebook",
            detail: "Seite öffnen",
            iconName: "facebook",
          },
        ]
      : []),
  ];

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0e1218">
  <meta name="description" content="${h(description)}">
  <title>${h(c.name)} · Digitale Visitenkarte</title>
  <link rel="canonical" href="${h(c.cardUrl)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    @font-face{font-family:Barlow;font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/barlow-400.woff2') format('woff2')}
    @font-face{font-family:Barlow;font-style:normal;font-weight:500;font-display:swap;src:url('/fonts/barlow-500.woff2') format('woff2')}
    @font-face{font-family:Barlow;font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/barlow-600.woff2') format('woff2')}
    :root{color-scheme:dark;font-family:Barlow,Arial,ui-sans-serif,system-ui,sans-serif;color:#f4f3ed;background:#0e1218;--muted:#bbc5d1;--line:#bfd1e533;--accent:#bfcee0}
    *{box-sizing:border-box}
    body{margin:0;min-width:320px;min-height:100vh;min-height:100svh;font-size:16px;line-height:1.5;-webkit-text-size-adjust:100%;text-size-adjust:100%}
    a{color:inherit;text-decoration:none;-webkit-tap-highlight-color:#bfcee033}
    a:focus-visible{outline:3px solid #e2eeff;outline-offset:5px}
    .skip-link{position:absolute;z-index:2;left:16px;top:12px;transform:translateY(-200%);padding:12px 16px;color:#0e1218;background:#f4f3ed}
    .skip-link:focus{transform:translateY(0)}
    .card{width:min(100%,560px);margin:0 auto;padding:32px 24px 20px;padding-top:max(32px,env(safe-area-inset-top));padding-bottom:max(20px,env(safe-area-inset-bottom))}
    .identity{padding:0 0 24px}
    .brand{display:block;width:160px;height:auto;margin:0 0 28px;object-fit:contain}
    .eyebrow{margin:0 0 12px;font-size:12px;font-weight:500;line-height:1.4;letter-spacing:.17em;text-transform:uppercase;color:var(--muted)}
    h1{margin:0;font-size:clamp(30px,7.8vw,42px);font-weight:400;letter-spacing:-.035em;line-height:1.06;overflow-wrap:anywhere;text-wrap:balance}
    .tagline{max-width:34ch;margin:14px 0 0;font-size:17px;line-height:1.5;color:var(--muted);overflow-wrap:anywhere}
    .owner{margin:12px 0 0;font-size:15px;color:#f4f3ed;overflow-wrap:anywhere}
    .actions{display:grid;gap:12px}
    .action{display:flex;align-items:center;gap:14px;min-height:68px;padding:15px 18px;border:1px solid var(--line);border-radius:4px;background:#151d27}
    .action--primary{min-height:76px;background:var(--accent);border-color:var(--accent);color:#0e1218}
    .icon{display:block;width:24px;height:24px;flex:0 0 24px}
    .action-copy{display:block;flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
    .action-label{display:block;font-size:17px;font-weight:500;line-height:1.3}
    .action-detail{display:block;margin-top:3px;font-size:13px;line-height:1.35;color:var(--muted)}
    .action--primary .action-detail{color:#293849}
    .action-arrow{width:18px;height:18px;flex:0 0 18px;color:var(--muted)}
    .action--primary .action-arrow{color:#0e1218}
    .direct-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .direct-actions .action{min-height:74px;gap:10px;padding:14px}
    .direct-actions .action-arrow{display:none}
    .direct-actions .action-label{font-size:16px}
    .direct-actions .action-detail{font-size:12px}
    .profiles{display:grid;gap:10px;margin-top:8px}
    .details{margin:28px 0 0;padding-top:22px;border-top:1px solid var(--line);font-style:normal;color:var(--muted);font-size:15px}
    .email{display:inline-flex;align-items:center;min-height:44px;max-width:100%;padding:8px 0;color:#f4f3ed;overflow-wrap:anywhere;text-decoration:underline;text-decoration-color:#bfcee066;text-underline-offset:4px}
    .address{margin:8px 0 0;overflow-wrap:anywhere}
    .footer{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:20px;border-top:1px solid var(--line);padding-top:8px;font-size:13px;color:var(--muted)}
    .footer a{display:inline-flex;align-items:center;min-height:44px;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:4px}
    @media(hover:hover){.action:hover{background:#202c3a;border-color:#bfcee077}.action--primary:hover{background:#d3deeb;border-color:#d3deeb}.email:hover,.footer a:hover{color:#fff;text-decoration-color:currentColor}}
    @media(min-width:700px){.card{margin-top:36px;margin-bottom:36px;padding:40px;border:1px solid var(--line);border-radius:4px}.brand{width:174px}.identity{padding-bottom:28px}}
    @media(max-width:359px){.card{padding-right:20px;padding-left:20px}.direct-actions{grid-template-columns:1fr}.direct-actions .action{min-height:68px;padding:15px 18px;gap:14px}.direct-actions .action-label{font-size:17px}.direct-actions .action-detail{font-size:13px}.direct-actions .action-arrow{display:block}}
    @media(forced-colors:active){.action,.card{border:1px solid ButtonText}.action--primary{background:Canvas;color:CanvasText}.action-detail,.action-arrow{color:CanvasText}}
  </style>
</head>
<body>
  <a class="skip-link" href="#kontakt">Zu den Kontaktmöglichkeiten</a>
  <main class="card">
    <header class="identity">
      <img class="brand" src="/media/logo-280.webp" alt="${h(c.name)}" width="280" height="161" decoding="async">
      <p class="eyebrow">Digitale Visitenkarte</p>
      <h1>${h(c.name)}</h1>
      ${c.tagline ? `<p class="tagline">${h(c.tagline)}</p>` : ""}
      ${c.owner ? `<p class="owner">${h(c.owner)}</p>` : ""}
    </header>
    <nav class="actions" id="kontakt" aria-label="Kontaktmöglichkeiten">
      ${linkRow({ href: "/visitenkarte.vcf", label: "Kontakt speichern", detail: "Kontaktdaten im Handy speichern", iconName: "contact", primary: true, download: true })}
      <div class="direct-actions">
        ${linkRow({ href: c.whatsapp, label: "WhatsApp", detail: "Chat öffnen", iconName: "chat" })}
        ${linkRow({ href: `tel:${c.phone}`, label: "Anrufen", detail: c.phoneDisplay, iconName: "phone" })}
      </div>
      <div class="profiles">
        ${socialLinks.map(linkRow).join("\n        ")}
      </div>
    </nav>
    <address class="details">
      <a class="email" href="mailto:${h(c.email)}">${h(c.email)}</a>
      <p class="address">${h(c.street)}<br>${h([c.postalCode, c.city].filter(Boolean).join(" "))}${c.country ? `<br>${h(c.country)}` : ""}</p>
    </address>
    <footer class="footer" aria-label="Rechtliche Informationen">
      <a href="https://white-gloss.de/impressum">Impressum</a>
      <a href="https://white-gloss.de/datenschutz">Datenschutz</a>
    </footer>
  </main>
</body>
</html>
`;
}

function escapeVCardText(value) {
  return text(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

// Count UTF-8 octets, including the leading space on each continuation line.
// Iteration over code points keeps multibyte characters and surrogate pairs intact.
function foldVCardLine(line) {
  const parts = [];
  let part = "";
  let bytes = 0;
  for (const character of line) {
    const size = utf8.encode(character).length;
    if (bytes + size > 75) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += character;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n");
}

/** Render a deterministic vCard 3.0 with CRLF endings and UTF-8-safe line folding. */
export function renderVCard(contact) {
  const c = readContact(contact);
  const e = escapeVCardText;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${e(c.name)}`,
    `N:${e(c.name)};;;;`,
    `ORG:${e(c.name)}`,
    "X-ABShowAs:COMPANY",
    `TEL;TYPE=WORK,CELL,VOICE:${c.phone}`,
    `EMAIL;TYPE=INTERNET,WORK:${e(c.email)}`,
    `ADR;TYPE=WORK:;;${e(c.street)};${e(c.city)};;${e(c.postalCode)};${e(c.country)}`,
    `SOURCE:${c.cardUrl}`,
  ];
  const links = [
    c.website,
    c.whatsapp,
    c.instagram,
    ...(c.facebook ? [c.facebook] : []),
    c.cardUrl,
  ];
  lines.push(...links.map((url) => `URL:${url}`));
  const notes = [
    c.owner ? `Ansprechpartner: ${c.owner}` : "",
    c.tagline,
  ].filter(Boolean);
  if (notes.length) lines.push(`NOTE:${e(notes.join("\n"))}`);
  lines.push("END:VCARD");
  return `${lines.map(foldVCardLine).join("\r\n")}\r\n`;
}
