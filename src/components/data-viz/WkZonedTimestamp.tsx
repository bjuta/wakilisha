export function formatWkZonedTimestamp(value: string | null | undefined, zone: string): string | null {
  if (!value || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: zone, day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
    }).format(instant);
  } catch { return null; }
}
export function WkZonedTimestamp({
  value, timeZone = "Africa/Nairobi",
}: { value: string | null | undefined; timeZone?: string }) {
  const output = formatWkZonedTimestamp(value, timeZone);
  return <time dateTime={output && value ? value : undefined} title={value || undefined}>
    {output ?? "Time unavailable"}
  </time>;
}
