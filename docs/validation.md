# Prüfprotokoll

## Überarbeitung vom 9. Oktober 2026 – lokaler Windows-Arbeitsbaum

Die folgenden Prüfungen gehören zur aktuellen Überarbeitung. Die danach dokumentierten Cloud-Prüfungen stammen vom vorherigen Stand; sie sind kein Beleg für einen neuen Containerbuild oder ein öffentlich ausgestelltes Zertifikat.

- `docker compose config --quiet` und die Kombination mit `compose.local.yaml`: erfolgreich. Die Basis hat weiterhin keine Host-Portbindungen; `/data` der API erhält ein benanntes persistentes Volume.
- OpenAPI-Tests: 3 bestanden. Spezifikation dokumentiert verfügbare Talsperren-Telemetrie, Zuordnung von Pegelmesswerten, historische Beobachtungen und strukturierte Fehler.
- API-Dokumentation im Chromium-Renderer bei 1366 × 1000 und 390 × 844 geprüft: kein horizontaler Überlauf, alle Inhaltsanker lösen auf. Desktop- und Mobilansicht visuell kontrolliert. Systemschriften, lokale Styles, keine externen Skripte.
- Docker-CLI vorhanden, Linux-Daemon dieser Windows-Umgebung nicht erreichbar (`dockerDesktopLinuxEngine` fehlt). Ein erneuter Image-Build, `nginx -t` im Image, Containerstart und Datenvolume-Neustarttest sind hierdurch **nicht** nachgewiesen.
- Keine verifizierte öffentliche Domain und kein bestätigter Coolify-/DNS-Zugriff im Repository. HTTPS-Zertifikatsausstellung bleibt ungeprüft; konkrete, mit aktueller offizieller Coolify-Dokumentation belegte Restschritte stehen in [Betrieb und HTTPS-Fehlersuche](deployment.md).

Abschließende Gesamtprüfung am 9. Oktober 2026:

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript API und Website | erfolgreich |
| API-, Adapter-, Identitäts-, Cache- und SQLite-Tests | **91 bestanden**, keine übersprungen |
| Produktionsbuild API und Website | erfolgreich |
| Start des gebauten API-Pakets mit SQLite (`npm run test:production-api`) | erfolgreich; `/health` und `/docs` antworten; in CI ergänzt |
| Produktions-Browserworkflows, Desktop und iPhone-Viewport | **20 bestanden**, einschließlich Quellen-Teilausfall, Messwert 0, Einzelpunkt, Auswahlrennen und Retry |
| Laufzeit-Abhängigkeiten (`npm audit --omit=dev`) | keine gemeldeten Schwachstellen |
| `git diff --check` | erfolgreich |

Der Produktionsstart fand und behob zusätzlich einen Bundlerfehler: `node:sqlite` darf nicht zum nicht existierenden npm-Import `sqlite` umgeschrieben werden. Der Starttest prüft deshalb ausdrücklich das gebaute API-Artefakt. Die SQLite-Tests decken automatische Initialisierung, Neustart mit dauerhaft erhaltenen Beobachtungen, Original-Cachezeitpunkte, Deduplizierung und Aufbewahrungsfristen ab. Die Persistenz benötigt kein Nachbilden fehlender Messungen. Vitest wurde zur Beseitigung kritischer Entwicklungsabhängigkeiten aktualisiert; der vollständige Audit meldet weiterhin einen niedrigen, ausschließlich die Entwicklungs-/Build-Abhängigkeit esbuild betreffenden Hinweis.

Zusätzlicher echter Live-Test des gebauten API-Pakets und der gebauten Website über einen lokalen Vite-Preview-Proxy: Desktop 1440 × 1000 und Mobil 390 × 844, echte OpenFreeMap-Kacheln und aktuelle Betreiberantworten; keine JavaScript-Fehler oder horizontalen Überläufe. Hauptseite, Talsperrenansicht, mobile Betriebsdaten und API-Dokumentation wurden als Screenshots visuell geprüft. Dies ist ausdrücklich kein Nginx-/Container-Lauftest.

Liveabruf des Produktionspakets um **14:27 Uhr MESZ**: 18 Speicher, davon **17 mit mindestens einem Betreiberparameter** und **16 mit Beckeninhalt**. Kelbra hatte nur Zufluss, Oderteich keine angebundene Reihe. Poppenburg (`NI_4885154`) lieferte **672**, Thale (`ST_579020`) **632** echte Verlaufspunkte. Die SQLite-Instanz enthielt bereits über **88.000** echte Beobachtungen. PEGELONLINE antwortete in dieser Stichprobe nicht rechtzeitig; auch der direkte Originalabruf überschritt 15 Sekunden. Die frisch gestartete Instanz ohne vorherigen WSV-Cache zeigte deshalb 1.711 Standorte mit 245 numerischen Wasserständen und explizitem Quellenhinweis. Frühere erfolgreiche WSV-Abgleiche und ihre zeitabhängigen Zahlen sind in der [Quellenprüfung](data-research-2026-10-09.md) festgehalten. Nationale Messwertabdeckung bleibt unvollständig; diese Ausfälle werden nicht als Entwarnung dargestellt.

## Frühere Cloud-Prüfung – historischer Stand vor dieser Überarbeitung

Die nachstehenden Zahlen und Aussagen beschreiben den damaligen Stand, einschließlich damaliger Funktionsgrenzen. Insbesondere „keine Live-Stauinhalte“ beschreibt die frühere Implementierung.
## Ausgeführt

| Prüfung | Ergebnis |
| --- | --- |
| Installation mit unverändertem Lockfile (`npm ci`) | erfolgreich |
| TypeScript-Prüfung beider Anwendungen | erfolgreich |
| API-, Prognose- und Regionaltests | 72 bestanden, keine übersprungen |
| Browser-Workflows | 14 bestanden, je 7 auf Desktop und Smartphone |
| Produktionsbuilds API/Web | erfolgreich |
| Docker-Images und Compose-Start | beide Dienste gesund, ohne Root und mit schreibgeschütztem Dateisystem |
| HTTP-Smoke-Test im Containerbetrieb | Website, API, Web-Proxy, OpenAPI und Dokumentation erfolgreich |
| Browser gegen echte Container und Datenquellen | keine JavaScript-Fehler, kein horizontaler Überlauf auf Desktop/Smartphone |
| Laufzeit-Abhängigkeiten (`npm audit --omit=dev`) | keine gemeldeten Schwachstellen zum Prüfzeitpunkt |

Die Browser-Regressionstests verwenden eigens definierte Testdaten und decken Suche, Filter, Verwaltungsregionen, MapLibre/WebGL, Kartenebenen, Tastaturauswahl, Messwertkurven, Warnhinweise, Prognose-Ortswechsel, echte Nullwerte gegenüber fehlenden Werten sowie API-Ausfälle ab. Für reproduzierbare Kartenprüfungen wird nur der externe Kartenstil durch einen klar getrennten Teststil ersetzt; der MapLibre-Renderer und die Anwendungs-Geometrien laufen wirklich. Zusätzlich wurde OpenFreeMap mit echten Kacheln und aktuellen Providerantworten im Browser geprüft. Die GitHub-Actions-Konfiguration ist eingerichtet; lokale Prüfungen sind kein Beleg für einen erfolgreichen GitHub-Lauf.

## Tatsächlich abgerufene Daten

Im letzten geprüften Produktionsabruf enthielt die bundesweite Sammlung **2.489 Datensätze mit eindeutigen Anbieter-IDs**, davon **796 mit Wasserstand**. Landes- und Bundesanbieter können dieselbe physische Messstelle unter unterschiedlichen IDs führen; die Zahl ist daher keine Behauptung über 2.489 unterschiedliche physische Pegel.

Die korrigierte Ansicht **Landkreis Harz** lieferte am 9. Oktober um 08:41 UTC **27 Pegeldatensätze**, davon **26 mit Wasserstand**, sowie **11 Flüsse und 8 Speicher**. **Sachsen-Anhalt**, die neue Standardansicht, lieferte **204 Pegeldatensätze**, davon **198 mit Wasserstand**, sowie **16 Flüsse und 10 Speicher**. Die Filter verwenden dokumentierte BKG-Verwaltungsgrenzen, keine umschließenden Rechtecke. Goslar und Nordhausen gehören nicht zur Landkreis-Auswahl. Die Geometrien sind vereinfachte Referenzen mit Datenstand 2018/2020, siehe [Gebiete](regions.md).

- LHP: aktueller Originaldatensatz mit 1.588 Features vollständig verarbeitet, auch IDs mit Punkten; Quellenzeitpunkt und Lizenz geprüft.
- PEGELONLINE: aktuelle Messwerte tatsächlich abgerufen; keine Umdeutung von hydrologischen Kennwerten in Alarmstufen.
- LHW: 145 regionale Zeitreihen angefragt, 143 abrufbar, zwei fehlend. Diese Teilverfügbarkeit wird ausdrücklich als eingeschränkt ausgegeben.
- NINA-LHP: erfolgreicher Abruf eines leeren aktuellen Warnindexes. Das bestätigt den Abruf, keine allgemeine Gefahrenfreiheit.
- Thale/Bode: echter Wasserstandsverlauf mit 615 Punkten geprüft, einschließlich amtlichem Hinweis zu Bauarbeiten.
- Geo-Katalog: 27 Flüsse und 16 Speicher; sechs HWW-Kapazitäten aus direkten Betreibersteckbriefen belegt. Vereinfachte Flussgeometrien bleiben Näherungen.
- Open-Meteo: am 9. Oktober um 08:45 UTC **14 von 14 Wetterpunkten** mit je **72 zukünftigen Stundenwerten** vollständig; davon fünf Punkte im Landkreis Harz. Rückgegebene Einheiten, Standort-IDs und Zeitfenster geprüft.
- GloFAS: **zwei Rasterpunkte mit je sieben täglichen Modellwerten** tatsächlich abgerufen. Fachprüfung fand eine nicht belegbare Flusszuordnung bei Halle; beide Reihen werden deshalb ausdrücklich als unvalidierte regionale Rasterpunkte mit tatsächlich zurückgegebenen Koordinaten ausgegeben. Keine behauptete Saale-/Elbe-Pegelprognose.
- OpenFreeMap: Kartenstil, Vektorkacheln und Anwendungsdaten im echten MapLibre-Renderer auf Desktop und Smartphone geprüft. Der Cloud-Browser vertraut der Session-Proxy-CA nicht automatisch; ausschließlich für diesen Test wurden Kartenanfragen über einen Node-Transport mit verifizierter System-CA weitergeleitet. TLS-Verifikation blieb aktiv. Normale Browser am öffentlich gehosteten Dienst benötigen diesen Testtransport nicht.

Diese Zahlen sind zeitabhängige Prüfergebnisse, keine im Produkt festgeschriebenen Livewerte. Bei vollständigem Upstream-Ausfall greift ein klar gekennzeichneter historischer Standortkatalog mit 1.589 Einträgen; alle Messwerte und Warnklassen daraus wurden entfernt.

## Im Test behobene Probleme

- Offizielle Pegelnummern mit Punkten wurden zunächst vom Parser verworfen; Parser, Routenvalidierung und Regressionstest berücksichtigen sie jetzt.
- Veraltete LHP-Klassen, ungültige Warnfeeds und unvollständige Warnungsdetails werden nicht als aktuelle Entwarnung ausgegeben.
- Zeitbudgets begrenzen die Dauer paralleler Anbieterabfragen.
- Nginx-Konfiguration besitzt im Image explizite Leserechte für den Benutzer ohne Root-Rechte.
- Der lokale Web-Healthcheck verwendet keinen ausgehenden Proxy. HTTPS-Prüfungen zu externen Datenquellen bleiben aktiv.
- MapLibre auf Version 6.13 aktualisiert, nachdem der Audit eine Sicherheitslücke in älteren Versionen meldete. Abschließender Laufzeit-Audit ohne gemeldete Schwachstellen.
- Regenprognosen unterscheiden echte 0 mm von fehlenden Werten; Summen brauchen ein vollständiges Stundenfenster. Modellabrufzeit wird nicht als Modelllaufzeit ausgegeben.
- Der abschließende Produktions-Browsertest fand einen fehlenden MapLibre-Worker im Vite-Paket. Der Worker wird jetzt explizit mit seinen Abhängigkeiten gebündelt. Die CI-Browsertests laufen gegen den Produktionsbuild und prüfen, dass der Worker tatsächlich startet; ein sichtbares Canvas allein genügt nicht.
- Für den Cloud-Image-Build wurden die vorhandene Proxy-CA und die Auflösung des bestehenden Proxy-Hosts über einen temporären, externen Compose-Override verwendet. Keine Proxy-Zugangsdaten oder Cloud-Adressen befinden sich im Repository.

## Verbleibende Grenzen

Keine vollständige Inventur aller deutschen Gewässer, keine vollständige amtliche Warnversorgung, keine eingebundenen Live-Stauinhalte und kein hydrologisch kalibriertes lokales Hochwasservorhersagemodell. Die Regenklassen sind eigene Orientierungsklassen. GloFAS-Rasterpunkte sind nicht fachlich Gewässern zugeordnet. Der recherchierte HWW-Live-Endpunkt ist ohne geklärte Weiterveröffentlichungsbedingungen bewusst nicht als freier Feed enthalten. Open-Meteos schlüsselloser Dienst unterliegt nichtkommerziellem Fair Use. Fachliche Herkunft und Bedingungen stehen in den Recherche-Dokumenten und [Wetterdaten](weather-data.md).

Die zwei öffentlichen Domains werden später in Coolify eingetragen. Das Repository enthält keine erfundenen veröffentlichten URLs und keine Server-Zugangsdaten. Ein neues Cloud-Task-Restore und das spätere Coolify-Deployment wurden noch nicht geprüft.

## Korrektur des Coolify-Portkonflikts

Der anschließende Deploymentversuch auf dem Netcup-Server meldete einen bereits belegten Host-Port 8080; Image-Build und API-Healthcheck waren erfolgreich. `compose.yaml` veröffentlicht deshalb keine Host-Ports mehr. Nur die ausdrücklich ausgewählte `compose.local.yaml` ergänzt lokale Loopback-Bindings. Coolify verwendet weiterhin die internen Zielports 8080 und 3001.

Die Konfigurationen wurden einzeln und zusammen validiert. Ein separater Compose-Start mit den vorhandenen Produktionsimages in der Cloud ergab zwei gesunde Container ohne Host-Port-Bindings. API- und Web-Healthcheck sowie `/api/v1/sources` und `/openapi.json` über den internen Web-Proxy lieferten HTTP 200. Dies prüft die korrigierte Containervernetzung; die erneute Bereitstellung auf dem Netcup-Server steht noch aus.
