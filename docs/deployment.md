# Betrieb mit Docker Compose und Coolify

## Aufbau

Ein Linux-Server mit Docker Engine / Compose v2 oder eine vorhandene Coolify-Installation genügt. Ein Kern und 1 GB RAM sind ein Ausgangspunkt; für parallele Image-Builds sind 2 GB zweckmäßig. Ausgehendes HTTPS und DNS zu den Quellen müssen möglich sein.

```text
Browser → HTTPS :443 → Coolify-Proxy → web:8080 (Nginx)
                                       └ /api, /docs, /openapi.json → api:3001
                                                                     └ /data/hnd.sqlite
```

Eine eigene HTTPS-Domain am Dienst `web` reicht für Website, API und Dokumentation. Eine zusätzliche API-Domain ist optional. TLS endet am Coolify-Proxy; die Container sprechen im internen Docker-Netz HTTP. Nginx benötigt dafür kein eigenes Zertifikat. Die Basisdatei veröffentlicht keine Host-Ports.

SQLite speichert erfolgreich empfangene Beobachtungen, Metadaten und Cache im benannten Volume `hnd-data`. Die API startet Migrationen automatisch. Die Datenbank braucht keinen separaten Dienst oder Port. Alle übrigen Containerdateien bleiben schreibgeschützt; beide Container laufen ohne Root.

## Lokal mit Docker starten

```bash
cp .env.example .env
docker compose -f compose.yaml -f compose.local.yaml config --quiet
docker compose -f compose.yaml -f compose.local.yaml up --build -d
docker compose -f compose.yaml -f compose.local.yaml ps
curl --fail http://localhost:8080/health
curl --fail http://localhost:8080/api/v1/sources
curl --fail http://localhost:3001/health
```

Website: `http://localhost:8080`; Dokumentation: `http://localhost:8080/docs`; direkte API: `http://localhost:3001`. `compose.local.yaml` ergänzt die Loopback-Hostbindungen. Bei belegten Host-Ports `WEB_PORT` oder `API_PORT` ändern; die internen Ports bleiben 8080 / 3001.

```bash
docker compose -f compose.yaml -f compose.local.yaml logs --tail=100 api web
docker compose -f compose.yaml -f compose.local.yaml restart api
docker compose -f compose.yaml -f compose.local.yaml down
```

`down` erhält das Datenvolume. **`down --volumes` würde die lokal gesammelten Daten löschen.** Logdateien sind auf drei Dateien zu jeweils 10 MB pro Container begrenzt.

## Coolify einrichten

1. Git-Repository als **Docker Compose**-Ressource mit ausschließlich `compose.yaml` auswählen. `compose.local.yaml` und zusätzliche Host-Port-Mappings nicht verwenden.
2. In den Domains des Dienstes **web** den eigenen Hostnamen mit Protokoll **HTTPS**, internem Zielport **8080**, ohne zusätzlichen Pfad eintragen. Bei einem einzelnen URL-Feld: `https://wasser.deine-domain.de:8080`. Der Port bezeichnet das interne Weiterleitungsziel; Besucher verwenden `https://wasser.deine-domain.de` auf Port 443.
3. Den DNS-A-Eintrag auf die öffentliche Server-IPv4 richten. Ein vorhandener AAAA-Eintrag muss zur funktionsfähigen IPv6 dieses Servers führen. Eingehend TCP 80 und 443 zum Coolify-Proxy zulassen. Die Beispieladresse ist keine veröffentlichte Instanz.
4. Variablen setzen:

   ```dotenv
   API_PUBLIC_URL=
   VITE_PUBLIC_API_URL=
   CORS_ORIGIN=https://wasser.deine-domain.de
   TRUST_PROXY=true
   OBSERVATION_RETENTION_DAYS=90
   REFRESH_INTERVAL_SECONDS=300
   ```

   Leere API-Adressen nutzen den aktuellen Ursprung. Damit enthält der öffentliche Web-Build keine auf dem Handy unbrauchbaren `localhost`-Dokumentationslinks. Nginx leitet API und Dokumentation intern weiter.
5. Das persistente Volume am API-Dienst erhalten, neu bauen und deployen. Ein unveränderter Ressourcen-/Volumename ist beim Redeployment wichtig. Ein neues Coolify-Projekt kann ein anderes Volume erhalten; vorhandene Daten dann ausdrücklich migrieren.
6. Website, `/docs`, `/openapi.json`, `/api/v1/sources` und `/api/v1/overview?region=harz` über die echte HTTPS-Domain öffnen. Healthchecks belegen Dienstverfügbarkeit, keine vollständige Verfügbarkeit der Originalquellen.

Coolify verwaltet Routing und Zertifikate aus Domain und Zielport. Siehe [offizielle Domain-Dokumentation](https://coolify.io/docs/core/networking/domains) und [Traefik-Übersicht](https://coolify.io/docs/core/networking/proxy/traefik/overview), geprüft am 9. Oktober 2026.

### Optionale zweite API-Domain

Zusätzlich **api** mit HTTPS und internem Port **3001** verbinden. Dann können folgende Werte gesetzt werden:

```dotenv
API_PUBLIC_URL=https://api.deine-domain.de
VITE_PUBLIC_API_URL=https://api.deine-domain.de
CORS_ORIGIN=https://wasser.deine-domain.de
```

`API_PUBLIC_URL` steuert den OpenAPI-Server, `VITE_PUBLIC_API_URL` die Dokumentationslinks der Website. Browser-Datenanfragen bleiben unter `/api` auf der Website-Domain. Nach Änderungen der Vite-Variable ist ein neuer Web-Build erforderlich. Nicht denselben Hostnamen ohne eindeutige Pfadrouten gleichzeitig beiden Diensten zuweisen. Eine gesonderte `/api`-Route ist hier nicht nötig und könnte bei automatischem Entfernen des Präfixes falsche URLs erzeugen.

## HTTPS-Fehler gezielt eingrenzen

**Belegter Repositorykontext:** Ein früherer Netcup-Deploymentversuch scheiterte am bereits belegten Host-Port 8080; die Basis-Compose-Datei wurde deshalb auf rein interne Ports umgestellt. Außerdem waren Dokumentationslinks und OpenAPI standardmäßig auf `http://localhost:3001` festgelegt. Nginx ersetzte das vom TLS-Proxy gelieferte `X-Forwarded-Proto: https` durch sein internes `http`. Beide letzteren Konfigurationen sind korrigiert. Keine dieser Beobachtungen beweist die konkrete Ursache eines fehlenden öffentlichen Zertifikats.

**Noch nicht live belegt:** Im Repository stehen weder eine verifizierte öffentliche Domain noch Zugang zum tatsächlichen Coolify-/DNS-Betrieb. Die Zertifikatsausstellung wurde deshalb nicht bestätigt. Folgende Prüfung erfolgt auf dem vorhandenen Server und mit seinem tatsächlichen Hostnamen:

1. Coolify-Domain des `web`-Dienstes: HTTPS aktiviert, Zielport 8080, keine konkurrierende Ressource mit gleichem Hostnamen. Bei „Custom/None“ als Proxy gibt es keine von Coolify verwaltete Zertifikatsausstellung. Nach Änderung redeployen.
2. DNS-A und gegebenenfalls AAAA auf denselben erreichbaren Server prüfen. TCP 80 und 443 müssen über beide veröffentlichten IP-Protokolle beim Proxy ankommen. Ein falscher AAAA-Eintrag kann die Prüfung trotz funktionierender IPv4 verhindern. [Coolify: Zertifikatsfehler](https://coolify.io/docs/troubleshoot/dns-and-domains/lets-encrypt-not-working)
3. Server → Proxy → Logs in Coolify ansehen; alternativ auf dem Server:

   ```bash
   docker logs --since 30m coolify-proxy
   curl -I http://wasser.deine-domain.de
   curl -Iv https://wasser.deine-domain.de
   ```

   TLS-Prüfung nicht mit `-k` umgehen. Fehlermeldungen zu Challenge, DNS, Rate Limit oder Resolver bestimmen den nächsten Schritt. Bei einem vorgeschalteten CDN/WAF muss die Challenge erreichbar sein. Einen globalen Zertifikatsspeicher nicht pauschal löschen.
4. Zeigt das Log ausdrücklich einen nicht verfügbaren `letsencrypt`-Resolver oder Probleme mit `acme.json`, Besitzer und Lese-/Schreibrechte der tatsächlichen Proxydatei prüfen; Traefik verlangt Dateimodus 600. Nur den belegten Fehler korrigieren. [Coolify: Certificate Resolver](https://coolify.io/docs/troubleshoot/dns-and-domains/certificate-resolver-doesnt-exist)
5. Nach einem erfolgreichen TLS-Handshake `/docs` und `/api/v1/sources` aufrufen. **Ungültiges Zertifikat** ist ein Proxy-/DNS-/ACME-Problem; **HTTP 502/503 nach erfolgreichem TLS** ist ein Routing-/Containerproblem; **HTTP 200 mit fehlenden Messwerten** verlangt die Prüfung von `providers` und API-Logs. Das sind verschiedene Fehlerklassen.

Beim früheren Fehler `Bind for 0.0.0.0:8080 failed: port is already allocated` gespeicherte Compose-Kopien und Coolify-Port-Mappings aktualisieren. Keine fremden Dienste stoppen: Der Zielport 8080 wird nur intern verwendet.

## SQLite und gesammelte Verläufe

`DB_PATH=/data/hnd.sqlite` ist im Container fest konfiguriert. Das Image legt `/data` mit Schreibrechten für `node` (UID 1000) an; das benannte Volume übernimmt diese beim ersten Start. Bei einem eigenen Host-Bind-Mount muss dessen Verzeichnis für UID 1000 schreibbar sein. Fehlende Schreibrechte in API-Logs beheben, bevor Beobachtungen gesammelt werden können.

Ein Hintergrundabruf sammelt standardmäßig alle fünf Minuten echte Beobachtungen. Die Aufbewahrung beträgt standardmäßig 90 Tage. Eine frische Datenbank enthält keine Vergangenheit: Umfangreiche historische Verläufe entstehen erst während des Betriebs oder werden aus tatsächlich verfügbaren Originalzeitreihen übernommen. Cache-Fristen und Datenfrische bleiben trotz dauerhafter Speicherung begrenzt; eine alte Beobachtung wird dadurch nicht zu einer aktuellen Meldung.

### Konsistente Sicherung

SQLite kann zusätzliche `-wal`-/`-shm`-Dateien verwenden. Während Schreibzugriffen **nicht nur `hnd.sqlite` kopieren**. Für dieses kleine Projekt ist eine kurze Unterbrechung mit vollständiger Verzeichniskopie einfach und verlässlich:

```bash
mkdir -p backups
docker compose stop api
docker compose cp api:/data/. ./backups/hnd-data/
docker compose start api
```

Im lokalen Betrieb bei allen drei Compose-Befehlen zusätzlich `-f compose.yaml -f compose.local.yaml` verwenden. In Coolify muss das Kommando das tatsächliche Ressourcenprojekt adressieren; alternativ den API-Container über die Oberfläche stoppen und dessen vollständiges Volume sichern. Sicherungen außerhalb des Servers aufbewahren. Für unterbrechungsfreie Backups die SQLite-Backup-API oder ein verfügbares `sqlite3 ... '.backup ...'` verwenden.

Zum Wiederherstellen API stoppen, die vollständige konsistente Sicherung in das richtige Datenvolume einspielen, Schreibrechte für UID 1000 prüfen und API starten. Bei laufendem Prozess keine Datenbankdateien austauschen. Danach Logs, Datenbankzustand und eine bekannte historische Reihe prüfen. Eine Rücksicherung sollte zunächst auf einer getrennten lokalen Instanz getestet werden.

## Konfiguration

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `WEB_PORT` / `API_PORT` | `8080` / `3001` | Host-Ports, nur mit lokalem Override |
| `BIND_ADDRESS` | `127.0.0.1` | lokale Bind-Adresse |
| `VITE_PUBLIC_API_URL` | leer | Dokumentationslinks; leer = eigener Ursprung, Build-Variable |
| `API_PUBLIC_URL` | leer | OpenAPI-Server; leer = eigener Ursprung |
| `CORS_ORIGIN` | `http://localhost:8080` | erlaubte Browser-Ursprünge, mehrere komma-getrennt |
| `TRUST_PROXY` | `true` in Compose | vertraut internen Proxy-Headern für Protokoll und Quell-IP |
| `DB_PATH` | `/data/hnd.sqlite` im Container | SQLite-Datei auf dem Datenvolume |
| `OBSERVATION_RETENTION_DAYS` | `90` | Aufbewahrung echter Beobachtungen |
| `REFRESH_INTERVAL_SECONDS` | `300` | regelmäßiger Hintergrundabruf |
| `CACHE_TTL_SECONDS` | `300` | Cache-Lebensdauer; API begrenzt auf 30–3600 Sekunden |
| `UPSTREAM_TIMEOUT_MS` | `8000` | Abfrage-Timeout; API begrenzt auf 500–30000 Millisekunden |

`TRUST_PROXY=true` passt zur internen API ohne öffentliche Host-Port-Bindung. Vorgeschaltete Proxies müssen eingehende Forwarding-Header zuverlässig setzen. Bei einer direkt öffentlich erreichbaren API `TRUST_PROXY=false` setzen; sonst kann ein Client die Rate-Limit-Quelladresse beeinflussen. Ohne Proxyvertrauen kann das Limit hinter einem Proxy dagegen für alle Besucher gemeinsam gelten. Das Limit beträgt 120 Anfragen pro Minute und Quell-IP.

Origins enthalten Schema und gegebenenfalls Port, keinen Pfad oder abschließenden Slash. Die `.env` wird von Compose zur Ersetzung gelesen und nicht in Images kopiert. `npm run dev` verwendet Prozessvariablen. CORS ist kein Zugriffsschutz; die API ist öffentlich lesbar.

## Netzwerk und Quellen

| Host | Zweck |
| --- | --- |
| `www.pegelonline.wsv.de` | Bundeswasserstraßen: Standorte und Messwerte |
| `api.hochwasserzentralen.de` | Landespegel und Hochwasserklassen |
| `hvz.lsaurl.de` | Landespegel Sachsen-Anhalt |
| `bis.azure-api.net` / `www.pegelonline.nlwkn.niedersachsen.de` | NLWKN: Niedersachsen-Messwerte und Zeitreihen; öffentlich dokumentierter gemeinsamer Webservice-Schlüssel, keine persönlichen Zugangsdaten |
| `warnung.bund.de` | LHP-Warnmeldungen über NINA |
| `www.talsperrenbetrieb.de` | Betriebsdaten der Talsperren in Sachsen-Anhalt |
| `www.harzwasserwerke.de` | Betreiberangaben und verfügbare Talsperrenwerte |
| `api.open-meteo.com` / `flood-api.open-meteo.com` | serverseitige Wetter-/Abflussmodelle |
| `tiles.openfreemap.org` | Kartenstil, Kacheln und Schriften, direkt aus dem Browser |

Adapter können vom Anbieter veröffentlichte Unterdomains verwenden; konkrete URLs stehen im Quellcode und Quellenverzeichnis. Image-Builds benötigen Docker Hub und `registry.npmjs.org`. Die Oberfläche nutzt Systemschriften. Die Karte benötigt WebGL; bei Fehlern bleibt die Objektliste nutzbar. OpenFreeMap-Abrufe im Browser sind in der Datenschutzerklärung zu berücksichtigen. Open-Meteos öffentlicher schlüsselloser Dienst setzt nichtkommerzielle Nutzung und Fair Use voraus; siehe [Wetterdaten](weather-data.md).

### Unternehmensproxy mit zusätzlicher CA

TLS-Prüfung bleibt aktiv. Die Dockerfiles akzeptieren optional das BuildKit-Secret `proxy_ca`. Bei normalen öffentlichen Zertifikaten ist es nicht erforderlich. Bei HTTPS-Inspection eine außerhalb des Repositorys gespeicherte CA verwenden. Beispiel für einen separaten Compose-Override:

```yaml
services:
  api:
    build:
      secrets: [proxy_ca]
    environment:
      NODE_EXTRA_CA_CERTS: /run/secrets/proxy_ca
      HTTP_PROXY: ${HTTP_PROXY:-}
      HTTPS_PROXY: ${HTTPS_PROXY:-}
      NO_PROXY: localhost,127.0.0.1,api,web
    secrets: [proxy_ca]
  web:
    build:
      secrets: [proxy_ca]
secrets:
  proxy_ca:
    file: ${PROXY_CA_FILE}
```

Die CA wird nicht in das Image eingebaut. Für Build-Schritte gegebenenfalls Proxyvariablen als `build.args` übergeben. Der Proxy muss aus dem Docker-Netz erreichbar sein; eine nötige Hostauflösung über einen externen Override mit der vom Betreiber bestätigten Adresse konfigurieren. Keine Zugangsdaten oder festen Infrastrukturadressen im Repository hinterlegen.

## Öffentlicher Betrieb

Amtliche Herkunft, Datenzeit und Datenlücken sichtbar halten. Das Projekt versendet keine Warn-SMS, E-Mails oder Pushmeldungen. Betreiberangaben, Impressum, Kontakt und eine zum Hosting passende Datenschutzerklärung sind zu ergänzen. Server- und Proxylogs können IP-Adressen enthalten. Eine fehlende Warnmeldung, ein Adapterfehler oder ein leerer Cache ist keine Entwarnung.
