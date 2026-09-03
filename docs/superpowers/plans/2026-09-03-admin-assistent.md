# Admin-Assistent (Posteingang) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operator-Chat mit Gemini im Admin-Panel, der bestehende Agent-Befehle/Tools nutzt, Inbox-Kontext versteht und Kundenantworten nur als Entwurf liefert.

**Architecture:** Serverseitiger Gemini-Tool-Loop hinter `createServerFn` + `operatorMiddleware`. Bestehende `parseAgentCommand` / `executeParsed`-Logik bleibt die Ausführungsquelle für Buchungs-/Kundenaktionen. Neues Chat-Panel im Admin-Shell; Entwurf-Antworten landen im Posteingang-UI zur Operator-Prüfung. Phase B (WhatsApp-Inbound im Posteingang) ist ein separates Folgeplan-Dokument — hier nur Anker.

**Tech Stack:** TanStack Start, React, TypeScript, Tailwind, Zod, node:test, Google Gemini API (`GEMINI_API_KEY`), bestehende Postgres/`inbox_messages`/`agent_commands`.

## Global Constraints

- Nur Operatoren (`authMiddleware` + `operatorMiddleware` / `requireOperator`).
- `GEMINI_API_KEY` nur serverseitig — niemals `VITE_`-Präfix.
- Kundenantworten: Entwurf erzeugen, Senden nur durch Operator (`replyInbox`).
- Deutsch in UI und Assistenten-Antworten.
- DRY: bestehende Agent-Aktionen nicht doppelt in SQL nachbauen.
- Tests: `node --experimental-strip-types --test` wie im Repo.
- Spec: `docs/superpowers/specs/2026-09-03-admin-assistent-design.md`.

## File map

| File | Role |
|------|------|
| `src/lib/agent.ts` | Unverändert als Parser/Hilfe; ggf. Export erweitern falls `executeParsed` ausgelagert wird |
| `src/lib/admin.functions.ts` | Heute: `runAgentCommand`, `interpretWithGrok`, `executeParsed` — Gemini-Chat-Fn hier oder ausgelagert aufrufen |
| `src/lib/gemini-admin.ts` | **Neu:** Gemini-Client + Tool-Definitionen + Loop |
| `src/lib/gemini-admin.test.ts` | **Neu:** Unit-Tests (Mock fetch / Tool-Dispatch) |
| `src/lib/agent-draft.ts` | **Neu:** reine Funktion `buildReplyDraft(inbox, booking?)` |
| `src/lib/agent-draft.test.ts` | **Neu:** Draft-Tests |
| `src/components/admin-assistant-panel.tsx` | **Neu:** aufklappbares Chat-Panel |
| `src/routes/admin.tsx` | Panel einbinden |
| `src/routes/admin.posteingang.tsx` | „Entwurf übernehmen“ aus Assistenten-Session / Query |
| `src/routes/admin.automatisierung.tsx` | Hinweis: Chat-Panel ist Primär-UI; Befehlzeile bleibt |
| `.env` / Server-Env-Doku | `GEMINI_API_KEY` dokumentieren (kein Secret committen) |

---

### Task 1: Antwort-Entwurf (pure function)

**Files:**
- Create: `src/lib/agent-draft.ts`
- Test: `src/lib/agent-draft.test.ts`

**Interfaces:**
- Consumes: `InboxRow`-ähnliches Minimalobjekt
- Produces: `buildReplyDraft(input: ReplyDraftInput): string`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReplyDraft } from "./agent-draft.ts";

describe("buildReplyDraft", () => {
  it("schreibt Du-Form, nennt Absender und fragt nicht nach erfundenen Daten", () => {
    const text = buildReplyDraft({
      sender: "Max Mustermann",
      subject: "Anfrage Signature",
      body: "Hallo, ich hätte gern einen Termin nächste Woche für mein SUV.",
      packageHint: "Signature",
    });
    assert.match(text, /Max Mustermann|Ihnen/i);
    assert.match(text, /Signature|Termin/i);
    assert.doesNotMatch(text, /IBAN|Steuer/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/lib/agent-draft.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
export type ReplyDraftInput = {
  sender: string | null;
  subject: string | null;
  body: string;
  packageHint?: string | null;
};

export function buildReplyDraft(input: ReplyDraftInput): string {
  const name = (input.sender ?? "Kunde").split(/[<(]/)[0]?.trim() || "Kunde";
  const pkg = input.packageHint ? ` zum Paket ${input.packageHint}` : "";
  return [
    `Guten Tag ${name},`,
    "",
    `vielen Dank für Ihre Nachricht${pkg}. Gerne schauen wir uns Ihren Wunschtermin an und melden uns mit einem konkreten Vorschlag.`,
    "",
    "Freundliche Grüße",
    "White Gloss Detailing",
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/lib/agent-draft.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-draft.ts src/lib/agent-draft.test.ts
git commit -m "feat(admin): Antwort-Entwurf-Helfer für Posteingang"
```

---

### Task 2: Gemini-Client + Tool-Dispatch (ohne UI)

**Files:**
- Create: `src/lib/gemini-admin.ts`
- Test: `src/lib/gemini-admin.test.ts`
- Modify: `src/lib/admin.functions.ts` — `executeParsed` exportieren oder gemeinsamen Runner extrahieren

**Interfaces:**
- Consumes: `parseAgentCommand` / bestehende Action-Ausführung; `buildReplyDraft`
- Produces:
  - `type ChatMessage = { role: "user" | "model"; text: string }`
  - `runGeminiAdminTurn(args: { apiKey: string; history: ChatMessage[]; userText: string; runTool: (name: string, args: Record<string, unknown>) => Promise<string> }): Promise<{ assistantText: string; toolTrace: string[] }>`
  - Tool-Namen: `run_agent_command`, `draft_customer_reply`, `get_inbox_summary`

- [ ] **Step 1: Write failing tests for tool JSON schemas / dispatch mapping**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geminiToolDeclarations, mapToolCallToResult } from "./gemini-admin.ts";

describe("gemini-admin tools", () => {
  it("deklariert run_agent_command und draft_customer_reply", () => {
    const names = geminiToolDeclarations().map((t) => t.name);
    assert.ok(names.includes("run_agent_command"));
    assert.ok(names.includes("draft_customer_reply"));
  });

  it("mapToolCallToResult ruft runTool mit bereinigten Args", async () => {
    const calls: unknown[] = [];
    const out = await mapToolCallToResult(
      { name: "run_agent_command", args: { text: "post" } },
      async (name, args) => {
        calls.push([name, args]);
        return "Posteingang leer.";
      },
    );
    assert.equal(out, "Posteingang leer.");
    assert.deepEqual(calls[0], ["run_agent_command", { text: "post" }]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node --experimental-strip-types --test src/lib/gemini-admin.test.ts`

- [ ] **Step 3: Implement `gemini-admin.ts`**

Kernpunkte (vollständiger Code im Commit; hier die Pflichtteile):

1. `geminiToolDeclarations()` — Gemini functionDeclarations für:
   - `run_agent_command` `{ text: string }` — Freitextbefehl wie bisheriges Panel
   - `draft_customer_reply` `{ inboxId: number }` — Draft, sendet **nicht**
   - `get_inbox_summary` `{}` — Kurzüberblick ungelesen
2. `mapToolCallToResult` — nur bekannte Tools, sonst Fehlerstring
3. `runGeminiAdminTurn` — `fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey)`, max 4 Tool-Runden, System-Instruction auf Deutsch: Operator-Assistent White Gloss; Kundenmails nur entwerfen; keine Secrets erfinden; nach Tool-Ergebnis kurz auf Deutsch zusammenfassen
4. Wenn `apiKey` fehlt: klarer Fehler `Gemini ist nicht konfiguriert (GEMINI_API_KEY).`

Extrahiere in `admin.functions.ts` die Ausführung so, dass `runTool("run_agent_command")` intern `parseAgentCommand` + bestehende `executeParsed`-Logik nutzt (nicht Grok-Interpretator für den Chat-Loop — Gemini übernimmt NLU).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini-admin.ts src/lib/gemini-admin.test.ts src/lib/admin.functions.ts
git commit -m "feat(admin): Gemini Tool-Loop für Operator-Assistent"
```

---

### Task 3: Server-Fn `chatAdminAssistant`

**Files:**
- Modify: `src/lib/admin.functions.ts`
- Test: erweitere `src/lib/gemini-admin.test.ts` oder kleines Validator-Testfile

**Interfaces:**
- Produces: `chatAdminAssistant` Server-Fn  
  Input: `{ message: string; history?: { role: "user" | "assistant"; text: string }[] }` (max message 4000, history max 20)  
  Output: `{ reply: string; draft?: { inboxId: number; body: string }; toolTrace: string[] }`

- [ ] **Step 1: Validator + Handler skizzieren (TDD: Zod-Parse-Test optional rein)**

Handler-Pflicht:

```ts
export const chatAdminAssistant = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        message: z.string().trim().min(1).max(4000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              text: z.string().max(4000),
            }),
          )
          .max(20)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini ist nicht konfiguriert (GEMINI_API_KEY).");
    const sql = await getSql();
    // runTool: run_agent_command -> executeParsed; draft_customer_reply -> load inbox + buildReplyDraft;
    // get_inbox_summary -> SQL ungelesen
    const turn = await runGeminiAdminTurn({ /* ... */ });
    await sql`
      insert into agent_commands (shop_id, channel, input, result, user_id)
      values (${SHOP}, ${"panel"}, ${data.message}, ${turn.assistantText.slice(0, 4000)}, ${context.userId})
    `;
    return {
      reply: turn.assistantText,
      draft: turn.draft ?? undefined,
      toolTrace: turn.toolTrace,
    };
  });
```

`draft_customer_reply` darf **kein** `replyInbox` / kein `outbound_queue`-Insert auslösen.

- [ ] **Step 2: Manuell / Test: ohne Key Fehlertext**

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin.functions.ts
git commit -m "feat(admin): chatAdminAssistant Server-Fn mit Gemini"
```

---

### Task 4: Chat-Panel UI

**Files:**
- Create: `src/components/admin-assistant-panel.tsx`
- Modify: `src/routes/admin.tsx`

**Interfaces:**
- Consumes: `chatAdminAssistant`
- Produces: floating panel; bei `draft` CustomEvent oder Callback `wg-admin-draft` mit `{ inboxId, body }`

- [ ] **Step 1: Panel-Komponente**

Verhalten:
- Button unten rechts „Assistent“
- Panel: Nachrichtenliste, Textarea, Senden
- `history` lokal im State (Session); nach Reload leer (DB-Persistenz = späteres Follow-up)
- Zeigt `toolTrace` klein/ausgeklappt optional
- Wenn `draft` zurückkommt: Button „Im Posteingang übernehmen“ → `sessionStorage.setItem("wg-admin-draft", JSON.stringify(draft))` + navigate `/admin/posteingang` oder Event

UI-Klassen: bestehende `Button`, `inputClass`, `border-line`, `bg-elevated`, `font-display` — kein neues Design-System.

- [ ] **Step 2: In `AdminShell` nach `<Outlet />` rendern** (nur wenn `access === "ok"` bereits true — Panel nur im geschützten Zweig)

- [ ] **Step 3: Smoke manuell:** Panel öffnen, „hilfe“/„post“ senden (mit Key), Antwort sehen

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-assistant-panel.tsx src/routes/admin.tsx
git commit -m "feat(admin): Chat-Panel für Operator-Assistent"
```

---

### Task 5: Posteingang — Entwurf übernehmen

**Files:**
- Modify: `src/routes/admin.posteingang.tsx`

- [ ] **Step 1: Beim Mount `sessionStorage` `wg-admin-draft` lesen**

Wenn vorhanden: passende Zeile `open` setzen, `reply` mit Draft-Body füllen, Storage clearen. Operator muss weiterhin „Senden“ klicken (`replyInbox`).

- [ ] **Step 2: Kurzer Hinweistext** unter dem Textarea: „Entwurf vom Assistenten — vor dem Senden prüfen.“

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.posteingang.tsx
git commit -m "feat(admin): Assistenten-Entwurf in Posteingang übernehmen"
```

---

### Task 6: Leitstand-Hinweis + Env-Doku

**Files:**
- Modify: `src/routes/admin.automatisierung.tsx` — ein Satz: Freitext-Chat liegt im Assistenten-Panel; Befehlzeile bleibt für PIN/WhatsApp-Tests
- Modify: `docs/superpowers/specs/2026-09-03-admin-assistent-design.md` oder kurze Notiz in `SETUP-GUIDE.md`: `GEMINI_API_KEY` setzen; `XAI_API_KEY` bleibt optional für alte `useAi`-Befehlzeile bis Migration

- [ ] **Step 1: Copy anpassen (kein Verhaltenbruch)**
- [ ] **Step 2: Commit**

```bash
git add src/routes/admin.automatisierung.tsx SETUP-GUIDE.md
git commit -m "docs(admin): Gemini-Key und Assistenten-Panel vermerken"
```

---

### Task 7: Phase-B-Anker (kein Code außer Doc)

**Files:**
- Create: `docs/superpowers/plans/2026-09-03-admin-assistent-whatsapp-phase-b.md` (Kurzplan, 1 Seite)

Inhalt: WhatsApp-Nachrichten als `inbox_messages` channel=`whatsapp` inbound; Webhook → Insert; Antworten weiter über `replyInbox` + `outbound_queue`; Meta 24h-Fenster; bestehende `inboundOperatorMessage` (PIN-Befehle) bleibt getrennt vom Kunden-Posteingang.

- [ ] **Step 1: Kurzplan schreiben**
- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-09-03-admin-assistent-whatsapp-phase-b.md
git commit -m "docs: Phase-B-Plan WhatsApp im Posteingang"
```

---

## Self-review (against spec)

| Spec-Anforderung | Task |
|------------------|------|
| Chat nur Operator / Admin | 3, 4 |
| Panel am Posteingang | 4, 5 |
| Gemini serverseitig | 2, 3 |
| Tools lesen/schreiben Admin | 2 (`run_agent_command` → executeParsed) |
| Kundenantwort mit Prüfung | 1, 3, 5 |
| WhatsApp-Pfad spezifiziert | 7 (Phase B separat) |
| Kein öffentlicher Chat | eingehalten |
| Kein Auto-Send | eingehalten |

Placeholder-Scan: keine TBD in Tasks. Typen: `ChatMessage` / Server history `assistant` vs model — in Task 2/3 beim Mapping `assistant` ↔ `model` klar halten.

---

## Out of scope this plan

- Vollständige WhatsApp-Cloud-API-Webhook-Implementation (Phase B)
- Chat-Verlauf in Postgres
- Ersetzen der Leitstand-Befehlzeile
