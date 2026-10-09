import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import type { StationHistory } from "@hnd/shared";
import { formatNumber, formatDate } from "../lib/format";

export default function HistoryChart({ stationId, refreshKey = 0 }: { stationId: string; refreshKey?: number }) {
  const [history, setHistory] = useState<StationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setHistory(null);
    setLoading(true);
    setError(false);
    fetch(`/api/v1/stations/${encodeURIComponent(stationId)}/history`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as StationHistory;
        if (controller.signal.aborted) return;
        if (data.stationId !== stationId || !Array.isArray(data.measurements)) throw new Error("Ungültiger Verlauf");
        setHistory(data);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [stationId, retry, refreshKey]);
  const points = useMemo(() => {
    if (history?.stationId !== stationId) return [];
    const valid = history.measurements.filter((p) => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.timestamp)));
    const unit = valid.at(-1)?.unit;
    return [...new Map(valid.filter((p) => p.unit === unit).map((p) => [Date.parse(p.timestamp), p])).values()]
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }, [history, stationId]);
  if (loading) return <div className="chart-empty" role="status"><RefreshCw className="spin" size={17} />Verlauf wird geladen …</div>;
  if (error) return <div className="chart-empty" role="status"><Activity size={20} /><p>Der Messwertverlauf konnte nicht geladen werden.</p><button className="text-button" onClick={() => setRetry((n) => n + 1)}><RefreshCw size={15} />Verlauf erneut laden</button></div>;
  if (!points.length) return <div className="chart-empty"><Activity size={20} /><p>{history?.provider.message || "Für diesen Pegel liegen noch keine gespeicherten oder veröffentlichten Verlaufsmessungen vor."}</p></div>;
  const min = Math.min(...points.map((p) => p.value)), max = Math.max(...points.map((p) => p.value));
  const padding = Math.max((max - min) * .15, 1), low = min - padding, high = max + padding;
  const y = (value: number) => 128 - ((value - low) / (high - low)) * 100;
  const start = Date.parse(points[0].timestamp), end = Date.parse(points.at(-1)!.timestamp);
  const x = (timestamp: string) => points.length === 1 ? 190 : 48 + ((Date.parse(timestamp) - start) / Math.max(end - start, 1)) * 292;
  const intervals = points.slice(1).map((p, i) => Date.parse(p.timestamp) - Date.parse(points[i].timestamp)).sort((a, b) => a - b);
  const gap = Math.max(60 * 60 * 1000, (intervals[Math.floor(intervals.length / 2)] || 0) * 3);
  const path = points.map((p, i) => `${!i || Date.parse(p.timestamp) - Date.parse(points[i - 1].timestamp) > gap ? "M" : "L"}${x(p.timestamp)},${y(p.value)}`).join(" ");
  return <div className="history-chart">
    <div className="chart-title"><span>Wasserstand · Verlauf</span><span>{points[0].unit}</span></div>
    <svg viewBox="0 0 350 150" role="img" aria-label={`Wasserstand von ${formatNumber(points[0].value)} bis ${formatNumber(points.at(-1)!.value)} ${points[0].unit}; ${formatDate(points[0].timestamp)} bis ${formatDate(points.at(-1)!.timestamp)}`}>
      {[low, (low + high) / 2, high].map((value) => <g key={value}><path d={`M48 ${y(value)}H340`} stroke="#d9e1e5" strokeDasharray="3 4" /><text x="41" y={y(value) + 4} textAnchor="end" fill="#526371" fontSize="11">{formatNumber(value)}</text></g>)}
      <path d={path} fill="none" stroke="#236987" strokeWidth="2.5" />
      {points.filter((_, i) => i === 0 || i === points.length - 1).map((p) => <circle key={p.timestamp} cx={x(p.timestamp)} cy={y(p.value)} r="4" fill="#236987"><title>{formatDate(p.timestamp)}: {formatNumber(p.value)} {p.unit}</title></circle>)}
    </svg>
    <div className="chart-axis"><span>{formatDate(points[0].timestamp)}</span><span>{formatDate(points.at(-1)!.timestamp)}</span></div>
    <p className="microcopy">{points.length === 1 ? "Bisher eine Beobachtung. Der Verlauf wächst mit weiteren echten Messungen." : `${points.length} Beobachtungen · ohne amtliche Alarmgrenzen. Größere Messlücken bleiben offen.`}</p>
    {(history?.provider.stale || Date.now() - end > 2 * 60 * 60 * 1000) && <p className="stale-text">Veralteter Verlauf · letzten Messzeitpunkt beachten.</p>}
    <details className="history-values"><summary>Messwerte als Tabelle</summary><div className="history-table-scroll"><table><thead><tr><th>Zeitpunkt (Berlin)</th><th>Wasserstand</th></tr></thead><tbody>{[...points].reverse().map((p) => <tr key={p.timestamp}><td>{formatDate(p.timestamp)}</td><td>{formatNumber(p.value)} {p.unit}</td></tr>)}</tbody></table></div></details>
  </div>;
}
