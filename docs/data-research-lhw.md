# Datenrecherche: Hochwasser, Deutschland und Harz

Recherche vom 9. Oktober 2026. Das Projekt ist ein unabhängiges Informationsangebot, kein amtlicher Hochwassernachrichtendienst. Es gibt keine einzelne freie API, die alle deutschen Pegel, Talsperren, Warnungen und Flussverläufe vollständig liefert.

## Nachweisstand

Die zunächst blockierten amtlichen Live-Endpunkte sind nach Anpassung der Netzwerkfreigaben erreichbar. Am 9. Oktober 2026 gegen 10:06 Uhr MESZ wurden folgende Primärquellen erfolgreich direkt abgerufen: LHP-Stationskatalog mit 1.588 Features, LHP-Warngebiete, PEGELONLINE mit 786 Stationsobjekten, NINA-LHP-Warnindex sowie der LHW-Stationskatalog mit 219 Einträgen. Die amtlichen LHP-Entwicklerhinweise und die PEGELONLINE-Nutzungsbedingungen wurden ebenfalls direkt gelesen. LHP-Warngebiete und NINA-LHP-Index enthielten bei diesen einzelnen Stichproben keine Einträge; daraus folgt keine allgemeine Entwarnung oder Vollständigkeitsgarantie.

Die Formate wurden außerdem anhand öffentlich zugänglicher API-Spezifikationen, Adapter und historischer Rohdatenaufzeichnungen auf GitHub geprüft. Historische Aufzeichnungen dürfen nur als ausdrücklich gekennzeichnete Testdaten oder als Metadatenbasis verwendet werden; ihre Wasserstände und Warnklassen sind keine aktuellen Informationen. Die nachstehenden Zahlen aus Live-Abrufen bezeichnen Stichproben und keine dauerhaft garantierte Abdeckung.

Besonders ergiebig ist das öffentliche [Waterheight-Quellenverzeichnis](https://github.com/mwijkhuisen/Waterheight/blob/c83975bb806fb50bbd4139456697cd0e65c70f2e/docs/sources/research/de-states.md). Es ist eine Sekundärquelle, keine amtliche Dokumentation. Wo eine Lizenz ausschließlich daraus hervorgeht, ist dies unten ausdrücklich angegeben.

## Empfohlene Quellenkombination

| Quelle | Inhalt | Abdeckung und Grenze | Zugang |
| --- | --- | --- | --- |
| LHP PublicAPI | Pegelstandorte, amtliche Hochwasserklassen, regionale Warngebiete | Bundesweites Portal mit Länderfiltern; nicht alle Länder oder Messstellen in jedem Abruf, keine Wasserstands- oder Abflusswerte | Öffentlich, ohne individuellen Schlüssel |
| PEGELONLINE, WSV | Stationsmetadaten, aktuelle Wasserstände und Abflüsse, Rohzeitreihen | Bundeswasserstraßen; ersetzt Landespegel im Harz nicht | Öffentlich, ohne Schlüssel |
| LHW/HVZ Sachsen-Anhalt | Stationskatalog, Wasserstand, Abfluss, Alarmgrenzen | Sachsen-Anhalt und im Portal geführte Nachbarpegel | Öffentliche JSON-Dateien; keine hier geprüfte allgemeine API-Lizenz |
| BBK/NINA | LHP-, MoWaS- und DWD-Warnmeldungen, Texte und Geometrien | Deutschland; nur tatsächlich eingespeiste Meldungen | Öffentlich abrufbar; Nutzungsbedingungen des jeweiligen Inhalts beachten |
| NLWKN Niedersachsen | Pegelstammdaten, aktuelle Messwerte, bis 30 Tage Historie | Öffentliches niedersächsisches Pegelnetz einschließlich Harzvorland | Dokumentierte Public API mit öffentlichem Anwendungsschlüssel; Wiederveröffentlichungsrechte klären |
| Thüringer HNZ | Pegeltabelle und amtliche Einzelpegel-Seiten | Thüringen, südliches Harzvorland | Öffentliches HTML; hier keine dokumentierte schlüssellose JSON-API bestätigt |

## 1. LHP PublicAPI: deutschlandweite Pegel- und Hochwasserübersicht

Amtliche Einstiegsseiten:

- [Entwicklerbereich](https://www.hochwasserzentralen.de/developers/)
- [API-Dokumentation](https://www.hochwasserzentralen.de/developers/api-docs)
- [OpenAPI-Spezifikation](https://www.hochwasserzentralen.de/developers/docs/lhp-public-api_v1.20240123.yaml)

Endpunkte:

```text
GET https://api.hochwasserzentralen.de/public/v1/data/stations?format=json
GET https://api.hochwasserzentralen.de/public/v1/data/stations?format=json&states=ST,NI,TH
GET https://api.hochwasserzentralen.de/public/v1/data/alerts?format=json
```

Antworten sind GeoJSON FeatureCollections mit zusätzlichen Metadaten: `apiVersion`, `status`, `source`, `sourceName`, `licence`, `licenceName`, `updated`, `lastModified`, `legend`, bei Stationen `stateLinks`.

Ein Pegelfeature enthält `id` wie `ST_440004`, `geometry.type: Point`, Koordinaten in Reihenfolge `[longitude, latitude]` und `properties` mit `name`, `water`, `timestamp`, `lhpClass`, `stateClassName`, `stationLink`, `stateId`. Der Stationsschlüssel ermöglicht den Abgleich mit dem LHW-Katalog. `stationLink` kann fehlen beziehungsweise null sein.

Der eigene Primärabruf vom 9. Oktober 2026 lieferte `status: success`, `updated: 2026-10-09T09:05:47+01:00` und 1.588 Features aus 15 Länderkennungen, davon 47 mit `DE-ST`; Hamburg war in dieser Stichprobe nicht vertreten. Als zusätzliche Schema-Referenz enthält der [historische Mitschnitt vom 29. September 2026](https://github.com/mwijkhuisen/Waterheight/blob/c83975bb806fb50bbd4139456697cd0e65c70f2e/apps/server/src/adapters/de-6/fixtures/de-6-stations.raw) 1.589 Features. Seine [Aufzeichnungsmetadaten](https://github.com/mwijkhuisen/Waterheight/blob/c83975bb806fb50bbd4139456697cd0e65c70f2e/apps/server/src/adapters/de-6/fixtures/de-6-stations.meta.json) nennen URL, Abrufzeit, HTTP 200 und `synthetic: false`. Die Datenmenge ist keine dauerhaft garantierte Stationszahl.

Die Stationslegende in diesem Mitschnitt lautet:

| `lhpClass` | Originalbezeichnung | Farbe |
| --- | --- | --- |
| -1 | Derzeit keine Daten | `#7b7b7b` |
| 0 | Kein Hochwasser | `#7CBD5C` |
| 1 | Kleines Hochwasser | `#ffff00` |
| 2 | Mittleres Hochwasser | `#ffa500` |
| 3 | Großes Hochwasser | `#de0000` |
| 4 | Sehr großes Hochwasser | `#941094` |

Eine fehlende `lhpClass` ist keine Klasse 0. Die API liefert ausdrücklich keine Messwerte wie Wasserstand und Abfluss. Regionale Warngebiete verwenden eine andere Klassenskala; deren `lhpClass` ist in der Testantwort ein String. Die dokumentierte Warngebietslegende umfasst `1` Entwarnung, `2` Vorwarnung, `4` Hochwasser, `5` Großes Hochwasser und `6` Sehr großes Hochwasser. Warngebiete können Polygon- oder Liniengeometrien besitzen. Stations- und Gebietsklassen nicht vermischen.

Lizenz: Die direkt gelesenen [amtlichen Entwicklerhinweise](https://www.hochwasserzentralen.de/developers/) und der eigene Live-Datensatz bestätigen [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de). Verpflichtend sind die gut sichtbare Quellenangabe „Datenquelle: www.hochwasserzentralen.de“ als klickbarer Link und „Stand: TT.MM.JJJJ hh:mm“ aus `updated`. Die amtliche Seite empfiehlt eine Aktualisierung mindestens alle zehn Minuten und die LHP-Farben nach Möglichkeit beizubehalten; diese beiden Punkte formuliert sie als „sollten“. Änderungen an übernommenen Daten kennzeichnen. Veraltete lokale Zwischenspeicher als veraltet anzeigen.

Zeitangaben beachten: `updated` besitzt einen UTC-Offset; `properties.timestamp` in den aufgezeichneten Daten nicht. Letzteres ist nach der Sekundärrecherche lokale deutsche Zeit, nicht automatisch UTC. Bei fehlendem sicheren Zeitbezug keinen vermeintlich exakten UTC-Zeitstempel erfinden.

Die alte PHP-Schnittstelle `/webservices/get_lagepegel.php` ist nicht diese PublicAPI. Ein [älterer Integrationshinweis](https://github.com/stephan192/hochwasserportal) beschreibt ihre Sperrung 2023; daraus darf nicht auf die Nichtverfügbarkeit der neueren PublicAPI geschlossen werden.

## 2. PEGELONLINE: schlüssellose Wasserstände

Primärdokumentation: [WSV REST API](https://www.pegelonline.wsv.de/webservice/dokuRestapi). Schema unabhängig nachvollzogen in [bundesAPI/pegel-online-api](https://github.com/bundesAPI/pegel-online-api/blob/main/openapi.yaml).

```text
GET https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?includeTimeseries=true&includeCurrentMeasurement=true
GET https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/{uuid}.json?includeTimeseries=true&includeCurrentMeasurement=true
GET https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/{uuid}/W/measurements.json?start=P7D
GET https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/{uuid}/Q/measurements.json?start=P7D
GET https://www.pegelonline.wsv.de/webservices/rest-api/v2/waters.json
```

Stationsfelder umfassen `uuid`, `number`, `longname`, `latitude`, `longitude`, `km`, `agency`, `water` und optional `timeseries`. Zeitreihen enthalten `shortname`, `unit`, `equidistance`, `currentMeasurement` und gegebenenfalls `gaugeZero`. Eine Messung ist `{timestamp, value}`; die Einheit stammt aus der Zeitreihe. `W` ist häufig cm über Pegelnullpunkt, aber die gelieferte Einheit ist maßgeblich. Unterschiedliche Pegelnullpunkte machen Wasserstandszahlen verschiedener Stationen nicht unmittelbar vergleichbar.

Die API bietet maximal die letzten 31 Tage Rohmessungen. `start=P7D` ist ein dokumentierter Zeitraumparameter. Weder Q noch aktuelle Messwerte sind für jede Station vorhanden. `stateMnwMhw: high` bedeutet eine Einordnung relativ zu hydrologischen Kennwerten und ist keine amtliche Hochwasserwarnung oder Alarmstufe.

Die [amtlichen Nutzungsbedingungen](https://www.pegelonline.wsv.de/gast/nutzungsbedingungen), Stand 21.05.2024, wurden am 9. Oktober 2026 direkt gelesen: „Informationen, Produkte oder Dienste, die Sie von dieser Website erhalten, dürfen übernommen werden. Dies geschieht auf der Grundlage der Lizenz DL-DE->Zero-2.0“. Sie erlauben ausdrücklich die kommerzielle und nicht kommerzielle Nutzung, Bearbeitung und Übermittlung an Dritte. Sinnvolle Quellenangabe unabhängig davon: „Pegeldaten: WSV/GDWS über PEGELONLINE; ungeprüfte Rohdaten“. Die Seite weist auf zusätzlich dargestellte Daten Dritter und fehlende Gewähr für Aktualität und Vollständigkeit hin. Der eigene Stationsabruf ergab 786 Objekte; auch darin können einzelne Zeitreihen veraltet sein.

## 3. Sachsen-Anhalt: LHW/HVZ, Harz-Pegel

Amtlicher Einstieg: [Hochwasservorhersage Sachsen-Anhalt](https://hochwasservorhersage.sachsen-anhalt.de/) beziehungsweise [HVZ-Kurzadresse](https://hvz.lsaurl.de/).

Der [aktuelle Sachsen-Anhalt-Adapter von lhpapi](https://github.com/stephan192/lhpapi/blob/master/src/lhpapi/st_api.py) belegt folgende URL-Struktur:

```text
BASE=https://hvz.lsaurl.de/fileadmin/Bibliothek/Politik_und_Verwaltung/MLU/HVZ/KISTERS/data/internet/stations
GET {BASE}/stations.json
GET {BASE}/{site_no}/{station_no}/W/week.json
GET {BASE}/{site_no}/{station_no}/Q/week.json
GET {BASE}/{site_no}/{station_no}/W/alarmlevel.json
```

`stations.json` ist ein Array mit mindestens `station_no`, `station_name`, `site_no`, `WTO_OBJECT` (Gewässer), `web_anmerkung` und `web_wichtigerhinweis`. Eine zweite öffentliche Implementierung, [ha-laenderpegel](https://github.com/klaffka/ha-laenderpegel/blob/main/custom_components/laenderpegel/providers/st.py), verwendet außerdem `catchment_name` und `GAUGE_DATUM`. Das Einzugsgebiet aus `catchment_name` nicht mit dem gemessenen Gewässer gleichsetzen.

Die W/Q-Antwort ist ein Array von Zeitreihenobjekten mit `data: [[ISO-Zeitpunkt, Wert], ...]`; in der zweiten Implementierung ist `ts_unitsymbol` belegt. Alarmgrenzen stehen als eigene Serien mit `ts_name: "Alarmstufe 1"` bis `"Alarmstufe 4"` und jeweils einem letzten Datenwert. Eine daraus berechnete Überschreitung ist eine rechnerische Schwellenüberschreitung und ersetzt keine amtlich ausgerufene Warnung. Ein fehlender Alarmgrenzendatensatz bedeutet nicht Alarmstufe 0.

Der eigene Primärabruf bestätigt die Koordinatenfelder `station_latitude` und `station_longitude` als Dezimalstrings. Beispiel Thale: `station_no: 579020`, `site_no: LHW`, `station_latitude: 51.7376525543673`, `station_longitude: 11.023815606979`. Weitere direkt bestätigte Metadaten sind `GAUGE_DATUM`, `DIST_TO_CONFL`, `CATCHMENT_SIZE`, `BODY_RESPONSIBLE` und `EIGENTUMSVERHALTNISSE`. Hinweise müssen erhalten bleiben: Bei Thale stand `web_wichtigerhinweis` beim Abruf auf „Die Wasserstände könner derzeit von Baumaßnahmen beeinflusst sein.“ (Originalschreibweise).

Auch Thales W-Wochenzeitreihe und Alarmgrenzen wurden direkt geprüft. Die Zeitreihe enthielt 615 Punkte mit `ts_unitsymbol: cm`; der letzte Punkt beim Abruf war `2026-10-09T09:30:00.000+02:00`, 110 cm. Die vier Alarmgrenzen lagen bei 200, 235, 280 und 310 cm. Dies sind dokumentierte Abrufbeispiele, keine dauerhaft aktuellen Anzeige- oder Warnwerte.

Belegte Harz-Pegel aus dem [öffentlichen lhpapi-Katalog](https://github.com/stephan192/lhpapi/blob/master/docs/pegel.md), zur späteren Discovery und Überprüfung:

| Gewässer | Stationsnummern und Namen |
| --- | --- |
| Bode | 579002 Neuwerk; 579006 Wendefurth; 579020 Thale; 579040 Ditfurt; 579049 Wegeleben; 579070 Hadmersleben; 579085 Staßfurt |
| Warme Bode | 579205 Tanne; 579209 Königshütte-WB |
| Kalte Bode | 579305 Elend; 5793052 Elend 1; 579330 Königshütte-KB |
| Selke | 579600 Güntersberge; 579605 Silberhütte; 579610 Meisdorf; 579620 Hausneindorf |
| Ilse | 444205 Ilsenburg; 444210 Hoppenstedt |
| Holtemme | 579703 Hanneckenbruch; 579705 Steinerne Renne; 5797051 Steinerne Renne 1; 579712 Mahndorf; 579745 Nienhagen |
| Zillierbach | 579754 Zillierbachtalsperre Zulauf; 579758 Wernigerode |
| Wipper | 5784001 VS Wippra Zulaufpegel; 5784003 VS Wippra Ablaufpegel; 578410 Wippra; 578420 Mansfeld-Leimbach; 578430 Großschierstedt |
| Helme | 575400 Sundhausen; 575401 Görsbach; 575409 Saukopf; 575410 Bennungen; 575560 Nikolausrieth |
| Thyra | 575700 Stolberg; 575710 Berga |

Der lhpapi-Katalog enthält beim Rechercheabruf 219 Einträge mit Präfix ST. Diese Zahl bezeichnet im Landesportal gelistete Stationen und nicht ausschließlich geografisch in Sachsen-Anhalt liegende Stationen. Die MIT-Lizenz der Adaptersoftware überträgt sich nicht auf die behördlichen Pegeldaten. Eine allgemeine Lizenz für die Weitergabe aller LHW-Rohdaten durch eine eigene öffentliche API ist hier noch nicht nachgewiesen; Quelle und unklaren Lizenzstatus offen ausweisen.

## 4. BBK/NINA: ergänzende Warnmeldungen

Primärportal: [warnung.bund.de](https://warnung.bund.de/). Die öffentlich gepflegte [OpenAPI-Dokumentation](https://github.com/bundesAPI/nina-api/blob/main/openapi.yaml) belegt:

```text
GET https://warnung.bund.de/api31/lhp/mapData.json
GET https://warnung.bund.de/api31/mowas/mapData.json
GET https://warnung.bund.de/api31/dwd/mapData.json
GET https://warnung.bund.de/api31/warnings/{identifier}.json
GET https://warnung.bund.de/api31/warnings/{identifier}.geojson
GET https://warnung.bund.de/api31/dashboard/{ARS}.json
```

Der LHP-Index ist ein Array aus `id`, `version`, `startDate`, `severity`, `type` und `i18nTitle.de`. Geometrien stehen im separaten GeoJSON-Endpunkt. Die Meldungsdetails sind CAP-ähnliches JSON mit `identifier`, `sender`, `sent`, `status`, `msgType` und `info[]`; darin unter anderem `headline`, `event`, `description`, `severity`, `urgency`, `certainty`, `effective`, `senderName`, `web` und `area[]`.

NINA-Schweregrade wie `Severe` sind keine hydrologischen Pegel-Alarmstufen. Aktualisierungen, Entwarnungen (`Cancel`), Testmeldungen und abgelaufene Meldungen unterscheiden. Ein fehlgeschlagener Abruf darf nie als „keine Warnung“ erscheinen. Bei nur teilweise verfügbaren Detailmeldungen muss die eingeschränkte Abdeckung sichtbar bleiben. Amtliche Texte nicht ungeprüft als HTML ausführen. Die ARS-Abfrage erwartet zwölf Stellen auf Kreisebene; die letzten sieben Stellen sind null. Nicht beliebige AGS- und ARS-Schlüssel austauschen.

Eine einheitliche Datenlizenz für alle durch NINA transportierten Inhalte ist in der gelesenen Spezifikation nicht angegeben. Die Quellenbetreiber und ihre Originalmeldungen jeweils verlinken; keine Lizenz der OpenAPI-Software als Inhaltslizenz deklarieren.

## 5. Niedersachsen und Thüringen: nächste Integrationen

NLWKN dokumentiert den kostenlosen Webservice auf [Hinweise / Webservice](https://www.pegelonline.nlwkn.niedersachsen.de/Hinweis#Webservice) und im [Benutzerhandbuch](https://www.pegelonline.nlwkn.niedersachsen.de/pdf/BenutzerhandbuchWebservicePegelonline.pdf). Der öffentlich dokumentierte Anwendungsschlüssel ist kein individueller Nutzerschlüssel; das Handbuch ist dafür die maßgebliche Quelle.

```text
GET https://bis.azure-api.net/PegelonlinePublic/REST/stammdaten/stationen/All?key={PUBLIC_KEY}
GET https://bis.azure-api.net/PegelonlinePublic/REST/station/{STA_ID}/datenspuren/parameter/{PAT_ID}/tage/-7?key={PUBLIC_KEY}
```

Belegt durch [lhpapi NI-Adapter](https://github.com/stephan192/lhpapi/blob/master/src/lhpapi/ni_api.py) und die oben genannte Sekundärrecherche. Die Stammdatenantwort heißt `getStammdatenResult`; `STA_ID` ist nicht `STA_Nummer`. `Parameter[].Datenspuren[]` enthält aktuelle Werte, deren Zeitpunkt und Meldestufen. `-888` ist ein Fehlwert. Die Sekundärrecherche dokumentiert vertauschte Feldbezeichnungen `Latitude`/`Longitude` und korrekte Zeitstempel nur in `DatumUTC`; nicht blind nach Feldnamen mappen.

Die Sekundärrecherche stellt einen Widerspruch zwischen Quellenangabepflicht im Handbuch und restriktiver Weitergabeklausel im [Impressum](https://www.pegelonline.nlwkn.niedersachsen.de/Impressum) fest. Deshalb keine pauschale freie Weiterveröffentlichungslizenz zusagen. LHP-Klassen für niedersächsische Stationen haben eine eigenständig dokumentierte CC-BY-Lizenz und können diese Lücke teilweise schließen.

Thüringen veröffentlicht [eine landesweite Pegeltabelle](https://hnz.thueringen.de/hw-portal/thueringen.html). Der [lhpapi-Adapter](https://github.com/stephan192/lhpapi/blob/master/src/lhpapi/th_api.py) liest das HTML-Element `table#pegelTabelle`, unter anderem Pegelnummer, Gewässer, Wasserstand, Abfluss und Zeit. Das ist ein fragiler Scraping-Adapter, keine stabile JSON-Vertragsgrundlage. Für den Südrand des Harzes sind insbesondere Helme, Zorge, Wieda und Thüringer Wipper relevant. Lizenz- und Vollständigkeitsstatus separat prüfen.

## 6. Harzwasserwerke: geprüfte Talsperren-Stammdaten

Die folgenden Betreiberseiten wurden am 9. Oktober 2026 direkt erfolgreich gelesen. Die Werte bezeichnen den **Speicherinhalt und die Speicheroberfläche bei Vollstau**, keinen aktuellen Füllstand. Die Höhe ist jeweils die Höhe über der Gründungssohle.

| Talsperre und direkte Primärquelle | Gewässer | Speicherinhalt bei Vollstau | Oberfläche bei Vollstau | Inbetriebnahme | Höhe |
| --- | --- | --- | --- | --- | --- |
| [Oker](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/okertalsperre/) | Oker | 46,85 Mio. m³ | 2,25 km² | 1956 | 75 m |
| [Ecker](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/eckertalsperre/) | Ecker | 13,27 Mio. m³ | 0,68 km² | 1943 | 65 m |
| [Grane](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/granetalsperre/) | Grane | 46,4 Mio. m³ | 2,19 km² | 1969 | 67 m |
| [Innerste](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/innerstetalsperre/) | Innerste | 19,26 Mio. m³ | 1,39 km² | 1966 | 40 m |
| [Oder](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/odertalsperre/) | Oder im Harz | 30,61 Mio. m³ | 1,36 km² | 1934 | 62 m |
| [Söse](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/soesetalsperre/) | Söse | 25,5 Mio. m³ | 1,24 km² | 1931 | 56 m |

Die [aktuelle Talsperrendatenseite](https://www.harzwasserwerke.de/infoservice/aktuelle-talsperrendaten/) und die TALIS-Seiten sind ebenfalls vorhanden. Das anfänglich gelieferte HTML enthält für aktuelle Messgrößen teilweise Platzhalter und ist deshalb keine Quelle vermeintlicher Nullwerte. Es verweist auf ein [Hochwasserdaten-PDF](https://www.harzwasserwerke.de/talis/hochwasserdaten.pdf); dessen Datenformat wurde hier nicht untersucht. Die obige Stammdatenverifikation betrifft genau die genannten Fakten, keine Koordinaten oder Geometrien.

### Technisch belegter HWW-Livedatenzugang, noch keine frei lizenzierte Integration

Die Betreiberseite lädt ihr öffentliches [Frontend-Skript `barrage-data.js`](https://www.harzwasserwerke.de/wp-content/themes/Avada-Child-Theme/barrage-data.js). Dieses verwendet zwei GET-Routen unter `https://www.harzwasserwerke.de/wp-content/themes/Avada-Child-Theme/barrageData/`:

```text
barrageDataCall.php?m=getTsMap
barrageDataCall.php?m=getReducedAndSplittedTextData&url={ENCODED_SOURCE_URL}
```

Der eigene erfolgreiche Aufruf von `getTsMap` lieferte:

| Name | Quelldatei unter `https://www.harzwasserwerke.de/talis/` |
| --- | --- |
| Oder | `ODE_tab_direct.txt` |
| Ecker | `ECK_tab_direct.txt` |
| Söse | `SOE_tab_direct.txt` |
| Oker | `OKE_tab_direct.txt` |
| Innerste | `INN_tab_direct.txt` |
| Grane | `GRA_tab_direct.txt` |

Der eigene Aufruf von `getReducedAndSplittedTextData` mit der URL-kodierten Oker-Quelldatei gab am 9. Oktober 2026 erfolgreich folgendes JSON zurück:

```json
{"datum":"09.10.2026 09:00:00","stauinhalt":"8.056","zufluss":"0.581","abgabe":"1.031"}
```

Das Betreiber-Frontend weist `stauinhalt` in Mio. m³ sowie Zu- und Abfluss in m³/s aus. Den Füllungsgrad berechnet es aus Speicherinhalt und dem im HTML hinterlegten maximalen Stauinhalt. `datum` enthält keinen UTC-Offset; der genaue Zeitbezug ist vor einer normalisierten API-Ausgabe zu klären. Ein direkter Abruf der Oker-Textdatei lieferte dagegen eine WordPress-Fehlerseite. Der PHP-Wrapper ist daher der einzige hier erfolgreich geprüfte maschinenlesbare Zugriff; es ist eine interne Frontend-Schnittstelle ohne hier gefundene stabile öffentliche API-Dokumentation.

**Rechte sind noch nicht geklärt:** Das direkt gelesene [HWW-Impressum](https://www.harzwasserwerke.de/impressum/) sagt: „Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.“ Es verlangt für Vervielfältigung, Verbreitung und Verwertung außerhalb der urheberrechtlichen Grenzen schriftliche Zustimmung. Eine ausdrückliche freie Datenlizenz für die kontinuierliche Weitergabe dieser Messreihen wurde nicht gefunden. Deshalb bleibt das Projekt bei geprüften Stammdaten und einem Link zur offiziellen aktuellen Anzeige; die technisch mögliche Livedaten-Integration ist eine gesonderte Erweiterung nach Klärung der Weiterveröffentlichung und des Zeitbezugs. Diese Feststellung ist keine Aussage, dass einzelne Sachangaben urheberrechtlich geschützt wären.

Die zusätzlich versuchten Talsperrenbetrieb-Domains `www.talsperren-lsa.de` und `www.talsperrenbetrieb.de` waren weiterhin mit einer Proxy-403-Antwort nicht erreichbar. Rappbode-Angaben sind damit durch diese Nachprüfung noch nicht primär verifiziert.

## Offene Abdeckungsgrenzen

- Stationspunkte bilden keinen vollständigen Flussverlauf von Quelle bis Mündung ab. Dafür werden eigenständig belegte Gewässergeometrien und ein gerichtetes Gewässernetz benötigt.
- Pegel an einem Talsperrenzulauf sind keine Messung des Talsperreninhalts. Füllstand, Stauziel, Volumen, Zufluss und Abgabe jeweils getrennt und nur aus belegten Betreiberquellen zeigen.
- Flusspegel, Stauseeoberflächenhöhe und Prozentfüllung sind verschiedene Größen. Keine Umrechnung ohne dokumentierte Bezugsdaten.
- Ein deutschlandweiter LHP-Katalog ist nicht „alle Pegel Deutschlands“. WSV, Länder und Talsperrenbetreiber ergänzen sich und können dieselbe Station mehrfach führen.
- Netzwerkausfall, fehlende Messwerte, fehlende Klassifikation und amtliche Entwarnung sind vier unterschiedliche Zustände.
- Eine selbst gehostete, schlüssellose API kann kostenlos zugänglich sein; Hosting und fremde Datenrechte bleiben davon unabhängig.

## Domains für Live-Prüfung und Betrieb

Notwendig für die oben genannten Kernquellen: `api.hochwasserzentralen.de`, `www.hochwasserzentralen.de`, `www.pegelonline.wsv.de`, `warnung.bund.de`, `hvz.lsaurl.de`, `hochwasservorhersage.sachsen-anhalt.de`, `lhw.sachsen-anhalt.de`.

Für die optionalen Landesintegrationen zusätzlich: `www.pegelonline.nlwkn.niedersachsen.de`, `bis.azure-api.net`, `hnz.thueringen.de`. Für die oben geprüften Talsperren-Stammdaten: `www.harzwasserwerke.de`. Die Zulassung eines Hosts bestätigt weder seinen aktuellen Zustand noch die Nutzungsrechte der Daten.
