import { ArrowUpRight, Droplets } from "lucide-react";
import type { Measurement, Reservoir } from "@hnd/shared";
import type { Selection } from "../WaterMap";
import { formatDate, formatNumber } from "../lib/format";
import { SourceLink } from "./ui";

const metrics = [
  ["storage", "Speicherinhalt"], ["fillPercent", "Füllgrad"], ["level", "Wasserspiegel"],
  ["inflow", "Zufluss"], ["outflow", "Abgabe"],
] as const;
export function reservoirObservation(reservoir: Reservoir): Measurement | undefined {
  return reservoir.telemetry?.fillPercent || reservoir.telemetry?.storage || reservoir.telemetry?.level || reservoir.telemetry?.inflow || reservoir.telemetry?.outflow;
}
export function ReservoirTelemetry({ reservoir }: { reservoir: Reservoir }) {
  const telemetry = reservoir.telemetry;
  const available = metrics.filter(([key]) => telemetry?.[key]);
  return <section className="reservoir-telemetry" aria-label="Betriebsdaten der Talsperre">
    <div className="telemetry-heading"><h3>Betriebsdaten</h3><span className={`status-pill ${telemetry?.freshness === "current" ? "information" : telemetry?.freshness === "stale" ? "warning" : "muted"}`}>{telemetry?.freshness === "current" ? "Aktuelle Meldung" : telemetry?.freshness === "stale" ? "Ältere Meldung" : "Keine Messwerte"}</span></div>
    {available.map(([key, label]) => {
      const measurement = telemetry![key]!;
      return <div className="telemetry-metric" key={key}><span>{label}</span><strong>{formatNumber(measurement.value)} <small>{measurement.unit}</small></strong><time dateTime={measurement.timestamp}>{formatDate(measurement.timestamp)}</time></div>;
    })}
    {!available.length && <p className="microcopy">Für diesen Speicher liegen in der angebundenen Quelle keine aktuellen Betriebswerte vor. Die Betreiberseite ist die nächste Anlaufstelle.</p>}
    {telemetry?.note && <p className="microcopy">{telemetry.note}</p>}
    {telemetry?.sourceUrl && <SourceLink href={telemetry.sourceUrl}>{telemetry.sourceName}</SourceLink>}
  </section>;
}
export function ReservoirCards({ reservoirs, onSelect, limit }: { reservoirs: Reservoir[]; onSelect: (selection: Selection) => void; limit?: number }) {
  return <div className="reservoir-grid">{reservoirs.slice(0, limit).map((reservoir) => {
    const measurement = reservoirObservation(reservoir);
    const metricLabel = reservoir.telemetry?.fillPercent ? "Füllgrad" : reservoir.telemetry?.storage ? "Speicherinhalt" : reservoir.telemetry?.level ? "Wasserspiegel" : reservoir.telemetry?.inflow ? "Zufluss" : "Abgabe";
    return <button className="reservoir-card" key={reservoir.id} onClick={() => onSelect({ type: "reservoir", id: reservoir.id })}>
      <div className="reservoir-card-top"><span><Droplets size={18} />{reservoir.type === "pre-dam" ? "Vorsperre" : "Talsperre"}</span><ArrowUpRight size={19} /></div>
      <div className="reservoir-card-content"><span className="card-eyebrow">{reservoir.region.join(" · ")}</span><h3>{reservoir.name}</h3><p>{reservoir.operator}</p>
        <div className="reservoir-reading"><span>{measurement ? metricLabel : "Betriebsdaten"}</span><strong>{measurement ? formatNumber(measurement.value) : "—"}<small>{measurement?.unit}</small></strong></div>
        <div className="reservoir-card-footer"><span>{measurement ? `${formatDate(measurement.timestamp)}${reservoir.telemetry?.freshness === "stale" ? " · veraltet" : ""}` : "Keine aktuellen Messwerte"}</span><span>Details</span></div>
      </div>
    </button>;
  })}</div>;
}
