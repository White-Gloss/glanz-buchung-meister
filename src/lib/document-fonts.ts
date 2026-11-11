import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont, PDFPage, PDFPageDrawTextOptions } from "pdf-lib";
import { gunzipSync } from "node:zlib";
import { documentFontData } from "./document-font-data.generated.ts";

const fontBytes = {
  body: gunzipSync(Buffer.from(documentFontData.body, "base64")),
  bodyStrong: gunzipSync(Buffer.from(documentFontData.bodyStrong, "base64")),
  heading: gunzipSync(Buffer.from(documentFontData.heading, "base64")),
  numbers: gunzipSync(Buffer.from(documentFontData.numbers, "base64")),
  fallback: gunzipSync(Buffer.from(documentFontData.fallback, "base64")),
};

/** New PDFs only. Existing files and signature originals are never re-rendered. */
export async function embedDocumentFonts(doc: PDFDocument) {
  doc.registerFontkit(fontkit);
  const [body, bodyStrong, heading, numbers, fallback] = await Promise.all([
    doc.embedFont(fontBytes.body, { subset: true }),
    doc.embedFont(fontBytes.bodyStrong, { subset: true }),
    doc.embedFont(fontBytes.heading, { subset: true }),
    doc.embedFont(fontBytes.numbers, { subset: true }),
    doc.embedFont(fontBytes.fallback, { subset: true }),
  ]);
  return { body, bodyStrong, heading, numbers, fallback };
}

const supportedCharacters = new WeakMap<PDFFont, Set<number>>();
const segmenter = new Intl.Segmenter("de", { granularity: "grapheme" });

function coverage(font: PDFFont): Set<number> {
  let supported = supportedCharacters.get(font);
  if (!supported) {
    supported = new Set(font.getCharacterSet());
    supportedCharacters.set(font, supported);
  }
  return supported;
}

export function documentGraphemes(value: string): string[] {
  return Array.from(segmenter.segment(value), (part) => part.segment);
}

function supports(font: PDFFont, value: string): boolean {
  return Array.from(value).every((character) => coverage(font).has(character.codePointAt(0)!));
}

/** Preserve the existing '?' treatment for characters no supplied font can render. */
export function documentText(value: string, font: PDFFont, fallback = font): string {
  return documentGraphemes(String(value).normalize("NFC").replace(/\r/g, ""))
    .map((grapheme) => {
      const activeFont = supports(font, grapheme) ? font : fallback;
      return Array.from(grapheme, (character) =>
        character === "\n" || coverage(activeFont).has(character.codePointAt(0)!) ? character : "?",
      ).join("");
    })
    .join("");
}

/** Match the panel's grapheme runs: wrapping, alignment and drawing share one selection. */
export function documentTextRenderer({ body, fallback }: { body: PDFFont; fallback: PDFFont }) {
  const choices = new WeakMap<PDFFont, Map<string, PDFFont>>();
  const runs = (value: string, primary = body): { font: PDFFont; text: string }[] => {
    let cache = choices.get(primary);
    if (!cache) {
      cache = new Map();
      choices.set(primary, cache);
    }
    const result: { font: PDFFont; text: string }[] = [];
    for (const grapheme of documentGraphemes(documentText(value, primary, fallback))) {
      let font = cache.get(grapheme);
      if (!font) {
        font = supports(primary, grapheme) ? primary : fallback;
        cache.set(grapheme, font);
      }
      const last = result.at(-1);
      if (last?.font === font) last.text += grapheme;
      else result.push({ font, text: grapheme });
    }
    return result;
  };
  return {
    widthOfTextAtSize(value: string, size: number, primary = body): number {
      return runs(value, primary).reduce((width, run) => width + run.font.widthOfTextAtSize(run.text, size), 0);
    },
    drawText(page: PDFPage, value: string, options: PDFPageDrawTextOptions & { x: number; size: number }): void {
      let x = options.x;
      for (const run of runs(value, options.font ?? body)) {
        page.drawText(run.text, { ...options, x, font: run.font });
        x += run.font.widthOfTextAtSize(run.text, options.size);
      }
    },
  };
}
