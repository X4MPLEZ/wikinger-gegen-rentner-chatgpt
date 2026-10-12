# Entwicklungsstand: Claude v39 übernommen, Wüsten-Erweiterung

Ausschließlich `X4MPLEZ/wikinger-gegen-rentner-chatgpt` wurde geändert.
Das Original wurde nur über GitHub-GET-Abfragen gelesen. Ausgangspunkt ist
`c6caf52e705d1c740d5c2439f18eac4251ae4100` (Claude v39). Der Import-Commit
`42cb48a` enthält dessen vier Spieldateien bytegleich, mit geprüften Git-Blob-Hashes.
Frühere Codex-Änderungen sind damit durch den ausdrücklich gewünschten Claude-Stand ersetzt.

## Implementierung

- `possStep`, `egoUpdate`, `startRam`: Reiter bewegen sich während des Aufladens.
  Rammursprung ist die aktuelle Position, kein alter Positionswert vom Tastendruck.
- `buildUnit`, `portrait`: Rentnermobil statt E-Mobil-Raser. Türkise Karosserie,
  Kotflügel, Spiegel, Beleuchtung, Instrumente, Korb und Gepäck; dunkelblaue
  Schirmmütze mit beigefarbenem Schirm statt roter Mütze. Statische Details werden
  weiterhin zusammengefasst; keine zusätzlichen dynamischen Lichter.
- `cakeSurface`, `updateGoo`: Sahne und Rand werden am Gelände abgetastet.
  Niedrige Tortenstücke ohne schwarze Kontur; keine vertikale Skalierung mit dem
  Wirkungsradius. Geometrien und eigene Materialien werden beim Entfernen freigegeben.
- `bearRig`, `updateWorld`: weich einsetzender diagonaler Laufzyklus, angehobene
  Pfoten, Körpergewicht und Kopfbewegung. Beim Zähmen erst Einknicken/Umfallen,
  dann Licht/Teamfarbe, schließlich Aufstehen; erst danach verbündete Einheit.
- `tapAt`: eigene Einheit direkt auswählen, auch aus bestehender Gruppenauswahl.
- `sandStep`: höchstens ein Sandwirbel, drei Sekunden Vorwarnung, begrenzte Dauer,
  individueller Schutz vor sofortigem erneutem Hochwirbeln. Bestehende Gravitation,
  Flugzustände, Landung und Multiplayer-Snapshots bleiben zuständig.
- `wormDive`, `wormStep`, `wormEmerge`: eigener unterirdischer Zustand, sechs
  Sekunden Dauer, acht Sekunden Abklingzeit. Angriff beendet das Graben und trifft
  nur nahe Gegner. Unterirdisch keine Boden-Kollision, Fahnen-Eroberung oder
  normalen Treffer; kein Graben durch Wasser, Kartenrand oder Basisgebäude.
  KI, Befehle und Ego-Steuerung nutzen denselben Zustand.
- `buildWorm`, `wormRig`, `updateDesertView`: segmentierter Cartoon-Wurm, Maul und
  Zähne, wellenförmige Bewegung, sichtbare Grabspur, Auftauch-Effekt und Zähmung.
  Zwei symmetrisch platzierte wilde Würmer pro Wüstenkarte; beide Fraktionen können
  sie zähmen. Keine Rekrutierung und kein neuer regulärer Einheitentyp im Baumenü.
- Netzwerkprotokoll 36: Tierart, Grabzeit, Auftauch-Ereignis und Sandwirbel werden
  vom Host übertragen. Beide Mitspieler müssen die neue Seite laden.

## Prüfung

```sh
npm test
npm run test:simulation
npm run test:performance
```

Für Browserprüfungen werden Playwright und Chromium benötigt. Optional:
`WVR_THREE_PATH=/pfad/three-r128.min.js` und `CHROMIUM_PATH=/pfad/chromium`.
Die Regressionstests wurden auf den neu importierten Ausgangsstand umgestellt;
ältere Suites für die ersetzte Codex-Fassung wurden abgelöst.

- Simulation: beide Reiter, beide Fraktionen, Bären-/Wurm-Zähmungsphasen,
  unterirdische Bewegung, Gegner-/Verbündetenschaden, Zeitlimit, Karten-/Basisgrenzen,
  Sandwirbel-Vorwarnung, Flug, Landung, Wiederholschutz und Snapshot-Inhalte.
- Flug-Netzwerk: wiederholte Flüge, alte/doppelte Pakete, Landebestätigung und
  Kollision mit höherem Felsboden.
- Browser: alle zwölf Modelle, Geländeanschluss und Ressourcenfreigabe der Torten,
  Grabdarstellung, neutrale Teamfarben, Desktop-/Touch-Einzelauswahl, Protokoll und
  Zahlencodes. Zwei Fenster (1280×800, 390×844 Touch), 41 Einheiten, 80–125 ms
  künstliche Zustellverzögerung: Sandwirbel/Flugzustand und mobile Gaststeuerung
  eines Sandwurms einschließlich Eingraben, Bewegung und Auftauch-Angriff.
- Keine JavaScript- oder Shaderfehler in den Browserprüfungen.
- Kontrollierter Vergleich mit v39, 100 stationäre Einheiten: 231 → 231 Draw Calls
  ohne Schatten, Partikelburst jeweils ein zusätzlicher Draw Call. Snapshot
  3163 → 3179 Bytes. Node-Simulation, Median für 300 Ticks: 131,7 → 131,4 ms.
  Diese Software-WebGL-/CPU-Messungen sind keine Smartphone-FPS-Zusage.

## Technische Grenzen

Reale iOS-/Android-GPUs, Safari sowie Internetverbindungen über Mobilfunk/NAT
wurden hier nicht getestet. Die Zweifensterprüfung verwendet den vorhandenen
lokalen Transport. Langzeit-Balancing der neuen Wüstengefahren braucht Spielpraxis.
Sandwirbel verwenden einen wiederverwendeten InstancedMesh mit maximal 96 bzw.
48 Elementen auf niedrigen Stufen. Grabeffekte nutzen den vorhandenen Partikelpool.
