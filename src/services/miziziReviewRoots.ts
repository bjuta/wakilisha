import type { HeadquartersQueueV2, QueueReviewV2 } from "./miziziHeadquartersBrief";

/**
 * Read-only, fully reconciled review membership projection.
 *
 * A root edge is categorization ONLY:
 * Registry review -> recorded review_type -> recorded entity_type -> review ID.
 * The review's current status is an attribute, not an inferred stage transition.
 * No inferred source, evidence, job, contributor, geographic or rights edges.
 */
export type RootSubjectV1 = Readonly<{
  name: string;
  reviews: readonly QueueReviewV2[];
  open: number;
  resolved: number;
  other: number;
}>;
export type RootWorkstreamV1 = Readonly<{
  key: string;
  label: string;
  total: number;
  open: number;
  resolved: number;
  other: number;
  subjects: readonly RootSubjectV1[];
  reviews: readonly QueueReviewV2[];
}>;
export type MiziziReviewRootsV1 = Readonly<{
  total: number;
  readAt: string;
  workstreams: readonly RootWorkstreamV1[];
}>;

const validCount = (n: number) => Number.isSafeInteger(n) && n >= 0;
const statuses = ["open", "resolved", "other"] as const;
type Status = (typeof statuses)[number];

function counts(items: readonly QueueReviewV2[]): Record<Status, number> {
  const result: Record<Status, number> = { open: 0, resolved: 0, other: 0 };
  for (const item of items) result[item.status] += 1;
  return result;
}

/** Reject incomplete, duplicate, contradictory or malformed snapshots. Never conceal categories. */
export function projectMiziziReviewRootsV1(queue: HeadquartersQueueV2): MiziziReviewRootsV1 {
  if (!queue || !validCount(queue.total) || !validCount(queue.open) ||
      !validCount(queue.resolved) || !validCount(queue.other) ||
      queue.total > 5000 || !Array.isArray(queue.items) || !Array.isArray(queue.workstreams) ||
      queue.items.length !== queue.total ||
      queue.open + queue.resolved + queue.other !== queue.total ||
      !Number.isFinite(Date.parse(queue.readAt))) {
    throw new TypeError("Registry review roots: incomplete authenticated snapshot");
  }

  const seen = new Set<string>();
  const byWorkstream = new Map<string, QueueReviewV2[]>();
  for (const item of queue.items) {
    if (!item || !item.id?.trim() || seen.has(item.id) ||
        !item.workstream?.trim() || !item.workstreamLabel?.trim() ||
        !item.subjectType?.trim() || !item.sourceStatus?.trim() ||
        !statuses.includes(item.status) ||
        (item.sourceStatus === "open" ? "open" : item.sourceStatus === "resolved" ? "resolved" : "other") !== item.status) {
      throw new TypeError("Registry review roots: malformed or duplicate recorded review");
    }
    seen.add(item.id);
    const group = byWorkstream.get(item.workstream) ?? [];
    group.push(item);
    byWorkstream.set(item.workstream, group);
  }
  const actual = counts(queue.items);
  if (statuses.some(status => actual[status] !== queue[status]) ||
      new Set(queue.workstreams.map(group => group.key)).size !== queue.workstreams.length ||
      byWorkstream.size !== queue.workstreams.length) {
    throw new TypeError("Registry review roots: source totals disagree");
  }

  const workstreams = queue.workstreams.map(group => {
    const members = byWorkstream.get(group.key);
    if (!members || group.label !== members[0].workstreamLabel ||
        !statuses.every(status => validCount(group[status]))) {
      throw new TypeError("Registry review roots: missing or contradictory workstream");
    }
    const c = counts(members);
    if (statuses.some(status => c[status] !== group[status])) {
      throw new TypeError("Registry review roots: workstream reconciliation failed");
    }
    const bySubject = new Map<string, QueueReviewV2[]>();
    for (const review of members) {
      if (review.workstreamLabel !== group.label) {
        throw new TypeError("Registry review roots: inconsistent workstream name");
      }
      const list = bySubject.get(review.subjectType) ?? [];
      list.push(review);
      bySubject.set(review.subjectType, list);
    }
    const subjects = [...bySubject].map(([name, reviews]) => ({
      name,
      reviews: [...reviews].sort((a, b) => a.id.localeCompare(b.id)),
      ...counts(reviews),
    })).sort((a, b) => b.reviews.length - a.reviews.length || a.name.localeCompare(b.name));
    const actualOpenSubjects = new Map(subjects.map(x => [x.name, x.open]));
    if (!Array.isArray(group.subjects) ||
        new Set(group.subjects.map(x => x.label)).size !== group.subjects.length ||
        group.subjects.length !== subjects.filter(x => x.open > 0).length ||
        group.subjects.some(x => !validCount(x.open) || x.open <= 0 ||
          actualOpenSubjects.get(x.label) !== x.open)) {
      throw new TypeError("Registry review roots: subject membership disagrees");
    }
    return {
      key: group.key,
      label: group.label,
      total: members.length,
      ...c,
      subjects,
      reviews: [...members].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id)),
    };
  });

  return {
    total: queue.total,
    readAt: queue.readAt,
    workstreams: workstreams.sort((a, b) => b.open - a.open || a.label.localeCompare(b.label)),
  };
}
