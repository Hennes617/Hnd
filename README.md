# HND · Wasserlage

Hochwasser, Pegel und Gewässer in Deutschland – mit Schwerpunkt **Sachsen-Anhalt und Landkreis Harz**. Eine TypeScript-Anwendung mit einer eigenständig nutzbaren JSON-API, OpenFreeMap-Karte und responsiver Weboberfläche. Beide Dienste lassen sich zusammen mit Docker Compose oder über Coolify betreiben.

HND ist ein unabhängiges Informationsangebot. Die eingebundenen Stellen bleiben die Herausgeber ihrer Messwerte und Warnungen. Für Entscheidungen bei Hochwasser sind die aktuellen amtlichen Meldungen und örtlichen Anweisungen maßgeblich.

## Lokal starten

Voraussetzung: Node.js 22 oder neuer und npm.

```bash
npm ci
npm run dev
```

- Website: <http://localhost:5173>
- API und Dokumentation: <http://localhost:3001/docs>
- OpenAPI: <http://localhost:3001/openapi.json>

Die Website ruft `/api` über ihren eigenen Ursprung auf. Vite leitet diese Anfragen im Entwicklungsbetrieb an die API auf Port 3001 weiter. Die API benötigt keinen Schlüssel und keine Datenbank.

```bash
npm run typecheck
npm test
npm run build
```

Browser-Workflows auf Desktop und Smartphone prüfen (die Tests verwenden klar getrennte Testdaten):

```bash
npx playwright install chromium
npm run test:e2e
```

## Docker Compose

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

- Website: <http://localhost:8080>
- API: <http://localhost:3001/docs>

Die Ports werden standardmäßig an `127.0.0.1` gebunden. Für Zugriff aus einem anderen Rechner ist ein Reverse Proxy mit TLS vorgesehen. Beide Container laufen ohne Root, besitzen Healthchecks und haben ein schreibgeschütztes Dateisystem. Der Cache liegt im Arbeitsspeicher; es werden keine Volumes benötigt.

## Zwei Domains mit Coolify

In Coolify das Repository als **Docker Compose**-Anwendung mit `compose.yaml` einbinden. Dem Dienst `web` eine Domain mit internem Port **8080**, dem Dienst `api` eine zweite Domain mit internem Port **3001** zuweisen. Beispielwerte:

```dotenv
API_PUBLIC_URL=https://api.deine-domain.de
VITE_PUBLIC_API_URL=https://api.deine-domain.de
CORS_ORIGIN=https://wasser.deine-domain.de
```

Nach dem Eintragen der Domains neu bauen und bereitstellen. Die Web-Variable wird beim Build eingebunden. DNS und HTTPS richtet der Betreiber mit Coolify ein; die Beispieladressen sind keine veröffentlichten Dienste. Einzelheiten zu Betrieb, Proxys, Variablen und Prüfung stehen in [docs/deployment.md](docs/deployment.md).

## Daten und Grenzen

- **Deutschland:** Landespegel und Hochwasserklassen aus dem gemeinsamen Angebot der Hochwasserzentralen; PEGELONLINE ergänzt Messstellen und Wasserstände an Bundeswasserstraßen. Das umfasst nicht alle Pegel Deutschlands.
- **Sachsen-Anhalt und Landkreis Harz:** zusätzliche Landespegel sowie ein kuratierter Katalog von Flüssen, ihren Quellen und Mündungen und wichtigen Talsperren. Die Standardansicht ist Sachsen-Anhalt. „Harz“ bezeichnet die Verwaltungsgrenze des Landkreises, nicht das gesamte Gebirge. Herkunft und Datenstand der BKG-Grenzen stehen in [docs/regions.md](docs/regions.md).
- **Karte:** OpenFreeMap mit MapLibre, verschiebbar und zoombar, mit Pegeln, Speichern und Verwaltungsgrenzen. Zusätzlich dargestellte Katalog-Flusslinien sind vereinfachte Routen, keine vermessenen Uferlinien.
- **Regen und Modellabfluss:** Open-Meteo liefert 72 Stunden Niederschlagsprognose für 14 ausgewählte Orte in Sachsen-Anhalt, davon fünf im Landkreis Harz. Sieben tägliche GloFAS-Modellwerte an Rasterpunkten im Raum Halle und Magdeburg ergänzen die Landesansicht. Deren Gewässerzuordnung ist nicht fachlich validiert; es sind keine belegten Saale-/Elbe-Pegelprognosen. Die eigene Einordnung der Regenbelastung ist keine amtliche Hochwasserwarnung oder berechnete Überflutungswahrscheinlichkeit. Kleine Harzbäche erhalten keine ungeeignete GloFAS-Abflussreihe.
- **Warnungen:** amtliche Quellen werden mit Herkunft und Datenstand zusammengeführt. Ein leerer, fehlgeschlagener oder veralteter Feed ist keine amtliche Entwarnung.
- **Talsperren:** Stammdaten und Betreiberverweise sind verfügbar. Ein Live-Füllstand wird nur angezeigt, wenn eine angebundene Quelle diesen tatsächlich liefert; Stammdaten ersetzen keine aktuellen Betriebsdaten.
- **Ausfälle:** die API puffert erfolgreiche Antworten, begrenzt Upstream-Zugriffe und weist Fehler beziehungsweise veraltete Daten aus. Sie erfindet keine Messwerte.

Verfügbarkeit und Nutzungsbedingungen richten sich nach der jeweiligen Originalquelle. Die freie Nutzbarkeit dieser Anwendung überträgt keine zusätzlichen Rechte an fremden Daten. Quellenangaben und jeweilige Bedingungen müssen bei Weiterverwendung erhalten bleiben. Der Dienst ist keine garantierte oder vollständige Warnversorgung.

Die schlüssellose Open-Meteo-API ist für nichtkommerzielle Nutzung unter Fair-Use-Bedingungen vorgesehen; kommerzieller Betrieb benötigt passende Anbieterbedingungen. Datenlizenz, Modellgrenzen und Berechnung der Regenklassen stehen in [docs/weather-data.md](docs/weather-data.md). Der API-Endpunkt `/api/v1/forecast?region=sachsen-anhalt` liefert beide Prognosearten mit getrennten Quellenzuständen. Für regionale Endpunkte sind `sachsen-anhalt` (Standard), `harz` und `germany` gültig; Wetterpunkte bleiben auch in der Deutschlandansicht auf Sachsen-Anhalt beschränkt.

Die Recherche ist in [Pegel- und Warndaten](docs/data-research-lhw.md) sowie [Flüssen und Talsperren](docs/data-research-geography.md) dokumentiert. Der mitgelieferte Referenzkatalog enthält 1.589 Pegelstandorte aus einem dokumentierten Mitschnitt vom 29. September 2026 (CC BY 4.0), ausschließlich Stammdaten ohne historische Messwerte oder Warnklassen. Er wird nur beim Ausfall der aktuellen Standortquelle verwendet. Der Gewässeratlas umfasst 27 Flüsse und 16 Speicher; für sechs Harzwasserwerke-Talsperren sind die baulichen Kapazitäten anhand direkter Betreiberquellen belegt.

Die ausgeführten Prüfungen und tatsächlichen Live-Abrufe sind im [Prüfprotokoll](docs/validation.md) festgehalten.

## Projektstruktur

```text
apps/api          Fastify-API, Upstream-Adapter, Cache, OpenAPI
apps/web          React, Vite, responsive Weboberfläche
packages/shared   gemeinsame TypeScript-Typen und Gewässerkatalog
deploy            Nginx-Konfiguration
docs              Quellen- und Betriebsdokumentation
```

Die API ist bewusst ohne Benutzerkonten oder Bezahlanbieter nutzbar. Der Betrieb auf einem eigenen Server kann Hostingkosten verursachen. Für einen öffentlichen produktiven Dienst sind Betreiberangaben, Impressum und eine zum Betrieb passende Datenschutzerklärung zu ergänzen.
