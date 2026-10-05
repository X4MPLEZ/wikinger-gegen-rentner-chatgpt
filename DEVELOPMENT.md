# Weiterentwicklung vom 5. Oktober 2026

Ausschließlich `X4MPLEZ/wikinger-gegen-rentner-chatgpt`, Ausgangsstand `887697e3b9bab583d0bcbfda58463655a9b3eedb`. Das Originalrepository wurde in dieser Iteration weder ausgecheckt noch verändert.

## Integration

- `startAir`, `airStep`, `advanceGround`: ein gemeinsamer ballistischer Zustand für Dash, Stoß und Klippensturz. Navigation, Trennung und Terrain-Snapping setzen fliegende Einheiten nicht auf den Boden. Horizontale Geschwindigkeit bleibt erhalten; Felswände blockieren seitliches Eindringen ohne die Figur hochzusetzen. Todessnapshots enthalten die tatsächliche Endposition; Leichen bleiben am Aufprallort.
- `ramImpulse`: Hauptimpuls nach vorne, maximal kleinere seitliche Komponente und kurzer vertikaler Impuls. Beide Fraktionen verwenden dieselbe Berechnung.
- `iceVelocity`, `iceStep`: Eis erreicht ungefähr 1,42-fache Zielgeschwindigkeit, beschleunigt schnell und hält beim Drehen/Rollen den Schwung. Intaktes Eis erhält keinen Wasserwiderstand. Löcher bleiben dauerhaft und interagieren mit späteren Einheiten; räumlicher Index und drei gemeinsame InstancedMeshes begrenzen die Darstellungskosten.
- Arktis: normales Wasser ausgeblendet, Eis über der gesamten sichtbaren Wasserzone einschließlich 900×900-Horizontfläche. Brücken bleiben unverändert nutzbar.
- `hitBear`, `tameBearStep`, `updateWorld`: 0,65 s Zusammenbruch, 1 s Teamfarben-/Herzeffekt, 0,6 s Aufstehen. Erst danach wird der Bär eine aktive verbündete Einheit. Bärenansichten und Farbstufen werden wiederverwendet.
- `baseAttackSlots`, `baseApproach`, `applyCmd`: direkte Base-Befehle speichern ein explizites Ziel und verteilen Angreifer auf gültige Nahkampfpositionen außerhalb des Colliders. Ein neuer Spielerauftrag ersetzt den alten Angriff.
- `genCode`, `hostOnline`, `showLobby`: sechsstellige Zahlencodes im bestehenden Menüfeld; Kopieren und Abbrechen inline. Kein zusätzlicher Code-Dialog. Alle fünf Bot-Stufen zeigen unterschiedliche gecachte Bot-Gesichter. Mobile HUD-Anordnung verhindert Überlappung der Armeeanzeige.
- `tutCommand`, `tutEnemySelected`, `tutMovementDone`: erste Fahne verlangt tatsächliche Bewegung beider Einheiten; Gegnerauswahl per PC-Linksklick bzw. Mobile-Langdruck. Profi-Aufgabe verlangt aktiven Laufmodus und Ankunft an der Fahne; Fehler setzen den Schritt vollständig zurück. Zwei konkrete Auto-Schaltflächen leuchten und müssen beide aktiviert sein. Kontertext beginnt mit dem gewünschten Satz; Chaos-Erklärung entfällt.
- `snapOf`, `possStep`, `updateWorld`, `renderUnits`: Flugposition/-geschwindigkeit und Bestätigungen werden übertragen. Neue und alte Flüge werden unterschieden; veraltete Flugpakete starten keinen neuen Sprung. Bei verpasstem kurzem Flug wird der lokale Zustand wieder mit dem Host abgeglichen. Protokoll **32**: beide Geräte neu laden.

## Grafik und Ressourcen

Bestehender Cartoon-/Low-Poly-Look, ACES, ein Hemisphere- und ein Sonnenlicht bleiben erhalten. Wärmere Sonnenseite, kühlere Schatten, felsigere steile Hänge und weichere Wiesen-/Uferübergänge. Leichte gemeinsame Shader-Windbewegung wird auf LOW deaktiviert. Wasser erhält günstige animierte Helligkeitsbewegung, Splash und instanzierte Ringe/Spuren. Sprungpads besitzen große Pfeile und Chevrons auf derselben Abschussachse, mechanisches Scharnier und bewegte Federn.

Das bereits vorhandene Partikel-Instancing wird mit getrennten Bewegungsprofilen für Staub, Landung, Dash, Pad, Treffer, Explosion, Wasser, Eis, Gebäude und Zähmung erweitert. 192 / 112 / 48 vorab angelegte Partikel, ein Draw Call; keine eigenen Materialien pro Partikel. Wellenringe verwenden einen zweiten Pool mit maximal 40 / 24 / 10 Einträgen. Wichtige nahe Einheiten werfen Schatten; entfernte Einheiten erhalten günstige Bodenkontaktschatten, die mit Höhe/Entfernung schwächer werden und am Boden bleiben. Bestehende Qualitäts- und Pixelratio-Grenzen bleiben erhalten. Einheitenpolygone werden nicht erhöht.

## Verifikation

```sh
npm test
npm run test:gameplay
npm run test:graphics
npm run test:air
npm run test:performance -- /pfad/zu/vorher.html
npm run test:simulation -- /pfad/zu/vorher.html
```

Wie bisher optional `WVR_THREE_PATH` für Three.js r128 offline; Playwright/Chromium erforderlich für WebGL-Tests.

- Neue Gameplay-Suite: **1198 Prüfungen**, Desktop 1280×720 sowie tatsächliche Touch-Emulation 390×844. Zahlencodes, Inline-Erstellen, Tutorial-Bewegung/Auswahl/Fehlversuche/Auto, beide Base-Angriffe, beide Reiterstöße, Landung, Dash über Kante, tiefer Klippensturz und Leichenposition, vier Klassen auf Eis, permanente Löcher über 120 s, gefrorener Ozean und alle Zähmungsphasen beider Fraktionen. Keine JavaScript-/Shaderfehler.
- Bestehende Suite: **917 Prüfungen**, anschließend zwei Browserfenster mit künstlicher Zustellverzögerung und 71 vollständig übertragenen Einheiten; Padflug, Landung und mobile Gaststeuerung bestanden. Keine Browserfehler.
- Grafik-Suite: zwölf Pool-/Shader-/Schattenprüfungen bestanden. Mobiler Effektsturm mit 1.000 Bursts bleibt auf 48 Partikel begrenzt und erzeugt genau einen zusätzlichen Draw Call. Wellenpool und Partikelpool geben alle Einträge zurück.
- Air-Netzwerktest: zweiter Flug nach erstem Flug, wiederholte alte Pakete, Bereinigung des Landepakets und steigender Körper vor einer Felswand bestanden.
- Vergleich mit `887697e`: 100 Einheiten ohne Schatten, **2663 → 2668 Draw Calls** (zusätzliche Pad-Chevrons/Wellen); stationärer Snapshot **2974 → 2982 Bytes**. Partikel und Löcher bleiben instanziert. Kontrollierter Node-VM-Median bei 300 Ticks: **115,2 → 127,9 ms**, entsprechend etwa 0,043 ms zusätzlicher Simulationsaufwand pro Tick für neue Zustände. Browser-Messungen schwanken durch Software-WebGL/JIT; keine belastbare Smartphone-FPS-Aussage. Unnötige Klippen-/Blockerprüfungen für stationäre Einheiten wurden nach gemessenen Mehrkosten entfernt.

Verbleibende Grenzen: echte Android-/iOS-GPUs und Safari, Mobilfunk/NAT über öffentliche PeerJS/STUN/TURN-Dienste, lange Partien und alle zufälligen Karten brauchen reale Gerätetests. Sehr große Nahkampfgruppen warten auf freie Plätze am Base-Umfang. Dauerhafte Löcher sind auf eine Einbruchstelle pro Rasterzelle begrenzt; ihre Snapshot-Größe wächst während einer Runde. Systemschrift-Rasterung kann weiterhin variieren; zentrale Spielsymbole verwenden SVG/Canvas.

---

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
