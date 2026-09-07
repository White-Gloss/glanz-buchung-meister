# Automatische WhatsApp-Hinweise an den Inhaber

Der Meta-Adapter versendet Vorlagen aus der dauerhaften Versandwarteschlange. Eine
API-Zusage bedeutet zunächst nur „angenommen“; der signierte Webhook trägt später
`sent`, `delivered`, `read` oder `failed` ein. Keine dieser Funktionen bestätigt,
ändert oder storniert einen Termin. Die Terminentscheidung bleibt im geschützten
Betriebspanel.

Die neue Anwendungsanbindung wurde in diesem Auftrag nur lokal geprüft. Neue
Migrationen, Timerinstallation und Meta-Webhook-Aktivierung auf dem
Produktivsystem sowie eine echte Testnachricht stehen noch aus. Das vorhandene
Meta-Konto wird weiterverwendet.
Die Reihenfolge für Migration, Release und Timer steht in
[booking-workflow-operations.md](booking-workflow-operations.md).

## Vorhandenes Meta-Konto verbinden

Die bestehende Meta-Cloud-API-Einrichtung wird weiterverwendet. Alle Werte gehören
in die geschützte Serverumgebung, beim aktuellen IONOS-Betrieb in
`/etc/white-gloss/environment`. `.env.example` enthält nur leere Felder. Keine
Zugangsdaten in Git, Browservariablen (`VITE_*`), Nachrichten oder Logs ablegen.

| Variable                        | Inhalt                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `WHATSAPP_PROVIDER`             | `meta`; leer oder `disabled` deaktiviert Versand und Webhook                             |
| `WHATSAPP_ACCESS_TOKEN`         | Server-Token mit Berechtigung `whatsapp_business_messaging` und Zugriff auf den Absender |
| `WHATSAPP_PHONE_NUMBER_ID`      | Meta-ID der sendenden Geschäftsnummer; keine Telefonnummer                               |
| `WHATSAPP_BUSINESS_ACCOUNT_ID`  | ID des zugehörigen WhatsApp Business Accounts (WABA)                                     |
| `WHATSAPP_APP_SECRET`           | App Secret für die HMAC-Prüfung eingehender POSTs                                        |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Eigenes geheimes Token für die GET-Verifizierung; getrennt vom App Secret                |
| `WHATSAPP_API_VERSION`          | Eine aktuell unterstützte Version des vorhandenen Meta-Projekts im Format `vNN.N`        |
| `WHATSAPP_TEMPLATE_NAME`        | Name der passenden bereits genehmigten Vorlage                                           |
| `WHATSAPP_TEMPLATE_LANGUAGE`    | Exakter Sprachcode dieser Vorlage, beispielsweise `de`                                   |
| `ADMIN_WHATSAPP_NUMBER`         | Empfangsnummer des Inhabers im internationalen Format                                    |
| `OWNER_WHATSAPP`                | Bestehender Ersatzwert, falls `ADMIN_WHATSAPP_NUMBER` leer ist                           |
| `WHATSAPP_TIMEOUT_MS`           | Optional 1000–30000 ms; Standard 10000 ms                                                |

Es gibt keinen Rückfall auf die öffentlich angezeigte Geschäftsnummer. Der Adapter
akzeptiert ausschließlich den konfigurierten Empfänger. Die Konfigurationsprüfung
gibt nur fehlende oder ungültige Feldnamen zurück. Für die regelmäßige Verarbeitung
der Warteschlange muss außerdem der geschützte Benachrichtigungsjob eingerichtet
sein; dessen Zugriff verwendet `REMINDER_CRON_SECRET`.

Meta dokumentiert System-User-Tokens als Alternative zu kurzlebigen Testtokens.
Die App muss dem WABA zugeordnet und für dessen Webhooks abonniert sein.
[Offizielle Meta-API-Sammlung](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)

## Exakter Vorlagenvertrag

Owner-Benachrichtigungen können außerhalb eines laufenden 24-Stunden-Fensters
entstehen. Deshalb sendet der Adapter immer eine genehmigte Vorlage. Meta erlaubt
außerhalb dieses Fensters ausschließlich genehmigte Vorlagen.
[WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy/preview?lang=es_LA)

Die vorhandene Vorlage muss genau zwei **positionale Textparameter im Body**
erwarten. Es werden keine variablen Header-, Button- oder Medienparameter gesendet.

1. `{{1}}`: Betreff des Ereignisses, höchstens 160 Zeichen.
2. `{{2}}`: Kurze strukturierte Buchungsinformation, höchstens 700 Zeichen.

Zeilenumbrüche, Tabs und wiederholte Leerzeichen werden zu einfachen Leerzeichen.
Name, Wunschtermin, Leistung, Telefon und Status können Teil der notwendigen
Buchungskurzinfo sein. Keine Zugangsdaten, vollständigen technischen Fehlertexte
oder Stacktraces in diese Parameter übernehmen. Die Parameter werden nicht geloggt.

Passender Vorlagentext zur Prüfung im vorhandenen Meta-Konto:

```text
White Gloss Betrieb: {{1}}
Information zum Vorgang: {{2}}
Bitte prüfen Sie den Vorgang im Betriebspanel.
```

Dies ist ein Einrichtungsvorschlag, keine Behauptung einer erfolgten
Meta-Genehmigung. Falls die bereits genehmigte Vorlage einen anderen Vertrag hat,
müssen Vorlage und Adapter zuerst aufeinander abgestimmt werden. Es wird keine
Vorlage automatisch angelegt und keine Freitextnachricht als Ersatz verschickt.
Das JSON-Schema für `template.name`, `language.code` und `components` entspricht
Metas Vorlagenbeispiel.
[Offizielles Template-Beispiel](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/)

## Webhook

Callback-URL: `https://white-gloss.de/api/whatsapp-webhook`. Im bestehenden Meta-App-
Dashboard das oben konfigurierte Verify-Token verwenden und das Feld `messages`
des zugehörigen WABA abonnieren. Die öffentlich erreichbare HTTPS-URL darf keine
Browseranmeldung voraussetzen.

GET akzeptiert ausschließlich `hub.mode=subscribe`, das passende
`hub.verify_token` und eine nicht leere `hub.challenge`. Die Challenge wird als
unveränderter Text zurückgegeben. POST prüft `X-Hub-Signature-256` mit HMAC-SHA256
über die unveränderten Body-Bytes und das **App Secret**, bevor JSON verarbeitet
wird. Der Vergleich ist zeitkonstant. Metas offizielle Implementierung zeigt die
getrennten Konfigurationswerte; das alte SDK wird hier nicht als Abhängigkeit
installiert.
[Meta-Webhook-Implementierung](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK/blob/main/src/api/webhooks.ts)

Statusdaten werden nur für den konfigurierten WABA, die Absender-ID und den
Inhaberempfänger verarbeitet. Andere signierte Ereignisse und eingehende Chats
werden bestätigt und ignoriert. Der Webhook ist ausdrücklich kein Kanal für
Terminbefehle. Unbekannte Nachrichten verändern keinen Buchungs- oder
Ausgangsdatensatz; ein empfangener Zustellstatus kann lediglich seinen
Deduplizierungsschlüssel in der Receipt-Tabelle hinterlassen.

Die Receipt-Tabelle speichert nur einen SHA-256-Ereignisschlüssel und den
Empfangszeitpunkt, keine vollständigen Webhooks. Deduplizierung, Outbox-Update und
der bei `failed` vorgemerkte E-Mail-Hinweis an den Inhaber liegen in derselben
Transaktion. Auch dieser Hinweis wird anhand des ursprünglichen Ausgangs
dedupliziert. Bei einem DB-Fehler wird 503 zurückgegeben,
damit eine Wiederzustellung verarbeitet werden kann. Doppelte Zustellungen haben
keinen weiteren Effekt. Der Adapter setzt keine kurze Ablaufzeit für diese
Deduplizierung voraus. Die Migration `0009_whatsapp_receipts.sql` benötigt die
Outbox-Erweiterung `0008_notification_delivery.sql`.

`read` schließt die Zustellung ein; spätere `sent`- oder `failed`-Ereignisse setzen
eine bereits zugestellte oder gelesene Nachricht nicht zurück. `cancelled`-Einträge
bleiben storniert. Die zugehörigen Meta-Statusfelder sind `id`, `recipient_id`,
`status`, `timestamp` und optional `errors`.
[Offizielle Statusreferenz](https://www.postman.com/meta/whatsapp-business-platform/folder/fuaee8l/statuses-object)

## Wiederholungen und ungewisse Antworten

`sendWhatsAppNotification()` sendet pro Aufruf genau einen POST. Explizite
Rate-Limits, transiente Graph-Fehler und Graph-5xx-Antworten werden als wiederholbar
klassifiziert; `Retry-After` wird an den Worker weitergegeben. Konfigurations-,
Empfänger- und Vorlagenfehler werden nicht endlos wiederholt. Nur sichere Fehlercodes
wie `meta_190`, keine Provider-Fehlertexte, verlassen den Adapter.

Der stabile Outbox-Schlüssel wird als `biz_opaque_callback_data` mitgegeben. Er
dient zur Korrelation späterer Statusmeldungen, auch wenn die unmittelbare
Sendeantwort verloren geht. Daraus wird **keine Exactly-once-Garantie von Meta**
abgeleitet; der Adapter erfindet keinen `Idempotency-Key`-Header. Nach Timeout,
Verbindungsabbruch oder unbrauchbarer Erfolgsantwort ist der Ausgang ungewiss.
Der Worker muss solche Einträge auf `review` setzen und darf sie nicht blind erneut
senden. Ein passender signierter Zustellstatus kann sie später auflösen.

Eine API-Zusage mit `wamid` ist noch kein Zustellnachweis. Ob die Nachricht den
Inhaber erreicht hat, ergibt sich erst aus dem Webhook. Die lokale
Konfigurationsprüfung erkennt fehlende oder ungültig formatierte Werte. Sie
prüft weder die Gültigkeit des Tokens noch die Genehmigung der Vorlage bei Meta.
Diese Kontoeinstellungen und die tatsächliche Zustellung müssen im verbundenen
Meta-Konto geprüft werden.

Recherche: 6. September 2026, offizielle Meta-Quellen. Die aktuelle Developer-
Dokumentation lieferte bei der Recherche teilweise HTTP 429. Deshalb wurde kein
unbestätigtes aktuelles Versions-, Preis- oder Retry-Zeitfenster fest eingebaut.
Das offizielle Node-SDK ist archiviert; verwendet werden native `fetch` und
`node:crypto`.
[SDK-Status](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK)

## Lokale Prüfung ohne Nachrichtenversand

```bash
node --experimental-strip-types --test src/lib/whatsapp-provider.test.ts src/lib/whatsapp-webhook.test.ts
```

Die Transporttests verwenden ausschließlich injizierte Fetch-Doubles. Webhook-
Tests signieren synthetische Daten; die Persistenztests nutzen eine separate
PGlite-Datenbank und die echten Migrationen. Sie prüfen parallele Duplikate,
Statusreihenfolge, Stornierungsschutz, atomare Fehlerhinweise, Wiederanlauf nach DB-Fehler und die
Auflösung ungewisser Versandversuche. Keine Tests benötigen Meta-Zugangsdaten oder
erreichen externe Empfänger.
