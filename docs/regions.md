# Sachsen-Anhalt und Landkreis Harz

Die Kennung `harz` bezeichnet **den Landkreis Harz (AGS 15085)**. Sie bezeichnet
weder das Harzgebirge noch dessen niedersächsisches/thüringisches Umland.
`sachsen-anhalt` bezeichnet das gesamte Bundesland (AGS 15), einschließlich des
Landkreises Mansfeld-Südharz. Die deutschlandweite Ansicht bleibt verfügbar.

Pegel und Talsperren werden mit ihren Koordinaten gegen administrative
Polygon-/MultiPolygon-Geometrien geprüft. Löcher und getrennte Gebietsteile
werden berücksichtigt. Punkte direkt auf einer Grenze werden eingeschlossen.
Eine Kamera-Bounding-Box ist **kein** geografischer Mitgliedschaftstest.
Deutschland übernimmt den nationalen Anbieterbestand einschließlich Grenzpegel;
hier erfolgt bewusst kein zusätzlicher Deutschland-Polygonfilter.

Flüsse bleiben mit ihrem vollständigen schematischen Verlauf sichtbar, wenn
mindestens ein Quell-/Mündungs-/Routenpunkt oder ein verbindendes Routensegment
die gewählte Region berührt. Deshalb kann auch ein Fluss, der außerhalb entspringt
und mündet, enthalten sein. Die Kataloglinien sind Näherungen und weder amtlich
vermessene Gewässerachsen noch Einzugsgebietsgrenzen. Sie dürfen insbesondere
nicht als Grundlage für eine Überflutungsberechnung verwendet werden.

## Herkunft und Genauigkeit der Verwaltungsgrenzen

Die Datei `packages/shared/src/data/administrative-boundaries.json` enthält zwei
unabhängige, aus veröffentlichten BKG-Daten abgeleitete Features. Die Grenzen
wurden nicht frei gezeichnet. Es werden keine aneinanderliegenden, separat
vereinfachten Kreise zu einer Landesgrenze zusammengefügt; damit entstehen keine
künstlichen Löcher an inneren Kreisgrenzen.

| Feature | Datengrundlage | Aufbereitung | Reproduzierbare Quelle |
| --- | --- | --- | --- |
| Sachsen-Anhalt, AGS 15 | BKG VG250, Veröffentlichung 2018 | WGS84, upstream Vereinfachung 20 m; hier Auswahl `SN_L == "15"` | [SBejga/germany-administrative-geojson, Commit bf62bc7](https://github.com/SBejga/germany-administrative-geojson/tree/bf62bc7750a70e441b41e8eb501f44995b9b5cf5), `geojson/germany_states_simplify20.geojson` |
| Landkreis Harz, AGS 15085 | BKG VG250, Stand 01.01.2020 | WGS84, upstream Vereinfachung 200 m; hier Auswahl `AGS == "15085"` | [jgehrcke/covid-19-germany-gae, Commit cbd821b](https://github.com/jgehrcke/covid-19-germany-gae/tree/cbd821bf42942378ffa40add9f9072abd7fcdb9d/geodata), `DE-counties.geojson` |

Abruf: 09.10.2026. Der Abrufzeitpunkt ist **kein neuer Gebietsstand**. Die Daten
sind für regionale Orientierung und Filterung geeignet. Vereinfachungen und der
ältere Stand können die Zuordnung unmittelbar an einer Verwaltungsgrenze
beeinflussen. Sie liefern keine katastergenaue Grenzauskunft. Bei einer
Aktualisierung möglichst beide Features aus derselben aktuellen BKG-VG250-
Veröffentlichung ersetzen und die Regionaltests erneut ausführen.

Die unveränderten heruntergeladenen Quelldateien hatten folgende SHA-256-Werte:

```text
germany_states_simplify20.geojson
c8a5a110fb32d66a43575858f94a09bf71cdfa66a22ffd629e388de1b826b1de

DE-counties.geojson
9e298741a7b56cde2b099ae3435575ffc5794c054e27d39780d46c8d4e940bca
```

Es wurden nur die genannten Features ausgewählt, die ursprünglichen Geometrien
unverändert übernommen und Herkunft, AGS, Jahr, Vereinfachung und Quellenvermerk
als Properties ergänzt. Die JSON-Minifizierung verändert keine Koordinaten.

## Nutzung und Quellenvermerk

Die BKG-Basisdaten werden als offene Bundesgeodaten unter der
[GeoNutzV](https://www.gesetze-im-internet.de/geonutzv/) bereitgestellt. Die
[Nutzungsbedingungen der Landesdaten-Konvertierung](https://github.com/SBejga/germany-administrative-geojson/blob/bf62bc7750a70e441b41e8eb501f44995b9b5cf5/README.md#source-of-data)
dokumentieren ausdrücklich die unentgeltliche kommerzielle und nichtkommerzielle
Nutzung, die Quellenangabe und den Bearbeitungshinweis. Die
[Herkunftsdokumentation der Kreisdaten](https://github.com/jgehrcke/covid-19-germany-gae/blob/cbd821bf42942378ffa40add9f9072abd7fcdb9d/geodata/README.md)
nennt BKG, Datensatz, Datum, Koordinatensystem und Konvertierung; das
Konvertierungsrepository steht unter MIT (Hinweis unten).

Auf der Karte muss bei Anzeige dieser Grenzen folgender Quellenvermerk sichtbar
sein, zusätzlich zu OpenFreeMap/OpenMapTiles/OpenStreetMap:

> © GeoBasis-DE / BKG 2018, 2020 (Daten bearbeitet)

Verlinkung: <https://www.bkg.bund.de/>. Die GeoJSON-Features enthalten den
jeweiligen Einzelvermerk, den Quellenlink, die Lizenzreferenz und den Datenstand,
sodass diese Angaben auch bei API-Weitergabe erhalten bleiben.

### MIT-Hinweis für die GeoJSON-Konvertierung von Jan-Philip Gehrcke

```text
MIT License

Copyright (c) 2020 Jan-Philip Gehrcke

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
