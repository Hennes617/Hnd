# Wetter- und Abflussprognosen mit Open-Meteo

Recherche: 9. Oktober 2026. Schwerpunkt der Anwendung ist Sachsen-Anhalt mit **Landkreis Harz**, nicht das gesamte grenzüberschreitende Harzgebirge. Wetterpunkte sind Orts- beziehungsweise Modellrasterpunkte; sie sind keine flächendeckenden Einzugsgebietsprognosen.

## Drei getrennte Informationen

1. **Amtliche Hochwasserwarnungen und Pegelmessungen** kommen weiterhin von LHW/HVZ, LHP, PEGELONLINE beziehungsweise NINA. Eine ausgebliebene Warnmeldung oder eine ausgefallene Quelle bedeutet keine Entwarnung.
2. **Niederschlagsvorhersage** kommt von Open-Meteo. Stundenwerte zeigen vorhergesagten Niederschlag, Regen und gegebenenfalls Niederschlagswahrscheinlichkeit. Eine Wahrscheinlichkeit von Regen ist ausdrücklich keine Wahrscheinlichkeit eines Hochwassers.
3. **Modellierter Flussabfluss** kommt von Copernicus CEMS GloFAS über die Flood API von Open-Meteo. Angezeigt werden tägliche Ensemblewerte in m³/s an zwei **unvalidierten Modellrasterpunkten im Raum Magdeburg und Halle**. Eine fachlich belegte Zuordnung dieser Rasterzellen zu Elbe beziehungsweise Saale fehlt; die Reihen werden deshalb nicht als Vorhersage dieser Flüsse bezeichnet. Es sind weder gemessene Pegelstände noch amtliche Warnstufen.

Aus einer beliebigen Regenmenge wird **keine Hochwasserwahrscheinlichkeit** abgeleitet. Dafür wären unter anderem Einzugsgebiete, Bodenfeuchte, Schneeschmelze, Speicherbewirtschaftung, Abflusslaufzeiten, belastbare Bezugspegel und eine hydrologisch validierte Kalibrierung erforderlich. Auch ein Anstieg des modellierten Abflusses allein ist keine Überschreitung einer amtlichen Hochwasserschwelle.

## Offizielle Quellen und geprüfter Stand

Die Wetter-API ist in der aktuellen Cloud-Laufzeit erfolgreich erreichbar. Bei der Live-Prüfung am **9. Oktober 2026 um 10:41 Uhr MESZ (08:41 UTC)** lieferte der implementierte Dienst Wetterdaten für alle **14 von 14 ausgewählten Orten in Sachsen-Anhalt**. Die Landkreis-Harz-Ansicht zeigte davon Wernigerode, Quedlinburg, Halberstadt, Harzgerode und Benneckenstein, jeweils mit 72 vollständigen Niederschlagsstunden. Einzelheiten zur Abnahme stehen unten. Ein anfänglicher Proxy-403 war ein vorübergehender Netzwerkzustand und ist kein aktueller Wetter-API-Blocker.

Parameter und Produkte wurden außerdem anhand des offiziellen Quellcodes und der offiziellen OpenAPI-Spezifikationen geprüft:
- [Offizielle Forecast-OpenAPI](https://github.com/open-meteo/open-meteo/blob/454d6ef3ef683587afac067f31627088cd111637/openapi/forecast.yml).
- [Offizielle Flood-OpenAPI](https://github.com/open-meteo/open-meteo/blob/454d6ef3ef683587afac067f31627088cd111637/openapi/flood.yml).
- [Forecast-Controller mit Modellwahl](https://github.com/open-meteo/open-meteo/blob/454d6ef3ef683587afac067f31627088cd111637/Sources/App/Controllers/ForecastapiController.swift).
- [GloFAS-Raster, Ensembleumfang und Aktualisierung](https://github.com/open-meteo/open-meteo/blob/454d6ef3ef683587afac067f31627088cd111637/Sources/App/GloFas/GloFasDownloader.swift).
- [Berechnung der Ensemble-Quantile](https://github.com/open-meteo/open-meteo/blob/454d6ef3ef683587afac067f31627088cd111637/Sources/App/GloFas/GloFasReader.swift).
- [Zeitfenster der Forecast-Abfrage](https://github.com/open-meteo/open-meteo/blob/454d6ef3ef683587afac067f31627088cd111637/Sources/App/Helper/ForecastapiQuery.swift).
- [Nutzungsbedingungen und Datenlizenz](https://github.com/open-meteo/open-meteo/blob/454d6ef3ef683587afac067f31627088cd111637/README.md#terms--privacy).

Referenz-Commit: `454d6ef3ef683587afac067f31627088cd111637` vom 8. Oktober 2026. Die öffentlich dokumentierten Produkte sind echte **Vorhersageprodukte**, nicht ausschließlich historische Abflussreihen. Ob ein konkreter Live-Abruf zukünftige, vollständige und brauchbare Werte liefert, muss zusätzlich anhand der Antwort geprüft werden. Dokumentation allein belegt keine aktuelle Verfügbarkeit.

Der eigene Endpunkt lautet `GET /api/v1/forecast?region=harz` für den Landkreis und `GET /api/v1/forecast?region=sachsen-anhalt` für das Land. Ohne Regionsparameter gilt Sachsen-Anhalt. `region=germany` erweitert nur die übrige Anwendung; diese Prognosefunktion bleibt bei den 14 ausgewählten Orten Sachsen-Anhalts.

## Wetter: 72 Stunden

Basis-URL: `https://api.open-meteo.com/v1/forecast`

Die Implementierung in `apps/api/src/forecast.ts` fragt `precipitation`, `rain` und `precipitation_probability` ab, mit `models=best_match`, `precipitation_unit=mm` und einem serverseitigen Cache von 30 Minuten. Lufttemperatur und Schneeschmelze sind nicht Bestandteil dieser Version. Beispiel für Wernigerode im Landkreis Harz:

```text
https://api.open-meteo.com/v1/forecast?latitude=51.8368&longitude=10.7856&location_id=1&hourly=precipitation,rain,precipitation_probability&forecast_hours=74&models=best_match&precipitation_unit=mm&timeformat=unixtime&timezone=GMT
```

| Parameter/Feld | Bedeutung |
| --- | --- |
| `forecast_hours=74` | Liefert die aktuelle Stunde, die folgenden 72 Stunden und eine Reservestunde für den 30-Minuten-Cache. Die Anwendung wählt daraus 72 Stundenwerte ab der nächsten vollen UTC-Stunde; dies ist ein stündliches Modellfenster und keine sekundengenaue Integralvorhersage ab dem Abrufzeitpunkt. `forecast_days=3` beginnt dagegen um Mitternacht und deckt nicht notwendigerweise die kommenden 72 Stunden ab. |
| `precipitation` | Gesamtniederschlag als Wasseräquivalent, mm je Stunde. Nicht zu `rain` addieren. |
| `rain` | Regenanteil, mm je Stunde. Je nach Modell sind weitere Niederschlagskomponenten getrennt. |
| `precipitation_probability` | Wahrscheinlichkeit von Niederschlag in Prozent; keine Hochwasserwahrscheinlichkeit. Fehlende Werte bleiben `null`. |
| `models=best_match` | Automatische Auswahl beziehungsweise Kombination geeigneter Modelle durch Open-Meteo. |
| `timeformat=unixtime` | Epochensekunden, im eigenen JSON in eindeutige UTC-Zeitstempel umwandeln. |
| `timezone=GMT` | Eindeutiger interner Zeitbezug; Anzeige lokal in `Europe/Berlin`. |

Die Anwendung setzt ausdrücklich `models=best_match` für Open-Meteos automatische Modellauswahl. `models=dwd_icon_seamless` ist im offiziellen Controller als Modellwahl vorhanden, muss aber für alle angeforderten Variablen separat geprüft werden; insbesondere sind Niederschlagswahrscheinlichkeiten nicht für jede deterministische Modellkonfiguration verfügbar. Die Oberfläche darf nicht behaupten, jede Prognose stamme ausschließlich aus ICON-D2.

Die JSON-Antwort enthält unter anderem `latitude`, `longitude`, `utc_offset_seconds`, `hourly_units` und `hourly`. Unter `hourly` stehen die angeforderten parallelen Arrays `time`, `precipitation`, `rain` und `precipitation_probability`. Das dokumentierte zusätzliche Feld `temperature_2m` wäre grundsätzlich verfügbar, wird hier jedoch weder angefragt noch ausgegeben. Es dürfen nur endliche Werte mit plausiblen Einheiten übernommen werden. Die Anwendung zeigt die angefragten Ortskoordinaten. Zurückgelieferte Rasterkoordinaten werden intern zur Plausibilisierung der Zuordnung geprüft; sie sind kein vermessener Standort und werden derzeit nicht separat im öffentlichen HND-Prognose-JSON veröffentlicht. `generationtime_ms` ist die Rechenzeit der HTTP-Anfrage, **kein Erstellungszeitpunkt des Wettermodells**.

Mehrere Koordinaten können als gleich lange kommaseparierte `latitude`-/`longitude`-Listen abgefragt werden. Dann kommt eine Liste von Standortantworten zurück. Explizite, gleich lange `location_id`-Listen mit Ganzzahlen **ab 1** ermöglichen eine robuste Zuordnung. Der offizielle JSON-Writer lässt `location_id: 0` weg; die Null darf deshalb nicht blind als erforderliches Feld vorausgesetzt werden. Zeitfenster und Reihen müssen pro Standort geprüft werden. `start_hour` und `end_hour` werden ebenfalls unterstützt, dürfen aber nicht gemeinsam mit `forecast_hours` verwendet werden. Nicht verfügbare Stunden dürfen nicht als 0 mm gezählt werden. Eine 24-/72-Stunden-Summe darf nur bei vollständig vorhandenen Werten des jeweiligen Fensters als vollständig ausgewiesen werden.

Die Niederschlags-Zeitstempel markieren das Ende des vorangegangenen stündlichen Intervalls. Ausgegeben werden die nächsten 72 Intervalle mit einem Endzeitpunkt nach dem Abfragezeitpunkt. Das erste Intervall kann damit bereits teilweise verstrichen sein; die Summe ist keine sekundengenaue 72-Stunden-Integration ab dem Abruf. Niederschlag und Regen werden getrennt aus der Modellantwort übernommen und nicht addiert. Unter `best_match` können Modellkombinationen und Interpolation zu Unterschieden zwischen Komponenten führen; insbesondere darf aus `rain` und `precipitation` keine künstlich erzwungene Massenbilanz abgeleitet werden.

Die eigene **Niederschlagsbelastung** ist eine nicht kalibrierte Orientierungsklasse, keine Hochwasserwarnung. „Hoch“ gilt bei mindestens 30 mm/24 h, 60 mm/72 h, 15 mm/1 h oder 25 mm/6 h; „erhöht“ bei mindestens 15 mm/24 h, 30 mm/72 h, 8 mm/1 h oder 15 mm/6 h, andernfalls „niedrig“. Stunden- und Sechsstunden-Maxima beziehen sich auf das 72-Stunden-Fenster. Klassen und Maxima werden nur aus vollständig vorhandenen 72 Niederschlagswerten gebildet. Eine niedrige Klasse ist keine Entwarnung. Die Schwellen sind eigene Produktkonventionen, keine übernommenen amtlichen Warnkriterien.

## GloFAS: sieben tägliche Modellwerte an unvalidierten Rasterpunkten

Basis-URL: `https://flood-api.open-meteo.com/v1/flood`

Die Implementierung fragt ausschließlich `river_discharge_mean` an den folgenden zwei Punkten ab. Sie erscheinen in der Sachsen-Anhalt- und Deutschlandansicht. Die Deutschlandansicht erweitert die Prognoseabdeckung nicht über Sachsen-Anhalt hinaus. Im Landkreis Harz wird bewusst keine GloFAS-Reihe angeboten. Die Zuordnung der Modellzellen zum jeweiligen realen Gewässer ist **nicht validiert**. Ortsnamen beschreiben daher nur den Abfrageraum:

- [Modellrasterpunkt im Raum Magdeburg](https://flood-api.open-meteo.com/v1/flood?latitude=52.130&longitude=11.645&location_id=1&daily=river_discharge_mean&forecast_days=7&models=forecast_v4&timeformat=unixtime&timezone=GMT).
- [Modellrasterpunkt im Raum Halle](https://flood-api.open-meteo.com/v1/flood?latitude=51.485&longitude=11.960&location_id=2&daily=river_discharge_mean&forecast_days=7&models=forecast_v4&timeformat=unixtime&timezone=GMT).

```text
https://flood-api.open-meteo.com/v1/flood?latitude=52.130&longitude=11.645&location_id=1&daily=river_discharge_mean&forecast_days=7&models=forecast_v4&timeformat=unixtime&timezone=GMT
```

Die offizielle API benennt `forecast_v4`, `seamless_v4` und `consolidated_v4` sowie entsprechende v3-Varianten. `forecast_v4` ist hier eine bewusste Auswahl des GloFAS-v4-Vorhersageprodukts. Im offiziellen Controller wird es aus dem Forecast- und ergänzenden GloFAS-Datenbestand gespeist. Die Anwendung prüft deshalb dennoch die tatsächlichen Daten und darf einen alten Datensatz nicht durch einen neuen Abrufzeitpunkt zur aktuellen Vorhersage erklären.

| Feld | Bedeutung |
| --- | --- |
| `daily.time` | Mit `timeformat=unixtime` Epochensekunden des jeweiligen Tagesbeginns in UTC. Die sieben Tage schließen den heutigen UTC-Kalendertag ein. |
| `daily.river_discharge_mean` | Mittel der Ensemblemitglieder für den täglichen Abfluss in m³/s. |
| `daily_units` | Erwartete Einheiten prüfen; keine automatische Interpretation als Zentimeter. |
| `latitude`, `longitude` | Tatsächlich gewählte Modellrasterzelle aus der Anbieterantwort. Die Ortsnähe ist keine validierte Zuordnung zu einem Fluss. |

`river_discharge` allein ist nicht ausdrücklich der Ensemble-Mittelwert; deshalb wird `river_discharge_mean` angefordert. Der Open-Meteo-Code berechnet das Mittel über 51 Vorhersagemitglieder. Die ebenfalls dokumentierten Anbieterfelder `river_discharge_p25` und `river_discharge_p75` werden in dieser HND-Version **nicht abgefragt oder angezeigt**. Das Ensemble-Mittel allein bildet die Modellunsicherheit daher nicht vollständig ab. Für eine spätere Erweiterung: Das Intervall P25–P75 umfasst die mittleren 50 Prozent der Modellmitglieder. Es ist **kein statistisch kalibriertes 50-Prozent-Vertrauensintervall für den tatsächlichen Abfluss** und keine Überflutungswahrscheinlichkeit.

GloFAS v4 arbeitet laut Quellcode auf einem Raster von 0,05° und mit Tagesschritten; im Bereich Sachsen-Anhalt sind das etwa 5,6 km in Nord-Süd- und 3,4 km in Ost-West-Richtung. Das Modell aktualisiert sich ungefähr täglich. Kleine Harzgewässer, Starkregen innerhalb weniger Stunden, lokale Rückstaueffekte und konkrete Talsperrensteuerung sind damit nicht zuverlässig abgebildet. Deshalb keine GloFAS-Hochwasserprognosen für Holtemme, Selke, Ilse, Zillierbach oder einzelne Bode-Zuflüsse behaupten. Die beiden Rasterzellen brauchen zuerst eine Prüfung gegen das GloFAS-Modellflussnetz und einen lokalen Vergleich mit zugehörigen Messwerten, bevor überhaupt eine belastbare Gewässerzuordnung behauptet werden kann. Anschließend wäre eine eigenständige fachliche Prüfung nötig, um daraus eine Pegelprognose abzuleiten.

Eine Live-Diagnose illustriert das Problem: Die Anfrage bei 51,485° N / 11,960° E wurde am 9. Oktober 2026 auf die Rasterzelle 51,475006° N / 11,975006° E abgebildet und lieferte für den aktuellen Tag 0,28 m³/s. Eine benachbarte westliche Zelle bei 51,475006° N / 11,925003° E lieferte 11,22 m³/s. Diese Unterschiede belegen eine starke Abhängigkeit von der gewählten Rasterzelle; sie beweisen weder, welche Zelle die Saale modelliert, noch welcher Wert am realen Fluss zutrifft. Es wird deshalb **nicht willkürlich auf den größeren Nachbarwert umgeschaltet**. Beide HND-Modellpunkte tragen eine ausdrückliche Kennzeichnung der fehlenden Gewässerzuordnung. Die genannten Zahlen dokumentieren die technische Prüfung und sind keine aktuelle Warn- oder Lageauskunft.

Fehlende, negative, nicht endliche oder zeitlich unpassende Abflusswerte werden nicht dargestellt. Bei einer Antwort mit ausschließlich `null` bleiben alle Abflusswerte nicht verfügbar; die Erreichbarkeit des Anbieters allein bedeutet keine vollständige Modellreihe. Keine synthetischen Ersatzreihen oder alten Testwerte als Live-Prognose verwenden. Ein Modellanstieg darf als solcher beschrieben werden; ohne lokal validierte Schwellen gibt es daraus keine Hochwasserwarnstufe.

## Nutzungsbedingungen und Attribution

Die API-Daten stehen laut Open-Meteo unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Erforderlich sind angemessene Namensnennung, ein Lizenzlink und die Kennzeichnung von Bearbeitungen, zum Beispiel „Wetterdaten: Open-Meteo · CC BY 4.0 · Stundenwerte zu 24-Stunden-Summen zusammengefasst“. In der Nähe jedes Wetter-/Abflussbereichs muss Open-Meteo verlinkt sein. Für die Modellabflüsse zusätzlich „Copernicus CEMS / GloFAS, bereitgestellt durch Open-Meteo“ nennen. Es darf keine amtliche Billigung der Anwendung suggeriert werden.

Die **Datenlizenz ist von der Nutzung der gehosteten API zu unterscheiden**: Die öffentliche, schlüssellose Open-Meteo-API ist für nichtkommerzielle Nutzung und Fair Use vorgesehen. Laut offiziellem README soll bei mehr als 10.000 Anfragen am Tag Kontakt aufgenommen werden; für kommerzielle Nutzung ist ebenfalls eine Vereinbarung beziehungsweise ein kommerzieller Zugang erforderlich. Die kostenlose HND-API hebt diese Bedingungen nicht auf. Serverseitiger Cache, Standortbündelung und Ratenbegrenzung begrenzen die Last. Den kommerziellen Betrieb erst mit passenden Anbieterbedingungen konfigurieren; niemals einen API-Schlüssel an den Browser liefern.

Der AGPL-Lizenzhinweis des Open-Meteo-Serverquellcodes betrifft die Server-Software. Hier wird deren HTTP-API konsumiert; es wird kein Open-Meteo-Servercode in diese TypeScript-Anwendung kopiert.

## Netzwerk und Abnahme

Erforderliche zusätzliche Hosts: `api.open-meteo.com`, `flood-api.open-meteo.com`; für Dokumentationslinks `open-meteo.com`. Die Zielhosts müssen in der jeweiligen Laufzeit erreichbar sein. Ein gespeicherter Cloud-Konfigurationsentwurf ist noch kein Beleg für einen freigeschalteten Laufzeitzugriff. Bei Coolify muss der Server ausgehend HTTPS erreichen können.

Die Live-Abnahme des Landkreis-Endpunkts am 9. Oktober 2026 um 10:41 Uhr MESZ bestätigte:

- HTTP-Antwort mit `provider.state: "live"`, `stale: false` und „14 von 14 Modellpunkten abrufbar“.
- Fünf Wetterorte im Landkreis Harz, alle mit `completeness: "complete"` und 72 Niederschlagswerten.
- Stundenendpunkte von `2026-10-09T09:00:00.000Z` bis `2026-10-12T08:00:00.000Z`, eindeutig in UTC.
- Keine GloFAS-Reihen im Landkreis; die Anbieterinformation erklärt die fehlende Eignung für kleine Harzbäche.

Die ergänzende Landesabfrage am **9. Oktober 2026 um 10:42 Uhr MESZ (08:42 UTC)** bestätigte zusätzlich 14 Wetterorte aus dem frischen Cache und **2 von 2 live erreichbare GloFAS-Modellpunkte**, jeweils mit sieben endlichen Tageswerten vom 9. bis 15. Oktober 2026. Der Mitschnitt lag unter `/tmp/hnd-forecast-review.json`. Die ursprünglichen Flussnamen dieser frühen Prüfantwort wurden bei der anschließenden fachlichen Prüfung als nicht belegt erkannt und durch die Kennzeichnung unvalidierter Modellrasterpunkte ersetzt. Erfolgreiche Erreichbarkeit und vollständige Arrays sind ausdrücklich keine Validierung einer Gewässerzuordnung.

Der temporäre Landkreis-Prüfmitschnitt lag unter `/tmp/hnd-forecast-district-live.json`; er ist kein eingebauter Fallback und wird nicht als dauerhaft aktuelle Prognose ausgeliefert. Der damalige Abrufzeitpunkt belegt eine erfolgreiche Live-Abfrage, keine Garantie der künftigen Erreichbarkeit. Bei späterem Quellenausfall werden im Dienst höchstens sechs Stunden alte Abrufe ausdrücklich als veraltet gekennzeichnet; fehlende Zukunftsstunden werden nicht mit 0 aufgefüllt.

Technische Ergänzung: Die exakte Einheit `m³/s` und `unixtime` sind im [offiziellen Open-Meteo-SDK](https://github.com/open-meteo/sdk/blob/main/swift/Sources/OpenMeteoSdk/Unit.swift) bestätigt. Das Weglassen von `location_id: 0` steht im [offiziellen JSON-Writer](https://github.com/open-meteo/open-meteo/blob/454d6ef3ef683587afac067f31627088cd111637/Sources/App/Helper/Writer/JsonWriter.swift).
