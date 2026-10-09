/**
 * Redaktioneller Startkatalog für Harz und Vorland.
 * Keine Vermessungsdaten, Messwerte oder amtlichen Warnungen.
 * Kapazitäten von sechs HWW-Talsperren wurden am 2026-10-09 primär belegt.
 * TSB-Speicherpositionen stammen aus dem Betreiberkatalog; Flussrouten bleiben Näherungen.
 */
export interface GeoPoint {
  name: string;
  lat: number;
  lon: number;
}

export interface River {
  id: string;
  name: string;
  basin: 'Elbe' | 'Weser';
  region: string[];
  /** Nur befüllen, wenn ein belastbarer Einzelbeleg vorliegt. */
  lengthKm?: number;
  source: GeoPoint;
  mouth: GeoPoint;
  /** Schematische Ortsfolge. Keine amtliche Gewässergeometrie. */
  route: GeoPoint[];
  reservoirIds: string[];
  sourceIds: string[];
  description: string;
  geometryAccuracy: 'approximate';
  researchVerified: boolean;
}

export interface ReservoirTelemetry {
  storage?: { timestamp: string; value: number; unit: string };
  level?: { timestamp: string; value: number; unit: string };
  inflow?: { timestamp: string; value: number; unit: string };
  outflow?: { timestamp: string; value: number; unit: string };
  fillPercent?: { timestamp: string; value: number; unit: string };
  freshness: 'current' | 'stale' | 'unavailable';
  sourceUrl: string;
  sourceName: string;
  note?: string;
}

export interface Reservoir {
  id: string;
  name: string;
  riverId?: string;
  type: 'dam' | 'reservoir' | 'pre-dam';
  operator: string;
  region: string[];
  lat: number;
  lon: number;
  /** Kein aktueller Füllstand. Nur belegter baulicher Stauraum. */
  capacityMillionM3?: number;
  /** Teilprüfung einzelner Fakten; keine Bestätigung der Koordinaten. */
  verifiedFields?: Array<'name' | 'operator' | 'capacityMillionM3'>;
  verifiedAt?: string;
  sourceIds: string[];
  description: string;
  geometryAccuracy: 'approximate';
  researchVerified: boolean;
  telemetry?: ReservoirTelemetry;
}

export interface Source {
  id: string;
  name: string;
  operator: string;
  url: string;
  kind: 'official' | 'open-data';
  coverage: string[];
  access: 'link-only' | 'public-api';
  researchVerified: boolean;
  verifiedAt?: string;
}

export const catalogMeta = {
  version: '2026-10-09',
  scope: 'Redaktioneller Startkatalog für Harz, Vorland und wichtige Vorfluter. Keine vollständige Gewässerinventur.',
  geometryNotice: 'Positionen und Flussverläufe sind schematische Näherungen. Nicht für Navigation, Gefahrenabschätzung oder Planung verwenden.',
  verificationNotice: 'Sechs HWW-Speicherkapazitäten und elf TSB-Speicherstandorte sind anhand der Betreiberquellen geprüft. Flussverläufe und weitere Positionen bleiben Näherungen.',
  researchVerified: false,
} as const;

export const rivers: River[] = [
  {
    "id": "bode",
    "name": "Bode",
    "basin": "Elbe",
    "region": [
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Zusammenfluss von Kalter und Warmer Bode bei Königshütte",
      "lat": 51.742,
      "lon": 10.766
    },
    "mouth": {
      "name": "Mündung in die Saale bei Nienburg",
      "lat": 51.84,
      "lon": 11.768
    },
    "route": [
      {
        "name": "Zusammenfluss von Kalter und Warmer Bode bei Königshütte",
        "lat": 51.742,
        "lon": 10.766
      },
      {
        "name": "Wendefurth",
        "lat": 51.746,
        "lon": 10.907
      },
      {
        "name": "Treseburg",
        "lat": 51.719,
        "lon": 10.972
      },
      {
        "name": "Thale",
        "lat": 51.748,
        "lon": 11.031
      },
      {
        "name": "Quedlinburg",
        "lat": 51.786,
        "lon": 11.151
      },
      {
        "name": "Oschersleben",
        "lat": 52.024,
        "lon": 11.225
      },
      {
        "name": "Staßfurt",
        "lat": 51.85,
        "lon": 11.581
      },
      {
        "name": "Mündung in die Saale bei Nienburg",
        "lat": 51.84,
        "lon": 11.768
      }
    ],
    "reservoirIds": [
      "koenigshuette",
      "wendefurth"
    ],
    "sourceIds": [
      "lhw",
      "tsb"
    ],
    "description": "Die Bode entsteht bei Königshütte aus Kalter und Warmer Bode. Über das Bodetal und das nördliche Harzvorland erreicht sie bei Nienburg die Saale.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "kalte-bode",
    "name": "Kalte Bode",
    "basin": "Elbe",
    "region": [
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet am Brockenfeld",
      "lat": 51.792,
      "lon": 10.626
    },
    "mouth": {
      "name": "Zusammenfluss zur Bode bei Königshütte",
      "lat": 51.742,
      "lon": 10.766
    },
    "route": [
      {
        "name": "Quellgebiet am Brockenfeld",
        "lat": 51.792,
        "lon": 10.626
      },
      {
        "name": "Schierke",
        "lat": 51.76,
        "lon": 10.665
      },
      {
        "name": "Elend",
        "lat": 51.744,
        "lon": 10.684
      },
      {
        "name": "Talsperre Mandelholz",
        "lat": 51.735,
        "lon": 10.716
      },
      {
        "name": "Zusammenfluss zur Bode bei Königshütte",
        "lat": 51.742,
        "lon": 10.766
      }
    ],
    "reservoirIds": [
      "mandelholz"
    ],
    "sourceIds": [
      "lhw",
      "tsb"
    ],
    "description": "Der nördliche Quellfluss der Bode entwässert das Gebiet zwischen Brocken und Wurmberg und fließt über Schierke und Elend.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "warme-bode",
    "name": "Warme Bode",
    "basin": "Elbe",
    "region": [
      "Niedersachsen",
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet am Bodebruch, Oberharz",
      "lat": 51.761,
      "lon": 10.601
    },
    "mouth": {
      "name": "Zusammenfluss zur Bode bei Königshütte",
      "lat": 51.742,
      "lon": 10.766
    },
    "route": [
      {
        "name": "Quellgebiet am Bodebruch, Oberharz",
        "lat": 51.761,
        "lon": 10.601
      },
      {
        "name": "Braunlage",
        "lat": 51.726,
        "lon": 10.61
      },
      {
        "name": "Sorge",
        "lat": 51.694,
        "lon": 10.698
      },
      {
        "name": "Tanne",
        "lat": 51.699,
        "lon": 10.723
      },
      {
        "name": "Zusammenfluss zur Bode bei Königshütte",
        "lat": 51.742,
        "lon": 10.766
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "nlwkn",
      "lhw"
    ],
    "description": "Die Warme Bode fließt aus dem Oberharz über Braunlage, Sorge und Tanne nach Königshütte. Die Quellgewässer werden als Große und Kleine Bode bezeichnet.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "rappbode",
    "name": "Rappbode",
    "basin": "Elbe",
    "region": [
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet bei Benneckenstein",
      "lat": 51.667,
      "lon": 10.69
    },
    "mouth": {
      "name": "Mündung in die Bode bei Wendefurth",
      "lat": 51.745,
      "lon": 10.903
    },
    "route": [
      {
        "name": "Quellgebiet bei Benneckenstein",
        "lat": 51.667,
        "lon": 10.69
      },
      {
        "name": "Trautenstein",
        "lat": 51.688,
        "lon": 10.786
      },
      {
        "name": "Rappbodevorsperre",
        "lat": 51.696,
        "lon": 10.813
      },
      {
        "name": "Rappbodetalsperre",
        "lat": 51.727,
        "lon": 10.861
      },
      {
        "name": "Mündung in die Bode bei Wendefurth",
        "lat": 51.745,
        "lon": 10.903
      }
    ],
    "reservoirIds": [
      "rappbode-vorsperre",
      "rappbode"
    ],
    "sourceIds": [
      "lhw",
      "tsb"
    ],
    "description": "Die Rappbode durchfließt das Talsperrensystem des Unterharzes. Unterhalb der Hauptsperre mündet sie im Bereich der Talsperre Wendefurth in die Bode.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "hassel",
    "name": "Hassel",
    "basin": "Elbe",
    "region": [
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet bei Stiege",
      "lat": 51.66,
      "lon": 10.882
    },
    "mouth": {
      "name": "Mündung in den Rappbodestausee",
      "lat": 51.705,
      "lon": 10.861
    },
    "route": [
      {
        "name": "Quellgebiet bei Stiege",
        "lat": 51.66,
        "lon": 10.882
      },
      {
        "name": "Hasselvorsperre",
        "lat": 51.69,
        "lon": 10.865
      },
      {
        "name": "Mündung in den Rappbodestausee",
        "lat": 51.705,
        "lon": 10.861
      }
    ],
    "reservoirIds": [
      "hassel"
    ],
    "sourceIds": [
      "lhw",
      "tsb"
    ],
    "description": "Die Hassel entwässert das Gebiet um Stiege und mündet nach ihrer Vorsperre in die Rappbodetalsperre.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "selke",
    "name": "Selke",
    "basin": "Elbe",
    "region": [
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet bei Stiege",
      "lat": 51.649,
      "lon": 10.885
    },
    "mouth": {
      "name": "Mündung in die Bode bei Rodersdorf",
      "lat": 51.854,
      "lon": 11.263
    },
    "route": [
      {
        "name": "Quellgebiet bei Stiege",
        "lat": 51.649,
        "lon": 10.885
      },
      {
        "name": "Güntersberge",
        "lat": 51.644,
        "lon": 10.98
      },
      {
        "name": "Straßberg",
        "lat": 51.615,
        "lon": 11.048
      },
      {
        "name": "Alexisbad",
        "lat": 51.651,
        "lon": 11.116
      },
      {
        "name": "Mägdesprung",
        "lat": 51.669,
        "lon": 11.131
      },
      {
        "name": "Meisdorf",
        "lat": 51.712,
        "lon": 11.293
      },
      {
        "name": "Hausneindorf",
        "lat": 51.84,
        "lon": 11.274
      },
      {
        "name": "Mündung in die Bode bei Rodersdorf",
        "lat": 51.854,
        "lon": 11.263
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "lhw"
    ],
    "description": "Die Selke verläuft durch den östlichen Unterharz und tritt bei Meisdorf in das Harzvorland ein. Sie mündet bei Rodersdorf in die Bode.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "holtemme",
    "name": "Holtemme",
    "basin": "Elbe",
    "region": [
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet zwischen Brocken und Renneckenberg",
      "lat": 51.81,
      "lon": 10.646
    },
    "mouth": {
      "name": "Mündung in die Bode bei Krottorf",
      "lat": 51.994,
      "lon": 11.18
    },
    "route": [
      {
        "name": "Quellgebiet zwischen Brocken und Renneckenberg",
        "lat": 51.81,
        "lon": 10.646
      },
      {
        "name": "Steinerne Renne",
        "lat": 51.813,
        "lon": 10.716
      },
      {
        "name": "Wernigerode",
        "lat": 51.837,
        "lon": 10.789
      },
      {
        "name": "Derenburg",
        "lat": 51.87,
        "lon": 10.91
      },
      {
        "name": "Halberstadt",
        "lat": 51.898,
        "lon": 11.057
      },
      {
        "name": "Mündung in die Bode bei Krottorf",
        "lat": 51.994,
        "lon": 11.18
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "lhw"
    ],
    "description": "Die Holtemme verbindet den Hochharz mit Wernigerode und Halberstadt und erreicht bei Krottorf die Bode.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "ilse",
    "name": "Ilse",
    "basin": "Weser",
    "region": [
      "Sachsen-Anhalt",
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet am Brocken",
      "lat": 51.807,
      "lon": 10.622
    },
    "mouth": {
      "name": "Mündung in die Oker bei Börßum",
      "lat": 52.067,
      "lon": 10.567
    },
    "route": [
      {
        "name": "Quellgebiet am Brocken",
        "lat": 51.807,
        "lon": 10.622
      },
      {
        "name": "Ilsenburg",
        "lat": 51.866,
        "lon": 10.681
      },
      {
        "name": "Veckenstedt",
        "lat": 51.902,
        "lon": 10.734
      },
      {
        "name": "Wasserleben",
        "lat": 51.921,
        "lon": 10.756
      },
      {
        "name": "Osterwieck",
        "lat": 51.97,
        "lon": 10.712
      },
      {
        "name": "Mündung in die Oker bei Börßum",
        "lat": 52.067,
        "lon": 10.567
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "lhw",
      "nlwkn"
    ],
    "description": "Die Ilse fließt vom Brocken durch das Ilsetal nach Ilsenburg und weiter durch das nördliche Harzvorland zur Oker.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "oker",
    "name": "Oker",
    "basin": "Weser",
    "region": [
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet am Bruchberg",
      "lat": 51.762,
      "lon": 10.474
    },
    "mouth": {
      "name": "Mündung in die Aller bei Müden",
      "lat": 52.525,
      "lon": 10.354
    },
    "route": [
      {
        "name": "Quellgebiet am Bruchberg",
        "lat": 51.762,
        "lon": 10.474
      },
      {
        "name": "Altenau",
        "lat": 51.802,
        "lon": 10.441
      },
      {
        "name": "Okertalsperre",
        "lat": 51.837,
        "lon": 10.464
      },
      {
        "name": "Oker bei Goslar",
        "lat": 51.886,
        "lon": 10.478
      },
      {
        "name": "Vienenburg",
        "lat": 51.953,
        "lon": 10.561
      },
      {
        "name": "Schladen",
        "lat": 52.024,
        "lon": 10.542
      },
      {
        "name": "Wolfenbüttel",
        "lat": 52.161,
        "lon": 10.536
      },
      {
        "name": "Braunschweig",
        "lat": 52.263,
        "lon": 10.523
      },
      {
        "name": "Mündung in die Aller bei Müden",
        "lat": 52.525,
        "lon": 10.354
      }
    ],
    "reservoirIds": [
      "oker"
    ],
    "sourceIds": [
      "nlwkn",
      "hww"
    ],
    "description": "Die Oker entwässert den nordwestlichen Harz. Ihr Lauf verbindet Altenau und den Harzrand mit Wolfenbüttel, Braunschweig und der Aller.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "ecker",
    "name": "Ecker",
    "basin": "Weser",
    "region": [
      "Niedersachsen",
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet am Brocken",
      "lat": 51.798,
      "lon": 10.596
    },
    "mouth": {
      "name": "Mündung in die Oker bei Wiedelah",
      "lat": 51.968,
      "lon": 10.587
    },
    "route": [
      {
        "name": "Quellgebiet am Brocken",
        "lat": 51.798,
        "lon": 10.596
      },
      {
        "name": "Eckertalsperre",
        "lat": 51.841,
        "lon": 10.585
      },
      {
        "name": "Eckertal",
        "lat": 51.885,
        "lon": 10.626
      },
      {
        "name": "Abbenrode",
        "lat": 51.927,
        "lon": 10.625
      },
      {
        "name": "Mündung in die Oker bei Wiedelah",
        "lat": 51.968,
        "lon": 10.587
      }
    ],
    "reservoirIds": [
      "ecker"
    ],
    "sourceIds": [
      "nlwkn",
      "lhw",
      "hww"
    ],
    "description": "Die Ecker bildet abschnittsweise die Grenze zwischen Niedersachsen und Sachsen-Anhalt und fließt über die Eckertalsperre zur Oker.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "radau",
    "name": "Radau",
    "basin": "Weser",
    "region": [
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet am Torfhausmoor",
      "lat": 51.797,
      "lon": 10.533
    },
    "mouth": {
      "name": "Mündung in die Oker bei Vienenburg",
      "lat": 51.961,
      "lon": 10.562
    },
    "route": [
      {
        "name": "Quellgebiet am Torfhausmoor",
        "lat": 51.797,
        "lon": 10.533
      },
      {
        "name": "Radauwasserfall",
        "lat": 51.851,
        "lon": 10.54
      },
      {
        "name": "Bad Harzburg",
        "lat": 51.88,
        "lon": 10.56
      },
      {
        "name": "Vienenburg",
        "lat": 51.95,
        "lon": 10.561
      },
      {
        "name": "Mündung in die Oker bei Vienenburg",
        "lat": 51.961,
        "lon": 10.562
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "nlwkn"
    ],
    "description": "Die Radau fließt vom Hochharz durch Bad Harzburg nach Norden und mündet nahe Vienenburg in die Oker.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "innerste",
    "name": "Innerste",
    "basin": "Weser",
    "region": [
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet bei Buntenbock",
      "lat": 51.774,
      "lon": 10.341
    },
    "mouth": {
      "name": "Mündung in die Leine bei Ruthe",
      "lat": 52.243,
      "lon": 9.813
    },
    "route": [
      {
        "name": "Quellgebiet bei Buntenbock",
        "lat": 51.774,
        "lon": 10.341
      },
      {
        "name": "Wildemann",
        "lat": 51.827,
        "lon": 10.283
      },
      {
        "name": "Lautenthal",
        "lat": 51.869,
        "lon": 10.285
      },
      {
        "name": "Innerstetalsperre",
        "lat": 51.895,
        "lon": 10.283
      },
      {
        "name": "Langelsheim",
        "lat": 51.936,
        "lon": 10.332
      },
      {
        "name": "Hildesheim",
        "lat": 52.152,
        "lon": 9.942
      },
      {
        "name": "Mündung in die Leine bei Ruthe",
        "lat": 52.243,
        "lon": 9.813
      }
    ],
    "reservoirIds": [
      "innerste"
    ],
    "sourceIds": [
      "nlwkn",
      "hww"
    ],
    "description": "Die Innerste entspringt im Oberharz, verläuft über Wildemann und Lautenthal und erreicht über Hildesheim die Leine.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "grane",
    "name": "Grane",
    "basin": "Weser",
    "region": [
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet bei Hahnenklee",
      "lat": 51.858,
      "lon": 10.351
    },
    "mouth": {
      "name": "Mündung in die Innerste bei Langelsheim",
      "lat": 51.942,
      "lon": 10.334
    },
    "route": [
      {
        "name": "Quellgebiet bei Hahnenklee",
        "lat": 51.858,
        "lon": 10.351
      },
      {
        "name": "Granetalsperre",
        "lat": 51.884,
        "lon": 10.37
      },
      {
        "name": "Langelsheim",
        "lat": 51.936,
        "lon": 10.329
      },
      {
        "name": "Mündung in die Innerste bei Langelsheim",
        "lat": 51.942,
        "lon": 10.334
      }
    ],
    "reservoirIds": [
      "grane"
    ],
    "sourceIds": [
      "nlwkn",
      "hww"
    ],
    "description": "Die Grane ist ein Harzzufluss der Innerste und wird oberhalb von Langelsheim in der Granetalsperre aufgestaut.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "soese",
    "name": "Söse",
    "basin": "Weser",
    "region": [
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet am Bruchberg",
      "lat": 51.756,
      "lon": 10.448
    },
    "mouth": {
      "name": "Mündung in die Rhume bei Katlenburg",
      "lat": 51.689,
      "lon": 10.098
    },
    "route": [
      {
        "name": "Quellgebiet am Bruchberg",
        "lat": 51.756,
        "lon": 10.448
      },
      {
        "name": "Riefensbeek-Kamschlacken",
        "lat": 51.728,
        "lon": 10.385
      },
      {
        "name": "Sösetalsperre",
        "lat": 51.735,
        "lon": 10.333
      },
      {
        "name": "Osterode am Harz",
        "lat": 51.728,
        "lon": 10.254
      },
      {
        "name": "Badenhausen",
        "lat": 51.77,
        "lon": 10.204
      },
      {
        "name": "Mündung in die Rhume bei Katlenburg",
        "lat": 51.689,
        "lon": 10.098
      }
    ],
    "reservoirIds": [
      "soese"
    ],
    "sourceIds": [
      "nlwkn",
      "hww"
    ],
    "description": "Die Söse entwässert den südwestlichen Oberharz und fließt über die Sösetalsperre und Osterode zur Rhume.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "oder",
    "name": "Oder (Harz)",
    "basin": "Weser",
    "region": [
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet im Oderbruch",
      "lat": 51.783,
      "lon": 10.572
    },
    "mouth": {
      "name": "Mündung in die Rhume bei Katlenburg",
      "lat": 51.68,
      "lon": 10.12
    },
    "route": [
      {
        "name": "Quellgebiet im Oderbruch",
        "lat": 51.783,
        "lon": 10.572
      },
      {
        "name": "Oderteich",
        "lat": 51.76,
        "lon": 10.535
      },
      {
        "name": "Oderhaus",
        "lat": 51.701,
        "lon": 10.55
      },
      {
        "name": "Odertalsperre",
        "lat": 51.652,
        "lon": 10.468
      },
      {
        "name": "Bad Lauterberg",
        "lat": 51.631,
        "lon": 10.47
      },
      {
        "name": "Hattorf am Harz",
        "lat": 51.65,
        "lon": 10.237
      },
      {
        "name": "Mündung in die Rhume bei Katlenburg",
        "lat": 51.68,
        "lon": 10.12
      }
    ],
    "reservoirIds": [
      "oder",
      "oderteich"
    ],
    "sourceIds": [
      "nlwkn",
      "hww"
    ],
    "description": "Diese Oder ist der Harzfluss im Wesergebiet. Sie fließt durch Oderteich und Odertalsperre über Bad Lauterberg in die Rhume.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "zorge",
    "name": "Zorge",
    "basin": "Elbe",
    "region": [
      "Niedersachsen",
      "Thüringen"
    ],
    "source": {
      "name": "Zusammenfluss von Wolfsbach und Sprakelbach bei Zorge",
      "lat": 51.635,
      "lon": 10.635
    },
    "mouth": {
      "name": "Mündung in die Helme bei Heringen",
      "lat": 51.463,
      "lon": 10.877
    },
    "route": [
      {
        "name": "Zusammenfluss von Wolfsbach und Sprakelbach bei Zorge",
        "lat": 51.635,
        "lon": 10.635
      },
      {
        "name": "Walkenried",
        "lat": 51.584,
        "lon": 10.617
      },
      {
        "name": "Ellrich",
        "lat": 51.586,
        "lon": 10.666
      },
      {
        "name": "Nordhausen",
        "lat": 51.497,
        "lon": 10.791
      },
      {
        "name": "Mündung in die Helme bei Heringen",
        "lat": 51.463,
        "lon": 10.877
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "nlwkn",
      "tlubn"
    ],
    "description": "Die Zorge entsteht im südlichen Harz und fließt über Walkenried, Ellrich und Nordhausen zur Helme.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "wipper",
    "name": "Wipper (Sachsen-Anhalt)",
    "basin": "Elbe",
    "region": [
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet am Auerberg bei Stolberg",
      "lat": 51.588,
      "lon": 10.969
    },
    "mouth": {
      "name": "Mündung in die Saale bei Bernburg",
      "lat": 51.774,
      "lon": 11.757
    },
    "route": [
      {
        "name": "Quellgebiet am Auerberg bei Stolberg",
        "lat": 51.588,
        "lon": 10.969
      },
      {
        "name": "Wippra",
        "lat": 51.573,
        "lon": 11.278
      },
      {
        "name": "Mansfeld",
        "lat": 51.594,
        "lon": 11.453
      },
      {
        "name": "Hettstedt",
        "lat": 51.647,
        "lon": 11.509
      },
      {
        "name": "Aschersleben",
        "lat": 51.759,
        "lon": 11.46
      },
      {
        "name": "Güsten",
        "lat": 51.794,
        "lon": 11.611
      },
      {
        "name": "Mündung in die Saale bei Bernburg",
        "lat": 51.774,
        "lon": 11.757
      }
    ],
    "reservoirIds": [
      "wippra"
    ],
    "sourceIds": [
      "lhw",
      "tsb"
    ],
    "description": "Die Wipper Sachsen-Anhalts fließt aus dem Unterharz über Wippra, Hettstedt und Aschersleben zur Saale. Sie ist von der thüringischen Wipper zu unterscheiden.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "helme",
    "name": "Helme",
    "basin": "Elbe",
    "region": [
      "Thüringen",
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet bei Stöckey",
      "lat": 51.533,
      "lon": 10.502
    },
    "mouth": {
      "name": "Mündung in die Unstrut bei Kalbsrieth",
      "lat": 51.343,
      "lon": 11.333
    },
    "route": [
      {
        "name": "Quellgebiet bei Stöckey",
        "lat": 51.533,
        "lon": 10.502
      },
      {
        "name": "Hesserode",
        "lat": 51.51,
        "lon": 10.731
      },
      {
        "name": "Nordhausen",
        "lat": 51.479,
        "lon": 10.813
      },
      {
        "name": "Heringen",
        "lat": 51.448,
        "lon": 10.877
      },
      {
        "name": "Talsperre Kelbra",
        "lat": 51.443,
        "lon": 10.999
      },
      {
        "name": "Kelbra",
        "lat": 51.436,
        "lon": 11.039
      },
      {
        "name": "Mündung in die Unstrut bei Kalbsrieth",
        "lat": 51.343,
        "lon": 11.333
      }
    ],
    "reservoirIds": [
      "kelbra"
    ],
    "sourceIds": [
      "tlubn",
      "lhw",
      "tsb"
    ],
    "description": "Die Helme entwässert die Goldene Aue am südlichen Harzrand. Die Talsperre Kelbra ist ein wichtiges Bauwerk für den Hochwasserrückhalt im Einzugsgebiet.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "wipper-thueringen",
    "name": "Wipper (Thüringen)",
    "basin": "Elbe",
    "region": [
      "Thüringen"
    ],
    "source": {
      "name": "Quellgebiet bei Worbis",
      "lat": 51.42,
      "lon": 10.365
    },
    "mouth": {
      "name": "Mündung in die Unstrut bei Sachsenburg",
      "lat": 51.275,
      "lon": 11.164
    },
    "route": [
      {
        "name": "Quellgebiet bei Worbis",
        "lat": 51.42,
        "lon": 10.365
      },
      {
        "name": "Bleicherode",
        "lat": 51.44,
        "lon": 10.576
      },
      {
        "name": "Sondershausen",
        "lat": 51.371,
        "lon": 10.87
      },
      {
        "name": "Göllingen",
        "lat": 51.343,
        "lon": 11.016
      },
      {
        "name": "Mündung in die Unstrut bei Sachsenburg",
        "lat": 51.275,
        "lon": 11.164
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "tlubn"
    ],
    "description": "Die thüringische Wipper entwässert Teile von Eichsfeld und Hainleite südlich des Harzes. Sie mündet in die Unstrut, nicht in die Saale.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "rhume",
    "name": "Rhume",
    "basin": "Weser",
    "region": [
      "Niedersachsen"
    ],
    "source": {
      "name": "Rhumequelle bei Rhumspringe",
      "lat": 51.591,
      "lon": 10.309
    },
    "mouth": {
      "name": "Mündung in die Leine bei Northeim",
      "lat": 51.726,
      "lon": 9.97
    },
    "route": [
      {
        "name": "Rhumequelle bei Rhumspringe",
        "lat": 51.591,
        "lon": 10.309
      },
      {
        "name": "Gieboldehausen",
        "lat": 51.61,
        "lon": 10.216
      },
      {
        "name": "Katlenburg",
        "lat": 51.683,
        "lon": 10.101
      },
      {
        "name": "Northeim",
        "lat": 51.711,
        "lon": 9.999
      },
      {
        "name": "Mündung in die Leine bei Northeim",
        "lat": 51.726,
        "lon": 9.97
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "nlwkn"
    ],
    "description": "Die Rhume nimmt die südwestlichen Harzflüsse Oder und Söse auf und führt ihr Wasser zur Leine.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "unstrut",
    "name": "Unstrut",
    "basin": "Elbe",
    "region": [
      "Thüringen",
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet bei Kefferhausen",
      "lat": 51.313,
      "lon": 10.283
    },
    "mouth": {
      "name": "Mündung in die Saale bei Naumburg",
      "lat": 51.184,
      "lon": 11.799
    },
    "route": [
      {
        "name": "Quellgebiet bei Kefferhausen",
        "lat": 51.313,
        "lon": 10.283
      },
      {
        "name": "Mühlhausen",
        "lat": 51.208,
        "lon": 10.466
      },
      {
        "name": "Bad Langensalza",
        "lat": 51.117,
        "lon": 10.646
      },
      {
        "name": "Sömmerda",
        "lat": 51.161,
        "lon": 11.116
      },
      {
        "name": "Artern",
        "lat": 51.363,
        "lon": 11.287
      },
      {
        "name": "Nebra",
        "lat": 51.285,
        "lon": 11.575
      },
      {
        "name": "Freyburg",
        "lat": 51.214,
        "lon": 11.767
      },
      {
        "name": "Mündung in die Saale bei Naumburg",
        "lat": 51.184,
        "lon": 11.799
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "tlubn",
      "lhw"
    ],
    "description": "Die Unstrut nimmt die Helme auf und verbindet das südliche Harzvorland mit der Saale. Der vollständige Lauf reicht bis ins Eichsfeld.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "saale",
    "name": "Saale",
    "basin": "Elbe",
    "region": [
      "Bayern",
      "Thüringen",
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet am Großen Waldstein im Fichtelgebirge",
      "lat": 50.119,
      "lon": 11.828
    },
    "mouth": {
      "name": "Mündung in die Elbe bei Barby",
      "lat": 51.954,
      "lon": 11.913
    },
    "route": [
      {
        "name": "Quellgebiet am Großen Waldstein im Fichtelgebirge",
        "lat": 50.119,
        "lon": 11.828
      },
      {
        "name": "Hof",
        "lat": 50.316,
        "lon": 11.913
      },
      {
        "name": "Saalfeld",
        "lat": 50.65,
        "lon": 11.365
      },
      {
        "name": "Jena",
        "lat": 50.928,
        "lon": 11.593
      },
      {
        "name": "Naumburg",
        "lat": 51.172,
        "lon": 11.814
      },
      {
        "name": "Merseburg",
        "lat": 51.356,
        "lon": 12.004
      },
      {
        "name": "Halle (Saale)",
        "lat": 51.48,
        "lon": 11.96
      },
      {
        "name": "Bernburg",
        "lat": 51.799,
        "lon": 11.73
      },
      {
        "name": "Mündung in die Elbe bei Barby",
        "lat": 51.954,
        "lon": 11.913
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "lhw",
      "tlubn",
      "pegelonline",
      "lhp"
    ],
    "description": "Die Saale ist der Vorfluter für Bode, Wipper und Unstrut. Sie fließt aus dem Fichtelgebirge durch Thüringen und Sachsen-Anhalt zur Elbe.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "elbe",
    "name": "Elbe",
    "basin": "Elbe",
    "region": [
      "Tschechien",
      "Sachsen",
      "Sachsen-Anhalt",
      "Brandenburg",
      "Niedersachsen",
      "Mecklenburg-Vorpommern",
      "Schleswig-Holstein",
      "Hamburg"
    ],
    "source": {
      "name": "Elbquelle im Riesengebirge",
      "lat": 50.776,
      "lon": 15.536
    },
    "mouth": {
      "name": "Mündung in die Nordsee bei Cuxhaven",
      "lat": 53.892,
      "lon": 8.72
    },
    "route": [
      {
        "name": "Elbquelle im Riesengebirge",
        "lat": 50.776,
        "lon": 15.536
      },
      {
        "name": "Hradec Králové",
        "lat": 50.211,
        "lon": 15.828
      },
      {
        "name": "Mělník",
        "lat": 50.347,
        "lon": 14.473
      },
      {
        "name": "Dresden",
        "lat": 51.055,
        "lon": 13.737
      },
      {
        "name": "Torgau",
        "lat": 51.559,
        "lon": 13.01
      },
      {
        "name": "Wittenberg",
        "lat": 51.862,
        "lon": 12.645
      },
      {
        "name": "Dessau-Roßlau",
        "lat": 51.885,
        "lon": 12.238
      },
      {
        "name": "Magdeburg",
        "lat": 52.128,
        "lon": 11.647
      },
      {
        "name": "Wittenberge",
        "lat": 52.99,
        "lon": 11.75
      },
      {
        "name": "Hamburg",
        "lat": 53.538,
        "lon": 9.976
      },
      {
        "name": "Mündung in die Nordsee bei Cuxhaven",
        "lat": 53.892,
        "lon": 8.72
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "pegelonline",
      "lhw",
      "lhp"
    ],
    "description": "Die Elbe verbindet das Riesengebirge mit der Nordsee. Über die Saale gelangen die östlichen und südöstlichen Harzabflüsse in dieses Stromgebiet.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "leine",
    "name": "Leine",
    "basin": "Weser",
    "region": [
      "Thüringen",
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet bei Leinefelde",
      "lat": 51.388,
      "lon": 10.322
    },
    "mouth": {
      "name": "Mündung in die Aller bei Schwarmstedt",
      "lat": 52.706,
      "lon": 9.602
    },
    "route": [
      {
        "name": "Quellgebiet bei Leinefelde",
        "lat": 51.388,
        "lon": 10.322
      },
      {
        "name": "Göttingen",
        "lat": 51.534,
        "lon": 9.925
      },
      {
        "name": "Northeim",
        "lat": 51.715,
        "lon": 9.978
      },
      {
        "name": "Alfeld",
        "lat": 51.986,
        "lon": 9.826
      },
      {
        "name": "Hannover",
        "lat": 52.366,
        "lon": 9.73
      },
      {
        "name": "Neustadt am Rübenberge",
        "lat": 52.502,
        "lon": 9.463
      },
      {
        "name": "Mündung in die Aller bei Schwarmstedt",
        "lat": 52.706,
        "lon": 9.602
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "nlwkn",
      "tlubn",
      "pegelonline"
    ],
    "description": "Die Leine nimmt Rhume und Innerste auf. Damit führt sie einen großen Teil des westlichen Harzabflusses über die Aller zur Weser.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "aller",
    "name": "Aller",
    "basin": "Weser",
    "region": [
      "Sachsen-Anhalt",
      "Niedersachsen"
    ],
    "source": {
      "name": "Quellgebiet bei Eggenstedt und Seehausen",
      "lat": 52.1,
      "lon": 11.213
    },
    "mouth": {
      "name": "Mündung in die Weser bei Verden",
      "lat": 52.935,
      "lon": 9.183
    },
    "route": [
      {
        "name": "Quellgebiet bei Eggenstedt und Seehausen",
        "lat": 52.1,
        "lon": 11.213
      },
      {
        "name": "Oebisfelde",
        "lat": 52.434,
        "lon": 10.984
      },
      {
        "name": "Wolfsburg",
        "lat": 52.426,
        "lon": 10.781
      },
      {
        "name": "Gifhorn",
        "lat": 52.485,
        "lon": 10.543
      },
      {
        "name": "Celle",
        "lat": 52.626,
        "lon": 10.082
      },
      {
        "name": "Schwarmstedt",
        "lat": 52.718,
        "lon": 9.617
      },
      {
        "name": "Verden",
        "lat": 52.919,
        "lon": 9.229
      },
      {
        "name": "Mündung in die Weser bei Verden",
        "lat": 52.935,
        "lon": 9.183
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "lhw",
      "nlwkn",
      "pegelonline"
    ],
    "description": "Die Aller nimmt Oker und Leine auf und verbindet so die westlichen Harzflüsse mit der Weser.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "weser",
    "name": "Weser",
    "basin": "Weser",
    "region": [
      "Hessen",
      "Niedersachsen",
      "Nordrhein-Westfalen",
      "Bremen"
    ],
    "source": {
      "name": "Zusammenfluss von Werra und Fulda in Hann. Münden",
      "lat": 51.421,
      "lon": 9.649
    },
    "mouth": {
      "name": "Mündung in die Nordsee, Außenweser",
      "lat": 53.85,
      "lon": 8.15
    },
    "route": [
      {
        "name": "Zusammenfluss von Werra und Fulda in Hann. Münden",
        "lat": 51.421,
        "lon": 9.649
      },
      {
        "name": "Holzminden",
        "lat": 51.825,
        "lon": 9.445
      },
      {
        "name": "Hameln",
        "lat": 52.103,
        "lon": 9.358
      },
      {
        "name": "Minden",
        "lat": 52.288,
        "lon": 8.925
      },
      {
        "name": "Nienburg",
        "lat": 52.639,
        "lon": 9.204
      },
      {
        "name": "Bremen",
        "lat": 53.076,
        "lon": 8.8
      },
      {
        "name": "Bremerhaven",
        "lat": 53.536,
        "lon": 8.571
      },
      {
        "name": "Mündung in die Nordsee, Außenweser",
        "lat": 53.85,
        "lon": 8.15
      }
    ],
    "reservoirIds": [],
    "sourceIds": [
      "pegelonline",
      "nlwkn",
      "lhp"
    ],
    "description": "Die Weser entsteht aus Werra und Fulda. Über Aller und Leine nimmt sie die Abflüsse des westlichen Harzes auf.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "zillierbach",
    "name": "Zillierbach",
    "basin": "Elbe",
    "region": [
      "Sachsen-Anhalt"
    ],
    "source": {
      "name": "Quellgebiet bei Drei Annen Hohne",
      "lat": 51.769,
      "lon": 10.721
    },
    "mouth": {
      "name": "Mündung in die Holtemme in Wernigerode",
      "lat": 51.839,
      "lon": 10.789
    },
    "route": [
      {
        "name": "Quellgebiet bei Drei Annen Hohne",
        "lat": 51.769,
        "lon": 10.721
      },
      {
        "name": "Zillierbachtalsperre",
        "lat": 51.8,
        "lon": 10.755
      },
      {
        "name": "Wernigerode",
        "lat": 51.83,
        "lon": 10.785
      },
      {
        "name": "Mündung in die Holtemme in Wernigerode",
        "lat": 51.839,
        "lon": 10.789
      }
    ],
    "reservoirIds": [
      "zillierbach"
    ],
    "sourceIds": [
      "lhw",
      "tsb"
    ],
    "description": "Der Zillierbach fließt aus dem Harz über die Zillierbachtalsperre nach Wernigerode und mündet dort in die Holtemme.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  }
];

export const reservoirs: Reservoir[] =[
  {
    "id": "rappbode",
    "name": "Rappbodetalsperre",
    "riverId": "rappbode",
    "type": "reservoir",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.7399570779581,
    "lon": 10.8931215155966,
    "sourceIds": [
      "tsb"
    ],
    "description": "Zentrale Trinkwassertalsperre im Rappbodesystem. Die Anlage dient auch dem Hochwasserschutz und der Niedrigwasseraufhöhung.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "wendefurth",
    "name": "Talsperre Wendefurth",
    "riverId": "bode",
    "type": "reservoir",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.7421065839928,
    "lon": 10.9186041290429,
    "sourceIds": [
      "tsb"
    ],
    "description": "Bodetalsperre unterhalb der Rappbodetalsperre. Bestandteil des Talsperrensystems für den Wasserhaushalt im Unterharz.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "koenigshuette",
    "name": "Überleitungssperre Königshütte",
    "riverId": "bode",
    "type": "reservoir",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.7362481758559,
    "lon": 10.8048064789938,
    "sourceIds": [
      "tsb"
    ],
    "description": "Überleitungssperre an der Bode bei Königshütte. Wasser kann in das Rappbodesystem übergeleitet werden.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "hassel",
    "name": "Hasselvorsperre",
    "riverId": "hassel",
    "type": "pre-dam",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.7090198848431,
    "lon": 10.8309055751544,
    "sourceIds": [
      "tsb"
    ],
    "description": "Vorsperre an der Hassel oberhalb der Rappbodetalsperre. Sie gehört zum Trinkwasserschutzsystem des Rappbodeverbunds.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "rappbode-vorsperre",
    "name": "Rappbodevorsperre",
    "riverId": "rappbode",
    "type": "pre-dam",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.7094915269496,
    "lon": 10.7986315487186,
    "sourceIds": [
      "tsb"
    ],
    "description": "Vorsperre an der Rappbode zwischen Trautenstein und der Hauptsperre.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "mandelholz",
    "name": "Hochwasserschutzbecken Mandelholz",
    "riverId": "kalte-bode",
    "type": "dam",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.7477323616979,
    "lon": 10.742188459587,
    "sourceIds": [
      "tsb"
    ],
    "description": "Hochwasserschutzbecken an der Kalten Bode zwischen Elend und Königshütte.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "wippra",
    "name": "Talsperre Wippra",
    "riverId": "wipper",
    "type": "reservoir",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.5667860772979,
    "lon": 11.2060859930771,
    "sourceIds": [
      "tsb"
    ],
    "description": "Talsperre an der Wipper im südöstlichen Harz, oberhalb von Wippra.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "kelbra",
    "name": "Talsperre Kelbra",
    "riverId": "helme",
    "type": "reservoir",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt",
      "Thüringen"
    ],
    "lat": 51.4403307692949,
    "lon": 11.0128296346084,
    "sourceIds": [
      "tsb",
      "lhw",
      "tlubn"
    ],
    "description": "Hochwasserrückhalt an der Helme in der Goldenen Aue am südlichen Harzrand. Der Stausee liegt im Bereich der Landesgrenze.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "oker",
    "name": "Okertalsperre",
    "riverId": "oker",
    "type": "reservoir",
    "operator": "Harzwasserwerke",
    "region": [
      "Niedersachsen"
    ],
    "lat": 51.851,
    "lon": 10.458,
    "sourceIds": [
      "hww",
      "hww-oker"
    ],
    "description": "Große Talsperre an der Oker zwischen Altenau und dem nördlichen Harzrand; Teil des Westharzer Wasserverbunds.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "capacityMillionM3": 46.85,
    "verifiedFields": [
      "name",
      "operator",
      "capacityMillionM3"
    ],
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "innerste",
    "name": "Innerstetalsperre",
    "riverId": "innerste",
    "type": "reservoir",
    "operator": "Harzwasserwerke",
    "region": [
      "Niedersachsen"
    ],
    "lat": 51.906,
    "lon": 10.288,
    "sourceIds": [
      "hww",
      "hww-innerste"
    ],
    "description": "Talsperre an der Innerste zwischen Lautenthal und Langelsheim.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "capacityMillionM3": 19.26,
    "verifiedFields": [
      "name",
      "operator",
      "capacityMillionM3"
    ],
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "grane",
    "name": "Granetalsperre",
    "riverId": "grane",
    "type": "reservoir",
    "operator": "Harzwasserwerke",
    "region": [
      "Niedersachsen"
    ],
    "lat": 51.908,
    "lon": 10.394,
    "sourceIds": [
      "hww",
      "hww-grane"
    ],
    "description": "Trinkwassertalsperre am nördlichen Harzrand bei Goslar und Langelsheim. Bestandteil des verbundenen Westharzer Talsperrensystems.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "capacityMillionM3": 46.4,
    "verifiedFields": [
      "name",
      "operator",
      "capacityMillionM3"
    ],
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "ecker",
    "name": "Eckertalsperre",
    "riverId": "ecker",
    "type": "reservoir",
    "operator": "Harzwasserwerke",
    "region": [
      "Niedersachsen",
      "Sachsen-Anhalt"
    ],
    "lat": 51.85,
    "lon": 10.586,
    "sourceIds": [
      "hww",
      "hww-ecker"
    ],
    "description": "Trinkwassertalsperre im Eckertal unterhalb des Brockens, an der Grenze von Niedersachsen und Sachsen-Anhalt.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "capacityMillionM3": 13.27,
    "verifiedFields": [
      "name",
      "operator",
      "capacityMillionM3"
    ],
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "soese",
    "name": "Sösetalsperre",
    "riverId": "soese",
    "type": "reservoir",
    "operator": "Harzwasserwerke",
    "region": [
      "Niedersachsen"
    ],
    "lat": 51.735,
    "lon": 10.327,
    "sourceIds": [
      "hww",
      "hww-soese"
    ],
    "description": "Trinkwassertalsperre an der Söse oberhalb von Osterode am Harz.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "capacityMillionM3": 25.5,
    "verifiedFields": [
      "name",
      "operator",
      "capacityMillionM3"
    ],
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "oder",
    "name": "Odertalsperre",
    "riverId": "oder",
    "type": "reservoir",
    "operator": "Harzwasserwerke",
    "region": [
      "Niedersachsen"
    ],
    "lat": 51.648,
    "lon": 10.467,
    "sourceIds": [
      "hww",
      "hww-oder"
    ],
    "description": "Talsperre an der Harzer Oder oberhalb von Bad Lauterberg. Sie dient unter anderem dem Hochwasserrückhalt.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "capacityMillionM3": 30.61,
    "verifiedFields": [
      "name",
      "operator",
      "capacityMillionM3"
    ],
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "oderteich",
    "name": "Oderteich",
    "riverId": "oder",
    "type": "reservoir",
    "operator": "Harzwasserwerke",
    "region": [
      "Niedersachsen"
    ],
    "lat": 51.763,
    "lon": 10.536,
    "sourceIds": [
      "hww"
    ],
    "description": "Historischer Speicher an der Oder im Oberharz, Teil der Oberharzer Wasserwirtschaft. Kein Ersatz für die weiter flussabwärts liegende Odertalsperre.",
    "geometryAccuracy": "approximate",
    "researchVerified": false
  },
  {
    "id": "zillierbach",
    "name": "Zillierbachtalsperre",
    "riverId": "zillierbach",
    "type": "reservoir",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.7918317307942,
    "lon": 10.7787334350089,
    "sourceIds": [
      "tsb"
    ],
    "description": "Trinkwassertalsperre am Zillierbach südlich von Wernigerode.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "kiliansteich",
    "name": "Kiliansteich",
    "type": "reservoir",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.6056264357047,
    "lon": 11.0240180904927,
    "sourceIds": [
      "tsb"
    ],
    "description": "Vom Talsperrenbetrieb Sachsen-Anhalt betriebene Stauanlage am Büschengraben.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  },
  {
    "id": "teufelsteich",
    "name": "Teufelsteich",
    "type": "reservoir",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "region": [
      "Sachsen-Anhalt"
    ],
    "lat": 51.6205207054713,
    "lon": 11.1156816883454,
    "sourceIds": [
      "tsb"
    ],
    "description": "Vom Talsperrenbetrieb Sachsen-Anhalt betriebene Stauanlage am Teufelsgrundbach.",
    "geometryAccuracy": "approximate",
    "researchVerified": false,
    "verifiedFields": [
      "name",
      "operator"
    ],
    "verifiedAt": "2026-10-09T12:00:00Z"
  }
];

export const sources: Source[] = [
  {
    "id": "lhw",
    "name": "Hochwasservorhersagezentrale Sachsen-Anhalt",
    "operator": "Landesbetrieb für Hochwasserschutz und Wasserwirtschaft Sachsen-Anhalt",
    "url": "https://hvz.lsaurl.de/",
    "kind": "official",
    "coverage": [
      "Sachsen-Anhalt",
      "Bode",
      "Saale",
      "Elbe",
      "Selke",
      "Holtemme",
      "Wipper"
    ],
    "access": "public-api",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T12:15:00Z"
  },
  {
    "id": "tsb",
    "name": "Talsperrenbetrieb Sachsen-Anhalt",
    "operator": "Talsperrenbetrieb Sachsen-Anhalt",
    "url": "https://www.talsperrenbetrieb-lsa.de/wasserstaende-talsperren/",
    "kind": "official",
    "coverage": [
      "Ostharz",
      "Rappbodesystem",
      "Wippra",
      "Kelbra"
    ],
    "access": "public-api",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T12:15:00Z"
  },
  {
    "id": "hww",
    "name": "Harzwasserwerke",
    "operator": "Harzwasserwerke GmbH",
    "url": "https://www.harzwasserwerke.de/infoservice/aktuelle-talsperrendaten/",
    "kind": "official",
    "coverage": [
      "Westharz",
      "Oker",
      "Innerste",
      "Grane",
      "Ecker",
      "Söse",
      "Oder",
      "Oberharzer Wasserwirtschaft"
    ],
    "access": "public-api",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T12:15:00Z"
  },
  {
    "id": "nlwkn",
    "name": "NLWKN Niedersachsen",
    "operator": "Niedersächsischer Landesbetrieb für Wasserwirtschaft, Küsten- und Naturschutz",
    "url": "https://www.pegelonline.nlwkn.niedersachsen.de/",
    "kind": "official",
    "coverage": [
      "Niedersachsen",
      "Oker",
      "Innerste",
      "Oder",
      "Söse",
      "Leine",
      "Aller",
      "Weser"
    ],
    "access": "public-api",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T12:15:00Z"
  },
  {
    "id": "tlubn",
    "name": "TLUBN Thüringen",
    "operator": "Thüringer Landesamt für Umwelt, Bergbau und Naturschutz",
    "url": "https://tlubn.thueringen.de/",
    "kind": "official",
    "coverage": [
      "Thüringen",
      "Südharz",
      "Zorge",
      "Helme",
      "Unstrut",
      "Wipper"
    ],
    "access": "link-only",
    "researchVerified": false
  },
  {
    "id": "pegelonline",
    "name": "PEGELONLINE",
    "operator": "Wasserstraßen- und Schifffahrtsverwaltung des Bundes",
    "url": "https://www.pegelonline.wsv.de/webservices/rest-api/v2/",
    "kind": "open-data",
    "coverage": [
      "Deutschland",
      "Bundeswasserstraßen"
    ],
    "access": "public-api",
    "researchVerified": false
  },
  {
    "id": "lhp",
    "name": "Länderübergreifendes Hochwasserportal",
    "operator": "Hochwasserzentralen der deutschen Bundesländer",
    "url": "https://www.hochwasserzentralen.de/",
    "kind": "official",
    "coverage": [
      "Deutschland",
      "16 Bundesländer"
    ],
    "access": "link-only",
    "researchVerified": false
  },
  {
    "id": "dwd",
    "name": "Deutscher Wetterdienst",
    "operator": "Deutscher Wetterdienst",
    "url": "https://www.dwd.de/",
    "kind": "official",
    "coverage": [
      "Deutschland",
      "Wetterwarnungen"
    ],
    "access": "link-only",
    "researchVerified": false
  },
  {
    "id": "nina",
    "name": "Warnung der Bevölkerung · NINA",
    "operator": "Bundesamt für Bevölkerungsschutz und Katastrophenhilfe",
    "url": "https://warnung.bund.de/",
    "kind": "official",
    "coverage": [
      "Deutschland",
      "Bevölkerungsschutz"
    ],
    "access": "link-only",
    "researchVerified": false
  },
  {
    "id": "hww-oker",
    "name": "Harzwasserwerke · Okertalsperre · Hauptdaten",
    "operator": "Harzwasserwerke GmbH",
    "url": "https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/okertalsperre/",
    "kind": "official",
    "coverage": [
      "Okertalsperre",
      "Speicherinhalt bei Vollstau"
    ],
    "access": "link-only",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "hww-innerste",
    "name": "Harzwasserwerke · Innerstetalsperre · Hauptdaten",
    "operator": "Harzwasserwerke GmbH",
    "url": "https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/innerstetalsperre/",
    "kind": "official",
    "coverage": [
      "Innerstetalsperre",
      "Speicherinhalt bei Vollstau"
    ],
    "access": "link-only",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "hww-grane",
    "name": "Harzwasserwerke · Granetalsperre · Hauptdaten",
    "operator": "Harzwasserwerke GmbH",
    "url": "https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/granetalsperre/",
    "kind": "official",
    "coverage": [
      "Granetalsperre",
      "Speicherinhalt bei Vollstau"
    ],
    "access": "link-only",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "hww-ecker",
    "name": "Harzwasserwerke · Eckertalsperre · Hauptdaten",
    "operator": "Harzwasserwerke GmbH",
    "url": "https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/eckertalsperre/",
    "kind": "official",
    "coverage": [
      "Eckertalsperre",
      "Speicherinhalt bei Vollstau"
    ],
    "access": "link-only",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "hww-soese",
    "name": "Harzwasserwerke · Sösetalsperre · Hauptdaten",
    "operator": "Harzwasserwerke GmbH",
    "url": "https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/soesetalsperre/",
    "kind": "official",
    "coverage": [
      "Sösetalsperre",
      "Speicherinhalt bei Vollstau"
    ],
    "access": "link-only",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T08:09:06Z"
  },
  {
    "id": "hww-oder",
    "name": "Harzwasserwerke · Odertalsperre · Hauptdaten",
    "operator": "Harzwasserwerke GmbH",
    "url": "https://www.harzwasserwerke.de/ueber-uns/anlagen/talsperren/odertalsperre/",
    "kind": "official",
    "coverage": [
      "Odertalsperre",
      "Speicherinhalt bei Vollstau"
    ],
    "access": "link-only",
    "researchVerified": true,
    "verifiedAt": "2026-10-09T08:09:06Z"
  }
];
