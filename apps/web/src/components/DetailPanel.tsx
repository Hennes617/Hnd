import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Gauge,
  Info,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";
import { REGIONS, type Snapshot } from "@hnd/shared";
import type { Selection } from "../WaterMap";
import type { View } from "../lib/types";
import {
  formatDate,
  formatNumber,
  formatTime,
  warningClass,
} from "../lib/format";
import { SourceLink, MeasurementValue, EntitySources } from "./ui";
import { ReservoirArt } from "./ReservoirCards";
import HistoryChart from "./HistoryChart";
export default function DetailPanel({
  selection,
  snapshot,
  onClose,
  navigate,
  onSelect,
}: {
  selection: Selection | null;
  snapshot: Snapshot;
  onClose: () => void;
  navigate: (view: View) => void;
  onSelect: (selection: Selection) => void;
}) {
  const station =
    selection?.type === "station"
      ? snapshot.stations.find((s) => s.id === selection.id)
      : undefined;
  const river =
    selection?.type === "river"
      ? snapshot.rivers.find((r) => r.id === selection.id)
      : undefined;
  const reservoir =
    selection?.type === "reservoir"
      ? snapshot.reservoirs.find((r) => r.id === selection.id)
      : undefined;
  const entity = station || river || reservoir;
  if (!entity) {
    const featured = [...snapshot.stations]
      .sort(
        (a, b) =>
          (b.warningLevel || 0) - (a.warningLevel || 0) ||
          Number(!!b.measurement) - Number(!!a.measurement),
      )
      .slice(0, 3);
    return (
      <aside className="region-panel">
        <div className="panel-top">
          <span className="eyebrow">DEINE REGION</span>
          <span className="tiny-tag">
            {REGIONS[snapshot.region].label}
          </span>
        </div>
        <h2>Ein Blick aufs Wasser.</h2>
        <p className="panel-description">
          Pegel, Gewässer und amtliche Informationen an einem Ort.
        </p>
        <div className="mini-station-heading">
          <span>Pegel im Blick</span>
          <Gauge size={15} />
        </div>
        {featured.length ? (
          <div className="mini-stations">
            {featured.map((s) => (
              <button
                key={s.id}
                className="mini-station"
                onClick={() => onSelect({ type: "station", id: s.id })}
              >
                <div>
                  <strong>{s.name}</strong>
                  <span>
                    {s.water}
                    {s.measurement
                      ? ` · ${formatTime(s.measurement.timestamp)} Uhr`
                      : ""}
                  </span>
                  {s.measurement && s.freshness !== "current" && (
                    <small className="stale-text">Messwert veraltet</small>
                  )}
                </div>
                <div className="mini-station-value">
                  {s.measurement ? (
                    <MeasurementValue station={s} />
                  ) : (
                    <span
                      className={`small-status ${warningClass(s.warningLevel)}`}
                    >
                      {s.warningLabel || "Keine Daten"}
                    </span>
                  )}
                  <ChevronRight size={14} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="no-stations">
            <Gauge size={24} />
            <strong>Pegeldaten nicht verfügbar</strong>
            <p>
              Die Karte und der Gewässerkatalog bleiben nutzbar. Aktuelle Werte
              bei den amtlichen Anbietern prüfen.
            </p>
          </div>
        )}
        <button
          className="text-button panel-all"
          onClick={() => navigate("stations")}
        >
          Alle Pegel ansehen
          <ArrowRight size={15} />
        </button>
        <div className="warning-teaser">
          <div>
            <span className="warning-icon">
              <Bell size={16} />
            </span>
            <strong>Hochwasserinformationen</strong>
          </div>
          <p>
            {snapshot.warnings.length
              ? `${snapshot.warnings.length} Meldungen aus angebundenen Quellen. Die Warnabdeckung bleibt unvollständig.`
              : "Keine vollständige Warnabdeckung. Fehlende Meldungen bedeuten keine Entwarnung."}
          </p>
          <button onClick={() => navigate("warnings")}>
            Amtliche Warnlage prüfen
            <ArrowUpRight size={14} />
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="region-panel detail-panel">
      <div className="panel-top">
        <span className="eyebrow">
          {station ? "PEGELSTATION" : river ? "FLUSSPORTRÄT" : "TALSPERRE"}
        </span>
        <button
          className="icon-button close-detail"
          aria-label="Auswahl schließen"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      <h2>{entity.name}</h2>
      <p className="detail-subtitle">
        <MapPin size={13} />
        {station
          ? station.water
          : river
            ? `${river.basin}-Einzugsgebiet`
            : reservoir?.region.join(" · ")}
      </p>
      {station && (
        <>
          <div className="detail-value">
            <MeasurementValue station={station} large />
            {station.measurement && (
              <span
                className={`status-pill ${station.freshness === "current" ? "success" : "warning"}`}
              >
                <i />
                {station.freshness === "current" ? "Aktuell" : "Veraltet"}
              </span>
            )}
          </div>
          {station.measurement && (
            <p className="microcopy">
              Messung: {formatDate(station.measurement.timestamp)} · Wasserstand
              am Pegel
            </p>
          )}
          {station.warningLabel && (
            <div
              className={`level-label ${warningClass(station.warningLevel)}`}
            >
              <ShieldCheck size={16} />
              <div>
                <strong>{station.warningLabel}</strong>
                <span>
                  {station.warningTimestamp
                    ? formatDate(station.warningTimestamp)
                    : "Zeitpunkt nicht angegeben"}{" "}
                  · {station.warningSource || station.agency}
                </span>
              </div>
            </div>
          )}
          {station.note && (
            <div className="station-note">
              <Info size={14} />
              <p>{station.note}</p>
            </div>
          )}
          <HistoryChart stationId={station.id} />
          {station.discharge && (
            <div className="discharge-detail">
              <div className="detail-row">
                <span>Letzter Abfluss</span>
                <strong>
                  {formatNumber(station.discharge.value)}{" "}
                  {station.discharge.unit}
                </strong>
              </div>
              <p className="microcopy">
                Messung: {formatDate(station.discharge.timestamp)}
                {Date.now() - new Date(station.discharge.timestamp).getTime() >
                2 * 60 * 60 * 1000
                  ? " · Veraltet"
                  : ""}
              </p>
            </div>
          )}
          <div className="detail-source">
            <span>{station.agency}</span>
            <SourceLink href={station.sourceUrl}>
              Amtliche Pegelseite
            </SourceLink>
          </div>
        </>
      )}
      {river && (
        <>
          <p className="entity-description">{river.description}</p>
          <div className="river-journey">
            <div>
              <i />
              <span>QUELLE / URSPRUNG</span>
              <strong>{river.source.name}</strong>
            </div>
            <div>
              <i />
              <span>MÜNDUNG</span>
              <strong>{river.mouth.name}</strong>
            </div>
          </div>
          <div className="detail-row">
            <span>Einzugsgebiet</span>
            <strong>{river.basin}</strong>
          </div>
          <div className="detail-row">
            <span>Talsperren im Katalog</span>
            <strong>{river.reservoirIds.length}</strong>
          </div>
          <p className="microcopy">
            Schematischer Verlauf.{" "}
            {river.researchVerified
              ? "Quellengeprüfter Steckbrief."
              : "Redaktioneller Steckbrief, noch nicht vollständig geprüft."}
          </p>
          <EntitySources
            sourceIds={river.sourceIds}
            sources={snapshot.sources}
          />
        </>
      )}
      {reservoir && (
        <>
          <div className="reservoir-detail-art">
            <ReservoirArt
              variant={snapshot.reservoirs.indexOf(reservoir) % 3}
            />
          </div>
          <p className="entity-description">{reservoir.description}</p>
          <div className="detail-row">
            <span>Aktueller Füllstand</span>
            <span className="small-status muted">Nicht angebunden</span>
          </div>
          {reservoir.capacityMillionM3 !== undefined && (
            <div className="detail-row">
              <span>Kapazität bei Vollstau</span>
              <strong>
                {formatNumber(reservoir.capacityMillionM3)} Mio. m³
              </strong>
            </div>
          )}
          <div className="operator">
            <span>Betreiber</span>
            <strong>{reservoir.operator}</strong>
          </div>
          <p className="microcopy">
            {reservoir.verifiedFields?.includes("capacityMillionM3")
              ? "Kapazität anhand der Betreiberangaben geprüft. Lage und Geometrie sind Näherungen."
              : reservoir.researchVerified
              ? "Quellengeprüfter Steckbrief."
              : "Redaktioneller Steckbrief, noch nicht vollständig geprüft."}{" "}
            Keine Live-Füllstände.
          </p>
          <EntitySources
            sourceIds={reservoir.sourceIds}
            sources={snapshot.sources}
          />
        </>
      )}
    </aside>
  );
}
