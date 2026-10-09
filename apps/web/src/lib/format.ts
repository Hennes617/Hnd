export const formatNumber = (value: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(value);
export const formatTime = (value: string | null | undefined) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      }).format(new Date(value))
    : "—";
export const formatDate = (value: string) =>
  !Number.isNaN(new Date(value).getTime())
    ? new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      }).format(new Date(value))
    : "Zeitpunkt unbekannt";
export function warningClass(level?: number) {
  return level !== undefined && level > 0
    ? "warning"
    : level === 0
      ? "neutral"
      : "muted";
}
