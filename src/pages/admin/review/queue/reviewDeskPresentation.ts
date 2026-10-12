import type { RegistryReviewItemRow } from "@/services/adminReviewCommandCenter";

/**
 * A collection here represents identical *issue templates* among loaded rows,
 * not deduplicated source identities or a batch-decision authority.
 */
export function genericChartIssue(item: RegistryReviewItemRow): boolean {
  return /^Chart provisional (?:track|release|label|artist) from [a-z0-9_]+$/i
    .test(item.title?.trim() ?? "") && Boolean(item.source_table);
}

export function chartIssueHeading(item: RegistryReviewItemRow): string {
  switch (item.source_table) {
    case "wkcharts_track_label_missing_reference_queue":
      return "Chart tracks missing label references";
    case "wkcharts_release_label_missing_reference_queue":
      return "Chart releases missing label references";
    case "wkcharts_track_release_missing_reference_queue":
      return "Chart tracks missing release references";
    case "chart_missing_canonical_track_repair_preview":
      return "Chart entries missing canonical tracks";
    default:
      return "Related chart source reviews";
  }
}

export function sourceDisplay(item: RegistryReviewItemRow): string {
  const raw = item.candidate_payload?.evidence;
  const evidence = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
  const meaningful = ["title", "label", "artist", "slug", "sourceId"]
    .map(key => evidence[key])
    .find(value => typeof value === "string" && value.trim());
  if (typeof meaningful === "string") return meaningful.trim();
  const source = item.source_id?.trim() || item.review_key?.trim() || item.id;
  const fingerprint = /^[0-9a-f]{32}$/i.test(source)
    ? source.slice(0, 12)
    : source.length > 20 ? source.slice(-12) : source;
  return "Source fingerprint " + fingerprint;
}

export type LoadedReviewGroup = {
  key: string;
  items: RegistryReviewItemRow[];
  grouped: boolean;
};

/** Never remove, merge or reinterpret source IDs when grouping identical labels. */
export function groupLoadedReviewRows(rows: readonly RegistryReviewItemRow[]): LoadedReviewGroup[] {
  const bucket = new Map<string, RegistryReviewItemRow[]>();
  const keyFor = (row: RegistryReviewItemRow) => genericChartIssue(row)
    ? ["issue", row.review_type, row.source_table, row.title, row.status, row.priority].join("::")
    : "review::" + row.id;
  for (const row of rows) {
    const key = keyFor(row);
    const items = bucket.get(key) ?? [];
    items.push(row);
    bucket.set(key, items);
  }
  const seen = new Set<string>();
  const result: LoadedReviewGroup[] = [];
  for (const row of rows) {
    const key = keyFor(row);
    if (seen.has(key)) continue;
    seen.add(key);
    const items = bucket.get(key) ?? [row];
    result.push({ key, items, grouped: genericChartIssue(row) && items.length >= 3 });
  }
  return result;
}

