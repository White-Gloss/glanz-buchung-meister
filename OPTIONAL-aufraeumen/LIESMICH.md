# Optionaler Aufräum-Schritt (Punkt 11 des Audits)

Dieser Ordner ist **nicht nötig**, damit die Website funktioniert.
Er entfernt 31 ungenutzte npm-Pakete und 41 ungenutzte Design-Bausteine.

**Nutzen:** kleinere Abhängigkeitsliste, weniger Angriffsfläche bei Updates,
schnellere Installation. **Kein** Einfluss auf Ladezeit oder Aussehen –
diese Dateien landen ohnehin nie im Browser.

## Wenn du es machen willst

1. `package.json` und `package-lock.json` aus diesem Ordner ins
   Hauptverzeichnis des Repositories hochladen.
2. Danach diese 42 Dateien im Repository löschen:

bun.lock
src/components/ui/accordion.tsx
src/components/ui/alert-dialog.tsx
src/components/ui/alert.tsx
src/components/ui/aspect-ratio.tsx
src/components/ui/avatar.tsx
src/components/ui/badge.tsx
src/components/ui/breadcrumb.tsx
src/components/ui/calendar.tsx
src/components/ui/card.tsx
src/components/ui/carousel.tsx
src/components/ui/chart.tsx
src/components/ui/checkbox.tsx
src/components/ui/collapsible.tsx
src/components/ui/command.tsx
src/components/ui/context-menu.tsx
src/components/ui/dialog.tsx
src/components/ui/drawer.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/form.tsx
src/components/ui/hover-card.tsx
src/components/ui/input-otp.tsx
src/components/ui/menubar.tsx
src/components/ui/navigation-menu.tsx
src/components/ui/pagination.tsx
src/components/ui/popover.tsx
src/components/ui/progress.tsx
src/components/ui/radio-group.tsx
src/components/ui/resizable.tsx
src/components/ui/scroll-area.tsx
src/components/ui/select.tsx
src/components/ui/separator.tsx
src/components/ui/sheet.tsx
src/components/ui/sidebar.tsx
src/components/ui/slider.tsx
src/components/ui/switch.tsx
src/components/ui/table.tsx
src/components/ui/tabs.tsx
src/components/ui/textarea.tsx
src/components/ui/toggle-group.tsx
src/components/ui/toggle.tsx
src/components/ui/tooltip.tsx

## WICHTIG: ganz oder gar nicht

Diese beiden Schritte gehören zusammen. Lädst du nur die neue `package.json`
hoch, ohne die Dateien zu löschen, schlägt die Prüfung fehl (die Dateien
verweisen auf entfernte Pakete). Löschst du nur die Dateien ohne die neue
`package.json`, funktioniert alles – dann bleiben nur die Pakete unnötig
installiert.

Einzige Ausnahme mit echtem Wert: `src/components/ui/sidebar.tsx`.
Diese Datei wird nirgends verwendet, setzt aber ein Cookie. Solange sie
ungenutzt herumliegt, passiert nichts – falls sie jemand versehentlich
einbindet, entsteht ein nicht deklariertes Cookie ohne Einwilligung.
Diese eine Datei zu löschen, lohnt sich auch ohne den Rest.
