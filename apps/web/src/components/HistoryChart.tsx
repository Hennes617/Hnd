import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import type { StationHistory } from "@hnd/shared";
import { formatNumber, formatDate, formatTime } from "../lib/format";
export default function HistoryChart({ stationId }: { stationId: string }) {
  const [history, setHistory] = useState<StationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setHistory(null);
    setLoading(true);
    fetch(`/api/v1/stations/${encodeURIComponent(stationId)}/history`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setHistory)
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [stationId]);
  const points = (history?.measurements || [])
    .filter((p) => Number.isFinite(p.value))
    .slice(-288);
  if (loading)
    return (
      <div className="chart-empty">
        <RefreshCw className="spin" size={17} />
        Verlauf wird geladen …
      </div>
    );
  if (points.length < 2)
    return (
      <div className="chart-empty">
        <Activity size={20} />
        <span>
          Für diesen Pegel ist kein
          <br />
          Messwertverlauf verfügbar.
        </span>
      </div>
    );
  const min = Math.min(...points.map((p) => p.value)),
    max = Math.max(...points.map((p) => p.value));
  const y = (value: number) =>
    105 - ((value - min) / Math.max(max - min, 1)) * 74;
  const start = new Date(points[0].timestamp).getTime(),
    end = new Date(points.at(-1)!.timestamp).getTime();
  const path = points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${((new Date(p.timestamp).getTime() - start) / Math.max(end - start, 1)) * 280},${y(p.value)}`,
    )
    .join(" ");
  return (
    <div className="history-chart">
      <div className="chart-title">
        <span>Wasserstand · Verlauf</span>
        <span>{points[0].unit}</span>
      </div>
      <svg
        viewBox="0 0 280 125"
        role="img"
        aria-label={`Wasserstand von ${formatNumber(points[0].value)} bis ${formatNumber(points.at(-1)!.value)} ${points[0].unit}; ${formatDate(points[0].timestamp)} bis ${formatDate(points.at(-1)!.timestamp)}`}
      >
        <path d={`${path} L280,123 L0,123Z`} fill="#e6eee7" />
        <path
          d="M0 30H280M0 68H280M0 106H280"
          stroke="#dce5df"
          strokeDasharray="3 4"
        />
        <path d={path} fill="none" stroke="#3c7765" strokeWidth="2.5" />
        <text x="0" y="20" fill="#76827c" fontSize="9">
          {formatNumber(max)}
        </text>
      </svg>
      <div className="chart-axis">
        <span>{formatDate(points[0].timestamp)}</span>
        <span>{formatTime(points.at(-1)!.timestamp)}</span>
      </div>
      <p className="microcopy">Messwertverlauf ohne amtliche Alarmgrenzen.</p>
      {(history?.provider.stale ||
        Date.now() - new Date(points.at(-1)!.timestamp).getTime() >
          2 * 60 * 60 * 1000) && (
        <p className="stale-text">
          Veralteter Verlauf · letzten Messzeitpunkt beachten.
        </p>
      )}
    </div>
  );
}
