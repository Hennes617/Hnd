import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudRain,
  Database,
  Droplets,
  Gauge,
  Info,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
  X,
} from "lucide-react";
import {
  rivers as catalogRivers,
  reservoirs as catalogReservoirs,
  sources as catalogSources,
  REGIONS,
  riverInRegion,
  reservoirInRegion,
} from "@hnd/shared";
import type { ForecastSnapshot, Region, Snapshot } from "@hnd/shared";
import WaterMap, { type Selection } from "./WaterMap";

import type { View } from "./lib/types";
import {
  formatDate,
  formatNumber,
  formatTime,
  warningClass,
} from "./lib/format";
import {
  DataAttribution,
  EmptyState,
  MeasurementValue,
  ProviderBadge,
  SourceCard,
  SourceLink,
} from "./components/ui";
import { ReservoirCards } from "./components/ReservoirCards";
import DetailPanel from "./components/DetailPanel";
import ForecastPanel from "./components/ForecastPanel";
const navigation = [
  { id: "overview", label: "Übersicht", icon: LayoutDashboard },
  { id: "stations", label: "Pegel", icon: Gauge },
  { id: "rivers", label: "Flüsse", icon: Waves },
  { id: "reservoirs", label: "Talsperren", icon: Droplets },
  { id: "warnings", label: "Warnungen", icon: Bell },
  { id: "forecast", label: "Regen & Prognose", icon: CloudRain },
  { id: "sources", label: "Datenquellen", icon: Database },
] as const;
const publicApi = (import.meta.env.VITE_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
function fallback(region: Region): Snapshot {
  return {
    generatedAt: new Date().toISOString(),
    region,
    stations: [],
    rivers: catalogRivers.filter((river) => riverInRegion(river, region)),
    reservoirs: catalogReservoirs.filter((reservoir) => reservoirInRegion(reservoir, region)),
    sources: catalogSources,
    warnings: [],
    providers: [],
    coverage: {
      stations: "Pegel sind derzeit nicht erreichbar.",
      warnings:
        "Aktuelle Warnungen konnten nicht abgerufen werden. Bitte amtliche Warndienste prüfen.",
      geography:
        "Redaktioneller Gewässerkatalog mit Schwerpunkt Sachsen-Anhalt und Landkreis Harz. Ortsangaben und Verläufe sind Näherungen.",
      complete: false,
    },
  };
}
export default function App() {
  const [stationLimit, setStationLimit] = useState(75);
  const [view, setView] = useState<View>("overview");
  const [region, setRegion] = useState<Region>("sachsen-anhalt");
  const [snapshot, setSnapshot] = useState<Snapshot>(() => fallback("sachsen-anhalt"));
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<ForecastSnapshot | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [basin, setBasin] = useState("all");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`/api/v1/overview?region=${region}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as Snapshot;
        if (!Array.isArray(data.stations) || !Array.isArray(data.rivers))
          throw new Error("Ungültige Daten");
        setSnapshot(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSnapshot(fallback(region));
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [region, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setForecast(null);
    setForecastLoading(true);
    setForecastError(false);
    fetch(`/api/v1/forecast?region=${region}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as ForecastSnapshot;
        if (!Array.isArray(data.locations) || !Array.isArray(data.riverForecasts))
          throw new Error("Ungültige Prognosedaten");
        if (!controller.signal.aborted) setForecast(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setForecastError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setForecastLoading(false);
      });
    return () => controller.abort();
  }, [region, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setRefresh((r) => r + 1), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => setStationLimit(75), [query, region]);
  const navigate = (next: View) => {
    setView(next);
    setMobileMenu(false);
    setBasin("all");
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const select = (next: Selection) => {
    setSelection(next);
    setView("overview");
    setQuery("");
    setSearchFocused(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const search = query.trim().toLocaleLowerCase("de");
  const filteredRivers = useMemo(
    () =>
      snapshot.rivers.filter(
        (r) =>
          (!search ||
            `${r.name} ${r.basin} ${r.source.name} ${r.mouth.name}`
              .toLocaleLowerCase("de")
              .includes(search)) &&
          (basin === "all" || r.basin === basin),
      ),
    [snapshot.rivers, search, basin],
  );
  const filteredReservoirs = useMemo(
    () =>
      snapshot.reservoirs.filter(
        (r) =>
          !search ||
          `${r.name} ${r.operator} ${r.region.join(" ")}`
            .toLocaleLowerCase("de")
            .includes(search),
      ),
    [snapshot.reservoirs, search],
  );
  const filteredStations = useMemo(
    () =>
      snapshot.stations.filter(
        (s) =>
          !search ||
          `${s.name} ${s.water} ${s.agency}`
            .toLocaleLowerCase("de")
            .includes(search),
      ),
    [snapshot.stations, search],
  );
  const measured = snapshot.stations.filter(
    (s) => s.measurement !== null,
  ).length;
  const classified = snapshot.stations.filter(
    (s) => s.warningLevel !== undefined && s.warningLevel >= 0,
  ).length;
  const liveProviders = snapshot.providers.filter(
    (p) => p.state === "live" || (p.state === "cached" && !p.stale),
  ).length;
  const searchResults = search
    ? [
        ...filteredStations.slice(0, 3).map((s) => ({
          type: "station" as const,
          id: s.id,
          name: s.name,
          subtitle: `Pegel · ${s.water}`,
        })),
        ...filteredRivers.slice(0, 3).map((r) => ({
          type: "river" as const,
          id: r.id,
          name: r.name,
          subtitle: `Fluss · ${r.basin}`,
        })),
        ...filteredReservoirs.slice(0, 3).map((r) => ({
          type: "reservoir" as const,
          id: r.id,
          name: r.name,
          subtitle: "Talsperre",
        })),
      ].slice(0, 6)
    : [];
  const titles: Record<
    View,
    { eyebrow: string; title: string; description: string }
  > = {
    overview: {
      eyebrow: REGIONS[region].label.toLocaleUpperCase("de"),
      title: "Wasser im Blick.",
      description:
        region === "harz"
          ? "Von der Bode bis zur Ilse. Pegel, Flüsse und Talsperren im Landkreis Harz – vom Oberharz bis ins Vorland."
          : region === "sachsen-anhalt"
            ? "Von den Quellen im Harz bis zur Elbe. Die Wasserlage in Sachsen-Anhalt, mit besonderem Blick auf den Landkreis Harz."
            : "Pegel und Hochwasserinformationen aus angebundenen amtlichen Quellen. Unser Schwerpunkt: Sachsen-Anhalt und der Landkreis Harz.",
    },
    stations: {
      eyebrow: "MESSEN & BEOBACHTEN",
      title: "Jeder Pegel erzählt.",
      description:
        "Wasserstände und amtliche Einstufungen aus verfügbaren Datenquellen. Zeitstempel und Herkunft bleiben immer sichtbar.",
    },
    rivers: {
      eyebrow: "VON DER QUELLE BIS ZUR MÜNDUNG",
      title: "Alles ist im Fluss.",
      description:
        "Flüsse in der gewählten Region, ihre Ursprünge und ihre Wege bis zur Mündung. Ein wachsendes Verzeichnis der Wasserlandschaft.",
    },
    reservoirs: {
      eyebrow: "WASSER IN DER LANDSCHAFT",
      title: "Raum für Wasser.",
      description:
        "Trinkwasserspeicher, Rückhalteräume und Landschaften. Entdecke die Talsperren und ihre Verbindungen zu den Flüssen.",
    },
    warnings: {
      eyebrow: "INFORMIERT BLEIBEN",
      title: "Die Warnlage verstehen.",
      description:
        "Verfügbare Hochwasserinformationen und der direkte Weg zu den zuständigen amtlichen Diensten.",
    },
    forecast: {
      eyebrow: "DIE NÄCHSTEN TAGE IM BLICK",
      title: "Was der Regen bringt.",
      description:
        "72 Stunden Niederschlag und regionale Abflussmodelle. Eine Einordnung der Regenbelastung – neben den amtlichen Hochwasserwarnungen.",
    },
    sources: {
      eyebrow: "OFFEN & NACHVOLLZIEHBAR",
      title: "Gute Daten. Klare Quellen.",
      description:
        "Woher unsere Informationen kommen, wie aktuell sie sind und wo die Abdeckung Grenzen hat.",
    },
  };
  const title = titles[view];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Zum Inhalt springen
      </a>
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="HND Startseite"
        >
          <span className="brand-symbol">
            <Waves size={28} strokeWidth={1.8} />
          </span>
          <span>
            HND<span className="brand-dot">.</span>
          </span>
        </button>
        <nav aria-label="Hauptnavigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
              aria-label={item.label}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={21} strokeWidth={1.65} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            aria-label="Informationen zu HND"
            onClick={() => navigate("sources")}
          >
            <CircleHelp size={21} />
            <span>Über HND</span>
          </button>
          <span className="sidebar-caption">
            WASSER
            <br />
            VERBINDET.
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-toggle icon-button"
              aria-label="Menü öffnen"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span>Wasserlage</span>
            <ChevronRight size={12} />
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={16} />
              <input
                aria-label="Pegel, Flüsse und Talsperren suchen"
                placeholder="Gewässer oder Ort suchen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setSearchFocused(false);
                  }
                  if (e.key === "Enter" && searchResults[0])
                    select(searchResults[0]);
                }}
              />
              {query ? (
                <button
                  className="search-clear"
                  aria-label="Suche zurücksetzen"
                  onClick={() => setQuery("")}
                >
                  <X size={13} />
                </button>
              ) : (
                <kbd>⌕</kbd>
              )}
              {searchFocused && search && (
                <div className="search-results">
                  {searchResults.length ? (
                    searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => select(result)}
                      >
                        <span>
                          {result.type === "river" ? (
                            <Waves size={16} />
                          ) : result.type === "station" ? (
                            <Gauge size={16} />
                          ) : (
                            <Droplets size={16} />
                          )}
                        </span>
                        <div>
                          <strong>{result.name}</strong>
                          <small>{result.subtitle}</small>
                        </div>
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                  ) : (
                    <p>Keine Gewässer gefunden.</p>
                  )}
                </div>
              )}
            </div>
            <div
              className={`connection-label ${liveProviders ? "connected" : ""}`}
            >
              <i />
              {loading
                ? "Daten laden"
                : liveProviders
                  ? "Quellen verbunden"
                  : "Daten eingeschränkt"}
            </div>
          </div>
        </header>
        <main id="main">
          <section className="page-heading">
            <div>
              <div className="eyebrow heading-eyebrow">
                <span />
                {title.eyebrow}
              </div>
              <h1>{title.title}</h1>
              <p>{title.description}</p>
            </div>
            <div className="heading-controls">
              <div
                className="region-switch"
                role="group"
                aria-label="Region auswählen"
              >
                {(["sachsen-anhalt", "harz", "germany"] as const).map((id) => (
                  <button
                    key={id}
                    className={region === id ? "active" : ""}
                    aria-pressed={region === id}
                    onClick={() => {
                      setRegion(id);
                      if (id !== region) setSnapshot(fallback(id));
                      setSelection(null);
                    }}
                  >
                    {REGIONS[id].label}
                  </button>
                ))}
              </div>
              <div className="updated-at">
                <Clock3 size={13} />
                <span>
                  {loading
                    ? "Aktualisierung läuft"
                    : error
                      ? "Abruf nicht verfügbar"
                      : `Abruf ${formatTime(snapshot.generatedAt)} Uhr`}
                </span>
                <button
                  aria-label="Daten aktualisieren"
                  title="Daten aktualisieren"
                  onClick={() => setRefresh((r) => r + 1)}
                  disabled={loading}
                >
                  <RefreshCw size={14} className={loading ? "spin" : ""} />
                </button>
              </div>
            </div>
          </section>
          {error && (
            <div className="inline-notice" role="status">
              <Info size={17} />
              <span>
                Live-Daten sind gerade nicht erreichbar. Du siehst den lokalen
                Gewässerkatalog. Aktuelle Warnungen bitte bei den amtlichen
                Diensten prüfen.
              </span>
              <button onClick={() => setRefresh((r) => r + 1)}>
                Erneut laden
              </button>
            </div>
          )}
          {view === "overview" && (
            <>
              <section className="stats-grid" aria-label="Datenübersicht">
                <button
                  className="stat-card"
                  onClick={() => navigate("stations")}
                >
                  <span className="stat-icon">
                    <Gauge size={23} />
                  </span>
                  <div>
                    <span className="stat-label">Pegelstandorte</span>
                    <div className="stat-number">
                      {loading && snapshot.stations.length === 0
                        ? "—"
                        : formatNumber(snapshot.stations.length)}
                      <span>{measured} mit Wasserstand</span>
                    </div>
                  </div>
                  <ArrowUpRight size={17} className="stat-arrow" />
                </button>
                <button
                  className="stat-card"
                  onClick={() => navigate("rivers")}
                >
                  <span className="stat-icon blue">
                    <Waves size={23} />
                  </span>
                  <div>
                    <span className="stat-label">Flüsse & Wasserwege</span>
                    <div className="stat-number">
                      {snapshot.rivers.length}
                      <span>im regionalen Katalog</span>
                    </div>
                  </div>
                  <ArrowUpRight size={17} className="stat-arrow" />
                </button>
                <button
                  className="stat-card"
                  onClick={() => navigate("reservoirs")}
                >
                  <span className="stat-icon tan">
                    <Droplets size={23} />
                  </span>
                  <div>
                    <span className="stat-label">Talsperren & Speicher</span>
                    <div className="stat-number">
                      {snapshot.reservoirs.length}
                      <span>im regionalen Katalog</span>
                    </div>
                  </div>
                  <ArrowUpRight size={17} className="stat-arrow" />
                </button>
              </section>
              <section className="map-section">
                <WaterMap
                  key={region}
                  region={region}
                  rivers={snapshot.rivers}
                  reservoirs={snapshot.reservoirs}
                  stations={snapshot.stations}
                  selection={selection}
                  onSelect={setSelection}
                />
                <DetailPanel
                  selection={selection}
                  snapshot={snapshot}
                  onClose={() => setSelection(null)}
                  navigate={navigate}
                  onSelect={setSelection}
                />
              </section>
              <DataAttribution providers={snapshot.providers} />
              <div className="map-caption">
                <Info size={13} />
                <span>{snapshot.coverage.geography}</span>
                <button onClick={() => navigate("sources")}>
                  Zur Datenabdeckung
                  <ArrowUpRight size={12} />
                </button>
              </div>
              <ForecastPanel
                compact
                region={region}
                forecast={forecast}
                loading={forecastLoading}
                error={forecastError}
                onRetry={() => setRefresh((r) => r + 1)}
                onExpand={() => navigate("forecast")}
              />
              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">ZWISCHEN BERGEN & WASSER</span>
                    <h2>
                      Die Talsperren entdecken
                      <span className="count-chip">
                        {snapshot.reservoirs.length}
                      </span>
                    </h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("reservoirs")}
                  >
                    Alle Talsperren
                    <ArrowRight size={16} />
                  </button>
                </div>
                <ReservoirCards
                  reservoirs={snapshot.reservoirs}
                  onSelect={select}
                  limit={3}
                />
              </section>
              <section className="river-feature">
                <div className="river-feature-copy">
                  <span className="eyebrow">
                    DAS WASSER KENNT KEINE GRENZEN
                  </span>
                  <h2>
                    Viele Quellen.
                    <br />
                    Ein verbundenes System.
                  </h2>
                  <p>
                    Vom Landkreis Harz durch die Täler der Bode bis zur Saale
                    und Elbe. Verfolge die Wege des Wassers.
                  </p>
                  <button
                    className="button dark"
                    onClick={() => navigate("rivers")}
                  >
                    Flüsse erkunden
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="featured-rivers">
                  {snapshot.rivers.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => select({ type: "river", id: r.id })}
                    >
                      <span className="river-initial">
                        <Waves size={21} />
                      </span>
                      <div>
                        <h3>{r.name}</h3>
                        <p>
                          {r.source.name}
                          <ArrowRight size={11} />
                          {r.mouth.name}
                        </p>
                      </div>
                      <ArrowUpRight size={18} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "forecast" && (
            <ForecastPanel
              region={region}
              forecast={forecast}
              loading={forecastLoading}
              error={forecastError}
              onRetry={() => setRefresh((r) => r + 1)}
              onWarnings={() => navigate("warnings")}
            />
          )}
          {view === "stations" && (
            <section className="content-section directory-section">
              <div className="directory-toolbar">
                <div>
                  <strong>{filteredStations.length} Pegelstandorte</strong>
                  <span>
                    {measured} mit Wasserstand · {classified} mit
                    Hochwassereinstufung
                  </span>
                </div>
                <span className="tiny-tag">
                  {REGIONS[region].label}
                </span>
              </div>
              <div className="coverage-note">
                <Info size={17} />
                <p>
                  {snapshot.coverage.stations} Wasserstand und
                  Hochwassereinstufung sind unterschiedliche Angaben.
                </p>
              </div>
              {filteredStations.length ? (
                <div className="station-table">
                  <div className="station-table-head">
                    <span>Station / Gewässer</span>
                    <span>Wasserstand</span>
                    <span>Hochwassereinstufung</span>
                    <span>Messzeitpunkt</span>
                    <span />
                  </div>
                  {filteredStations.slice(0, stationLimit).map((station) => (
                    <button
                      key={station.id}
                      className="station-table-row"
                      onClick={() =>
                        select({ type: "station", id: station.id })
                      }
                    >
                      <div>
                        <strong>{station.name}</strong>
                        <span>
                          {station.water} · {station.agency}
                        </span>
                      </div>
                      <div>
                        <MeasurementValue station={station} />
                        {station.measurement &&
                          station.freshness !== "current" && (
                            <small className="stale-text">Veraltet</small>
                          )}
                      </div>
                      <div>
                        <span
                          className={`small-status ${warningClass(station.warningLevel)}`}
                        >
                          {station.warningLabel || "Nicht verfügbar"}
                        </span>
                      </div>
                      <span className="table-time">
                        {station.measurement
                          ? formatDate(station.measurement.timestamp)
                          : "—"}
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="gauge"
                  title={
                    search ? "Keine passenden Pegel" : "Noch keine Pegeldaten"
                  }
                  description={
                    search
                      ? "Versuche einen anderen Gewässer- oder Ortsnamen."
                      : "Die angebundenen Datenquellen liefern aktuell keine Pegeldaten für diese Ansicht."
                  }
                />
              )}
              <DataAttribution providers={snapshot.providers} />
              {filteredStations.length > stationLimit && (
                <div className="load-more">
                  <span>
                    {stationLimit} von {filteredStations.length} Standorten
                  </span>
                  <button
                    className="button"
                    onClick={() => setStationLimit((n) => n + 75)}
                  >
                    Weitere Pegel laden
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
            </section>
          )}
          {view === "rivers" && (
            <section className="content-section directory-section">
              <div className="directory-toolbar">
                <div>
                  <strong>{filteredRivers.length} Flüsse im Verzeichnis</strong>
                  <span>{REGIONS[region].label} · Quelle bis Mündung</span>
                </div>
                <label className="select-control">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="Flüsse nach Einzugsgebiet filtern"
                    value={basin}
                    onChange={(e) => setBasin(e.target.value)}
                  >
                    <option value="all">Alle Einzugsgebiete</option>
                    <option value="Elbe">Elbe</option>
                    <option value="Weser">Weser</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className="river-directory">
                {filteredRivers.map((r) => (
                  <button
                    className="river-directory-card"
                    key={r.id}
                    onClick={() => select({ type: "river", id: r.id })}
                  >
                    <div className="river-card-top">
                      <span className="river-card-icon">
                        <Waves size={24} />
                      </span>
                      <span className="tiny-tag">{r.basin}-Gebiet</span>
                      <ArrowUpRight size={18} />
                    </div>
                    <h2>{r.name}</h2>
                    <p>{r.description}</p>
                    <div className="route-summary">
                      <div>
                        <i />
                        <span>{r.source.name}</span>
                      </div>
                      <div>
                        <i />
                        <span>{r.mouth.name}</span>
                      </div>
                    </div>
                    <div className="river-card-footer">
                      <span>{r.region.join(" · ")}</span>
                      <span>
                        {r.reservoirIds.length
                          ? `${r.reservoirIds.length} Speicher`
                          : "Flussporträt"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {!filteredRivers.length && (
                <EmptyState
                  title="Kein passender Fluss"
                  description="Ändere deinen Suchbegriff oder das Einzugsgebiet."
                />
              )}
              <p className="catalog-notice">
                Redaktioneller Startkatalog · Schematische Gewässerverläufe.
                Prüfstatus und Quellen stehen im jeweiligen Steckbrief.
              </p>
            </section>
          )}
          {view === "reservoirs" && (
            <section className="content-section directory-section">
              <div className="directory-toolbar">
                <div>
                  <strong>
                    {filteredReservoirs.length} Talsperren & Speicher
                  </strong>
                  <span>Die Speicher in {REGIONS[region].label}</span>
                </div>
                <span className="tiny-tag">Geografischer Katalog</span>
              </div>
              <div className="coverage-note">
                <Info size={17} />
                <p>
                  Aktuelle Füllstände und Abgaben sind noch nicht angebunden. In
                  jedem Steckbrief findest du die zuständigen Betreiber und
                  Informationsquellen.
                </p>
              </div>
              <ReservoirCards
                reservoirs={filteredReservoirs}
                onSelect={select}
              />
              {!filteredReservoirs.length && (
                <EmptyState
                  title="Keine passende Talsperre"
                  description="Versuche einen anderen Namen oder Betreiber."
                />
              )}
              <p className="catalog-notice">
                Die Landschaftsbilder sind Illustrationen. Positionen und
                Steckbriefe bilden einen noch nicht vollständig geprüften
                Startkatalog.
              </p>
            </section>
          )}
          {view === "warnings" && (
            <section className="content-section directory-section">
              <div className="warning-coverage">
                <span className="warning-coverage-icon">
                  <Bell size={27} />
                </span>
                <div>
                  <span className="eyebrow">ABDECKUNG EINGESCHRÄNKT</span>
                  <h2>Amtliche Warnlage immer direkt prüfen.</h2>
                  <p>
                    {snapshot.coverage.warnings} Fehlende Meldungen sind keine
                    Entwarnung.
                  </p>
                </div>
                <SourceLink
                  className="button"
                  href="https://www.hochwasserzentralen.de/"
                >
                  Hochwasserzentralen
                </SourceLink>
              </div>
              {snapshot.warnings.length > 0 ? (
                <div className="warning-list">
                  {snapshot.warnings.map((w) => (
                    <article key={w.id} className="warning-card">
                      <div className="warning-card-meta">
                        <span className="status-pill warning">
                          {w.severity === "extreme"
                            ? "Extreme Gefahr"
                            : w.severity === "severe"
                              ? "Hohe Gefahr"
                              : w.severity === "moderate"
                                ? "Warnung"
                                : w.severity === "minor"
                                  ? "Hinweis"
                                  : "Einstufung unbekannt"}
                        </span>
                        <span>{formatDate(w.sentAt)}</span>
                      </div>
                      <h2>{w.title}</h2>
                      <p>{w.description}</p>
                      {w.instruction && (
                        <p className="warning-instruction">{w.instruction}</p>
                      )}
                      <div>
                        <span>{w.area}</span>
                        <SourceLink href={w.sourceUrl}>{w.source}</SourceLink>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="no-warning-message">
                  <Info size={21} />
                  <div>
                    <h3>Keine Warnmeldungen in dieser Ansicht verfügbar.</h3>
                    <p>
                      Das ist keine Aussage darüber, ob vor Ort eine
                      Hochwassergefahr besteht. Nutze die amtlichen Quellen für
                      aktuelle Warnungen und Handlungsempfehlungen.
                    </p>
                  </div>
                </div>
              )}
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">DIREKT ZUR QUELLE</span>
                  <h2>Die zuständigen Warndienste</h2>
                </div>
              </div>
              <div className="source-grid">
                {snapshot.sources
                  .filter(
                    (s) => s.kind === "official" && s.access === "link-only",
                  )
                  .map((s) => (
                    <SourceCard source={s} key={s.id} />
                  ))}
              </div>
              <p className="catalog-notice">
                HND ist ein unabhängiges Informationsangebot und kein amtlicher
                Warndienst. Bei akuter Gefahr: Notruf 112 und Hinweise der
                örtlichen Behörden beachten.
              </p>
            </section>
          )}
          {view === "sources" && (
            <section className="content-section directory-section">
              <div className="transparency-card">
                <ShieldCheck size={32} />
                <div>
                  <h2>Nachvollziehbar statt lückenlos behauptet.</h2>
                  <p>
                    HND verbindet verfügbare amtliche Daten mit einem
                    redaktionellen Gewässerkatalog. Deutschlandweite Pegeldaten
                    bedeuten keine vollständige Erfassung aller Messstellen,
                    Warnungen oder Talsperren. Messwerte werden mit Herkunft und
                    Zeitstempel angezeigt.
                  </p>
                </div>
              </div>
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">AKTUELLER ABRUF</span>
                  <h2>Verbindungen & Verfügbarkeit</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setRefresh((r) => r + 1)}
                  disabled={loading}
                >
                  <RefreshCw size={14} className={loading ? "spin" : ""} />
                  Aktualisieren
                </button>
              </div>
              <div className="provider-grid">
                {snapshot.providers.length ? (
                  snapshot.providers.map((p) => (
                    <article className="provider-card" key={p.id}>
                      <div>
                        <Database size={20} />
                        <ProviderBadge provider={p} />
                      </div>
                      <h3>{p.name}</h3>
                      <p>{p.message}</p>
                      <footer>
                        <span>
                          {p.fetchedAt
                            ? `Abruf: ${formatDate(p.fetchedAt)}`
                            : "Kein Abrufzeitpunkt"}
                        </span>
                        <SourceLink href={p.url}>Quelle</SourceLink>
                      </footer>
                    </article>
                  ))
                ) : (
                  <div className="coverage-note">
                    <Info size={17} />
                    <p>
                      Die API ist noch nicht erreichbar. Es liegen keine Angaben
                      zur Verfügbarkeit der Datenanbieter vor.
                    </p>
                  </div>
                )}
              </div>
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">
                    OFFIZIELLE ANLAUFSTELLEN & OFFENE DATEN
                  </span>
                  <h2>Das Quellenverzeichnis</h2>
                </div>
              </div>
              <div className="source-grid">
                {snapshot.sources.map((s) => (
                  <SourceCard source={s} key={s.id} />
                ))}
              </div>
              <div className="api-callout">
                <div>
                  <span className="eyebrow">FÜR ALLE, DIE WEITERBAUEN</span>
                  <h2>Eine offene Schnittstelle.</h2>
                  <p>
                    Pegel, Gewässerkatalog und Quellen als JSON. Kostenlos und
                    ohne eigenen API-Schlüssel abrufbar. Nutzungsbedingungen der
                    Ursprungsquellen beachten.
                  </p>
                </div>
                <a
                  className="button dark"
                  href={`${publicApi}/docs`}
                  target="_blank"
                  rel="noreferrer"
                >
                  API-Dokumentation
                  <ArrowUpRight size={16} />
                </a>
              </div>
            </section>
          )}
          <footer className="site-footer">
            <div className="footer-brand">
              <Waves size={21} />
              <strong>
                HND<span>.</span>
              </strong>
              <span>Wasser verbindet.</span>
            </div>
            <p>Unabhängiges Informationsangebot · Kein amtlicher Warndienst</p>
            <div>
              <button onClick={() => navigate("sources")}>
                Quellen & Hinweise
              </button>
              <a href={`${publicApi}/docs`} target="_blank" rel="noreferrer">
                Offene API
                <ArrowUpRight size={12} />
              </a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
