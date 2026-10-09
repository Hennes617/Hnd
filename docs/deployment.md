# Betrieb mit Docker Compose und Coolify

## Voraussetzungen

- Linux-Server mit Docker Engine und Docker Compose v2 oder eine vorhandene Coolify-Installation.
- Als Ausgangspunkt mindestens 1 CPU und 1 GB RAM zum Betrieb; für den parallelen Image-Build sind 2 GB RAM zweckmäßig.
- Ausgehendes HTTPS zu den verwendeten Datenquellen und DNS-Auflösung.
- Für öffentliche Links zwei eigene DNS-Namen und HTTPS am Reverse Proxy.

Die Anwendung braucht keine Datenbank, keine persistenten Volumes und keine Zugangsdaten zu den angebundenen öffentlichen Quellen. Daten liegen in einem zeitlich begrenzten In-Memory-Cache. Ein Container-Neustart beginnt mit einem leeren Cache; Quellen werden beim nächsten Abruf neu abgefragt.

## Docker Compose

Im Repository-Verzeichnis:

```bash
cp .env.example .env
docker compose -f compose.yaml -f compose.local.yaml config --quiet
docker compose -f compose.yaml -f compose.local.yaml up --build -d
docker compose -f compose.yaml -f compose.local.yaml ps
curl --fail http://localhost:8080/health
curl --fail http://localhost:3001/health
```

Die Website ist unter `http://localhost:8080` erreichbar. API-Dokumentation und Maschinenbeschreibung liegen unter `http://localhost:3001/docs` und `http://localhost:3001/openapi.json`. Die API ist auf Port 3001 und die Website auf Port 8080 getrennt erreichbar.

Die Basisdatei `compose.yaml` veröffentlicht keine Host-Ports. Coolify erreicht die internen Container-Ports über sein Docker-Netzwerk und benötigt die lokale Zusatzdatei nicht. Erst `compose.local.yaml` richtet für den lokalen Zugriff Host-Ports ein; `BIND_ADDRESS=127.0.0.1` begrenzt diese auf Loopback. Ein lokaler Reverse Proxy kann diese Ports ebenfalls verwenden. Bei einem lokalen Portkonflikt `WEB_PORT` oder `API_PORT` ändern; die Container-Ports bleiben immer 8080 beziehungsweise 3001.

```bash
docker compose -f compose.yaml -f compose.local.yaml logs --tail=100 api web
docker compose -f compose.yaml -f compose.local.yaml restart api
docker compose -f compose.yaml -f compose.local.yaml down
```

`down` entfernt die Container und das Compose-Netzwerk. Die Originaldaten verbleiben bei den Quellen. Logdateien werden pro Container auf drei Dateien zu jeweils 10 MB begrenzt.

## Coolify: Website und API getrennt veröffentlichen

1. Ein neues Projekt beziehungsweise eine neue Ressource vom Git-Repository anlegen. Als Build-/Deployment-Typ **Docker Compose** wählen und ausschließlich `compose.yaml` im Repository-Root auswählen. `compose.local.yaml` nicht hinzufügen. In Coolify keine zusätzlichen Host-Port-Mappings setzen.
2. Beide Dienste aus der Compose-Datei übernehmen. Für `web` die öffentliche Website-Domain mit Zielport `8080` zuweisen; für `api` die öffentliche API-Domain mit Zielport `3001` zuweisen. Beispiel: `https://wasser.deine-domain.de` und `https://api.deine-domain.de`. Je nach Coolify-Version wird der interne Port im Domainfeld oder im Service-Dialog eingetragen.
3. Die DNS-Einträge beider Namen auf den Coolify-Server richten. HTTPS-Zertifikate im Coolify-Proxy aktivieren.
4. Folgende Variablen in den Umgebungs-/Build-Einstellungen dieser Ressource setzen:

   ```dotenv
   API_PUBLIC_URL=https://api.deine-domain.de
   VITE_PUBLIC_API_URL=https://api.deine-domain.de
   CORS_ORIGIN=https://wasser.deine-domain.de
   ```

5. Neu bauen und deployen. `VITE_PUBLIC_API_URL` muss beim Web-Build verfügbar sein; eine reine Änderung zur Laufzeit aktualisiert die ausgelieferten Links nicht.
6. Beide Healthchecks und anschließend die Live-Datenquellen prüfen. Ein gesunder Container bestätigt nur, dass der Dienst läuft, nicht die Erreichbarkeit aller externen Anbieter.

Die Browser-Anfragen der Website bleiben auf ihrer Website-Domain unter `/api/…`. Nginx leitet sie intern an `api:3001` weiter. Die zusätzliche API-Domain dient externen Clients und dem Link zur API-Dokumentation. Für diese Aufteilung sind weder Cross-Origin-Cookies noch vertrauliche Variablen im Frontend nötig.

### Bestehender Fehler „port is already allocated“

Bei `Bind for 0.0.0.0:8080 failed: port is already allocated` ist der Build bereits abgeschlossen, aber ein Host-Port wird von einem anderen Dienst verwendet. Den aktuellen Stand von `main` mit der Basisdatei `compose.yaml` neu deployen. Falls Coolify eigene Port-Mappings oder eine gespeicherte Compose-Kopie verwendet, dort die Host-Freigaben für 8080 und 3001 entfernen beziehungsweise die Datei aus Git aktualisieren. Die internen Domain-Zielports **8080** und **3001** bleiben eingetragen. Ein anderer Dienst auf dem Server muss dafür nicht gestoppt werden.

## Konfiguration

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `WEB_PORT` | `8080` | Host-Port der Website, nur mit `compose.local.yaml` |
| `API_PORT` | `3001` | Host-Port der API, nur mit `compose.local.yaml` |
| `BIND_ADDRESS` | `127.0.0.1` | Bind-Adresse, nur mit `compose.local.yaml` |
| `VITE_PUBLIC_API_URL` | `http://localhost:3001` | öffentliche API-Basisadresse für Web-Links; Build-Variable |
| `API_PUBLIC_URL` | `http://localhost:3001` | dokumentierte öffentliche API-Adresse; keine Änderung des internen Listen-Ports |
| `CORS_ORIGIN` | `http://localhost:8080` | erlaubte Browser-Ursprünge, bei mehreren komma-getrennt |
| `CACHE_TTL_SECONDS` | `300` | Cache-Lebensdauer; API begrenzt auf 30–3600 Sekunden |
| `UPSTREAM_TIMEOUT_MS` | `8000` | Upstream-Timeout; API begrenzt auf 500–30000 Millisekunden |

Das API-Ratenlimit liegt bei 120 Anfragen pro Minute und Quelladresse. Standardmäßig werden Weiterleitungsheader nicht vertraut; hinter einem Reverse Proxy kann das Limit daher für mehrere Besucher gemeinsam gelten. `TRUST_PROXY=true` ist nur für einen abgeschirmten API-Dienst geeignet, dessen vorgeschalteter Proxy eingehende Forwarding-Header zuverlässig ersetzt. Niemals unkontrollierte Header öffentlicher Clients vertrauen. Die Standardkonfiguration ist bewusst konservativ.

Origins enthalten Schema und gegebenenfalls Port, aber keinen Pfad oder abschließenden Slash. Beispiel: `https://wasser.deine-domain.de,https://weitere-seite.de`. CORS ist ein Browsermechanismus; die öffentliche Lese-API ist kein zugangsgeschützter Dienst.

Die `.env` im Repository-Root wird von Docker Compose zur Variablenersetzung gelesen. Sie wird nicht in die Images kopiert. Beim direkten Start mit `npm run dev` gelten die im Prozess gesetzten Variablen. `HOST` und `PORT` sind im Container fest auf `0.0.0.0` und `3001` gesetzt, damit der interne Proxy konsistent bleibt.

## Netzwerk und Quellen

Für die aktuell eingebundenen Adapter ausgehendes HTTPS erlauben:

| Host | Zweck |
| --- | --- |
| `www.pegelonline.wsv.de` | PEGELONLINE-Messstellen und Messwerte |
| `api.hochwasserzentralen.de` | Landespegel und Hochwasserklassen der Hochwasserzentralen |
| `hvz.lsaurl.de` | Pegeldaten Sachsen-Anhalt |
| `warnung.bund.de` | ergänzende amtliche Warnmeldungen |
| `api.open-meteo.com` | 72-Stunden-Niederschlagsvorhersage, serverseitig gebündelt und gecacht |
| `flood-api.open-meteo.com` | GloFAS-Abflussreihen an unvalidierten Modellrasterpunkten im Raum Halle und Magdeburg |
| `tiles.openfreemap.org` | Kartenstil, Vektorkacheln, Symbole und Kartenschriften; direkter Abruf im Browser |

Die genauen URLs, Datenumfänge und Rechte sind bei der jeweiligen Quelle zu prüfen. Ein amtliches Webportal ist nicht automatisch eine dokumentierte oder uneingeschränkt weiterverwendbare API. Die Aggregation deckt insbesondere nicht alle Landespegel, Privatpegel, Talsperrenstände oder hydrologischen Vorhersagen in Deutschland ab.

Image-Builds benötigen Zugriff auf Docker Hub und `registry.npmjs.org`. Die Oberfläche nutzt Systemschriften; Kartenschriftzeichen werden von OpenFreeMap geladen. Die Karte benötigt WebGL. Bei fehlendem WebGL oder nicht erreichbaren Kacheln bleibt eine durchsuchbare Objektliste verfügbar. TLS-Prüfungen bleiben aktiviert. Hinter einem Unternehmensproxy können `HTTP_PROXY`, `HTTPS_PROXY` und `NO_PROXY` in die API-Umgebung durchgereicht werden. `NO_PROXY` sollte interne Dienste wie `localhost,127.0.0.1,api,web` enthalten.

Die Karte stellt eine direkte Verbindung vom Browser zu OpenFreeMap her; dies in der Datenschutzerklärung berücksichtigen. Die gespeicherten BKG-Grenzen benötigen zur Laufzeit keinen Geodatendienst. Wetter und Abfluss werden getrennt für 30 Minuten gepuffert; fehlende Werte bleiben ausdrücklich unbekannt. Open-Meteos öffentlicher, schlüsselloser Dienst setzt nichtkommerzielle Nutzung und Fair Use voraus. Die kostenlose eigene API ändert diese Bedingungen nicht; siehe [Wetterdaten und Nutzungsbedingungen](weather-data.md).

### Zusätzliche CA für einen HTTPS-Proxy

Die Dockerfiles akzeptieren optional das BuildKit-Secret `proxy_ca`. Bei normalen Servern mit öffentlichen Zertifikaten ist es unnötig. In einer Umgebung mit HTTPS-Inspection die bereitgestellte CA sicher als Build-Secret einbinden. Beispiel für eine zusätzliche Compose-Datei außerhalb des Repositorys:

```yaml
services:
  api:
    build:
      secrets:
        - proxy_ca
    environment:
      NODE_EXTRA_CA_CERTS: /run/secrets/proxy_ca
      HTTP_PROXY: ${HTTP_PROXY:-}
      HTTPS_PROXY: ${HTTPS_PROXY:-}
      NO_PROXY: localhost,127.0.0.1,api,web
    secrets:
      - proxy_ca
  web:
    build:
      secrets:
        - proxy_ca
secrets:
  proxy_ca:
    file: ${PROXY_CA_FILE}
```

```bash
PROXY_CA_FILE=/pfad/zur/proxy-ca.pem docker compose \
  -f compose.yaml -f compose.local.yaml -f /pfad/zur/compose.proxy.yaml up --build -d
```

Die CA bleibt außerhalb der Images. Die Proxy-Adresse muss aus dem Docker-Netzwerk erreichbar sein. Für Build-Schritte zusätzlich die Proxy-Variablen als `build.args` durchreichen. Falls der Proxy-Hostname nur im Host-Netz auflösbar ist, ihn mit der vom Betreiber bereitgestellten Adresse unter `build.extra_hosts` eintragen; den Proxy selbst weiterhin verwenden. Keine festen Cloud-Adressen in dieses Repository übernehmen. Das Deaktivieren der Zertifikatsprüfung ist keine unterstützte Konfiguration.

## Vor einer öffentlichen Freigabe

Zuerst Healthchecks, API-Dokumentation und Quellenstatus über die tatsächlichen Domains öffnen. Im Webangebot müssen fehlende oder veraltete Daten als solche erkennbar bleiben. Eine fehlende Warnmeldung, ein Adapterfehler oder ein leerer Cache begründen keine Entwarnung. Quellenangaben und Datenstände bei Weiterverwendung beibehalten und die Nutzungsbedingungen der Originalanbieter prüfen.

Die Anwendung versendet keine SMS, E-Mails oder Push-Warnungen und ersetzt keine amtliche Warn-App. Impressum, Kontakt und eine dem konkreten Hosting entsprechende Datenschutzerklärung sind vor einem öffentlichen Betrieb durch den Betreiber zu ergänzen. Der Code erhebt keine Nutzerkonten; Server- und Proxylogs können dennoch IP-Adressen enthalten.
