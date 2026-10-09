import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, CloudRain, Info, MapPin, RefreshCw, Waves } from "lucide-react";
import { REGIONS, type ForecastHour, type ForecastSnapshot, type Region, type RiverForecast } from "@hnd/shared";
import { formatDate } from "../lib/format";
import "./forecast.css";

const number = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value);
const date = (value: string, time = false) => new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit",
  ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}),
}).format(new Date(value));
const rainfallLabels = { low: "Geringe Regenbelastung", elevated: "Erhöhte Regenbelastung", high: "Hohe Regenbelastung", unknown: "Einordnung nicht verfügbar" };

function RainChart({ hours, compact = false }: { hours: ForecastHour[]; compact?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const values = hours.slice(0, 72);
  const width = 720, left = 38, right = 10, bottom = 153, top = 24;
  const plotWidth = width - left - right;
  const max = Math.max(1, ...values.map((hour) => hour.precipitationMm ?? 0));
  const scaleMax = max > 5 ? Math.ceil(max / 5) * 5 : Math.ceil(max);
  const slot = plotWidth / Math.max(values.length, 1);
  const selected = active === null ? undefined : values[active];
  const hasValues = values.some((hour) => hour.precipitationMm !== null);
  if (!hasValues) return <div className="forecast-chart-empty"><CloudRain size={26} /><p>Für diesen Ort sind noch keine Niederschlagswerte verfügbar.</p></div>;
  return (
    <div className={`rain-chart ${compact ? "rain-chart-compact" : ""}`}>
      {!compact && <div className="forecast-chart-label"><span>Niederschlag pro Stunde</span><span>mm · Ortszeit Berlin</span></div>}
      <svg viewBox={`0 0 ${width} 185`} role="img" aria-label={`Stündlicher Niederschlag vom ${date(values[0].timestamp, true)} bis ${date(values.at(-1)!.timestamp, true)}, in Millimetern. Höchster Wert ${number(Math.max(...values.map((hour) => hour.precipitationMm ?? 0)))} mm. Einzelwerte in der Datentabelle.`}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width * width;
          setActive(Math.max(0, Math.min(values.length - 1, Math.floor((x - left) / slot))));
        }} onPointerLeave={() => setActive(null)}>
        {[0, 0.5, 1].map((fraction) => {
          const y = bottom - fraction * (bottom - top);
          return <g key={fraction}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#dce5df" strokeDasharray={fraction ? "3 5" : undefined} /><text x={left - 9} y={y + 4} textAnchor="end">{number(scaleMax * fraction)}</text></g>;
        })}
        {values.map((hour, index) => {
          const height = hour.precipitationMm === null ? 2 : Math.max(1, hour.precipitationMm / scaleMax * (bottom - top));
          return <rect key={hour.timestamp} x={left + index * slot + 1} y={bottom - height} width={Math.max(1, slot - 2)} height={height} rx={Math.min(2, slot / 4)} fill={hour.precipitationMm === null ? "#b9c0bc" : active === index ? "#bb8950" : "#548779"} opacity={hour.precipitationMm === 0 ? 0.35 : 1}><title>{date(hour.timestamp, true)}: {number(hour.precipitationMm)} mm</title></rect>;
        })}
        {[0, 12, 24, 36, 48, 60, 71].filter((index) => index < values.length).map((index, tick) => <text key={index} className={tick % 2 ? "forecast-minor-tick" : undefined} x={left + (index + 0.5) * slot} y={176} textAnchor={tick === 0 ? "start" : index === values.length - 1 ? "end" : "middle"}>{date(values[index].timestamp, true).replace(",", " ·").replace(":00", "h")}</text>)}
      </svg>
      {!compact && <div className="forecast-hover-detail" aria-live="off">{selected ? <><strong>{date(selected.timestamp, true)}</strong><span>{number(selected.precipitationMm)} mm Niederschlag</span><span>{selected.probabilityPercent === null ? "Wahrscheinlichkeit unbekannt" : `${number(selected.probabilityPercent, 0)} % Niederschlagswahrscheinlichkeit`}</span></> : <span>Über die Balken fahren oder die stündlichen Werte aufklappen.</span>}</div>}
    </div>
  );
}

function HourlyValues({ hours }: { hours: ForecastHour[] }) {
  return <details className="forecast-values"><summary>Stündliche Werte ansehen <ChevronDown size={14} /></summary><div className="forecast-table-scroll"><table><caption>72-Stunden-Prognose · Ortszeit Europe/Berlin</caption><thead><tr><th>Zeitpunkt</th><th>Niederschlag</th><th>Regen</th><th>Wahrscheinlichkeit</th></tr></thead><tbody>{hours.map((hour) => <tr key={hour.timestamp}><th scope="row">{date(hour.timestamp, true)}</th><td>{number(hour.precipitationMm)} mm</td><td>{number(hour.rainMm)} mm</td><td>{number(hour.probabilityPercent, 0)} %</td></tr>)}</tbody></table></div></details>;
}

function RiverCard({ river }: { river: RiverForecast }) {
  const points = river.daily.slice(0, 7);
  const measured = points.filter((point) => point.dischargeM3s !== null);
  const max = Math.max(0, ...points.map((point) => point.dischargeM3s ?? 0));
  const scaleTarget = Math.max(1, max * 1.12);
  const scaleStep = 10 ** Math.floor(Math.log10(scaleTarget));
  const scaleMax = Math.ceil(scaleTarget / scaleStep) * scaleStep;
  const x = (index: number) => 48 + index / Math.max(1, points.length - 1) * 460;
  const y = (value: number) => 147 - value / scaleMax * 125;
  let inSegment = false;
  const path = points.map((point, index) => {
    if (point.dischargeM3s === null) { inSegment = false; return ""; }
    const command = `${inSegment ? "L" : "M"}${x(index)},${y(point.dischargeM3s)}`;
    inSegment = true;
    return command;
  }).join(" ");
  return <article className="river-forecast-card">
    <div className="river-forecast-heading"><div><span className="eyebrow">GLOFAS · MODELLPROGNOSE</span><h3>{river.name}</h3></div><Waves size={23} /></div>
    <p className="forecast-model-coordinates"><MapPin size={12} />{measured.length ? "Rasterpunkt" : "Zielkoordinaten"} {number(river.latitude, 3)}° N · {number(river.longitude, 3)}° E</p>
    <div className="forecast-chart-label"><span>Mittlerer Modellabfluss pro Tag</span><span>m³/s · {river.model}</span></div>
    {measured.length ? <svg viewBox="0 0 540 183" role="img" aria-label={`Modellierter Abfluss für ${river.name}: ${points.map((point) => `${date(point.timestamp)} ${number(point.dischargeM3s)} Kubikmeter pro Sekunde`).join(", ")}`}>
      {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1={48} x2={510} y1={y(scaleMax * fraction)} y2={y(scaleMax * fraction)} stroke="#dce5df" strokeDasharray={fraction ? "3 5" : undefined} /><text x={39} y={y(scaleMax * fraction) + 4} textAnchor="end">{number(scaleMax * fraction, scaleMax < 10 ? 2 : 0)}</text></g>)}
      <path d={path} fill="none" stroke="#4c7c89" strokeWidth={2.5} />
      {points.map((point, index) => <g key={point.timestamp}>{point.dischargeM3s !== null && <circle cx={x(index)} cy={y(point.dischargeM3s)} r={3.5} fill="#4c7c89"><title>{date(point.timestamp)}: {number(point.dischargeM3s)} m³/s</title></circle>}<text x={x(index)} y={174} textAnchor="middle">{date(point.timestamp)}</text></g>)}
    </svg> : <div className="forecast-chart-empty"><Waves size={24} /><p>Abflussprognose derzeit nicht verfügbar.</p></div>}
    <p className="river-forecast-note">{river.note}</p>
    {!!points.length && <details className="forecast-values"><summary>Tageswerte ansehen <ChevronDown size={14} /></summary><div className="forecast-table-scroll"><table><thead><tr><th>Tag</th><th>Modellierter Abfluss</th></tr></thead><tbody>{points.map((point) => <tr key={point.timestamp}><th scope="row">{date(point.timestamp)}</th><td>{number(point.dischargeM3s)} m³/s</td></tr>)}</tbody></table></div></details>}
  </article>;
}

interface Props {
  region: Region;
  forecast: ForecastSnapshot | null;
  loading: boolean;
  error: boolean;
  compact?: boolean;
  onRetry: () => void;
  onExpand?: () => void;
  onWarnings?: () => void;
}

export default function ForecastPanel({ region, forecast, loading, error, compact = false, onRetry, onExpand, onWarnings }: Props) {
  const [locationId, setLocationId] = useState("");
  const locations = useMemo(() => [...(forecast?.locations || [])].sort((a, b) => Number(b.location.district === "Landkreis Harz") - Number(a.location.district === "Landkreis Harz")), [forecast]);
  const selected = locations.find((item) => item.location.id === locationId) || locations[0];
  const availableLocations = locations.filter((item) => item.totals.next72hMm !== null);
  const highest = [...availableLocations].sort((a, b) => b.totals.next72hMm! - a.totals.next72hMm!)[0];
  const stale = forecast?.provider.stale;
  const unavailable = !loading && (error || !forecast || forecast.provider.state === "unavailable" || !availableLocations.length);
  const noData = <div className="forecast-empty" role="status"><CloudRain size={28} /><div><strong>{loading ? "Die nächsten Tage werden geladen …" : "Regenprognose gerade nicht verfügbar"}</strong><p>{loading ? "Niederschlag und Abflussmodelle werden unabhängig von den Pegeln abgerufen." : "Fehlende Prognosen sind keine Entwarnung. Amtliche Warnungen bleiben separat erreichbar."}</p></div>{!loading && <button className="text-button" onClick={onRetry}><RefreshCw size={14} />Erneut laden</button>}</div>;

  if (compact) return <section className="forecast-preview" aria-label="Regenvorschau">
    <div className="forecast-preview-title"><span className="forecast-cloud"><CloudRain size={24} /></span><div><span className="eyebrow">VORAUSSCHAU · 72 STUNDEN</span><h2>Der nächste Regen.</h2><p>{region === "germany" ? "Sachsen-Anhalt" : REGIONS[region].label} · ausgewählte Orte</p><p className="forecast-preview-source"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p></div></div>
    {loading || unavailable || !highest ? noData : <><div className="forecast-preview-metric"><strong>{number(highest.totals.next72hMm)}<span>mm</span></strong><p>Höchste 72-h-Summe der {availableLocations.length} Orte<br /><b>{highest.location.name}</b>{stale ? " · veraltet" : ""}</p></div><div className="forecast-preview-context"><span className={`rainfall-indicator ${highest.rainfallClass}`}>{rainfallLabels[highest.rainfallClass]}</span><p>Keine amtliche Hochwasserwarnung</p></div></>}
    <button className="forecast-preview-link" onClick={onExpand}>Regen & Prognose<ArrowRight size={17} /></button>
  </section>;

  return <section className="forecast-section" aria-label="Regen und Abflussprognosen">
    {(loading || !forecast) && noData}
    {forecast && <>
      <div className="forecast-status-line"><span><i className={stale || unavailable ? "forecast-dot-muted" : ""} />{unavailable ? "Niederschlag nicht verfügbar" : stale ? "Gespeicherte Prognose · veraltet" : "Modellprognose verfügbar"}</span><span>Abruf {formatDate(forecast.provider.fetchedAt || forecast.generatedAt)}</span></div>
      {stale && <div className="forecast-notice"><Info size={16} /><p>Der letzte Abruf ist veraltet. Die angezeigten Vorhersagezeiten und Datenlücken beachten.</p></div>}
      {selected ? <div className="forecast-grid">
        <article className="rain-forecast-card">
          <header className="rain-forecast-heading"><div><span className="eyebrow">NIEDERSCHLAGSVORHERSAGE</span><h2>Regen über {selected.location.name}.</h2></div><label className="forecast-location"><MapPin size={15} /><select aria-label="Prognoseort auswählen" value={selected.location.id} onChange={(event) => setLocationId(event.target.value)}>{locations.map((item) => <option value={item.location.id} key={item.location.id}>{item.location.name} · {item.location.district}</option>)}</select><ChevronDown size={14} /></label></header>
          <div className="rainfall-assessment"><span className={`rainfall-indicator ${selected.rainfallClass}`}>{rainfallLabels[selected.rainfallClass]}</span><p>Regenbelastung – keine amtliche Hochwasserwarnung</p></div>
          <div className="rain-forecast-metrics"><RainMetric value={selected.totals.next24hMm} label="Nächste 24 Stunden" /><RainMetric value={selected.totals.next72hMm} label="Nächste 72 Stunden" /><RainMetric value={selected.totals.max1hMm} label="Stärkste Stunde" /></div>
          <RainChart hours={selected.hourly} />
          <p className="forecast-explanation">{selected.explanation}</p>
          {selected.completeness !== "complete" && <p className="forecast-missing-note">{selected.completeness === "unavailable" ? "Keine vollständige Vorhersage verfügbar." : "Die Vorhersage enthält Datenlücken. Unvollständige Summen werden nicht als 0 mm dargestellt."}</p>}
          {!!selected.hourly.length && <HourlyValues hours={selected.hourly} />}
          <footer className="forecast-source">Wetterdaten: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo <ArrowUpRight size={12} /></a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a><span>Stundenwerte zusammengefasst · eigene Regenklassen</span><span>Niederschlag inkl. Schnee als Wasseräquivalent</span></footer>
        </article>
        <aside className="forecast-places"><div className="forecast-places-heading"><span className="eyebrow">REGIONALER BLICK</span><h3>Wo fällt wie viel?</h3><p>72-h-Niederschlag an ausgewählten Orten in {region === "germany" ? "Sachsen-Anhalt" : REGIONS[region].label}.</p></div><div className="forecast-place-list">{locations.map((item) => <button key={item.location.id} onClick={() => setLocationId(item.location.id)} className={selected.location.id === item.location.id ? "selected" : ""} aria-pressed={selected.location.id === item.location.id}><span><strong>{item.location.name}</strong><small>{item.location.district === "Harz" ? "Landkreis Harz" : item.location.district}</small></span><b>{number(item.totals.next72hMm)} <small>mm</small></b></button>)}</div><div className="forecast-places-footer"><Info size={15} /><p>Eine Punktprognose beschreibt einen Modellstandort, nicht das gesamte Einzugsgebiet.</p></div></aside>
      </div> : !loading && noData}
      <div className="section-heading forecast-river-title"><div><span className="eyebrow">REGIONALE MODELLPUNKTE · 7 TAGE</span><h2>Abfluss im regionalen Modell.</h2><p>GloFAS-Rasterpunkte mit Abfluss in m³/s. Die Zuordnung zu konkreten Flüssen ist nicht fachlich validiert; daraus lässt sich keine lokale Hochwasservorhersage ableiten.</p></div><Waves size={26} /></div>
      {(forecast.riverProvider.stale || forecast.riverProvider.state === "unavailable") && <div className="forecast-notice"><Info size={16} /><p>{forecast.riverProvider.stale ? "Die gespeicherte Abflussprognose ist veraltet." : "Die Abflussprognose ist derzeit nicht erreichbar."} {forecast.riverProvider.message}</p></div>}
      <div className="river-forecast-grid">{forecast.riverForecasts.map((river) => <RiverCard river={river} key={river.id} />)}</div>
      {!forecast.riverForecasts.length && <div className="forecast-no-rivers"><Waves size={23} /><div><strong>Für diese Region keine Abflussmodellreihe</strong><p>{forecast.riverProvider.message}</p></div></div>}
      <p className="forecast-river-source">Abflussmodelle: <a href="https://open-meteo.com/en/docs/flood-api" target="_blank" rel="noreferrer">Open-Meteo Flood API</a> · <a href="https://global-flood.emergency.copernicus.eu/" target="_blank" rel="noreferrer">Copernicus GloFAS</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>{forecast.riverProvider.fetchedAt && <> · Abruf {formatDate(forecast.riverProvider.fetchedAt)}</>}</p>
      <div className="forecast-bottom"><details className="forecast-methodology"><summary><Info size={17} />So entsteht diese Prognose <ChevronDown size={15} /></summary><div><p>{forecast.methodology.description}</p><h3>Einordnung der Regenbelastung</h3><p>{forecast.methodology.thresholds}</p><h3>Was die Daten leisten</h3><ul>{forecast.methodology.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><div className="forecast-method-sources">{forecast.methodology.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name}<ArrowUpRight size={12} /></a>)}</div></div></details><button className="text-button" onClick={onWarnings}>Amtliche Warnungen ansehen<ArrowRight size={15} /></button></div>
    </>}
  </section>;
}

function RainMetric({ value, label }: { value: number | null; label: string }) {
  return <div><span>{label}</span><strong>{number(value)}<small>mm</small></strong></div>;
}
