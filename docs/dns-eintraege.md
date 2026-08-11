# DNS-Einträge bei IONOS pflegen

Anleitung für `white-gloss.de`. Alle Schritte laufen in der IONOS-Oberfläche,
nichts davon berührt die Website selbst.

**Wo Sie hinmüssen:** IONOS-Konto → _Domains & SSL_ → `white-gloss.de` →
Reiter _DNS_. Dort steht eine Liste aller Einträge, darüber der Knopf
_Eintrag hinzufügen_.

## Drei Regeln vorweg

1. **Einen bestehenden Eintrag ändern heißt bearbeiten, nicht hinzufügen.**
   Bei manchen Eintragsarten sind zwei Stück gleichzeitig ungültig — dann
   greift keiner von beiden. Das gilt für SPF und DMARC.
2. **Nichts löschen, was Sie nicht zuordnen können.** Ein gelöschter
   MX-Eintrag stoppt den Mailempfang, ein gelöschter A-Eintrag die Website.
3. **Änderungen brauchen Zeit.** Meist wenige Minuten, in Einzelfällen bis zu
   einem Tag, weil andere Server die alten Werte zwischengespeichert haben.

---

## Stand heute

| Eintrag                 | Wert                                    | Bewertung                   |
| ----------------------- | --------------------------------------- | --------------------------- |
| A (`@` und `www`)       | `217.154.124.239`                       | richtig, nicht anfassen     |
| MX                      | `mx00.ionos.de`, `mx01.ionos.de`        | richtig, nicht anfassen     |
| TXT (SPF)               | `v=spf1 include:_spf-eu.ionos.com ~all` | richtig, nicht anfassen     |
| TXT `resend._domainkey` | DKIM-Schlüssel                          | richtig, nicht anfassen     |
| TXT `send` + MX `send`  | Resend-Versandweg                       | richtig, nicht anfassen     |
| `_dmarc`                | CNAME auf `dmarc.ionos.de`              | **wirkungslos — Schritt 2** |
| CAA                     | fehlt                                   | **Schritt 3**               |
| AAAA                    | fehlt                                   | optional — Schritt 4        |

Zwei `google-site-verification`-Einträge sind vorhanden. Einer stammt
vermutlich aus einem früheren Versuch. **Bitte beide stehen lassen** — sie
stören nicht, und wer den falschen löscht, verliert die Bestätigung in der
Google Search Console.

---

## Schritt 1 – Aussteller des Zertifikats feststellen

Diese Prüfung entscheidet, was in Schritt 3 einzutragen ist. Ohne sie kann
der CAA-Eintrag die Website bei der nächsten Zertifikatserneuerung lahmlegen.

1. `https://white-gloss.de` im Browser öffnen.
2. Auf das Schloss-Symbol links in der Adresszeile klicken.
3. _Verbindung ist sicher_ → _Zertifikat ist gültig_ (Edge/Chrome) wählen.
4. Unter **Ausgestellt von** die Zeile **Organisation (O)** ablesen.

**Nur die Organisationszeile zählt.** Darüber steht der Name des
Zwischenzertifikats — Kürzel wie `R10`, `E5` oder `YE1`. Die werden von den
Ausstellern regelmäßig ausgetauscht und sagen nichts darüber aus, was in den
CAA-Eintrag gehört. Ein Kürzel, das hier nicht aufgeführt ist, bedeutet also
nicht, dass etwas nicht stimmt.

| Organisation (O)        | Wert für den CAA-Eintrag |
| ----------------------- | ------------------------ |
| `Let's Encrypt`         | `letsencrypt.org`        |
| `ZeroSSL`               | `sectigo.com`            |
| `Google Trust Services` | `pki.goog`               |
| `DigiCert`              | `digicert.com`           |

Einzutragen ist immer der **Domainname** aus der rechten Spalte, niemals der
Anzeigename. `Let's Encrypt` als Wert passt auf keine Zertifizierungsstelle
und verbietet damit allen die Ausstellung — der Fehler fällt erst bei der
nächsten Erneuerung auf.

## Schritt 2 – DMARC vervollständigen

DMARC sagt anderen Mailservern, was mit Nachrichten geschehen soll, die
vorgeben, von Ihnen zu kommen.

**Der Ausgangszustand ist eine Falle.** Unter `_dmarc` steht kein eigener
Eintrag, sondern ein **CNAME auf `dmarc.ionos.de`**. Dort liegt ein
Sammeleintrag von IONOS, den alle Kunden teilen:

```
v=DMARC1; p=none;
```

Er gehört nicht diesem Betrieb, ordnet nichts an und nennt keine Adresse für
Berichte. In jeder Prüfung sieht das nach einem vorhandenen DMARC-Eintrag
aus — wirksam ist er nicht.

**Deshalb bietet die IONOS-Maske hier kein TXT an.** Im DNS gilt: Ein Name mit
CNAME darf keinen weiteren Eintrag tragen. Der Typ lässt sich also nicht
umstellen, solange der CNAME existiert.

**Vorbereitung:** Legen Sie im IONOS-Postfachbereich eine Adresse
`dmarc@white-gloss.de` an — als Alias oder eigenes Postfach. Dorthin kommen
täglich technische Berichte als XML-Anhang. In Ihrem Hauptpostfach wären die
nur lästig.

**Dann in dieser Reihenfolge:**

1. Den Eintrag `_dmarc` vom Typ **CNAME löschen**. Das ist gefahrlos: Mit
   `p=none` ordnet er ohnehin nichts an, es wird also keine einzige Mail
   anders behandelt.
2. Über _Eintrag hinzufügen_ einen **neuen TXT-Eintrag** anlegen:

| Feld     | Wert                                                      |
| -------- | --------------------------------------------------------- |
| Typ      | `TXT`                                                     |
| Hostname | `_dmarc`                                                  |
| Wert     | `v=DMARC1; p=none; rua=mailto:dmarc@white-gloss.de; fo=1` |
| TTL      | Standard belassen                                         |

Legt IONOS den CNAME nach kurzer Zeit selbsttätig wieder an, ist in den Mail-
oder Sicherheitseinstellungen eine Option wie „DMARC verwalten" aktiv. Die
muss erst abgeschaltet werden, sonst überschreibt IONOS den eigenen Eintrag
immer wieder.

`p=none` bleibt zunächst bewusst stehen: In dieser Stufe wird nur beobachtet,
nichts abgewiesen. So kann der Eintrag keine echte Post blockieren.

**Nach vier bis sechs Wochen**, wenn die Berichte zeigen, dass alle Ihre
Versandwege sauber sind, auf `p=quarantine` erhöhen. Erst dann entsteht die
eigentliche Schutzwirkung.

## Schritt 3 – CAA anlegen

Damit legen Sie fest, welche Stelle überhaupt Zertifikate für Ihre Domain
ausstellen darf. Ohne diesen Eintrag darf es jede.

Legen Sie **zwei** Einträge an — einen für den in Schritt 1 ermittelten
Aussteller, einen zweiten als Rückfalloption, falls die Servertechnik den
Anbieter wechselt. Zwei CAA-Einträge nebeneinander sind ausdrücklich erlaubt
und sinnvoll.

| Feld     | Eintrag 1                                         | Eintrag 2     |
| -------- | ------------------------------------------------- | ------------- |
| Typ      | `CAA`                                             | `CAA`         |
| Hostname | leer bzw. `@`                                     | leer bzw. `@` |
| Flag     | `0`                                               | `0`           |
| Tag      | `issue`                                           | `issue`       |
| Wert     | Aussteller aus Schritt 1, z. B. `letsencrypt.org` | `sectigo.com` |

Fragt IONOS statt einzelner Felder nach einer Zeile, lautet sie:

```
0 issue "letsencrypt.org"
```

**Wenn Sie sich bei Schritt 1 nicht sicher sind: diesen Schritt überspringen.**
Kein CAA-Eintrag ist der heutige Zustand und ungefährlich. Ein falscher CAA-
Eintrag führt dazu, dass das Zertifikat irgendwann nicht mehr erneuert werden
kann und die Website mit einer Sicherheitswarnung stehen bleibt.

## Schritt 4 – IPv6 (optional, später)

Der Server ist derzeit nur über IPv4 erreichbar. Ein AAAA-Eintrag ist nur
sinnvoll, wenn der VPS eine IPv6-Adresse hat **und** die Website darauf
antwortet. Beides muss vorher geprüft werden — ein AAAA-Eintrag auf eine
Adresse, die nichts ausliefert, macht die Seite für IPv6-Besucher unerreichbar.

Kein dringender Punkt. Ohne geprüfte Serverkonfiguration besser weglassen.

---

## Was Sie auf keinen Fall tun sollten

- **Keinen zweiten SPF-Eintrag anlegen.** Eine Domain darf genau einen haben.
  Ein zweiter macht beide ungültig, und Ihre Mails landen im Spam. Der
  Resend-Versand braucht keinen — er läuft über die Unterdomain `send`, die
  ihren eigenen Eintrag hat.
- **Den `www`-Eintrag nicht löschen.** Er fängt alle auf, die aus Gewohnheit
  `www.` davor tippen.
- **Die Einträge der Unterdomain `send` nicht anfassen.** Sie tragen den
  Mailversand der Website.

## Zum Nachprüfen

Nach etwa einer halben Stunde lässt sich das Ergebnis kostenlos prüfen:

- <https://mxtoolbox.com/dmarc.aspx> — DMARC
- <https://mxtoolbox.com/CAATest.aspx> — CAA
- <https://mxtoolbox.com/spf.aspx> — SPF, sollte weiterhin genau einen Eintrag melden
