# Prüfung der Messquellen am 9. Oktober 2026

Diese Prüfung betrifft tatsächlich abgerufene öffentliche Betreiber- und Behördenquellen. Die genannten Momentwerte sind ein Prüfprotokoll, keine in die Anwendung eingebauten Messwerte. Die API ruft die Quellen regelmäßig ab und speichert empfangene Beobachtungen in SQLite.

## Talsperren

Der [Talsperrenbetrieb Sachsen-Anhalt](https://www.talsperrenbetrieb-lsa.de/wasserstaende-talsperren/) verlinkt seinen [öffentlichen WISKI-Dienst](https://www.talsperrenbetrieb.de/#Talsperren). Die Betreiberseite bezeichnet die Angaben als ungeprüfte, normalerweise täglich aktualisierte Rohdaten. Dessen [Messwert-Layer 1300](https://www.talsperrenbetrieb.de/tsb/data/internet/layers/1300/index.json) enthält individuelle Zeitstempel pro Parameter. Der [Stationskatalog](https://www.talsperrenbetrieb.de/tsb/data/internet/stations/stations.json) belegt Stationsnummern und Positionen.

| Katalog-ID | Betreiber-Nummer | Besonderheit |
| --- | --- | --- |
| rappbode | 579430 | Beckeninhalt und Beckenpegel |
| wendefurth | 579005 | Beckeninhalt, Pegel, Zu- und Abfluss |
| koenigshuette | 579000 | Überleitungssperre Königshütte |
| hassel | 579530 | Vorsperre Hassel |
| rappbode-vorsperre | 579420 | Eigene Anlage, getrennt von Rappbode |
| mandelholz | 579320 | Betreibername „HWR Kalte Bode“ |
| wippra | 578400 | Talsperre, **nicht** HRB Wippra 5784005 |
| kelbra | 575404 | Beim Abruf nur aktueller Zufluss, kein Beckeninhalt |
| zillierbach | 579756 | Beckeninhalt, Pegel und Zufluss |
| kiliansteich | 5796021 | Beckeninhalt und Pegel |
| teufelsteich | 5796041 | Beckeninhalt und Pegel |

Auswertung: `L1` Beckeninhalt in hm³ (= Mio. m³), `L2` Beckenpegel in m (öffentliche Tabelle: mNHN), `L4` Zuflussmenge und `L6` Abflussmenge in m³/s. Der Adapter prüft Bezeichnung und Einheit. Nullwerte bleiben fehlend; eine echte numerische Null bleibt Null. Individuelle Messzeitpunkte bleiben erhalten. TSB gilt nach 36 Stunden als älter; ein frischer Zufluss verjüngt keinen alten Beckeninhalt. Es wird kein TSB-Füllgrad aus den unterschiedlichen saisonalen Stauzielen oder dem Gesamtstauraum geschätzt.

Die [Harzwasserwerke](https://www.harzwasserwerke.de/infoservice/aktuelle-talsperrendaten/) beziehen ihre sechs öffentlichen Momentwerte über den auf ihrer Webseite verwendeten JSON-Dienst `wp-content/themes/Avada-Child-Theme/barrageData/barrageDataCall.php`. `m=getTsMap` beschreibt die TALIS-Quelldateien; `m=getReducedAndSplittedTextData&url=…` liefert `datum`, `stauinhalt`, `zufluss`, `abgabe`. Verwendet werden die sechs festen Betreiberzuordnungen ECK, GRA, INN, ODE, OKE und SOE. Direkter Abruf einzelner TXT-Dateien lieferte HTTP 500; deshalb wird derselbe öffentliche JSON-Endpunkt wie auf der Betreiberwebseite genutzt.

Die [TALIS-Detailseite Ecker](https://www.harzwasserwerke.de/infoservice/talis-talsperrendaten/talis-daten-eckertalsperre/) erklärt die Zeitbasis ausdrücklich als MEZ/Winterzeit. Der Adapter rechnet ganzjährig mit UTC+01, auch im Sommer. Nach zwei Stunden gelten HWW-Werte als älter. Die optionalen HWW-Prozentwerte werden aus empfangenem Inhalt und den bereits einzeln belegten Speicherkapazitäten berechnet, entsprechend gekennzeichnet und nicht als gemessene Beobachtungen gespeichert. Ein Füllgrad ist keine Hochwasserwarnklasse.

Prüfergebnis um 14:15 Uhr MESZ: 18 Kataloganlagen, davon 17 mit verfügbaren Betreiberparametern. Für 16 gab es einen Stauinhalt; Kelbra lieferte nur Zufluss. Beim Oderteich ist keine Messreihe in den angebundenen öffentlichen Feeds verfügbar. Die Anwendung zeigt diese Unterschiede ausdrücklich.

## Deutschlandkarte und Pegelidentitäten

Die [öffentliche LHP-Schnittstelle](https://api.hochwasserzentralen.de/public/v1/data/stations?format=json) liefert Standorte und Warnklassen, **keine** numerischen Wasserstände. Ein Liveabruf ergab 1.583 Standorte, darunter 216 ohne `lhpClass` (181 davon in Mecklenburg-Vorpommern) und 78 mit der amtlichen Kennzeichnung `-1`. Solche fehlenden Angaben lassen sich fachlich nicht durch Grün ersetzen. Überalterte Klassen werden ebenfalls nicht als aktuelle Entwarnung ausgegeben.

[PEGELONLINE / WSV](https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?includeTimeseries=true&includeCurrentMeasurement=true) hatte 786 Standorte. 180 amtliche Stationsnummern stimmten mit LHP-Nummern überein und lagen am selben Standort. Bisher erschienen Landes- und WSV-Identitäten getrennt, wodurch ein grauer Punkt einen amtlich klassifizierten Punkt verdecken konnte. LHP-Klicks führten zudem nicht zur WSV-Zeitreihe.

Die neue Zuordnung verlangt eine eindeutige identische amtliche Nummer, kompatible Koordinaten sowie denselben normalisierten Namen oder dasselbe Gewässer. Räumliche Nähe allein reicht nicht. Der gemeinsame Kartenpunkt behält seine LHP-ID und Warnklasse; `measurementSourceId` trägt die tatsächliche WSV-ID. Die ursprüngliche WSV-UUID bleibt über Detail- und History-Endpunkte abrufbar. Bei mehreren Kandidaten wird nicht zusammengeführt.

Ein zusätzlicher Fehler lag im LHW-Katalog: Er enthält 219 Standorte, darunter 76 außerhalb Sachsen-Anhalts aus Nachbarländern und dem WSV-Netz. Diese wurden bislang als weitere `ST_<Nummer>`-Punkte importiert, obwohl nur die 143 Standorte innerhalb Sachsen-Anhalts Messwerte erhielten. Der LHW-Adapter beschränkt seine Übersicht nun auf Sachsen-Anhalt; echte Standorte außerhalb bleiben über ihre LHP-/WSV-Identitäten erhalten. Bereits gespeicherte, anhand des LHW-Katalogs bestätigte externe Alt-ST-IDs werden nicht wieder als zweite Marker eingeblendet.

## Niedersachsen

Der [NLWKN-Webservice und sein offizielles Benutzerhandbuch](https://www.pegelonline.nlwkn.niedersachsen.de/pdf/BenutzerhandbuchWebservicePegelonline.pdf) ermöglichen freie Rohdatenabfragen. Der dort veröffentlichte gemeinsame Schlüssel ist ein öffentlicher Zugangsschlüssel, kein persönliches Geheimnis. Die vorgeschriebene Quellenangabe `www.pegelonline.nlwkn.niedersachsen.de` ist in API und Quellenkatalog enthalten.

Das JSON unter `https://bis.azure-api.net/PegelonlinePublic/REST/stammdaten/stationen/All` lieferte 112 Datensätze, darunter 108 nutzbare beobachtete Wasserstandsreihen. Auswahl: `PAT_ID = 1`, `IstWasserstand = true`, `IstVorhersage = false`, keine Speicherinhaltsreihe. `STA_Nummer` ordnet der LHP-ID `NI_<Nummer>` zu. `STA_ID` dient ausschließlich dem dokumentierten Wochenexport `/station/<ID>/datenspuren/parameter/1/tage/-7`.

Zwei reale Formatfehler mussten berücksichtigt werden: In der Stationsantwort sind die Feldnamen `Latitude` und `Longitude` vertauscht; der Adapter prüft plausible deutsche Koordinaten und akzeptiert auch künftig korrigierte Achsen. `Datum` enthält inkonsistente Zeitzoneninformationen. Deshalb wird ausschließlich `DatumUTC` ausgewertet, sowohl als ISO-Zeit als auch als WCF-Format `/Date(milliseconds)/`. `-888` ist ein Fehlwert. Echte negative Tidepegel und Null bleiben erhalten. Landesmeldestufen werden nicht in bundesweite Warnklassen übersetzt.

## Verläufe, Persistenz und Grenzen

Liveprüfung der fertigen API um 14:16 Uhr MESZ: Deutschlandansicht mit 2.300 eindeutigen Kartenstandorten und 920 numerischen Messwerten. Beispielverläufe: Poppenburg (`NI_4885154`) 671 Beobachtungen, Wittenberge (`BB_503050`, über WSV zugeordnet) 672 Beobachtungen, Thale (`ST_579020`, LHW) 631 Beobachtungen. Die Anzahl verändert sich mit den Quellen.

Nach der zusätzlichen LHW-Katalogbereinigung um 14:22 Uhr war bei einer weiteren Liveprüfung PEGELONLINE vorübergehend nicht abrufbar. Die API kennzeichnete diesen Provider als nicht verfügbar und lieferte 1.711 Standorte mit 245 numerischen Messwerten; alle 18 Talsperren blieben verfügbar, davon 17 mit Betreiberparametern. Momentaufnahmen sind daher kein Nachweis einer dauerhaften Vollabdeckung.

Zeitreihen werden nach tatsächlichem Zeitstempel und Einheit zusammengeführt und sortiert. SQLite enthält ausschließlich empfangene Beobachtungen; es gibt keine Dummyhistorie oder nachträglich erfundenen Zwischenwerte. Bei nicht abrufbarem Wochenexport werden vorhandene echte lokale Beobachtungen mit klarer Cache-Kennzeichnung zurückgegeben. Stationen und letzte Beobachtungen bleiben auch bei längerem Quellenausfall sichtbar, ohne alte Warnklassen zu übernehmen.

Die Wasserstandabdeckung der übrigen Länder ist weiterhin nicht vollständig. Ein LHP-Standort kann eine aktuelle amtliche Warnklasse besitzen, obwohl hier keine Wasserstandsreihe angebunden ist. Umgekehrt kann eine aktuelle WSV-/NLWKN-Messung ohne amtliche Warnklasse vorliegen. Beide Zustände müssen getrennt dargestellt werden. LHW hatte bei der Liveprüfung 2 von 143 angefragten Reihen ohne aktuellen Abruf; die Provideranzeige kennzeichnet diese Teilabdeckung.

Gezielte Regressionstests prüfen die Winterzeitbasis von HWW, TSB-Teilwerte und Alter, Null-/Fehlwerte, NLWKN-Koordinaten und WCF-Zeiten, Ausschluss von Prognosen, eindeutige Pegelidentität und das Routing von LHP-IDs zu WSV-Verläufen. Hinzu kommen längere Quellenausfälle mit Wiederherstellung, Teilfehler bei LHW-Reihen und Ausschluss falscher externer ST-Dubletten. Die Gesamtprüfung einschließlich SQLite-Neustarttests lag nach der Datenintegration bei 91 bestandenen API-Tests.
