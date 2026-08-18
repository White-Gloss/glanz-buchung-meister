# Alte Domain weiterleiten: whitegloss.de → white-gloss.de

**Das ist derzeit der wichtigste offene Punkt für die Auffindbarkeit bei
Google — wichtiger als jede weitere Änderung an der Website.**

## Warum

Die Search Console sagt es unmissverständlich für die Startseite:

```
Vom Nutzer angegebene kanonische URL:   https://white-gloss.de/
Von Google ausgewählte kanonische URL:  https://whitegloss.de/
```

Übersetzt: „Ihr sagt, white-gloss.de sei das Original. Ich halte die alte
Adresse für das Original und indexiere deshalb eure neue Startseite nicht."

An der neuen Seite liegt es nicht. Google bestätigt im selben Bericht
„Seitenabruf: Erfolgreich" und „Indexierung zulässig: Ja". Der Canonical
zeigt korrekt auf white-gloss.de, in der Sitemap steht keine einzige alte
Adresse. Google ignoriert diese Signale, weil die alte Domain älter und
bekannter ist.

Solange das so bleibt, zahlt jede Verbesserung auf eine Adresse ein, die
Google für eine Kopie hält.

## Wichtig vorweg: Die E-Mail bleibt unberührt

Eine Weiterleitung wirkt auf **Web-Aufrufe**, nicht auf E-Mail. Der
Mailverkehr läuft über MX-Einträge, die davon nichts mitbekommen.

**Nicht tun**, sonst ist die E-Mail weg:

- die Domain kündigen oder löschen
- die DNS-Zone löschen
- MX-Einträge ändern oder entfernen
- die Domain „parken", wenn dabei die DNS-Einträge ersetzt werden

Die alte Domain muss **registriert bleiben**. Sie hört nur auf, eine eigene
Website auszuliefern.

---

## Weg A – über die Oberfläche (einfacher)

1. Bei [hpanel.hostinger.com](https://hpanel.hostinger.com) anmelden
2. Oben **Domains** → **Weiterleitungen** (englisch: *Redirects*)
3. **Weiterleitung erstellen**
   - Domain: `whitegloss.de`
   - Weiterleiten zu: `https://white-gloss.de`
4. Speichern

Läuft die alte Seite noch als Hosting-Paket, muss sie vorher unter
**Websites** vom Domainnamen getrennt oder gelöscht werden — sonst gewinnt
die Website gegen die Weiterleitung. Die Dateien dürfen liegenbleiben, sie
werden nur nicht mehr ausgeliefert.

**Einschränkung:** Diese Variante schickt in der Regel *alles* auf die
Startseite. `whitegloss.de/abholservice/calw` landet dann auf
`white-gloss.de` statt auf der passenden Unterseite. Für den Umzug bei
Google reicht das, ideal ist es nicht — siehe Weg B.

## Weg B – über `.htaccess` (besser, jede Seite landet richtig)

Die Adressen sind auf beiden Domains gleich aufgebaut. Damit lässt sich
jede alte Unterseite exakt auf ihr neues Gegenstück schicken.

1. hPanel → **Dateien** → **Dateimanager**
2. In den Ordner `public_html` der alten Domain wechseln
3. Die Datei `.htaccess` öffnen (falls nicht vorhanden: neu anlegen)
4. Diese Zeilen **ganz oben** einfügen, vor allem anderen:

```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} ^(www\.)?whitegloss\.de$ [NC]
RewriteRule ^(.*)$ https://white-gloss.de/$1 [R=301,L]
```

5. Speichern

`R=301` bedeutet „dauerhaft umgezogen" — genau das Signal, das Google für
die Adressänderung braucht. Eine 302 (vorübergehend) taugt dafür nicht.

## Prüfen

Im Browser aufrufen:

- `whitegloss.de` → muss auf `white-gloss.de` landen
- `whitegloss.de/abholservice/calw` → bei Weg B auf
  `white-gloss.de/abholservice/calw`, bei Weg A auf der Startseite

Danach eine Testmail an die alte Adresse schicken und prüfen, ob sie
ankommt. Sie sollte — aber nachsehen ist besser als annehmen.

---

## Danach: Adressänderung in der Search Console

Erst wenn die Weiterleitung steht, akzeptiert Google den Umzug.

1. Search Console öffnen
2. Oben links auf die Property umschalten — **auf die alte Domain**
   `whitegloss.de`. Die Adressänderung wird in der Property der **alten**
   Domain gemacht, nicht in der neuen. Das ist die häufigste Verwechslung.
3. **Einstellungen** → **Adressänderung**
4. Als Ziel `white-gloss.de` wählen → **Validieren und aktualisieren**

### Falls die alte Property nicht mehr existiert

Dann muss sie neu angelegt und bestätigt werden — und zwar **über einen
DNS-TXT-Eintrag**, nicht über eine HTML-Datei. Grund: Nach der Weiterleitung
liefert die alte Domain keine Dateien mehr aus, die Datei-Methode schlägt
also zwangsläufig fehl. Der DNS-Weg funktioniert weiter, weil die
Weiterleitung nur Web-Aufrufe betrifft und die DNS-Einträge unverändert
bleiben.

Der TXT-Eintrag wird bei Hostinger unter **Domains → DNS-Zone** angelegt.

## Was danach passiert

Google überträgt die Signale der alten Domain schrittweise auf die neue.
Das dauert Wochen, nicht Tage. Die Weiterleitung sollte deshalb **mindestens
ein Jahr** bestehen bleiben, und die alte Domain so lange registriert.

Kontrolle in der Search Console unter **Seiten**: Die Zeile „Duplikat —
Google hat eine andere Seite als der Nutzer als kanonische Seite bestimmt"
muss verschwinden.
