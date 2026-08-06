/**
 * MARKDOWN-AUFBEREITUNG FÜR RATGEBER-BEITRÄGE
 * --------------------------------------------
 * Wandelt den im Admin-Panel gepflegten Markdown-Text in HTML um und zieht
 * dabei gleichzeitig das Inhaltsverzeichnis (alle H2/H3 mit Anker-IDs).
 *
 * SICHERHEIT: Der Text wird ZUERST vollständig HTML-escaped und erst
 * danach werden die Markdown-Muster in Tags übersetzt. Dadurch kann aus
 * dem Datenbankinhalt kein eigenes Markup und kein <script> entstehen —
 * auch dann nicht, wenn ein Admin-Zugang kompromittiert wäre. Der Preis
 * dafür: roher HTML-Code im Beitrag wird als Text angezeigt, nicht
 * gerendert. Das ist bewusst so gewählt.
 *
 * Kein zusätzliches Paket: der unterstützte Markdown-Umfang ist bewusst
 * klein (Überschriften, Absätze, Listen, Links, Bilder, Zitate, Code,
 * Trennlinien, fett/kursiv) und deckt redaktionelle Ratgeber-Texte ab.
 */

export type TocHeading = {
  /** Anker-Ziel, z. B. "wie-lange-haelt-eine-keramikversiegelung" */
  id: string;
  text: string;
  level: 2 | 3;
};

export type RenderedArticle = {
  html: string;
  headings: TocHeading[];
  /** Geschätzte Lesedauer in Minuten (für den Artikelkopf). */
  readingMinutes: number;
  /** Reiner Text ohne Markup — Grundlage für automatische Kurzfassungen. */
  plainText: string;
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Macht aus escaptem HTML-Text wieder lesbaren Klartext (für TOC/Alt-Texte). */
function unescapeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Anker-IDs aus deutschen Überschriften. Umlaute werden ausgeschrieben
 * statt entfernt, damit die URL lesbar bleibt — Google zeigt Anker-Links
 * als Sitelinks an, dort ist "…haelt-eine-keramikversiegelung" deutlich
 * aussagekräftiger als "…hlt-eine-keramikversiegelung".
 */
export function slugifyHeading(text: string): string {
  return (
    unescapeHtml(text)
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      // Kombinierende Akzente entfernen (é -> e), danach bleibt nur ASCII.
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "abschnitt"
  );
}

/**
 * Nur Ziele zulassen, die im Browser eine Navigation auslösen. Verhindert
 * `javascript:`- und `data:`-URLs in Links und Bildquellen.
 */
function safeUrl(rawUrl: string): string | null {
  const url = unescapeHtml(rawUrl).trim();
  if (!url) return null;
  if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(url)) return escapeHtml(url);
  return null;
}

/**
 * Liest Breite und Höhe aus einer Bild-URL, sofern sie beim Upload
 * angehängt wurden (…?w=1600&h=900). Damit können width/height am
 * <img> gesetzt werden, ohne die Maße in einer eigenen Spalte zu führen —
 * ohne diese Attribute springt das Layout beim Nachladen (CLS).
 */
export function imageDimensionsFromUrl(url: string): { width: number; height: number } | null {
  const match = /[?&]w=(\d{1,5})&h=(\d{1,5})/.exec(url);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height };
}

/** Fällt auf 16:9 zurück, wenn die echten Maße nicht bekannt sind. */
export function imageAttributes(url: string): { width: number; height: number } {
  return imageDimensionsFromUrl(url) ?? { width: 1600, height: 900 };
}

/**
 * Inline-Auszeichnungen. Erwartet bereits escapten Text und liefert HTML.
 * Reihenfolge ist wichtig: Code-Spans zuerst herausnehmen, damit darin
 * enthaltene Sternchen nicht als Fettschrift interpretiert werden.
 */
function renderInline(escapedText: string): string {
  const codeSpans: string[] = [];
  let text = escapedText.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `\uE000CODE${codeSpans.length - 1}\uE000`;
  });

  // Bilder vor Links, weil ![alt](url) sonst als Link mit "!" davor gilt.
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt: string, url: string) => {
    const src = safeUrl(url);
    if (!src) return match;
    const { width, height } = imageAttributes(unescapeHtml(url));
    return (
      `<img src="${src}" alt="${alt}" width="${width}" height="${height}" ` +
      `loading="lazy" decoding="async" class="my-6 h-auto w-full rounded-2xl border border-border/60" />`
    );
  });

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    const href = safeUrl(url);
    if (!href) return match;
    // Externe Ziele in neuem Tab und ohne Referrer-Weitergabe öffnen.
    const isExternal = /^https?:\/\//i.test(unescapeHtml(url));
    const attributes = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${href}"${attributes} class="text-primary underline underline-offset-2 hover:text-primary/80">${label}</a>`;
  });

  text = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return text.replace(
    /\uE000CODE(\d+)\uE000/g,
    (_match, index: string) =>
      `<code class="rounded bg-secondary/60 px-1.5 py-0.5 text-[0.9em]">${codeSpans[Number(index)]}</code>`,
  );
}

/**
 * Baut aus dem Markdown-Text HTML und Inhaltsverzeichnis.
 *
 * Zeilenweiser Blockparser: jede Zeile gehört zu genau einem Blocktyp,
 * mehrzeilige Blöcke (Listen, Zitate, Code) werden gesammelt und beim
 * Wechsel des Typs abgeschlossen.
 */
export function renderArticle(markdown: string): RenderedArticle {
  const source = String(markdown ?? "").replace(/\r\n?/g, "\n");
  const lines = source.split("\n");

  const html: string[] = [];
  const headings: TocHeading[] = [];
  const usedIds = new Set<string>();

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let quoteLines: string[] = [];
  let codeLines: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = renderInline(escapeHtml(paragraph.join(" ")));
    html.push(`<p class="mt-5 leading-7 text-muted-foreground">${text}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listType || listItems.length === 0) {
      listItems = [];
      listType = null;
      return;
    }
    const items = listItems
      .map((item) => `<li class="leading-7">${renderInline(escapeHtml(item))}</li>`)
      .join("");
    const listClass =
      listType === "ul"
        ? "mt-5 list-disc space-y-2 pl-6 text-muted-foreground"
        : "mt-5 list-decimal space-y-2 pl-6 text-muted-foreground";
    html.push(`<${listType} class="${listClass}">${items}</${listType}>`);
    listItems = [];
    listType = null;
  }

  function flushQuote() {
    if (quoteLines.length === 0) return;
    const text = renderInline(escapeHtml(quoteLines.join(" ")));
    html.push(
      `<blockquote class="mt-6 border-l-2 border-primary/60 pl-4 italic text-foreground/80">${text}</blockquote>`,
    );
    quoteLines = [];
  }

  /** Schließt alle offenen Blöcke — vor jedem neuen Blocktyp aufrufen. */
  function flushAll() {
    flushParagraph();
    flushList();
    flushQuote();
  }

  function uniqueHeadingId(text: string): string {
    const base = slugifyHeading(text);
    let id = base;
    let counter = 2;
    // Doppelte Überschriften bekommen ein Suffix, sonst zeigen zwei
    // Inhaltsverzeichnis-Einträge auf dieselbe Stelle.
    while (usedIds.has(id)) {
      id = `${base}-${counter}`;
      counter += 1;
    }
    usedIds.add(id);
    return id;
  }

  for (const line of lines) {
    // Code-Block: alles bis zum schließenden ``` wörtlich übernehmen.
    if (/^```/.test(line.trim())) {
      if (codeLines === null) {
        flushAll();
        codeLines = [];
      } else {
        html.push(
          `<pre class="mt-6 overflow-x-auto rounded-2xl border border-border/60 bg-secondary/40 p-4 text-sm"><code>${escapeHtml(
            codeLines.join("\n"),
          )}</code></pre>`,
        );
        codeLines = null;
      }
      continue;
    }
    if (codeLines !== null) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    // Überschriften. H1 bleibt der Beitragstitel im Seitenkopf, deshalb
    // beginnt die Gliederung im Fließtext bei H2.
    const headingMatch = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length === 2 ? 2 : 3;
      const rawText = headingMatch[2].trim();
      const id = uniqueHeadingId(rawText);
      const text = renderInline(escapeHtml(rawText));
      headings.push({ id, text: unescapeHtml(rawText), level });

      const className =
        level === 2
          ? "display-section mt-12 scroll-mt-24 uppercase text-foreground"
          : "display-card mt-8 scroll-mt-24 uppercase text-foreground";
      html.push(`<h${level} id="${id}" class="${className}">${text}</h${level}>`);
      continue;
    }

    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      flushAll();
      html.push('<hr class="mt-10 border-border/60" />');
      continue;
    }

    const quoteMatch = /^>\s?(.*)$/.exec(trimmed);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const bulletMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }

  // Ein nicht geschlossener Code-Block soll den Beitrag nicht verschlucken.
  if (codeLines !== null && codeLines.length > 0) {
    html.push(
      `<pre class="mt-6 overflow-x-auto rounded-2xl border border-border/60 bg-secondary/40 p-4 text-sm"><code>${escapeHtml(
        codeLines.join("\n"),
      )}</code></pre>`,
    );
  }
  flushAll();

  const plainText = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = plainText ? plainText.split(" ").length : 0;

  return {
    html: html.join("\n"),
    headings,
    // 200 Wörter/Minute ist der übliche Richtwert für deutsche Fließtexte.
    readingMinutes: Math.max(1, Math.round(wordCount / 200)),
    plainText,
  };
}

/**
 * Kurzfassung für Meta-Description und Vorschaukarten, wenn im Admin-Panel
 * keine eigene gepflegt wurde. Schneidet an der letzten Wortgrenze ab.
 */
export function excerptFrom(text: string, maxLength = 160): string {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
