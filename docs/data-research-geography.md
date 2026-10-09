# Geografischer Datenkatalog

Stand: 9. Oktober 2026. Der Katalog in `packages/shared/src/catalog.ts` ist ein redaktioneller Ausgangspunkt mit Schwerpunkt Harz und Harzvorland. Er enthält **27 Flüsse, 16 Talsperren beziehungsweise Speicher und 15 Quellenverweise** (9 Fachportale und 6 konkret geprüfte Betreibersteckbriefe). Er ist keine vollständige Gewässerinventur Deutschlands oder Sachsen-Anhalts.

## Datenqualität und Herkunft

Die Fluss- und Speicherbeschreibungen wurden als redaktionelle Orientierung zusammengestellt. Die angegebenen Koordinaten und Ortsfolgen sind **ungeprüfte, schematische Näherungen**, keine aus amtlichen GIS-Daten abgeleiteten Linien. Alle Fluss- und Speichereinträge tragen `geometryAccuracy: "approximate"` und `researchVerified: false`, weil die Datensätze als Ganzes einschließlich der Koordinaten noch nicht verifiziert sind. Bei sechs Speichern kennzeichnet `verifiedFields` die tatsächlich anhand der Betreibersteckbriefe geprüften Teilfelder Name, Betreiber und Kapazität. Die sechs zugehörigen Einzelquellen tragen `researchVerified: true` und einen Abrufzeitpunkt. Die Ortsfolge `route` verbindet ausgewählte Stationen zwischen Quelle beziehungsweise Ursprung und Mündung; sie bildet keine Flussschlingen, Nebenarme oder wasserbaulichen Verzweigungen ab. Ein Ursprung kann auch ein Zusammenfluss sein, etwa bei Bode und Weser.

Amtliche Betreiber- und Fachportale sind als **Anlaufstellen für die weitere Prüfung** verlinkt. Ein Quellenlink allein belegt noch nicht jede Einzelangabe. Es wurden keine Flusslängen, Speicherinhalte, Wasserstände, Durchflüsse, Stauziele, aktuellen Füllstände oder Warnstufen erfunden. Das optionale Feld `lengthKm` bleibt bis zur Prüfung belastbarer Einzelbelege leer. `capacityMillionM3` ist ausschließlich für die sechs unten einzeln belegten HWW-Talsperren befüllt; bei allen übrigen Speichern bleibt es leer. Ein baulicher Speicherinhalt ist zudem ausdrücklich kein aktueller Füllstand.

Zu Beginn dieser Arbeit hat ein vorgeschalteter Proxy die Abfragen von `www.talsperren-lsa.de`, `www.harzwasserwerke.de`, `hnd.sachsen-anhalt.de`, `www.nlwkn.niedersachsen.de` und `www.thueringen.de` am 9. Oktober 2026 mit HTTP 403 beim Verbindungsaufbau abgelehnt. Das ist **kein Beleg für einen Ausfall der Fachportale**. Bei einer späteren erneuten Prüfung am selben Tag waren die sechs HWW-Betreibersteckbriefe direkt per HTTPS erreichbar (HTTP 200); ihre baulichen Speicherkapazitäten sind unten belegt. `www.talsperren-lsa.de` wurde bei der erneuten Prüfung weiterhin mit Proxy-HTTP-403 abgewiesen. Deshalb bleiben insbesondere Rappbode-Kapazitäten hier unbelegt. Weitere Hostnamen im Quellenkatalog wurden nicht alle direkt auf Erreichbarkeit geprüft. Die öffentliche Fachseite für Sachsen-Anhalt wird hier als Hochwasservorhersagezentrale (HVZ) des LHW geführt; „HND“ ist kein bundesweit einheitlicher Behördenname.

Messstellenmetadaten aus amtlichen Angeboten sind getrennt zu behandeln: Das API-Modul kann einen bundesweiten LHP-Katalog mit tatsächlich gelieferten Pegelkoordinaten bereitstellen. Solche Punktkoordinaten ersetzen nicht die schematischen Flusslinien oder Talsperrenpositionen dieses Katalogs. Historische Messwerte oder Warnstufen aus Testdateien dürfen nicht als aktuelle Lage ausgegeben werden.

## Gewässernetz und Abdeckung

| Raum | Flüsse im Startkatalog | Weiterer Abfluss |
| --- | --- | --- |
| Ost- und Nordostharz | Kalte Bode, Warme Bode, Bode, Rappbode, Hassel, Selke, Holtemme, Zillierbach | Bode → Saale → Elbe |
| Nordharz | Ilse, Ecker, Radau, Oker | Oker → Aller → Weser |
| Nordwestharz | Grane, Innerste | Innerste → Leine → Aller → Weser |
| Südwestharz | Oder (Harz), Söse, Rhume | Rhume → Leine → Aller → Weser |
| Südharz und Goldene Aue | Zorge, Helme | Helme → Unstrut → Saale → Elbe |
| Östliches Harzvorland | Wipper (Sachsen-Anhalt) | Wipper → Saale → Elbe |
| Südliches Vorland | Wipper (Thüringen) | Wipper → Unstrut → Saale → Elbe |
| Überregionale Vorfluter | Unstrut, Saale, Elbe, Leine, Aller, Weser | Elbe beziehungsweise Weser → Nordsee |

Die Harzer Oder ist nicht die Oder an der deutsch-polnischen Grenze. Die zwei hier erfassten Wipper sind unterschiedliche Flüsse. Beide Unterscheidungen stehen auch in den Datensätzen.

## Talsperren und Speicher

| Betreiber als Prüf-Anlaufstelle | Katalogeinträge |
| --- | --- |
| Talsperrenbetrieb Sachsen-Anhalt | Rappbodetalsperre, Talsperre Wendefurth, Überleitungssperre Königshütte, Hasselvorsperre, Rappbodevorsperre, Hochwasserschutzbecken Mandelholz, Talsperre Wippra, Talsperre Kelbra, Zillierbachtalsperre |
| Harzwasserwerke | Okertalsperre, Innerstetalsperre, Granetalsperre, Eckertalsperre, Sösetalsperre, Odertalsperre, Oderteich |

Die Liste enthält unterschiedliche Bauwerks- und Nutzungsarten. Der historische Oderteich gehört zur Oberharzer Wasserwirtschaft und ist nicht die Odertalsperre. Überleitungen zwischen Stauanlagen werden textlich erwähnt, aber noch nicht als hydraulisch vollständiges Netz modelliert. Aussagen über Betrieb, Freiraum oder Hochwasserschutzwirkung lassen sich aus den statischen Einträgen nicht ableiten.

## Amtliche Quellenportale

| ID | Portal | Gegenstand |
| --- | --- | --- |
| `lhw` | [Hochwasservorhersage Sachsen-Anhalt](https://hochwasservorhersage.sachsen-anhalt.de/) | Amtliche Pegel- und Hochwasserinformationen Sachsen-Anhalts |
| `tsb` | [Talsperrenbetrieb Sachsen-Anhalt](https://www.talsperren-lsa.de/) | Talsperren, Bauwerke und Betreiberinformationen |
| `hww` | [Harzwasserwerke](https://www.harzwasserwerke.de/) | Westharzer Talsperren und Oberharzer Wasserwirtschaft |
| `nlwkn` | [NLWKN](https://www.nlwkn.niedersachsen.de/) | Pegel, Hydrologie und Hochwasser in Niedersachsen |
| `tlubn` | [TLUBN](https://tlubn.thueringen.de/) | Pegel, Hydrologie und Hochwasser in Thüringen |
| `pegelonline` | [PEGELONLINE REST API](https://www.pegelonline.wsv.de/webservices/rest-api/v2/) | Pegel der Wasserstraßen- und Schifffahrtsverwaltung; keine Vollabdeckung aller Harzbäche |
| `lhp` | [Länderübergreifendes Hochwasserportal](https://www.hochwasserzentralen.de/) | Einstieg zu den Hochwasserinformationen aller 16 Bundesländer |
| `dwd` | [Deutscher Wetterdienst](https://www.dwd.de/) | Amtliche Wetterwarnungen; nicht gleichbedeutend mit einer Hochwasserwarnung für jeden Fluss |
| `nina` | [Warnung der Bevölkerung](https://warnung.bund.de/) | Amtliche Bevölkerungsschutzwarnungen; keine vollständige Pegeldatenquelle |

Das LHP bündelt die Bundesländer fachlich; ein einziges bundesweites „HND“-System mit allen Talsperrenfüllständen existiert in diesem Katalog nicht. Die kostenfreie Nutzung der eigenen API beseitigt keine Nutzungs- und Lizenzbedingungen der Datenlieferanten. Für jeden zusätzlichen Datensatz müssen Quelle, Lizenz, Attribution, Zeitbezug und Änderungsstand separat dokumentiert werden. Öffentlich erreichbare Webseiten sind nicht automatisch frei zur massenhaften Weiterveröffentlichung.

## Gezielte Erweiterung

1. Netzwerkzugriff auf die genannten Anbieter und deren dokumentierte Datenhosts erlauben; Verfügbarkeit anschließend erneut prüfen.
2. Quellen- und Mündungskoordinaten sowie Flussgeometrien aus geeigneten amtlichen Gewässerdaten übernehmen. Je Layer Nutzungsrechte, Bezugsdatum und räumlichen Umfang erfassen.
3. Stauraum, Stauziel, Höhe und weitere Bauwerksdaten aus Betreibersteckbriefen mit Einzelbeleg ergänzen. Gemessene Inhalte und Abgaben separat mit Messzeit, Einheit und Anbieter integrieren.
4. Weitere Gewässer und Rückhaltebecken in Harz, Mansfelder Land, Eichsfeld und Harzvorland ergänzen; vor einer Vollständigkeitsbehauptung eine explizite räumliche Grenze und Mindestgröße festlegen.
5. Die schematischen Linien dürfen nach externer Validierung durch präzise Linien ersetzt werden. `researchVerified` erst setzen, wenn die jeweilige Aussage tatsächlich geprüft wurde; bloße Erreichbarkeit eines Portals genügt nicht.

## Gespeicherter LHP-Standortkatalog

`apps/api/src/data/lhp-stations-reference.json` enthält **1.589 Pegelstandorte** aus einer gespeicherten Antwort der öffentlichen LHP-API. Der Aufzeichnungszeitpunkt lautet **29. September 2026, 13:43:26 UTC** (`recordedAt: "2026-09-29T13:43:26Z"`). Der Mitschnitt enthält Standorte aus **15 Bundesländern; Hamburg ist in diesem Stand nicht vertreten**. Er ist kein Nachweis einer vollständigen bundesweiten Pegelinventur. Im rechteckigen Harz-Umgebungsfilter (50,9–52,3° N und 9,4–12,2° E) liegen 97 dieser Stationen. Das Rechteck ist eine Anwendungsauswahl und keine amtliche Definition des Harzes.

**Namensnennung:** Quelle: [Länderübergreifendes Hochwasserportal (LHP)](https://www.hochwasserzentralen.de/), [öffentliche Stations-API](https://api.hochwasserzentralen.de/public/v1/data/stations?format=json). Lizenz laut Ursprungsantwort: [Creative Commons Namensnennung 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.de). Die quelleneigenen Felder `sourceName`, `licence` und `licenceName` nennen das LHP und diese Lizenz ausdrücklich.

Die Antwort wurde für diese Arbeit nicht direkt vom LHP abgerufen, sondern aus einem **Drittanbieter-Mitschnitt** im Repository [mwijkhuisen/Waterheight](https://github.com/mwijkhuisen/Waterheight) übernommen. Nachvollziehbarer Stand: Commit [`c83975bb806fb50bbd4139456697cd0e65c70f2e`](https://github.com/mwijkhuisen/Waterheight/tree/c83975bb806fb50bbd4139456697cd0e65c70f2e), Dateien [`de-6-stations.raw`](https://github.com/mwijkhuisen/Waterheight/blob/c83975bb806fb50bbd4139456697cd0e65c70f2e/apps/server/src/adapters/de-6/fixtures/de-6-stations.raw) und [`de-6-stations.meta.json`](https://github.com/mwijkhuisen/Waterheight/blob/c83975bb806fb50bbd4139456697cd0e65c70f2e/apps/server/src/adapters/de-6/fixtures/de-6-stations.meta.json). Die Begleitdatei bezeichnet den Mitschnitt als `synthetic: false`, HTTP-Status 200 und ungekürzt. Diese Dokumentation der Herkunft ist keine unabhängige Prüfung der damaligen Messlage.

**Bearbeitung:** Übernommen wurden ausschließlich Original-ID, Stationsname, Gewässername, Punktkoordinaten, zuständiges Bundesland und Link zur Originalstation. Die GeoJSON-Koordinaten `[Längengrad, Breitengrad]` sind geografische Gradwerte; sie wurden ohne Projektionstransformation in `longitude` und `latitude` übertragen. Ergänzt wurde der oben definierte regionale Filter. Die Anwendung behält die Original-IDs wie `ST_579620` bei.

**Sämtliche historischen Warnklassen, Farben, Zustandsangaben und Messzeitstempel wurden entfernt.** Jede Station hat ausdrücklich `measurement: null`, `discharge: null` und `freshness: "unavailable"`. Der gespeicherte Katalog ermöglicht es, Standorte bei ausgefallenem oder gesperrtem Netzwerk weiterhin anzuzeigen. Er darf weder als aktuelle Messlage noch als aktuelle Entwarnung ausgegeben werden. Das Datum der Aufzeichnung ist kein Messzeitpunkt.

Prüfungen bei der Übernahme: 1.589 eindeutige IDs, GeoJSON-Punktgeometrien, plausible geografische Koordinatenbereiche, exakt abgegrenzte Metadatenfelder, dokumentierter Aufzeichnungszeitpunkt und fehlende Mess-/Warnwerte. Der aktuelle API-Abruf bleibt die Voraussetzung für aktuelle Informationen.


## Direkt geprüfte HWW-Speicherkapazitäten

Am **9. Oktober 2026 um 08:09 UTC** wurden die folgenden Betreibersteckbriefe der Harzwasserwerke direkt über HTTPS abgerufen (jeweils HTTP 200). Im Abschnitt „Staubecken / Wasserwirtschaft“ steht der **Speicherinhalt bei Vollstau**, der ohne Umrechnung als `capacityMillionM3` übernommen wurde:

| Speicher | Speicherinhalt bei Vollstau | Einzelquelle / Source-ID |
| --- | ---: | --- |
| Okertalsperre | 46,85 Mio. m³ | [Betreibersteckbrief](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/okertalsperre/) · `hww-oker` |
| Innerstetalsperre | 19,26 Mio. m³ | [Betreibersteckbrief](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/innerstetalsperre/) · `hww-innerste` |
| Granetalsperre | 46,4 Mio. m³ | [Betreibersteckbrief](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/granetalsperre/) · `hww-grane` |
| Eckertalsperre | 13,27 Mio. m³ | [Betreibersteckbrief](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/eckertalsperre/) · `hww-ecker` |
| Sösetalsperre | 25,5 Mio. m³ | [Betreibersteckbrief](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/soesetalsperre/) · `hww-soese` |
| Odertalsperre | 30,61 Mio. m³ | [Betreibersteckbrief](https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/odertalsperre/) · `hww-oder` |

Diese Werte sind **bauliche Kapazitätsangaben bei Vollstau, keine aktuellen Füllstände**. Es wurde kein aktueller Füllgrad daraus berechnet. Die Prüfung bezieht sich auf Name, Betreiber und den genannten Speicherinhalt; die ungefähren Positionskoordinaten, Flussgeometrien und übrigen Katalogangaben wurden dadurch nicht automatisch bestätigt. Die Speicher behalten daher das konservative Gesamtflag `researchVerified: false`; ihre geprüften Fakten sind feldbezogen unter `verifiedFields` und `verifiedAt` nachvollziehbar. Die sechs konkreten Quellen sind als tatsächlich abgerufen gekennzeichnet.
