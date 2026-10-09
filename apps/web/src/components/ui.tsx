import { ArrowUpRight, BookOpen, Database, Gauge, Waves } from "lucide-react";
import type { ProviderState, Source, Station } from "@hnd/shared";
import { formatNumber, formatDate } from "../lib/format";
function safeLink(value: string) {
  try {
    if (value.startsWith("/") && !value.startsWith("//")) return value;
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}
export function SourceLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={safeLink(href)}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
export function MeasurementValue({
  station,
  large = false,
}: {
  station: Station;
  large?: boolean;
}) {
  return station.measurement ? (
    <span className={large ? "measurement large" : "measurement"}>
      {formatNumber(station.measurement.value)}
      <small>{station.measurement.unit}</small>
    </span>
  ) : (
    <span className="no-value">Kein Wasserstand</span>
  );
}
export function ProviderBadge({ provider }: { provider: ProviderState }) {
  return (
    <span
      className={`status-pill ${provider.state === "live" ? "information" : provider.state === "cached" ? provider.stale ? "warning" : "information" : "muted"}`}
    >
      <i />
      {provider.state === "live"
        ? "Verbunden"
        : provider.state === "cached"
          ? provider.stale ? "Älterer Datenstand" : "Zwischengespeichert"
          : provider.state === "reference"
            ? "Anlaufstelle"
            : "Eingeschränkt"}
    </span>
  );
}

export function EntitySources({
  sourceIds,
  sources,
}: {
  sourceIds: string[];
  sources: Source[];
}) {
  return (
    <div className="entity-sources">
      {sourceIds
        .map((id) => sources.find((s) => s.id === id))
        .filter((s): s is Source => !!s)
        .slice(0, 2)
        .map((s) => (
          <SourceLink key={s.id} href={s.url}>
            {s.name}
          </SourceLink>
        ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = "water",
}: {
  title: string;
  description: string;
  icon?: "water" | "gauge";
}) {
  return (
    <div className="empty-state">
      {icon === "gauge" ? <Gauge size={36} /> : <Waves size={36} />}
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
export function SourceCard({ source }: { source: Source }) {
  return (
    <article className="source-card">
      <div className="source-card-icon">
        {source.access === "public-api" ? (
          <Database size={21} />
        ) : (
          <BookOpen size={21} />
        )}
      </div>
      <div>
        <span className="card-eyebrow">
          {source.access === "public-api"
            ? "ÖFFENTLICHE API"
            : "AMTLICHE ANLAUFSTELLE"}
        </span>
        <h3>{source.name}</h3>
        <p>{source.operator}</p>
        <div className="source-card-regions">{source.coverage.join(" · ")}</div>
        <SourceLink href={source.url}>Zur Quelle</SourceLink>
      </div>
    </article>
  );
}

export function DataAttribution({ providers }: { providers: ProviderState[] }) {
  const lhp = providers.find((p) => p.id === "lhp-reference") || providers.find((p) => p.id === "lhp");
  const wsv = providers.find((p) => p.id.includes("pegel"));
  return (
    <div className="data-attribution">
      <span>
        Datenquelle:{" "}
        <a
          href="https://www.hochwasserzentralen.de/"
          target="_blank"
          rel="noreferrer"
        >
          www.hochwasserzentralen.de
          <ArrowUpRight size={10} />
        </a>
        {lhp?.dataUpdatedAt
          ? ` · Stand: ${formatDate(lhp.dataUpdatedAt)} Uhr`
          : lhp?.state === "reference"
            ? ` · Standortkatalog${lhp.fetchedAt ? ` vom ${formatDate(lhp.fetchedAt)}` : ""}, keine Live-Messwerte`
            : ""}
      </span>
      {wsv && (
        <span>
          Weitere Messwerte:{" "}
          <a
            href="https://www.pegelonline.wsv.de/"
            target="_blank"
            rel="noreferrer"
          >
            PEGELONLINE / WSV
            <ArrowUpRight size={10} />
          </a>
        </span>
      )}
    </div>
  );
}
