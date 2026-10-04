# Separate Entwicklungsfassung – technische Prüfung

Alle Änderungen betreffen ausschließlich `X4MPLEZ/wikinger-gegen-rentner-chatgpt`.
Referenz für den unveränderten Ausgangsstand: `202e03f635312655f4b60365ae006c55c28f1ac2`.
Das Original wurde nur gelesen. Fraktionen, Siegbedingungen und Steuerung bleiben erhalten.

## Behobene Ursachen

- Sprungpads waren als schmale begehbare Linien über dem Wasser modelliert. Jetzt enthält A* gerichtete Sprungverbindungen und explizite Pad-Wegpunkte. Die KI hält den Anlauf fest und lässt ihn nicht durch neue automatische Befehle ersetzen. Katapulte und wilde Bären erhalten nur Bodenrouten.
- Der Pfeil zeigte nach der Rotation der ShapeGeometry entgegen der Flugrichtung. Seine Spitze zeigt jetzt entlang der tatsächlichen Abschussachse. Die vordere Scharnierachse hebt die Rückseite; die Feder folgt dem Öffnungswinkel.
- Flugzustand, Bodenbewegung und Einheitentrennung beeinflussten sich gegenseitig. Der Flug hat jetzt einen eigenen Zustand, 1,75 Sekunden Dauer und eine Parabel mit 10 Höheneinheiten über der interpolierten Start-/Landehöhe. Bodenbewegung und Bodenkollision verschieben fliegende Einheiten nicht.
- Padfläche und Trigger sind gemeinsam etwa 44 % größer. Wiederaufladezeit 1,4 Sekunden. Mehrere Einheiten starten gemeinsam; Landepositionen verteilen sich deterministisch.
- Herrscherbefehle auf Pads erhalten passende Formation und ein Verbrauchskennzeichen. Nach der Landung werden alte Pfade und Eisgeschwindigkeiten entfernt. Ein weiter entferntes Ziel bleibt erhalten, ein Auftrag auf das benutzte Pad wird abgeschlossen.
- Alte Positionspakete konnten den Spieler nach dem Sprung zurückziehen. Ein Sprungkennzeichen bestätigt neue Eingaben. Übernehmen einer bereits gelandeten Einheit setzt dieses Kennzeichen zurück.

## Rendering und Effekte

Statische Details mit gleichem Material werden innerhalb desselben Animationsgelenks zusammengefasst. Köpfe, Gliedmaßen, Räder und abwerfbare Ausrüstung bleiben separat. Gemeinsame Geometrien werden wiederverwendet; eigens erzeugte zusammengefasste Geometrien werden beim Entfernen der Einheit freigegeben.

Staub, Turbo, Wasser, Treffer und Landungen nutzen einen gemeinsamen InstancedMesh-Partikelpool mit weichem Ausblenden. Keine eigenen Meshes/Materialien pro Partikel. Begrenzung: 192 / 112 / 48 Partikel. Bodenkontaktschatten sind ebenfalls instanziert und ändern Größe und Stärke mit der Flughöhe. Himmels-/Bodenlicht und Belichtung sind heller, das Sonnenlicht etwas weicher. Kleine Details werfen keine teuren Schatten.

| Qualität | Pixelratio-Obergrenze | Schatten | Partikelmaximum |
| --- | --- | --- | --- |
| HIGH | 1,75 Desktop / 1,5 Touch | 2048, jedes Bild | 192 |
| MEDIUM | 1,15 | 1024, jedes zweite Bild | 112 |
| LOW | 0,8 | Kontaktschatten | 48 |

Touchgeräte beginnen auf MEDIUM. Bei wiederholt langen Bildern wird die Qualität reduziert; nach längerer stabiler Erholung kann sie wieder steigen. Verdeckte Tabs werden dabei nicht bewertet; einzelne sehr lange Bilder werden für die Bewertung begrenzt.

## Netzwerk, Gelände und Balancing

- Feste Simulation bleibt bei 20 Hz. Ein Snapshot pro aufgeholtem Timerdurchlauf wird für Anzeige und Versand wiederverwendet. Versand ungefähr 13–15 Hz.
- Remote-Sprünge verwenden dieselbe verzögerte Simulationszeit wie die Positionsinterpolation. Der Renderzeitpunkt läuft zwischen normalen Zuständen nicht rückwärts und wird nach langen Unterbrechungen neu gesetzt; der Jitterpuffer verändert sich schrittweise. Snapshot-Nachschlagetabellen werden gecacht. Überlastete WebRTC-Kanäle verschicken den neuesten Zustand nach Entlastung.
- Vollständige Armeen bleiben auf P2P, MQTT und lokalem Transport erhalten; die bisherige Kürzung auf 70 Einheiten entfällt. Der spezielle Claude-Raum hat weiterhin eine enge Paketgrenze und warnt bei Überschreitung. Für GitHub Pages die Spieladresse direkt auf beiden Geräten öffnen. Netzwerkprotokoll jetzt Version 31; beide Geräte sollten die neue Seite laden.
- Wasserwiderstand gilt auch für Turbo und Reiter-Spezialbewegung. Der Übergang wird zeitbasiert geglättet. Der Grundcode enthielt bereits einen Wasserfaktor; dieser wird jetzt nicht abrupt angewendet und beeinflusst weiterhin die erhöhte Geschwindigkeit.
- Auf angehobenen Klippenkarten verhindert die Wasserhöhe kein echtes Fallen mehr. Host und lokale Steuerung beurteilen abwärts begehbare Böschungen gleich. Objektkollision und Kartengrenzen bleiben erhalten. Wiesen-Inseln haben flacheren Untergrund und sanftere Flussufer; die Wiesen erzeugen keine tödlichen Klippenspalten.
- Wilde Eisbären: maximal zwei statt anfänglich vier; Wiederkehr nach 85–120 statt 55–80 Sekunden. HP 600 → 520, Schaden 42 → 34, Angriffspause 1,1 → 1,25 Sekunden, Verfolgungstempo 5,2 → 4,7. Auch gezähmte Bären moderat reduziert.

## Symbolvergleich

Die SVG-Definitionen und Font-CSS im unveränderten Ausgangsstand stimmen mit der gelesenen Originalfassung überein. Die zentralen Spielsymbole sind feste SVGs, die Einheitenporträts Canvas-Grafiken; kein Beleg für ausgetauschte Emoji-Symbole. Text nutzt Rubik/Lilita One mit System-Fallbacks. Bei blockierten Webfonts sowie bei Unicode-Tastaturpfeilen, Plus/Minus und Schrift-Rasterung können Browser und Betriebssystem unterschiedlich aussehen. Deshalb keine unnötigen Symbolersetzungen. Pixelidentische Darstellung auf Windows, macOS, Android und iOS ist noch nicht auf realen Geräten nachgewiesen.

## Tests ausführen

Node.js 20 oder neuer und Chromium werden benötigt:

```sh
npm install
npx playwright install chromium
npm test
npm run test:performance
npm run test:simulation
```

`CHROMIUM_PATH` überschreibt den Browserpfad. Falls `/usr/bin/chromium` fehlt, wird der Playwright-Browser verwendet. Optional liefert `WVR_THREE_PATH=/absoluter/pfad/three-r128.min.js` die unveränderte Three.js-r128-Datei als Offline-Fixture. Ohne Fixture wird die im Spiel eingebundene CDN-Datei geladen. Die Performanceprüfung akzeptiert alternativ einen HTML-Pfad für den Ausgangsstand.

Bestandener Abschlusslauf: 917 Einzelprüfungen, anschließend der Test mit zwei Browserfenstern; keine JavaScript- oder Shaderfehler.

Browserprüfung: einzelne Einheiten, Reiter, Wiederverwendung, beide Sprungrichtungen, exakte Flugposition, KI-Routenfortsetzung, 20 gleichzeitige Sprünge, Herrscher-Massenbefehl, alte Netzwerk-Eingaben, 64 Kartenseeds, Pfeilrichtung, Partikelgrenze, LOW-Qualität und reale Ego-Wasser-/Turbo-Physik. Zusätzliche Prüfungen decken verlorene Flugpakete, lange Netzwerkpausen, alle Einheitenanimationen und die Freigabe abgetrennter Geometrien ab. Zwei Browserfenster (1280×720 und 390×844 mit aktivierter Touch-Emulation) tauschen Produktions-Snapshots und Eingaben über BroadcastChannel aus, mit 80–125 ms zusätzlicher Zustellverzögerung. 71 Einheiten, Sprung, Landung und Steuerung vom Gast zum Host werden geprüft. JavaScript-/Shaderfehler führen zum Fehler.

Die lokale Transportprüfung ersetzt keinen Test der öffentlichen PeerJS/STUN/TURN-Dienste über Mobilfunk/NAT. Unterschiedliche Fenstergrößen ersetzen keine echten Android-/iOS-Geräte.

## Leistungsmessung und Grenzen

Kontrollierter Vergleich bei 100 Einheiten, gleichem Kartenseed und ausgeschalteten Shadow-Maps: rund 3416 → 2663 Draw Calls (etwa 22 % weniger). Ein Ausbruch mit 160 Partikeln benötigt einen zusätzlichen Draw Call statt 160. Software-WebGL ist für Draw-Call-Zählungen brauchbar; absolute FPS, Framezeiten und JS-Heap-Samples sind durch Software-GPU, Prozesslast und Garbage Collection keine belastbare Smartphone-Prognose. Die Scripts erfassen auch Simulationszeit, Geometrien, Snapshotgröße und Heap, ohne daraus garantierte FPS abzuleiten. Ein getesteter räumlicher Kollisionsindex wurde wegen gemessener Mehrkosten wieder entfernt.

`test:simulation` prüft denselben stationären 100-Einheiten-Fall zusätzlich in einer isolierten Node-VM ohne WebGL, mit fester Zufallsfolge, drei Aufwärmläufen und neun Messungen. Der erste kontrollierte VM-Lauf ergab 113,7 → 114,8 ms für 300 Ticks: kein wesentlicher Unterschied. Absolute VM-Zeiten enthalten Isolationskosten und sind nicht mit den Browserzeiten vergleichbar.

Offen für Gerätetests: längere Online-Partien über Mobilfunk, schwache GPUs, Safari/iOS, alle zufälligen Klippenkarten, Balance über viele Partien und Unicode-Fallbackdarstellung bei ausgefallenen Webfonts.
