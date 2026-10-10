/** Read-only view of the complete existing Registry review queue. */
import { supabase } from "@/lib/supabase";

export const HEADQUARTERS_QUEUE_CONTRACT = "mizizi.headquarters.registry_queue.v2" as const;
export const HEADQUARTERS_QUEUE_PAGE_SIZE = 100;
const MAX_PAGES = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LABELS: Record<string, string> = {
  mizizi_data_hygiene: "Music Identity and Credits",
  chart_entry_missing_canonical_link: "Chart Links",
  chart_provisional_label_write: "Chart Labels",
};

export type RegistryQueueFactV2 = Readonly<{
  id: string;
  title: string | null;
  review_type: string | null;
  status: string | null;
  entity_type: string | null;
  updated_at: string | null;
}>;

export type RegistryQueuePageV2 = Readonly<{
  rows: readonly RegistryQueueFactV2[];
  total: number;
  offset: number;
  limit: number;
}>;

export type QueueReviewV2 = Readonly<{
  id: string;
  title: string;
  workstream: string;
  workstreamLabel: string;
  subjectType: string;
  status: "open" | "resolved" | "other";
  sourceStatus: string;
  updatedAt: string | null;
}>;

export type QueueWorkstreamV2 = Readonly<{
  key: string;
  label: string;
  open: number;
  resolved: number;
  other: number;
  subjects: ReadonlyArray<Readonly<{ label: string; open: number }>>;
}>;

export type HeadquartersQueueV2 = Readonly<{
  contract: typeof HEADQUARTERS_QUEUE_CONTRACT;
  readAt: string;
  total: number;
  open: number;
  resolved: number;
  other: number;
  workstreams: readonly QueueWorkstreamV2[];
  items: readonly QueueReviewV2[];
  recentOpen: readonly QueueReviewV2[];
  recentResolved: readonly QueueReviewV2[];
}>;

function labelForKey(key: string): string {
  return LABELS[key] ?? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function validatePage(page: RegistryQueuePageV2, offset: number, expectedTotal: number): void {
  if (!page || !Array.isArray(page.rows) ||
      !Number.isSafeInteger(page.total) || page.total < 0 ||
      page.total !== expectedTotal || page.offset !== offset ||
      page.limit !== HEADQUARTERS_QUEUE_PAGE_SIZE ||
      page.rows.length !== Math.min(HEADQUARTERS_QUEUE_PAGE_SIZE, expectedTotal - offset)) {
    throw new TypeError("Headquarters review inventory changed during the read");
  }
}

/** Every status and type participates. Unknown types are shown, never silently discarded. */
export function projectHeadquartersQueueV2(
  pages: readonly RegistryQueuePageV2[],
  readAt: string,
): HeadquartersQueueV2 {
  if (!pages.length || !Number.isFinite(Date.parse(readAt)) || !readAt.endsWith("Z")) {
    throw new TypeError("Invalid Headquarters queue snapshot");
  }
  const total = pages[0].total;
  if (total > MAX_PAGES * HEADQUARTERS_QUEUE_PAGE_SIZE ||
      pages.length !== Math.max(1, Math.ceil(total / HEADQUARTERS_QUEUE_PAGE_SIZE))) {
    throw new RangeError("Headquarters queue snapshot exceeds its bounded read");
  }
  const seen = new Set<string>();
  const groups = new Map<string, { open: number; resolved: number; other: number; subjects: Map<string, number> }>();
  const recentOpen: QueueReviewV2[] = [];
  const items: QueueReviewV2[] = [];
  const recentResolved: QueueReviewV2[] = [];
  let open = 0;
  let resolved = 0;
  let other = 0;

  pages.forEach((page, index) => {
    validatePage(page, index * HEADQUARTERS_QUEUE_PAGE_SIZE, total);
    for (const row of page.rows) {
      if (!row || !UUID.test(row.id) || seen.has(row.id) ||
          typeof row.review_type !== "string" || !row.review_type.trim() ||
          typeof row.status !== "string" || !row.status.trim()) {
        throw new TypeError("Invalid or duplicate Registry review in Headquarters inventory");
      }
      seen.add(row.id);
      const key = row.review_type;
      const group = groups.get(key) ?? { open: 0, resolved: 0, other: 0, subjects: new Map<string, number>() };
      const status = row.status === "open" ? "open" : row.status === "resolved" ? "resolved" : "other";
      group[status] += 1;
      if (status === "open") {
        const subject = typeof row.entity_type === "string" && row.entity_type.trim()
          ? row.entity_type.trim() : "Unclassified";
        group.subjects.set(subject, (group.subjects.get(subject) ?? 0) + 1);
      }
      groups.set(key, group);
      if (status === "open") open += 1;
      else if (status === "resolved") resolved += 1;
      else other += 1;

      const item: QueueReviewV2 = {
        id: row.id,
        title: row.title?.trim() || "Review",
        workstream: key,
        workstreamLabel: labelForKey(key),
        subjectType: row.entity_type || "Review",
        status,
        sourceStatus: row.status,
        updatedAt: row.updated_at,
      };
      items.push(item);
      if (status === "open") recentOpen.push(item);
      else if (status === "resolved") recentResolved.push(item);
    }
  });
  if (seen.size !== total || open + resolved + other !== total) {
    throw new TypeError("Incomplete Headquarters queue snapshot");
  }
  const workstreams = [...groups].map(([key, value]) => ({
    key, label: labelForKey(key), open: value.open, resolved: value.resolved, other: value.other,
    subjects: [...value.subjects].map(([label, count]) => ({ label, open: count }))
      .sort((a, b) => b.open - a.open || a.label.localeCompare(b.label)),
  })).sort((a, b) => b.open - a.open || a.label.localeCompare(b.label));
  const newestFirst = (a: QueueReviewV2, b: QueueReviewV2) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id);
  return { contract: HEADQUARTERS_QUEUE_CONTRACT, readAt, total, open, resolved, other,
    items: items.sort(newestFirst), workstreams,
    recentOpen: recentOpen.sort(newestFirst).slice(0, 8),
    recentResolved: recentResolved.sort(newestFirst).slice(0, 8),
  };
}

async function readPage({ offset, limit }: { offset: number; limit: number }): Promise<RegistryQueuePageV2> {
  // Same authenticated Supabase client used by the existing Admin review service.
  // A stable UUID sort prevents tied update timestamps from shifting page boundaries.
  const { data, count, error } = await supabase
    .from("registry_review_items")
    .select("id,title,review_type,status,entity_type,updated_at", { count: "exact" })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: (data ?? []) as RegistryQueueFactV2[], total: count ?? Number.NaN, offset, limit };
}

export async function loadHeadquartersQueueV2(
  reader: (args: { offset: number; limit: number }) => Promise<RegistryQueuePageV2> = readPage,
): Promise<HeadquartersQueueV2> {
  const pages: RegistryQueuePageV2[] = [];
  const first = await reader({ limit: HEADQUARTERS_QUEUE_PAGE_SIZE, offset: 0 });
  if (!first || !Number.isSafeInteger(first.total) || first.total < 0 ||
      first.total > MAX_PAGES * HEADQUARTERS_QUEUE_PAGE_SIZE) {
    throw new RangeError("Review inventory is not available within its read limit");
  }
  pages.push(first);
  for (let offset = HEADQUARTERS_QUEUE_PAGE_SIZE; offset < first.total; offset += HEADQUARTERS_QUEUE_PAGE_SIZE) {
    pages.push(await reader({ limit: HEADQUARTERS_QUEUE_PAGE_SIZE, offset }));
  }
  return projectHeadquartersQueueV2(pages, new Date().toISOString());
}
