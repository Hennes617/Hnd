import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  LocateFixed,
  Minus,
  Plus,
  Layers3,
  MapPinned,
  Search,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import {
  REGIONS,
  REGION_BOUNDARIES,
  type Region,
  type River,
  type Reservoir,
  type Station,
} from "@hnd/shared";
import type {
  Map as LibreMap,
  GeoJSONSource,
  MapMouseEvent,
} from "maplibre-gl";
import type { FeatureCollection, Point, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

export type Selection = { type: "river" | "reservoir" | "station"; id: string };
interface Props {
  region: Region;
  rivers: River[];
  reservoirs: Reservoir[];
  stations: Station[];
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}
type Layers = {
  stations: boolean;
  reservoirs: boolean;
  rivers: boolean;
  boundaries: boolean;
};
type MapState = "loading" | "ready" | "partial" | "unavailable";
type MapObject = Selection & {
  name: string;
  detail: string;
  coordinates: [number, number];
};
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const COLORS = {
  current: "#287967",
  stale: "#7b8587",
  elevated: "#c28427",
  high: "#b63f37",
  reservoir: "#387c9a",
};
const pointKey = (selection: Selection | null) =>
  selection ? `${selection.type}:${selection.id}` : "";
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pointsFor(
  stations: Station[],
  reservoirs: Reservoir[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: [
      ...stations.map((station) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [station.longitude, station.latitude],
        },
        properties: {
          id: station.id,
          key: `station:${station.id}`,
          kind: "station",
          name: station.name,
          color:
            (station.warningLevel ?? 0) >= 3
              ? COLORS.high
              : (station.warningLevel ?? 0) > 0
                ? COLORS.elevated
                : station.freshness !== "current"
                  ? COLORS.stale
                  : COLORS.current,
        },
      })),
      ...reservoirs.map((reservoir) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [reservoir.lon, reservoir.lat],
        },
        properties: {
          id: reservoir.id,
          key: `reservoir:${reservoir.id}`,
          kind: "reservoir",
          name: reservoir.name,
          color: COLORS.reservoir,
        },
      })),
    ].filter((feature) => feature.geometry.coordinates.every(Number.isFinite)),
  };
}

function linesFor(rivers: River[]): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: rivers
      .filter((river) => river.route.length > 1)
      .map((river) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: river.route.map((point) => [point.lon, point.lat]),
        },
        properties: {
          id: river.id,
          key: `river:${river.id}`,
          kind: "river",
          name: river.name,
        },
      })),
  };
}

function updateLayers(
  map: LibreMap,
  layers: Layers,
  selection: Selection | null,
) {
  for (const [id, visible] of [
    ["hnd-stations", layers.stations],
    ["hnd-reservoirs", layers.reservoirs],
    ["hnd-rivers", layers.rivers],
    ["hnd-river-hit", layers.rivers],
    ["hnd-state-boundary", layers.boundaries],
    ["hnd-district-fill", layers.boundaries],
    ["hnd-district-boundary", layers.boundaries],
  ] as const) {
    if (map.getLayer(id))
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
  if (map.getLayer("hnd-selection")) {
    const visible =
      selection?.type === "station"
        ? layers.stations
        : selection?.type === "reservoir"
          ? layers.reservoirs
          : false;
    map.setFilter("hnd-selection", [
      "==",
      ["get", "key"],
      visible ? pointKey(selection) : "",
    ]);
  }
  if (map.getLayer("hnd-rivers"))
    map.setPaintProperty("hnd-rivers", "line-width", [
      "case",
      ["==", ["get", "key"], pointKey(selection)],
      3.5,
      1.8,
    ]);
}

function installLayers(
  map: LibreMap,
  points: FeatureCollection<Point>,
  lines: FeatureCollection<LineString>,
) {
  map.addSource("hnd-boundaries", { type: "geojson", data: REGION_BOUNDARIES });
  map.addSource("hnd-points", { type: "geojson", data: points });
  map.addSource("hnd-lines", { type: "geojson", data: lines });
  map.addLayer({
    id: "hnd-district-fill",
    type: "fill",
    source: "hnd-boundaries",
    filter: ["==", ["get", "id"], "harz"],
    paint: { "fill-color": "#437d60", "fill-opacity": 0.065 },
  });
  map.addLayer({
    id: "hnd-state-boundary",
    type: "line",
    source: "hnd-boundaries",
    filter: ["==", ["get", "id"], "sachsen-anhalt"],
    paint: {
      "line-color": "#718473",
      "line-width": 1.5,
      "line-dasharray": [4, 3],
      "line-opacity": 0.7,
    },
  });
  map.addLayer({
    id: "hnd-district-boundary",
    type: "line",
    source: "hnd-boundaries",
    filter: ["==", ["get", "id"], "harz"],
    paint: { "line-color": "#31634f", "line-width": 2.4, "line-opacity": 0.85 },
  });
  map.addLayer({
    id: "hnd-river-hit",
    type: "line",
    source: "hnd-lines",
    paint: { "line-width": 18, "line-opacity": 0 },
  });
  map.addLayer({
    id: "hnd-rivers",
    type: "line",
    source: "hnd-lines",
    paint: {
      "line-color": "#357688",
      "line-width": 1.8,
      "line-dasharray": [3, 2],
      "line-opacity": 0.8,
    },
  });
  map.addLayer({
    id: "hnd-selection",
    type: "circle",
    source: "hnd-points",
    filter: ["==", ["get", "key"], ""],
    paint: {
      "circle-radius": 13,
      "circle-color": "#fff",
      "circle-opacity": 0.5,
      "circle-stroke-color": "#1c5145",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "hnd-reservoirs",
    type: "circle",
    source: "hnd-points",
    filter: ["==", ["get", "kind"], "reservoir"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7],
      "circle-color": COLORS.reservoir,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2.5,
    },
  });
  map.addLayer({
    id: "hnd-stations",
    type: "circle",
    source: "hnd-points",
    filter: ["==", ["get", "kind"], "station"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 10, 5.8],
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.6,
    },
  });
}

export default function WaterMap({
  region,
  rivers,
  reservoirs,
  stations,
  selection,
  onSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const [mapState, setMapState] = useState<MapState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [layers, setLayers] = useState<Layers>({
    stations: true,
    reservoirs: true,
    rivers: false,
    boundaries: true,
  });
  const [showLayers, setShowLayers] = useState(false);
  const [showObjects, setShowObjects] = useState(false);
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const objectButton = useRef<HTMLButtonElement>(null);
  const layerButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const points = useMemo(
    () => pointsFor(stations, reservoirs),
    [stations, reservoirs],
  );
  const lines = useMemo(() => linesFor(rivers), [rivers]);
  const latest = useRef({ region, points, lines, layers, selection, onSelect });
  latest.current = { region, points, lines, layers, selection, onSelect };
  const lastSelection = useRef("");

  const objects = useMemo<MapObject[]>(
    () =>
      [
        ...rivers.map(
          (river): MapObject => ({
            type: "river",
            id: river.id,
            name: river.name,
            detail: "Fluss · schematischer Katalog",
            coordinates: [river.source.lon, river.source.lat],
          }),
        ),
        ...reservoirs.map(
          (reservoir): MapObject => ({
            type: "reservoir",
            id: reservoir.id,
            name: reservoir.name,
            detail: "Talsperre · ungefähre Position",
            coordinates: [reservoir.lon, reservoir.lat],
          }),
        ),
        ...stations.map(
          (station): MapObject => ({
            type: "station",
            id: station.id,
            name: station.name,
            detail: `Pegel · ${station.water}`,
            coordinates: [station.longitude, station.latitude],
          }),
        ),
      ].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [rivers, reservoirs, stations],
  );
  const matchingObjects = useMemo(
    () =>
      objects.filter((object) =>
        `${object.name} ${object.detail}`
          .toLocaleLowerCase("de")
          .includes(query.trim().toLocaleLowerCase("de")),
      ),
    [objects, query],
  );

  const resetView = () => {
    mapRef.current?.fitBounds([...REGIONS[region].bounds], {
      padding: { top: 82, bottom: 94, left: 40, right: 56 },
      duration: reducedMotion() ? 0 : 650,
    });
  };

  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let instance: LibreMap | null = null;
    let observer: ResizeObserver | undefined;
    let styleReady = false;
    setMapState("loading");
    const timeout = window.setTimeout(() => {
      if (!disposed && !styleReady) setMapState("unavailable");
    }, 18_000);
    void import("maplibre-gl")
      .then(({ Map }) => {
        if (disposed || !container.current) return;
        instance = new Map({
          container: container.current,
          style: STYLE_URL,
          bounds: [...REGIONS[latest.current.region].bounds],
          fitBoundsOptions: {
            padding: { top: 82, bottom: 94, left: 40, right: 56 },
          },
          attributionControl: false,
          maxZoom: 17,
          minZoom: 4,
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText":
              "Mit Strg + Scrollen die Karte zoomen",
            "CooperativeGesturesHandler.MacHelpText":
              "Mit ⌘ + Scrollen die Karte zoomen",
            "CooperativeGesturesHandler.MobileHelpText":
              "Mit zwei Fingern die Karte verschieben",
          },
        });
        mapRef.current = instance;
        instance
          .getCanvas()
          .setAttribute(
            "aria-label",
            "OpenFreeMap-Karte. Mit Pfeiltasten verschieben, mit Plus und Minus zoomen. Objekte über die Suche auswählen.",
          );
        instance.touchZoomRotate.disableRotation();
        instance.on("style.load", () => {
          if (!instance || disposed) return;
          styleReady = true;
          window.clearTimeout(timeout);
          installLayers(instance, latest.current.points, latest.current.lines);
          updateLayers(
            instance,
            latest.current.layers,
            latest.current.selection,
          );
          setMapState("ready");
        });
        instance.on("error", () => {
          if (!disposed) setMapState(styleReady ? "partial" : "unavailable");
        });
        const selectable = ["hnd-stations", "hnd-reservoirs", "hnd-river-hit"];
        const featuresAt = (event: MapMouseEvent) => {
          if (!instance || !styleReady) return [];
          return instance.queryRenderedFeatures(
            [
              [event.point.x - 5, event.point.y - 5],
              [event.point.x + 5, event.point.y + 5],
            ],
            { layers: selectable },
          );
        };
        instance.on("click", (event) => {
          const feature = featuresAt(event)[0];
          if (
            feature?.properties?.id &&
            ["station", "reservoir", "river"].includes(feature.properties.kind)
          ) {
            latest.current.onSelect({
              type: feature.properties.kind,
              id: feature.properties.id,
            });
          }
        });
        instance.on("mousemove", (event) => {
          const feature = featuresAt(event)[0];
          if (instance)
            instance.getCanvas().style.cursor = feature ? "pointer" : "";
          setHovered(feature?.properties?.name ?? null);
        });
        instance
          .getCanvas()
          .addEventListener("mouseleave", () => setHovered(null));
        observer = new ResizeObserver(() => instance?.resize());
        observer.observe(container.current);
      })
      .catch(() => {
        if (!disposed) setMapState("unavailable");
      });
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      observer?.disconnect();
      instance?.remove();
      if (mapRef.current === instance) mapRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("hnd-points")) return;
    (map.getSource("hnd-points") as GeoJSONSource).setData(points);
    (map.getSource("hnd-lines") as GeoJSONSource).setData(lines);
  }, [points, lines]);

  useEffect(() => {
    resetView();
  }, [region]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("hnd-stations")) updateLayers(map, layers, selection);
    const key = pointKey(selection);
    if (!selection) {
      lastSelection.current = "";
      return;
    }
    if (key === lastSelection.current) return;
    lastSelection.current = key;
    if (selection.type === "river")
      setLayers((current) => ({ ...current, rivers: true }));
    const object = objects.find((candidate) => pointKey(candidate) === key);
    if (object && map && !map.getBounds().contains(object.coordinates))
      map.flyTo({
        center: object.coordinates,
        zoom: Math.max(map.getZoom(), 9),
        duration: reducedMotion() ? 0 : 700,
      });
  }, [selection, layers, objects]);

  const chooseObject = (object: MapObject) => {
    onSelect({ type: object.type, id: object.id });
    setShowObjects(false);
    objectButton.current?.focus();
    mapRef.current?.flyTo({
      center: object.coordinates,
      zoom: Math.max(
        mapRef.current.getZoom(),
        object.type === "river" ? 9 : 11,
      ),
      duration: reducedMotion() ? 0 : 700,
    });
  };

  return (
    <section
      className="water-map ofm-map"
      aria-label={`Gewässerkarte ${REGIONS[region].label}`}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || (!showObjects && !showLayers)) return;
        event.stopPropagation();
        if (showObjects) objectButton.current?.focus();
        else layerButton.current?.focus();
        setShowObjects(false);
        setShowLayers(false);
      }}
    >
      <div ref={container} className="ofm-canvas" />
      <div className="ofm-title">
        <span className="ofm-title-icon">
          <MapPinned size={19} />
        </span>
        <div>
          <strong>{REGIONS[region].label}</strong>
          <span>Gewässer & Pegel · OpenFreeMap</span>
        </div>
      </div>

      <div className="ofm-controls" role="group" aria-label="Kartensteuerung">
        <button
          type="button"
          aria-label="Karte vergrößern"
          title="Vergrößern"
          onClick={() =>
            mapRef.current?.zoomIn({ duration: reducedMotion() ? 0 : 250 })
          }
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          aria-label="Karte verkleinern"
          title="Verkleinern"
          onClick={() =>
            mapRef.current?.zoomOut({ duration: reducedMotion() ? 0 : 250 })
          }
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          aria-label="Kartenausschnitt zurücksetzen"
          title="Region anzeigen"
          onClick={resetView}
        >
          <LocateFixed size={18} />
        </button>
      </div>

      <div className="ofm-actions">
        <button
          ref={objectButton}
          type="button"
          className={showObjects ? "active" : ""}
          onClick={() => {
            setShowObjects(!showObjects);
            setShowLayers(false);
          }}
          aria-expanded={showObjects}
          aria-controls={`${id}-objects`}
        >
          <Search size={16} />
          <span>Objekt auswählen</span>
        </button>
        <button
          ref={layerButton}
          type="button"
          className={showLayers ? "active" : ""}
          onClick={() => {
            setShowLayers(!showLayers);
            setShowObjects(false);
          }}
          aria-expanded={showLayers}
          aria-controls={`${id}-layers`}
        >
          <Layers3 size={16} />
          <span>Ebenen</span>
        </button>
      </div>

      {showObjects && (
        <div className="ofm-object-panel" id={`${id}-objects`}>
          <label htmlFor={`${id}-search`}>Gewässer oder Pegel finden</label>
          <div className="ofm-search">
            <Search size={15} />
            <input
              id={`${id}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zum Beispiel Bode oder Thale"
              autoFocus
            />
          </div>
          <div className="ofm-object-count" aria-live="polite">
            {matchingObjects.length} Objekte
            {matchingObjects.length > 60
              ? " · Suche zum Eingrenzen verwenden"
              : ""}
          </div>
          <ul>
            {matchingObjects.slice(0, 60).map((object) => (
              <li key={pointKey(object)}>
                <button
                  type="button"
                  onClick={() => chooseObject(object)}
                  aria-label={`${object.type === "river" ? "Fluss" : object.type === "station" ? "Pegel" : "Talsperre"} ${object.name} auswählen`}
                >
                  <span className={`ofm-object-symbol ${object.type}`} />
                  <span>
                    <strong>{object.name}</strong>
                    <small>{object.detail}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!matchingObjects.length && (
            <p className="ofm-empty">Kein passendes Objekt in dieser Region.</p>
          )}
        </div>
      )}

      {showLayers && (
        <fieldset className="ofm-layer-panel" id={`${id}-layers`}>
          <legend>Kartenebenen</legend>
          {(
            [
              ["stations", "Pegel", "Messwerte und vorhandene Warnstufen"],
              ["reservoirs", "Talsperren", "Katalogpositionen sind Näherungen"],
              [
                "boundaries",
                "Verwaltungsgrenzen",
                "Sachsen-Anhalt · Landkreis Harz",
              ],
              [
                "rivers",
                "Flusskatalog",
                "Gestrichelt: schematische Ortsfolgen",
              ],
            ] as const
          ).map(([key, label, detail]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() =>
                  setLayers((current) => ({ ...current, [key]: !current[key] }))
                }
              />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {mapState === "loading" && (
        <div className="ofm-loading" role="status">
          <span />
          Karte wird geladen
        </div>
      )}
      {mapState === "unavailable" && (
        <div className="ofm-fallback" role="status">
          <span className="ofm-fallback-icon">
            <WifiOff size={25} />
          </span>
          <strong>Karte gerade nicht verfügbar</strong>
          <p>
            OpenFreeMap konnte nicht geladen werden. Prüfe die Verbindung und
            WebGL-Unterstützung. Alle Gewässer und Pegel bleiben über die
            Objektauswahl erreichbar.
          </p>
          <div>
            <button
              type="button"
              onClick={() => setAttempt((current) => current + 1)}
            >
              <RefreshCw size={15} />
              Erneut laden
            </button>
            <button
              type="button"
              onClick={() => {
                setShowObjects(true);
                setShowLayers(false);
              }}
            >
              Objekte anzeigen
            </button>
          </div>
        </div>
      )}
      {mapState === "partial" && (
        <div className="ofm-partial" role="status">
          <WifiOff size={15} />
          <span>Einige Karteninhalte konnten nicht geladen werden.</span>
          <button
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
            aria-label="Karteninhalte erneut laden"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}
      {hovered && !showObjects && !showLayers && mapState !== "unavailable" && (
        <div className="ofm-hover">{hovered}</div>
      )}

      <div className="ofm-legend" aria-label="Legende">
        <span>
          <i style={{ background: COLORS.current }} />
          Pegel aktuell
        </span>
        <span>
          <i style={{ background: COLORS.stale }} />
          Älter / ohne Wert
        </span>
        <span>
          <i className="ofm-warning-dot" />
          Warnstufe
        </span>
        <span>
          <i style={{ background: COLORS.reservoir }} />
          Talsperre
        </span>
        {layers.boundaries && (
          <span>
            <i className="ofm-boundary-line" />
            Landkreis Harz
          </span>
        )}
      </div>
      {layers.rivers && (
        <div className="ofm-geometry-note">
          Gestrichelte Flüsse: schematischer Katalog, kein genauer
          Gewässerverlauf.
        </div>
      )}
      <div className="ofm-attribution">
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
        <span>·</span>
        <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">
          OpenMapTiles
        </a>
        <span>·</span>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap
        </a>
        {layers.boundaries && (
          <>
            <span>·</span>
            <a href="https://www.bkg.bund.de/" target="_blank" rel="noreferrer">
              © GeoBasis-DE / BKG 2018, 2020 (Daten bearbeitet)
            </a>
            <a
              href="https://www.govdata.de/dl-de/by-2-0"
              target="_blank"
              rel="noreferrer"
            >
              dl-de/by-2-0
            </a>
          </>
        )}
      </div>
    </section>
  );
}
