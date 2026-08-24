# Search-Console-Eintrag wird nicht bestätigt

Stand: 24. August 2026. Betrifft das Google-Konto `info@whitegloss.de` und
die Properties `whitegloss.de` (alt) und `white-gloss.de` (neu).

## Befund

Im Ordner `public/` liegen zwei Bestätigungsdateien:

| Datei                         | Hinzugefügt am | Commit                                              |
| ----------------------------- | -------------- | --------------------------------------------------- |
| `googlef2a231c40b846ddd.html` | 08.08.2026     | „Google-Favicon neu anstoßen"                       |
| `googlec46de81dfa777419.html` | 17.08.2026     | „Bestaetigungsdatei fuer die Google Search Console" |

Zwei Dateien aus zwei Anläufen — die zweite wurde angelegt, weil die erste
nicht griff. Gleichzeitig steht `VITE_GOOGLE_SITE_VERIFICATION` in `.env`
auf `""`, das Meta-Tag wird also gar nicht ausgeliefert.

**Die Datei-Methode kann in dieser Lage nicht funktionieren.** Das hat je
nach Property-Typ einen von zwei Gründen — beide treffen hier zu.

### Grund 1 – Bei einer Domain-Property gibt es die Datei-Methode nicht

Eine **Domain-Property** (`white-gloss.de`, ohne `https://` eingegeben)
lässt sich ausschließlich über einen **DNS-TXT-Eintrag** bestätigen. Google
bietet die HTML-Datei dort nicht einmal an. Eine Datei in `public/`
abzulegen ändert daran nichts: Sie wird zwar ausgeliefert, aber niemand
fragt sie ab.

### Grund 2 – Bei der alten Domain frisst die Weiterleitung die Datei

Für die **Adressänderung** muss auch die alte Property `whitegloss.de`
bestätigt sein. Genau dort scheitert die Datei-Methode zwangsläufig:
`whitegloss.de` leitet seit dem Umzug alles per `301` auf `white-gloss.de`
um. Google ruft `https://whitegloss.de/google….html` ab, bekommt eine
Weiterleitung auf eine **andere Domain** — und folgt ihr für die
Besitzprüfung nicht. Was zählt, ist ausschließlich, was unter der
Property-Adresse selbst ausgeliefert wird.

Das steht so auch schon in
[`alte-domain-weiterleiten.md`](alte-domain-weiterleiten.md) unter „Falls
die alte Property nicht mehr existiert".

### Nebenbefund – die Postanschrift des Kontos

Das Google-Konto lautet `info@whitegloss.de`, die Website nennt überall
`info@white-gloss.de`. Beide Postfächer dürfen bestehen; die MX-Einträge
der alten Domain sind von der Weiterleitung nicht betroffen
([`dns-eintraege.md`](dns-eintraege.md)). Wichtig ist nur: Google schickt
Bestätigungen, Warnungen und den Ausgang der Adressänderung an **das Konto,
mit dem die Property angelegt wurde**. Läuft `info@whitegloss.de`
irgendwann aus, gehen diese Nachrichten verloren — und der Verlust einer
Bestätigung fällt erst auf, wenn die Daten in der Search Console
verschwinden.

## Was zu tun ist

Reihenfolge einhalten. Schritt 1 und 2 sind unabhängig voneinander, Schritt
3 setzt beide voraus.

### Schritt 1 – Neue Domain per DNS bestätigen

1. <https://search.google.com/search-console> mit `info@whitegloss.de`
   öffnen.
2. _Property hinzufügen_ → linke Spalte **Domain** → `white-gloss.de`
   eintragen (ohne `https://`, ohne `www`).
3. Google zeigt einen TXT-Wert `google-site-verification=…`.
4. Bei **IONOS** unter _Domains → white-gloss.de → DNS_ einen
   **zusätzlichen** TXT-Eintrag anlegen, Hostname leer bzw. `@`.

   > **Den vorhandenen SPF-Eintrag nicht überschreiben.** Eine Domain darf
   > beliebig viele TXT-Einträge haben, aber nur einen SPF. Wird der
   > bestehende ersetzt, landen ab sofort alle Mails im Spam.

5. Nach einigen Minuten in der Search Console auf **Bestätigen** klicken.

### Schritt 2 – Alte Domain ebenfalls per DNS bestätigen

Gleiches Vorgehen, aber Property `whitegloss.de` und der TXT-Eintrag in der
DNS-Zone der **alten** Domain (bei Hostinger unter _Domains → DNS-Zone_).

Nur dieser Weg funktioniert — die Datei-Methode scheitert hier an der
Weiterleitung, siehe Grund 2.

### Schritt 3 – Adressänderung melden

Erst wenn beide Properties bestätigt sind:

1. Property **`whitegloss.de`** auswählen — die Adressänderung sitzt bei der
   **alten** Domain. Das ist die häufigste Verwechslung.
2. _Einstellungen_ → _Adressänderung_ → Ziel `white-gloss.de` →
   **Validieren und aktualisieren**.

Danach weiter mit
[`sichtbarkeit-sofortmassnahmen.md`](sichtbarkeit-sofortmassnahmen.md)
(Sitemap einreichen, Indexierung beantragen).

## Wenn stattdessen eine URL-Präfix-Property gewünscht ist

Nur bei dieser Variante ist das Meta-Tag überhaupt sinnvoll. Der Code aus
dem `content`-Attribut gehört dann in `.env`:

```
VITE_GOOGLE_SITE_VERIFICATION="abcDEF123…"
```

Mehrere Properties gleichzeitig sind zulässig, durch Komma getrennt:

```
VITE_GOOGLE_SITE_VERIFICATION="codeFuerDieEineProperty,codeFuerDieAndere"
```

`VITE_`-Werte werden beim Build fest eingebaut — nach jeder Änderung ist ein
neues Deployment nötig.

Dass mehrere Codes tatsächlich ankommen, war bis jetzt nicht der Fall:
Die Meta-Liste der Seite wird nach `name` dedupliziert, von zwei Einträgen
`google-site-verification` überlebte also nur der letzte. Der verworfene
Code war im Quelltext nicht zu sehen — die Seite sah richtig aus, Google
meldete lediglich „nicht bestätigt". Die Bestätigungs-Tags werden deshalb
seit dieser Änderung direkt im Dokumentkopf gesetzt (`RootShell` in
`src/routes/__root.tsx`), wo sie vollständig erhalten bleiben.

Zwei weitere Eingaben werden abgefangen, statt still zu scheitern:

- Ein **versehentlich ganz kopiertes `<meta …>`-Tag** — der Code wird
  daraus herausgelöst.
- Der **Dateiname der Datei-Methode** (`google….html`) wird verworfen. Als
  Meta-Wert bestätigt er nichts; früher wäre daraus ein Tag entstanden, das
  gültig aussieht und es nicht ist.

Die Einzelheiten stehen in `src/lib/googleSiteVerification.ts`.

## Was mit den beiden vorhandenen Dateien geschieht

Sie bleiben liegen. Eine davon könnte eine bestehende URL-Präfix-Property
bestätigen; ein Löschen würde diese Property sofort entwerten. Sie zu
behalten kostet nichts — zwei Dateien mit je einer Zeile.

Ab sofort prüft `npm run smoke:production` nach jedem Deployment, dass jede
Datei aus `public/` unter der Live-Domain erreichbar ist, den erwarteten
Inhalt trägt und nicht durch eine Weiterleitung auf eine fremde Domain
abwandert. Bisher wäre ein solcher Verlust nur per E-Mail an das
Google-Konto gemeldet worden — und dort wochenlang unbemerkt geblieben.

## Was hiermit ausdrücklich nicht gelöst ist

Das **Google-Unternehmensprofil** ist ein getrenntes Verfahren mit einer
eigenen Sperre (gesperrt, als Duplikat geführt, „dauerhaft geschlossen").
Es hängt nicht an der Search Console und wird durch keinen der Schritte
hier freigeschaltet. Der Weg dorthin steht in
[`google-unternehmensprofil.md`](google-unternehmensprofil.md).

Für einen örtlichen Dienstleistungsbetrieb bleibt dieses Profil der
wirksamere Hebel — die Search Console zeigt Messwerte, das Profil bringt
Kundschaft.
