#!/usr/bin/env python3
"""WHITE GLOSS Produktion-Audit Abschlussbericht — 31.08.2026, Nachzug."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from pathlib import Path

DARK, CREAM = "0C0C0D", "F4EFE6"
GREEN, GREEN_BG = "1F7A4D", "D9F2E4"
RED, RED_BG = "9B2C2C", "F8D7DA"
YELLOW, YELLOW_BG = "8A6D00", "FFF3CD"
ORANGE, ORANGE_BG = "9A5B00", "FCE8C3"
GREY, LINE, BLUE = "6B7280", "D1D5DB", "0000FF"
WHITE = "FFFFFF"
FN = "Arial"
thin = Border(
    left=Side(style="thin", color=LINE),
    right=Side(style="thin", color=LINE),
    top=Side(style="thin", color=LINE),
    bottom=Side(style="thin", color=LINE),
)
fill_dark = PatternFill("solid", fgColor=DARK)
fill_head = PatternFill("solid", fgColor="1C1C20")
fill_alt = PatternFill("solid", fgColor="F7F5F2")
fill_input = PatternFill("solid", fgColor="FFF59D")
fill_pass = PatternFill("solid", fgColor=GREEN_BG)
fill_fail = PatternFill("solid", fgColor=RED_BG)
fill_man = PatternFill("solid", fgColor=YELLOW_BG)
fill_blk = PatternFill("solid", fgColor=ORANGE_BG)
title_font = Font(name=FN, size=18, bold=True, color=WHITE)
headf = Font(name=FN, size=10, bold=True, color=WHITE)
valf = Font(name=FN, size=10, color=DARK)
small = Font(name=FN, size=9, italic=True, color=GREY)
wrap = Alignment(wrap_text=True, vertical="top")
center = Alignment(horizontal="center", vertical="center", wrap_text=True)


def status_fill(cell, status):
    cell.alignment = center
    s = str(status)
    if s.startswith("PASS"):
        cell.fill = fill_pass
        cell.font = Font(name=FN, size=9, bold=True, color=GREEN)
    elif s.startswith("FAIL"):
        cell.fill = fill_fail
        cell.font = Font(name=FN, size=9, bold=True, color=RED)
    elif s == "BLOCKED":
        cell.fill = fill_blk
        cell.font = Font(name=FN, size=9, bold=True, color=ORANGE)
    else:
        cell.fill = fill_man
        cell.font = Font(name=FN, size=8, bold=True, color=YELLOW)


def header_row(ws, row, headers):
    for i, h in enumerate(headers, 1):
        cell = ws.cell(row, i, h)
        cell.font = headf
        cell.fill = fill_head
        cell.alignment = center
        cell.border = thin


def paint(ws, r1, r2, c1, c2, fill):
    for r in range(r1, r2 + 1):
        for c in range(c1, c2 + 1):
            ws.cell(r, c).fill = fill


wb = Workbook()

# ---------------------------------------------------------------------------
# Deckblatt
# ---------------------------------------------------------------------------
ws = wb.active
ws.title = "Deckblatt"
ws.sheet_properties.tabColor = DARK
ws.page_setup.orientation = "landscape"
ws.page_setup.fitToPage = True
ws.page_setup.fitToWidth = 1
ws.page_setup.fitToHeight = 1
ws.sheet_view.showGridLines = False
ws.freeze_panes = "A8"
ws.merge_cells("A1:F2")
ws["A1"] = "WHITE GLOSS DETAILING  ·  Produktion-Audit Abschlussbericht"
ws["A1"].font = title_font
ws["A1"].alignment = Alignment(vertical="center", indent=1)
paint(ws, 1, 2, 1, 6, fill_dark)
ws.merge_cells("A3:F3")
ws["A3"] = (
    "Technischer Audit von white-gloss.de und White-Gloss/glanz-buchung-meister. "
    "Keine anwaltliche Freigabe. Keine erfundenen Register- oder Steuerangaben. "
    "Status nur PASS / FAIL / BLOCKED / MANUAL CHECK REQUIRED."
)
ws["A3"].font = small
ws["A3"].alignment = wrap

meta = [
    (5, "Projekt", "WHITE GLOSS DETAILING"),
    (6, "Repository", "White-Gloss/glanz-buchung-meister"),
    (7, "Live-Domain", "https://white-gloss.de"),
    (8, "Vorgänger-PR", "https://github.com/White-Gloss/glanz-buchung-meister/pull/99 (merged) + main bfb3aab"),
    (9, "Dieser Stand", "Branch fix/admin-operator-allowlist — Allowlist, Same-Site, Bericht"),
]
for r, k, v in meta:
    ws.cell(r, 1, k).font = Font(name=FN, size=10, bold=True, color=GREY)
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
    ws.cell(r, 2, v).font = valf

ws["A11"] = "EINGABEN (gelb = nach Deploy dieses Nachzugs aktualisieren)"
ws["A11"].font = Font(name=FN, size=10, bold=True, color=WHITE)
paint(ws, 11, 11, 1, 4, fill_head)
inputs = [
    (12, "Auditdatum", "2026-08-31"),
    (13, "Main-SHA vor diesem PR", "bfb3aab8b514b609cac057281ac6053f1c697e5c"),
    (14, "Live-SHA jetzt", "bfb3aab (Login-Text live: keine öffentliche Registrierung)"),
    (15, "Code-Fix PR 99", "c3f24750e3503d4467b29269cbc39916f5223111"),
    (16, "Dieser PR (Allowlist)", "Branch fix/admin-operator-allowlist — SHA im PR nach Push"),
    (17, "Live = dieser PR?", "NEIN — Google/X-Konto ohne @white-gloss.de hat auf Live noch volles Panel"),
]
for r, k, v in inputs:
    ws.cell(r, 1, k).font = Font(name=FN, size=10, bold=True, color=GREY)
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
    c = ws.cell(r, 2, v)
    c.font = valf
    c.fill = fill_input

ws["A19"] = "KENNZAHLEN AUS DER AUDITMATRIX (Formeln)"
ws["A19"].font = Font(name=FN, size=10, bold=True, color=WHITE)
paint(ws, 19, 19, 1, 6, fill_head)
ws["E20"] = "Status"
ws["F20"] = "Anzahl"
ws["E20"].font = headf
ws["F20"].font = headf
ws["E20"].fill = fill_head
ws["F20"].fill = fill_head
for col in range(1, 7):
    ws.cell(20, col).border = thin

# Matrix data starts at row 6 col H on Auditmatrix sheet
ws["A21"] = "Punkte gesamt"
ws["B21"] = '=COUNTA(Auditmatrix!A6:A50)-COUNTIF(Auditmatrix!A6:A50,"")'
ws["E21"] = "PASS"
ws["F21"] = '=COUNTIF(Auditmatrix!H6:H50,"PASS")'
ws["A22"] = "PASS"
ws["B22"] = "=F21"
ws["E22"] = "FAIL"
ws["F22"] = '=COUNTIF(Auditmatrix!H6:H50,"FAIL")'
ws["A23"] = "FAIL"
ws["B23"] = "=F22"
ws["E23"] = "BLOCKED"
ws["F23"] = '=COUNTIF(Auditmatrix!H6:H50,"BLOCKED")'
ws["A24"] = "BLOCKED"
ws["B24"] = "=F23"
ws["E24"] = "MANUAL CHECK REQUIRED"
ws["F24"] = '=COUNTIF(Auditmatrix!H6:H50,"MANUAL CHECK REQUIRED")'
ws["A25"] = "MANUAL CHECK REQUIRED"
ws["B25"] = "=F24"
ws["A26"] = "Anteil PASS"
ws["B26"] = '=IF(B21=0,0,B22/B21)'
ws["B26"].number_format = "0.0%"
ws["A27"] = "Offen (FAIL+BLOCKED+MANUAL)"
ws["B27"] = "=B23+B24+B25"
ws["A28"] = "Live entspricht diesem PR?"
ws["B28"] = "NEIN"

for r in range(21, 29):
    for c in range(1, 7):
        ws.cell(r, c).border = thin
        ws.cell(r, c).font = valf

status_fill(ws["F21"], "PASS")
status_fill(ws["F22"], "FAIL")
status_fill(ws["F23"], "BLOCKED")
status_fill(ws["F24"], "MANUAL CHECK REQUIRED")

ws["A30"] = "Lokal nachgewiesene Qualitätstore"
ws["A30"].font = Font(name=FN, size=10, bold=True, color=WHITE)
paint(ws, 30, 30, 1, 4, fill_head)
gates = [
    (31, "npm test", "PASS 33/33 (pickup, ops, contrast, rate-limit, gate-identity, operator)"),
    (32, "npm run typecheck", "PASS"),
    (33, "npm run lint", "PASS (0 errors, 4 vorbestehende warnings)"),
    (34, "npm run build", "PASS"),
    (35, "Browser Skip-Link / Maps 2-Klick / Login ohne Signup / Formular HTML5", "PASS"),
    (36, "smoke:production gegen Live", "Signup-UI live PASS (bfb3aab). Allowlist noch nicht live."),
]
for r, k, v in gates:
    ws.cell(r, 1, k).font = Font(name=FN, size=10, bold=True, color=GREY)
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
    ws.cell(r, 2, v).font = valf
    if v.startswith("PASS"):
        ws.cell(r, 2).fill = fill_pass
    elif v.startswith("FAIL"):
        ws.cell(r, 2).fill = fill_fail

ws.merge_cells("A38:F39")
ws["A38"] = (
    "PR 99 und main bfb3aab liegen auf IONOS: ODR weg, 10 km kostenlos, kein wg-cookie, "
    "Maps nach Klick, Queue=queued, Login ohne Registrieren, kein Auto-WhatsApp an Kunden. "
    "Dieser PR schließt das verbleibende P0: jedes Google/X-Konto hätte sonst volles Panel."
)
ws["A38"].alignment = wrap
ws["A38"].font = small

ws.column_dimensions["A"].width = 36
ws.column_dimensions["B"].width = 28
for col in "CDEF":
    ws.column_dimensions[col].width = 22
ws.row_dimensions[1].height = 22
ws.row_dimensions[3].height = 36
ws.row_dimensions[38].height = 36
ws.oddFooter.left.text = "WHITE GLOSS Produktion-Audit 31.08.2026 — keine Rechtsberatung"
ws.oddFooter.right.text = "Seite &P / &N"

# Pie chart of status
pie = PieChart()
pie.title = "Status"
labels = Reference(ws, min_col=5, min_row=21, max_row=24)
data = Reference(ws, min_col=6, min_row=20, max_row=24)
pie.add_data(data, titles_from_data=True)
pie.set_categories(labels)
pie.dataLabels = DataLabelList()
pie.dataLabels.showPercent = True
pie.dataLabels.showVal = False
pie.dataLabels.showCatName = True
pie.width = 12
pie.height = 8
ws.add_chart(pie, "E5")

# ---------------------------------------------------------------------------
# Auditmatrix
# ---------------------------------------------------------------------------
am = wb.create_sheet("Auditmatrix")
am.sheet_properties.tabColor = "D97868"
am.page_setup.orientation = "landscape"
am.page_setup.fitToPage = True
am.page_setup.fitToWidth = 1
am.page_setup.fitToHeight = 0
am.freeze_panes = "A6"
am.sheet_view.showGridLines = False
am.merge_cells("A1:I2")
am["A1"] = "Auditmatrix  ·  jeder Punkt mit nachgewiesenem Status"
am["A1"].font = title_font
am["A1"].alignment = Alignment(vertical="center", indent=1)
paint(am, 1, 2, 1, 9, fill_dark)
am.merge_cells("A3:I3")
am["A3"] = (
    "Spalte H nur die vier Statuswerte. Deckblatt zählt per COUNTIF. "
    "PR 99 (c3f2475) und bfb3aab sind live. Dieser PR (operatorMiddleware, Same-Site, Bericht) ist lokal, live noch ohne Allowlist."
)
am["A3"].font = small
am["A3"].alignment = wrap
am.row_dimensions[3].height = 32

headers = ["Nr", "Bereich", "Fehler", "Ursache", "Lösung", "Dateien", "Test", "Ergebnis", "Bemerkung"]
header_row(am, 5, headers)

rows = [
    [1, "Impressum / ODR", "Toter EU-OS-/ODR-Link", "Plattform seit 20.07.2025 eingestellt",
     "Link weg. VSBG-Satz belassen. OS-Plattform nicht mehr betrieben. Keine USt-IdNr. erfunden.",
     "impressum.tsx; smoke-production.mjs",
     "Live 31.08.2026: kein ec.europa.eu/consumers/odr; VSBG-Satz da; Stand 31.08.2026",
     "PASS", "Anwalt VSBG/BFSG und USt-IdNr. bleiben MANUAL."],
    [2, "Abholpreise", "Mehrere hartcodierte Staffeln; Live hatte 20 € bis 10 km",
     "Texte drifteten von der Logik",
     "pickupPricing einzige Tabelle. 10 km = 0. Helper pickupFee/PriceText/TierSummary. Server quoteTotal.",
     "site.ts; pickup.test.ts; configurator.tsx",
     "npm test pickup 6/6; Live /preise: bis 10 km kostenlos, 20 km 50 €, 50 km 70 €",
     "PASS", "City-Blurbs mit Prosa-Beträgen; Test bricht bei Drift. Alte 20-€-Staffel verboten."],
    [3, "Fotoanfrage", "Text: Dateien im Betrieb; Code: nur Namen",
     "Kein Upload-Backend",
     "Variante A: ehrliche Copy. Inbox enthält Name+Telefon+Dateinamen. Kein produktiver Upload.",
     "photo-inquiry.tsx; bookings.functions.ts; datenschutz.tsx",
     "Live /dellen: nicht hochgeladen + Dateinamen; kein Alt-Satz",
     "PASS", "File-Picker bleibt UX-Hinweis, kein Upload."],
    [4, "Datenschutz", "Behauptungen ≠ Code",
     "Texte vorgezogen; Kunden-WA noch gequeued",
     "Nur IONOS, kein Marketing-Cookie, Maps nach Klick, Foto=Namen. Kunden-WA aus Confirm-Queue entfernt. Instagram-Satz ergänzt.",
     "datenschutz.tsx; ops.ts",
     "Lokal: kein Auto-WA-Ziel mehr; Live-Text noch alter Stand bis Nachzug-Deploy",
     "PASS", "Code-PASS. Live-Datenschutz sagt schon „nicht aktiv“ — jetzt auch die Queue."],
    [5, "Cookie / localStorage", "wg-cookie ohne Zweck",
     "Banner nur Kenntnisnahme",
     "CookieNotice und wg-cookie entfernt. Login-Session unangetastet.",
     "site-chrome.tsx; datenschutz.tsx",
     "Live und lokal: kein Banner, kein wg-cookie",
     "PASS", ""],
    [6, "Maps 2-Klick", "Button unklar / Google vor Klick",
     "Iframe schon am Klick, Label knapp",
     "«Google Maps laden – dabei werden Daten an Google übertragen». Vorher 0 iframe.",
     "workshop-map.tsx; security-headers.ts",
     "Playwright/agent-browser: iframes=0, nach Klick Google-Embed. DNS-Prefetch off.",
     "PASS", "HAR nach Deploy manuell nur noch zur Bestätigung."],
    [7, "Owner-Notify WhatsApp", "Ziel booking.phone",
     "Empfänger mit Kundenkanal vermischt",
     "OWNER_* bzw. Impressum. Filter booking.phone. Kunden-Confirm ohne WhatsApp-Queue.",
     "ops.ts; ops.test.ts",
     "Unit-Tests nie Kunden-Tel als Owner; Confirm ohne WA-Kanal",
     "PASS", "Kein produktiver WA-Adapter."],
    [8, "outbound_queue Status", "status=sent ohne Versand",
     "queueChannel hardcodierte sent",
     "OUTBOUND_QUEUED=queued.",
     "ops.ts; bookings.functions.ts; admin.functions.ts",
     "Kein sent-Writer in src/",
     "PASS", ""],
    [9, "E-Mail-Fallback", "email||phone im Mailkanal",
     "Keine Kanalvalidierung",
     "isEmailAddress. Ack/Erinnerung nur mit Mail. Telefon nie in E-Mail-Feld.",
     "utils.ts; ops.ts; bookings.functions.ts",
     "ops.test ohne Mail kein E-Mail-Ziel und kein WA-Ziel",
     "PASS", ""],
    [10, "Spam-Schutz", "Nur Zod",
     "Keine Drossel/Honeypot/Origin",
     "IP-Limiter + Honeypot website + assertSameSiteRequest auf öffentlichen POSTs.",
     "rate-limit.ts; bookings.functions.ts; admin.functions.ts; isolation.server.ts",
     "rate-limit.test 2/2; Same-Site auf booking/photo/operator",
     "PASS", "In-Memory, ein VPS. Sec-Fetch-Site fehlt bei manchen Clients — dann durchgelassen."],
    [11, "WCAG Kontrast", "#c45c4a unter 4,5:1",
     "Zu dunkel auf dark",
     "--color-danger #d97868. Token-Test für danger/muted/subtle auf bg/surface/elevated.",
     "styles.css; contrast.ts; contrast.test.ts",
     "contrast.test 2/2; Skip-Link Tab+Enter → #main-content",
     "PASS", "Login hat jetzt id=main-content."],
    [12, "Lighthouse CI", "Nicht bei Frontend-Änderungen",
     "Nur main, kein Artefakt-Pin, server/** fehlte",
     "paths inkl. server/**; PR+main; upload-artifact pin; A11y 0,95 error.",
     "lighthouse-audit.yml; lighthouserc.*.cjs",
     "YAML-Review",
     "PASS", "CI trifft Live-URL, nicht PR-Preview. Median 3× nach Deploy MANUAL."],
    [13, "Production-Smoke", "Zu wenige Seiten / keine Altlasten",
     "Keine Verbote für ODR, 20-€-Staffel, Signup",
     "Rechtsseiten, B2B, Luxus, Qualität, Zustand, Dellen. Verbote ODR / whitegloss.de / Alt-Upload / 10 km 20 / Registrieren. Preise 149/349/899.",
     "smoke-production.mjs",
     "Live: Signup-UI weg. Script prüft zusätzlich 10-km-20 und 149/349/899.",
     "PASS", "Allowlist ist kein HTML-Snippet — Nr. 23 bleibt FAIL bis Deploy."],
    [14, "Security-Header / CSP", "Grok-Skript blockiert; DNS-Prefetch on",
     "script-src ohne grok.com; Prefetch-Header on",
     "script-src + connect-src https://grok.com (PWA-Injektor). X-DNS-Prefetch-Control off. unsafe-inline/eval unverändert (Framework).",
     "server/security-headers.ts",
     "Lokal Header: dns-prefetch off; grok.com in CSP. Live noch alter Header bis Nachzug.",
     "PASS", "Nonce-CSP Folgeauftrag. unsafe-* nicht als behoben verkauft."],
    [15, "Admin / Agent Auth", "Öffentliche Selbstregistrierung = volles Panel",
     "email signup an, Google/X ohne Allowlist, nur if (!user)",
     "disableSignUp immer (nicht nur production). Login ohne Registrieren (bfb3aab live). operatorMiddleware + Allowlist @white-gloss.de / OWNER_EMAIL / ADMIN_EMAILS. n<=1 Bootstrap. UI „Kein Betriebszugang“.",
     "email-password.ts; server.ts; login.tsx; operator.ts; admin.tsx; *functions.ts",
     "operator.test 4/4; lokal /login ohne Registrieren; typecheck",
     "PASS", "In Produktion Enforce an. Google-Gmail des Inhabers in ADMIN_EMAILS, sobald >1 User. Live noch ohne Allowlist — siehe Nr. 23."],
    [16, "Sitemap / SEO", "200, Canonical, keine old domain",
     "Bestand 0f386ef + PR 99",
     "Rechtstexte indexierbar. Smoke prüft noindex-Widerspruch.",
     "seo.ts; smoke-production.mjs",
     "Live 181 URLs indexierbar",
     "PASS", ""],
    [17, "Strukturierte Daten", "Keine Fake-Sterne",
     "Bestand LocalBusiness/FAQ",
     "Kein aggregateRating erfunden.",
     "seo.ts; faq.tsx",
     "Code-Review",
     "PASS", "Rich-Results Search Console MANUAL."],
    [18, "Formulare + Serverpreis", "Browserpreis darf nicht gelten; on-request als 0 gespeichert",
     "IDs müssen serverseitig rechnen; pickup null → 0",
     "assertKnownPricing. total_cents aus quoteTotal. Bei pickupOnRequest Notiz „Preis nicht im Gesamtbetrag“. Honeypot+Limit+Same-Site.",
     "bookings.functions.ts; site.ts; configurator.tsx",
     "pickup.test Sindelfingen on-request; HTML5 required Name/Datenschutz",
     "PASS", "UI-Negativmatrix nicht vollständig geklickt (MANUAL Rest)."],
    [19, "Keine Fake-Funktion / ERPNext", "sent ohne Adapter; keine Zoho",
     "Queue-Status + Strategie",
     "queued. Kunden-WA nicht mehr vorgemerkt. ERPNext unangetastet. Kein Zoho.",
     "ops.ts; admin.functions.ts",
     "Diff-Review",
     "PASS", ""],
    [20, "Datenbank / Löschen", "PII-Dopplung, Aufbewahrung",
     "customers+bookings; Foto=Name",
     "Datenschutz Speicherdauer. Kein Auto-Delete von Belegen.",
     "datenschutz.tsx; bookings.functions.ts",
     "Code: Namen, keine Löschjobs",
     "MANUAL CHECK REQUIRED", "VVT/Löschkonzept Anwalt/Inhaber."],
    [21, "USt-IdNr / Register", "Mögliche Pflichtangaben",
     "Im Repo nicht belegt",
     "Nichts erfunden.",
     "impressum.tsx",
     "Repo ohne belegte USt-IdNr/HR/W-IdNr",
     "MANUAL CHECK REQUIRED", "Falls vorhanden nachreichen."],
    [22, "VSBG / BFSG", "Passt der Satz rechtlich?",
     "Schwellen nicht im Code",
     "Standard-Satz für nicht verpflichtete Unternehmer belassen. Keine Rechtsberatung.",
     "impressum.tsx",
     "Text da; Passgenauigkeit nicht code-testbar",
     "MANUAL CHECK REQUIRED", "Anwalt."],
    [23, "Live vs Allowlist-PR", "Google/X-Konto = volles Panel auf Live",
     "authMiddleware prüft nur Session, keine Betreiber-E-Mail",
     "Nicht behaupten, die Allowlist sei live. bfb3aab hat nur die Signup-UI geschlossen.",
     "operator.ts; operator-middleware.ts",
     "Live /login 31.08.2026: keine Registrieren-UI. Admin-APIs ohne Allowlist.",
     "FAIL", "Nach Deploy dieses PR: Fremdkonto muss „Kein Betriebszugang“ sehen."],
    [24, "Formulare UI-Fehlerfälle", "Leere Felder, oversize, Fake-IDs",
     "Server steht, UI nicht voll geklickt",
     "Zod-Limits, Honeypot, known IDs, HTML5 required.",
     "bookings.functions.ts; configurator; photo-inquiry",
     "Leer-Submit: native required Name + Datenschutz. Rest unvollständig.",
     "MANUAL CHECK REQUIRED", ""],
    [25, "Tastatur Rest-AA", "Menü, Slider, 200%-Zoom",
     "Auftrag volle Matrix",
     "Skip-Link PASS (Tab+Enter → main-content). Kontrast PASS. Login Skip-Target ergänzt.",
     "site-chrome.tsx; login.tsx",
     "agent-browser Tab/Enter",
     "MANUAL CHECK REQUIRED", "Slider/Zoom/SR Folgecheck."],
    [26, "Lighthouse 3×", "Median Start/Preise/Leistungen/Abhol",
     "Nicht gegen Branch gemessen",
     "Workflow 3 runs, Assertions vorbereitet.",
     "lighthouserc.*.cjs",
     "Nicht 3× gegen diesen Nachzug gelaufen",
     "MANUAL CHECK REQUIRED", "Kein Cherry-Pick des besten Laufs."],
    [27, "CWV Feld", "LCP/INP/CLS Feld",
     "Keine CrUX-Abfrage",
     "AVIF/WebP, Fonts, lazy Configurator nicht zerstört.",
     "media-src.ts; styles.css",
     "Keine Feldmessung",
     "MANUAL CHECK REQUIRED", "Search Console nach Deploy."],
    [28, "Maps HAR Live", "Vor Klick keine Google-Requests",
     "Nur Code + Browser-DOM",
     "iframe nur nach Klick. DNS-Prefetch off. Keine Google-Fonts.",
     "workshop-map.tsx; security-headers.ts",
     "agent-browser: 0 iframe, danach Google-Embed-URL",
     "PASS", "Volles HAR in DevTools nach Deploy empfohlen, nicht mehr blockierend."],
    [29, "Operator-PIN", "Default WG-BETRIEB öffentlich",
     "Default im Code/DB",
     "Inbound und setOperatorPin lehnen Default ab. Panel hinter operatorMiddleware.",
     "admin.functions.ts; api.operator.ts",
     "Default-PIN return vor executeParsed",
     "PASS", "Eigenen PIN setzen bleibt MANUAL."],
    [30, "Outbound wirklich senden", "queued nicht als sent verkaufen",
     "Kein bestätigter Sender",
     "Status queued. Kein Kunden-WA. Kein neuer WA-API-Call.",
     "ops.ts",
     "insert queued; Confirm ohne WA",
     "PASS", "Worker später: sent/failed."],
    [31, "Regression Build/Routen", "test/typecheck/lint/build/Routen",
     "Pflicht nach Fixes",
     "33/33, tsc, eslint 0 err, lokale Routen 200.",
     "package.json; Diff",
     "Kommandos Exit 0",
     "PASS", ""],
    [32, "CSP unsafe-* Rest", "unsafe-inline/eval",
     "Framework",
     "Nicht aufgeweicht außer grok.com Host. Nicht als behoben verkauft.",
     "security-headers.ts",
     "Diff: grok.com + dns-prefetch off",
     "MANUAL CHECK REQUIRED", "Nonce-Folgeauftrag."],
    [33, "Rate-Limit Multi-Instanz", "In-Memory Map",
     "Ein Node auf VPS",
     "Einfach, ohne Captcha.",
     "rate-limit.ts",
     "4. Request blockiert",
     "PASS", "Mehrere Nodes: Limit nicht global."],
    [34, "Kein Merge / keine Secrets", ".env und Prod-Push",
     "Arbeitsregel",
     "Nachzug nicht ungefragt auf IONOS. .env nicht im Commit.",
     "git status",
     "status ohne .env",
     "PASS", ""],
    [35, "Abholung auf Anfrage", "Sindelfingen 52 km als 0 € gespeichert",
     "pickup null coalesced to 0",
     "Notiz an Buchung und Inbox. pickupOnRequest im quote. Configurator nutzt pickupPriceText.",
     "bookings.functions.ts; configurator.tsx; pickup.test.ts",
     "pickup.test on-request",
     "PASS", "pickup_cents bleibt 0 wegen NOT NULL — Notiz macht es sichtbar."],
]

dv = DataValidation(type="list", formula1='"PASS,FAIL,BLOCKED,MANUAL CHECK REQUIRED"', allow_blank=False)
dv.add("H6:H50")
am.add_data_validation(dv)

for i, row in enumerate(rows):
    r = 6 + i
    for c, val in enumerate(row, 1):
        cell = am.cell(r, c, val)
        cell.border = thin
        cell.alignment = wrap if c > 2 else center
        cell.font = valf
        if i % 2:
            if c != 8:
                cell.fill = fill_alt
    status_fill(am.cell(r, 8), row[7])
    am.row_dimensions[r].height = 48

last = 5 + len(rows)
am.cell(last + 1, 1, "Summen (Formel)")
am.cell(last + 1, 8, f'=COUNTA(H6:H{last})')
am.cell(last + 1, 8).font = Font(name=FN, size=10, bold=True)

am.column_dimensions["A"].width = 6
am.column_dimensions["B"].width = 22
am.column_dimensions["C"].width = 32
am.column_dimensions["D"].width = 28
am.column_dimensions["E"].width = 42
am.column_dimensions["F"].width = 28
am.column_dimensions["G"].width = 36
am.column_dimensions["H"].width = 24
am.column_dimensions["I"].width = 36
am.oddFooter.left.text = "WHITE GLOSS Produktion-Audit 31.08.2026 — keine Rechtsberatung"
am.oddFooter.right.text = "Seite &P / &N"
am.auto_filter.ref = f"A5:I{last}"

# ---------------------------------------------------------------------------
# Qualitaetstore
# ---------------------------------------------------------------------------
qs = wb.create_sheet("Qualitaetstore")
qs.sheet_properties.tabColor = GREEN
qs.sheet_view.showGridLines = False
qs.freeze_panes = "A6"
qs.merge_cells("A1:F2")
qs["A1"] = "Qualitätstore — nur was wirklich gelaufen ist"
qs["A1"].font = title_font
qs["A1"].alignment = Alignment(vertical="center", indent=1)
paint(qs, 1, 2, 1, 6, fill_dark)
qs.merge_cells("A3:F3")
qs["A3"] = "Keine PASS-Behauptung ohne Kommando oder Browserbeleg. Lighthouse-3er-Median dieses Nachzugs wurde nicht gemessen."
qs["A3"].font = small
header_row(qs, 5, ["Nr", "Gate", "Kommando / Methode", "Umgebung", "Ergebnis", "Beleg"])
qrows = [
    [1, "Unit-Tests", "npm test", "Dieser PR lokal", "PASS", "33/33 pickup, ops, contrast, rate-limit, gate-identity, operator"],
    [2, "TypeScript", "npm run typecheck", "Nachzug lokal", "PASS", "tsc --noEmit Exit 0"],
    [3, "Lint", "npm run lint", "Nachzug lokal", "PASS", "0 errors, 4 vorbestehende warnings"],
    [4, "Production Build", "npm run build", "Nachzug lokal", "PASS", "Vite client+SSR, Nitro"],
    [5, "Lokale Routen", "HTTP GET Home/Login/Impressum", "Dev :8080", "PASS", "kein ODR, kein Signup, DNS-Prefetch off, 10 km kostenlos"],
    [6, "Live-Smoke PR 99 + bfb3aab", "npm run smoke:production", "white-gloss.de", "PASS", "Signup-UI weg. ODR/Upload/wg-cookie weg. 10 km kostenlos. Allowlist nicht per HTML prüfbar"],
    [7, "Skip-Link", "Tab + Enter", "Preview", "PASS", "Fokus #main-content"],
    [8, "Cookie-Banner", "DOM", "Preview + Live", "PASS", "Kein Hinweis"],
    [9, "Maps 2-Klick", "DOM iframe count", "Preview", "PASS", "0 iframe, nach Klick Google-Embed"],
    [10, "Impressum", "Live curl + Browser", "white-gloss.de + Preview", "PASS", "kein ODR, VSBG, OS nicht betrieben"],
    [11, "Preise", "Live curl + Browser", "white-gloss.de + Preview", "PASS", "Staffel 10/20/50 km kostenlos/50/70, Keramik 60 km"],
    [12, "Login Signup-UI", "Browser + Smoke", "Preview + Live", "PASS", "Kein Registrieren. Google/X bleiben für den Inhaber."],
    [13, "Formular leer", "HTML5 required", "Preview", "PASS", "Name + Datenschutz required"],
    [14, "Kontrast", "contrast.test", "Unit", "PASS", "danger/muted/subtle ≥ 4,5:1"],
    [15, "Lighthouse 3× Median", "lhci autorun", "nicht gegen diesen PR", "MANUAL CHECK REQUIRED", "CI verdrahtet, Lauf nach Deploy"],
    [16, "Live = Allowlist-PR", "Inhalt vs Code", "white-gloss.de", "FAIL", "Live = bfb3aab, ohne operatorMiddleware"],
]
for i, row in enumerate(qrows):
    r = 6 + i
    for c, val in enumerate(row, 1):
        cell = qs.cell(r, c, val)
        cell.border = thin
        cell.alignment = wrap
        cell.font = valf
        if i % 2 and c != 5:
            cell.fill = fill_alt
    status_fill(qs.cell(r, 5), row[4])
    qs.row_dimensions[r].height = 32
qs.column_dimensions["A"].width = 6
qs.column_dimensions["B"].width = 24
qs.column_dimensions["C"].width = 28
qs.column_dimensions["D"].width = 22
qs.column_dimensions["E"].width = 24
qs.column_dimensions["F"].width = 55
qs["A24"] = "PASS-Gates"
qs["B24"] = '=COUNTIF(E6:E21,"PASS")'
qs["A25"] = "FAIL-Gates"
qs["B25"] = '=COUNTIF(E6:E21,"FAIL")'
qs["A26"] = "MANUAL"
qs["B26"] = '=COUNTIF(E6:E21,"MANUAL CHECK REQUIRED")'

# ---------------------------------------------------------------------------
# Offene Punkte
# ---------------------------------------------------------------------------
op = wb.create_sheet("Offene_Punkte")
op.sheet_properties.tabColor = YELLOW
op.sheet_view.showGridLines = False
op.freeze_panes = "A6"
op.merge_cells("A1:F2")
op["A1"] = "Offene manuelle Punkte — nichts davon erfunden"
op["A1"].font = title_font
op["A1"].alignment = Alignment(vertical="center", indent=1)
paint(op, 1, 2, 1, 6, fill_dark)
header_row(op, 5, ["Nr", "Thema", "Warum offen", "Wer", "Nächster Schritt", "Status"])
opens = [
    [1, "USt-IdNr.", "Im Repo nicht belegt", "Inhaber / Steuerberatung", "Nur eintragen wenn vorhanden.", "MANUAL CHECK REQUIRED"],
    [2, "Wirtschafts-ID", "Nicht im Repo", "Inhaber", "Nur nach Zuteilung.", "MANUAL CHECK REQUIRED"],
    [3, "Handelsregister", "Einzelunternehmen, nicht belegt", "Inhaber", "Nur wenn eingetragen.", "MANUAL CHECK REQUIRED"],
    [4, "VSBG-Pflicht", "Schwellen unbekannt", "Anwalt", "Satz prüfen. OS-Hinweis faktisch korrekt.", "MANUAL CHECK REQUIRED"],
    [5, "BFSG", "Geltung abhängig von Größe", "Anwalt", "Technisch AA; Rechtspflicht klären.", "MANUAL CHECK REQUIRED"],
    [6, "Operator-PIN", "Default wird abgelehnt", "Inhaber im Panel", "Eigenen PIN ≠ WG-BETRIEB setzen.", "MANUAL CHECK REQUIRED"],
    [7, "ADMIN_EMAILS", "Google-Konto des Inhabers unbekannt", "Inhaber / Hosting", "Falls mehr als ein Auth-User: Google-Adresse in ADMIN_EMAILS.", "MANUAL CHECK REQUIRED"],
    [8, "Allowlist-Deploy", "Google/X ohne Allowlist = Panel", "Inhaber", "Diesen PR mergen, IONOS deployen. ADMIN_EMAILS setzen falls Inhaber-Google ≠ @white-gloss.de.", "FAIL"],
    [9, "Lighthouse-Median", "Nicht 3× gegen Nachzug", "CI", "Nach Deploy, keinen Bestlauf cherrypicken.", "MANUAL CHECK REQUIRED"],
    [10, "AVV IONOS/Meta/Google", "Verträge nicht im Repo", "Inhaber", "AVV/TOMs vorhalten.", "MANUAL CHECK REQUIRED"],
    [11, "Löschkonzept / VVT", "Nur generische Speicherdauer", "Datenschutz", "Anfrage vs. Belegfristen trennen.", "MANUAL CHECK REQUIRED"],
    [12, "CSP ohne unsafe-*", "Framework", "Entwicklung", "Nonce-Folgeauftrag.", "MANUAL CHECK REQUIRED"],
    [13, "Outbound-Worker", "Kein Sender", "Entwicklung", "queued bis Adapter echt sendet. Kunden-WA bewusst nicht queue.", "PASS"],
]
for i, row in enumerate(opens):
    r = 6 + i
    for c, val in enumerate(row, 1):
        cell = op.cell(r, c, val)
        cell.border = thin
        cell.alignment = wrap
        cell.font = valf
        if i % 2 and c != 6:
            cell.fill = fill_alt
    status_fill(op.cell(r, 6), row[5])
    op.row_dimensions[r].height = 28
op.column_dimensions["A"].width = 6
op.column_dimensions["B"].width = 24
op.column_dimensions["C"].width = 36
op.column_dimensions["D"].width = 22
op.column_dimensions["E"].width = 50
op.column_dimensions["F"].width = 24
op["A20"] = "Offen (MANUAL+FAIL)"
op["B20"] = '=COUNTIF(F6:F18,"MANUAL CHECK REQUIRED")+COUNTIF(F6:F18,"FAIL")'

# ---------------------------------------------------------------------------
# Risiken
# ---------------------------------------------------------------------------
rk = wb.create_sheet("Risiken")
rk.sheet_properties.tabColor = RED
rk.sheet_view.showGridLines = False
rk.freeze_panes = "A6"
rk.merge_cells("A1:F2")
rk["A1"] = "Verbleibende Risiken nach diesem Nachzug"
rk["A1"].font = title_font
rk["A1"].alignment = Alignment(vertical="center", indent=1)
paint(rk, 1, 2, 1, 6, fill_dark)
header_row(rk, 5, ["ID", "Risiko", "Schwere", "Wahrscheinlichkeit", "Mitigation", "Rest"])
risks = [
    ["R1", "Live: jedes Google/X-Konto sieht Kundendaten bis Allowlist-Deploy", "hoch", "sicher bis Deploy", "operatorMiddleware in diesem PR", "Mergen+deployen; ADMIN_EMAILS"],
    ["R2", "Inhaber-Google ≠ @white-gloss.de und >1 User → Zugangssperre", "mittel", "wenn zweites Konto existiert", "ADMIN_EMAILS setzen; n<=1 Bootstrap", "Env nach erstem Login prüfen"],
    ["R3", "Operator-Webhook nur PIN", "hoch", "mittel", "Default tot, Rate-Limit, Same-Site, eigener PIN", "PIN < Session-Auth"],
    ["R4", "CSP unsafe-inline/eval", "mittel", "bestehend", "Nicht weiter aufgeweicht; grok.com Host ergänzt", "XSS-Oberfläche"],
    ["R5", "In-Memory Rate-Limit", "niedrig-mittel", "Multi-Prozess", "pro Node wirksam", "verteilt umgehbar"],
    ["R6", "Keine echte Mail/WA-Zustellung", "mittel", "sicher", "Status queued, keine Kunden-WA-Queue", "Kunde ohne Auto-Mail wenn Worker fehlt"],
    ["R7", "Fotoanfrage ohne Dateiinhalt", "niedrig", "sicher", "Ehrliche UI Variante A", "Zweiter Kanal nötig"],
    ["R8", "Impressum ohne USt-IdNr falls pflichtig", "mittel", "unbekannt", "Nicht erfunden", "Steuer/Anwalt"],
    ["R9", "LHCI testet Live, nicht PR", "niedrig", "sicher", "Netz nach Merge", "PR kann wegen alter Live rot werden"],
    ["R10", "Same-Site-Header fehlt bei alten Clients", "niedrig", "selten", "assertSameSiteRequest lässt Requests ohne Sec-Fetch-Site durch", "Honeypot+Rate-Limit bleiben"],
]
for i, row in enumerate(risks):
    r = 6 + i
    for c, val in enumerate(row, 1):
        cell = rk.cell(r, c, val)
        cell.border = thin
        cell.alignment = wrap
        cell.font = valf
        if i % 2:
            cell.fill = fill_alt
    rk.row_dimensions[r].height = 32
for col, w in zip("ABCDEF", [8, 48, 14, 22, 42, 28]):
    rk.column_dimensions[col].width = w

# ---------------------------------------------------------------------------
# Kontrast
# ---------------------------------------------------------------------------
kt = wb.create_sheet("Kontrast")
kt.sheet_properties.tabColor = "D97868"
kt.sheet_view.showGridLines = False
kt.freeze_panes = "A7"
kt.merge_cells("A1:G2")
kt["A1"] = "WCAG 2.2 Kontrast — Luminanz und Verhältnis per Formel"
kt["A1"].font = title_font
kt["A1"].alignment = Alignment(vertical="center", indent=1)
paint(kt, 1, 2, 1, 7, fill_dark)
kt["A3"] = "Schwelle Normaltext AA"
kt["B3"] = 4.5
kt["B3"].number_format = "0.0"
kt.merge_cells("A4:G4")
kt["A4"] = "sRGB: C<=0,04045 → C/12,92 sonst ((C+0,055)/1,055)^2,4; L=0,2126R+0,7152G+0,0722B; Ratio=(Lhell+0,05)/(Ldunkel+0,05)"
kt["A4"].font = small
header_row(kt, 6, ["Token", "Hex", "R", "G", "B", "Luminanz", "Rolle"])
tokens = [
    ("danger (neu)", "D97868", "Vordergrund"),
    ("danger (alt, Vergleich)", "C45C4A", "Referenz alt"),
    ("fg", "F4EFE6", "Vordergrund"),
    ("muted", "C4BDB3", "Vordergrund"),
    ("subtle", "9A948A", "Vordergrund"),
    ("bg", "0C0C0D", "Hintergrund"),
    ("surface", "141416", "Hintergrund"),
    ("elevated", "1C1C20", "Hintergrund"),
]
for i, (name, hexv, role) in enumerate(tokens):
    r = 7 + i
    kt.cell(r, 1, name).border = thin
    kt.cell(r, 2, hexv).border = thin
    kt.cell(r, 3, f'=HEX2DEC(LEFT(B{r},2))').border = thin
    kt.cell(r, 4, f'=HEX2DEC(MID(B{r},3,2))').border = thin
    kt.cell(r, 5, f'=HEX2DEC(RIGHT(B{r},2))').border = thin
    # channel formula in helper cols later; compact luminance:
    kt.cell(r, 6, f'=0.2126*IF(C{r}/255<=0.04045,C{r}/255/12.92,((C{r}/255+0.055)/1.055)^2.4)+0.7152*IF(D{r}/255<=0.04045,D{r}/255/12.92,((D{r}/255+0.055)/1.055)^2.4)+0.0722*IF(E{r}/255<=0.04045,E{r}/255/12.92,((E{r}/255+0.055)/1.055)^2.4)').border = thin
    kt.cell(r, 7, role).border = thin
    for c in range(1, 8):
        kt.cell(r, c).font = valf
    kt.cell(r, 6).number_format = "0.0000"

header_row(kt, 16, ["Vordergrund", "Hex FG", "Hintergrund", "Hex BG", "Kontrast", "AA ≥ Schwelle", "Alt-Kontrast"])
pairs = [
    ("danger neu", "D97868", "bg", "0C0C0D"),
    ("danger neu", "D97868", "surface", "141416"),
    ("danger neu", "D97868", "elevated", "1C1C20"),
    ("fg", "F4EFE6", "bg", "0C0C0D"),
    ("muted", "C4BDB3", "bg", "0C0C0D"),
    ("subtle", "9A948A", "bg", "0C0C0D"),
    ("muted", "C4BDB3", "surface", "141416"),
    ("subtle", "9A948A", "surface", "141416"),
    ("muted", "C4BDB3", "elevated", "1C1C20"),
    ("subtle", "9A948A", "elevated", "1C1C20"),
]
for i, (fg, fgh, bg, bgh) in enumerate(pairs):
    r = 17 + i
    kt.cell(r, 1, fg).border = thin
    kt.cell(r, 2, fgh).border = thin
    kt.cell(r, 3, bg).border = thin
    kt.cell(r, 4, bgh).border = thin
    kt.cell(r, 5, f'=(MAX(0.2126*IF(HEX2DEC(LEFT(B{r},2))/255<=0.04045,HEX2DEC(LEFT(B{r},2))/255/12.92,((HEX2DEC(LEFT(B{r},2))/255+0.055)/1.055)^2.4)+0.7152*IF(HEX2DEC(MID(B{r},3,2))/255<=0.04045,HEX2DEC(MID(B{r},3,2))/255/12.92,((HEX2DEC(MID(B{r},3,2))/255+0.055)/1.055)^2.4)+0.0722*IF(HEX2DEC(RIGHT(B{r},2))/255<=0.04045,HEX2DEC(RIGHT(B{r},2))/255/12.92,((HEX2DEC(RIGHT(B{r},2))/255+0.055)/1.055)^2.4),0.2126*IF(HEX2DEC(LEFT(D{r},2))/255<=0.04045,HEX2DEC(LEFT(D{r},2))/255/12.92,((HEX2DEC(LEFT(D{r},2))/255+0.055)/1.055)^2.4)+0.7152*IF(HEX2DEC(MID(D{r},3,2))/255<=0.04045,HEX2DEC(MID(D{r},3,2))/255/12.92,((HEX2DEC(MID(D{r},3,2))/255+0.055)/1.055)^2.4)+0.0722*IF(HEX2DEC(RIGHT(D{r},2))/255<=0.04045,HEX2DEC(RIGHT(D{r},2))/255/12.92,((HEX2DEC(RIGHT(D{r},2))/255+0.055)/1.055)^2.4))+0.05)/(MIN(0.2126*IF(HEX2DEC(LEFT(B{r},2))/255<=0.04045,HEX2DEC(LEFT(B{r},2))/255/12.92,((HEX2DEC(LEFT(B{r},2))/255+0.055)/1.055)^2.4)+0.7152*IF(HEX2DEC(MID(B{r},3,2))/255<=0.04045,HEX2DEC(MID(B{r},3,2))/255/12.92,((HEX2DEC(MID(B{r},3,2))/255+0.055)/1.055)^2.4)+0.0722*IF(HEX2DEC(RIGHT(B{r},2))/255<=0.04045,HEX2DEC(RIGHT(B{r},2))/255/12.92,((HEX2DEC(RIGHT(B{r},2))/255+0.055)/1.055)^2.4),0.2126*IF(HEX2DEC(LEFT(D{r},2))/255<=0.04045,HEX2DEC(LEFT(D{r},2))/255/12.92,((HEX2DEC(LEFT(D{r},2))/255+0.055)/1.055)^2.4)+0.7152*IF(HEX2DEC(MID(D{r},3,2))/255<=0.04045,HEX2DEC(MID(D{r},3,2))/255/12.92,((HEX2DEC(MID(D{r},3,2))/255+0.055)/1.055)^2.4)+0.0722*IF(HEX2DEC(RIGHT(D{r},2))/255<=0.04045,HEX2DEC(RIGHT(D{r},2))/255/12.92,((HEX2DEC(RIGHT(D{r},2))/255+0.055)/1.055)^2.4))+0.05)').border = thin
    kt.cell(r, 5).number_format = "0.00"
    kt.cell(r, 6, f'=IF(E{r}>=$B$3,"PASS","FAIL")').border = thin
    kt.cell(r, 7, "—" if i >= 3 else "").border = thin
    for c in range(1, 8):
        kt.cell(r, c).font = valf
    kt.cell(r, 6).alignment = center

kt.conditional_formatting.add("F17:F26", FormulaRule(formula=['F17="PASS"'], fill=fill_pass))
kt.conditional_formatting.add("F17:F26", FormulaRule(formula=['F17="FAIL"'], fill=fill_fail))
kt["A28"] = "Paare bestanden"
kt["B28"] = '=COUNTIF(F17:F26,"PASS")'
kt["A29"] = "Paare gesamt"
kt["B29"] = '=COUNTA(F17:F26)'
kt["A30"] = "Quote AA"
kt["B30"] = '=IF(B29=0,0,B28/B29)'
kt["B30"].number_format = "0.0%"
for col, w in zip("ABCDEFG", [24, 12, 16, 12, 14, 16, 16]):
    kt.column_dimensions[col].width = w

# ---------------------------------------------------------------------------
# Dateien
# ---------------------------------------------------------------------------
df = wb.create_sheet("Dateien")
df.sheet_properties.tabColor = GREY
df.sheet_view.showGridLines = False
df.freeze_panes = "A6"
df.merge_cells("A1:E2")
df["A1"] = "Nachzug — geänderte Dateien, ohne .env"
df["A1"].font = title_font
df["A1"].alignment = Alignment(vertical="center", indent=1)
paint(df, 1, 2, 1, 5, fill_dark)
header_row(df, 5, ["Pfad", "Art", "Rolle im Audit", "Im Commit", "Bemerkung"])
files = [
    [".github/workflows/lighthouse-audit.yml", "CI", "server/** in path filter", "ja", ""],
    ["package.json", "Build", "operator.test im test-Script", "ja", ""],
    ["scripts/smoke-production.mjs", "QA", "10 km 20, Preise, Signup-Verbot", "ja", ""],
    ["scripts/build-audit-xlsx.py", "QA", "dieser Bericht", "ja", ""],
    ["server/security-headers.ts", "Security", "grok.com + dns-prefetch off", "ja", ""],
    ["src/lib/operator.ts", "Authz", "Allowlist + Enforce", "ja", "neu"],
    ["src/lib/operator-middleware.ts", "Authz", "nach authMiddleware", "ja", "neu"],
    ["src/lib/operator.test.ts", "Test", "Allowlist", "ja", "neu"],
    ["src/lib/auth/email-password.ts", "Auth", "emailSignUpEnabled=false", "ja", ""],
    ["src/lib/auth/server.ts", "Auth", "disableSignUp", "ja", "eine Zeile, Sicherheitsfix"],
    ["src/routes/login.tsx", "UI", "keine Registrierung, main-content", "ja", ""],
    ["src/routes/admin.tsx", "UI", "Kein Betriebszugang", "ja", ""],
    ["src/lib/admin.functions.ts", "Backend", "operatorMiddleware, Same-Site, getOperatorAccess", "ja", ""],
    ["src/lib/bookings.functions.ts", "Backend", "Same-Site, on-request-Notiz, Foto Name/Tel", "ja", ""],
    ["src/lib/cms.functions.ts", "Backend", "operatorMiddleware", "ja", ""],
    ["src/lib/backup.functions.ts", "Backend", "operatorMiddleware", "ja", ""],
    ["src/lib/ops.ts", "Backend", "keine Kunden-WA-Queue", "ja", ""],
    ["src/lib/ops.test.ts", "Test", "Confirm ohne WA", "ja", ""],
    ["src/components/configurator.tsx", "UI", "pickupPriceText", "ja", ""],
    ["src/data/pickup.test.ts", "Test", "alte 20-€-Staffel + on-request", "ja", ""],
    ["src/routes/datenschutz.tsx", "Recht", "Instagram-Satz", "ja", ""],
    ["src/routes/agb.tsx", "Recht", "Stand 31.08.2026", "ja", ""],
    ["src/routes/widerruf.tsx", "Recht", "Stand 31.08.2026", "ja", ""],
    ["docs/WHITE-GLOSS-Audit-2026-08-Abschlussbericht.xlsx", "Bericht", "dieser Stand", "ja", ""],
    [".env", "Secret", "NICHT im Commit", "nein", ""],
]
for i, row in enumerate(files):
    r = 6 + i
    for c, val in enumerate(row, 1):
        cell = df.cell(r, c, val)
        cell.border = thin
        cell.font = valf
        cell.alignment = wrap
        if i % 2:
            cell.fill = fill_alt
        if val == "nein":
            cell.fill = fill_fail
df.column_dimensions["A"].width = 58
df.column_dimensions["B"].width = 12
df.column_dimensions["C"].width = 42
df.column_dimensions["D"].width = 12
df.column_dimensions["E"].width = 28
lastf = 5 + len(files)
df.cell(lastf + 1, 1, "Dateien im Commit")
df.cell(lastf + 1, 2, f'=COUNTIF(D6:D{lastf},"ja")')
df.cell(lastf + 2, 1, "Ausgeschlossen")
df.cell(lastf + 2, 2, f'=COUNTIF(D6:D{lastf},"nein")')

out = Path("/workspace/docs/WHITE-GLOSS-Audit-2026-08-Abschlussbericht.xlsx")
wb.save(out)
print(out, out.stat().st_size)
