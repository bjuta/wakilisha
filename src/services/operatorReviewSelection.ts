/** Pure, immutable operator-queue selection. No browser authority or side effects. */
import type { QueueReviewV2 } from "./miziziHeadquartersBrief";

export const OPERATOR_REVIEW_PAGE_SIZE = 20;
export type OperatorStatusV1 = "open" | "resolved" | "other" | "all";
export type OperatorReviewQueryV1 = Readonly<{
  status: OperatorStatusV1;
  workstream: string;
  search: string;
  page: number;
}>;
export type OperatorReviewPageV1 = Readonly<{
  total: number;
  totalPages: number;
  currentPage: number;
  start: number;
  end: number;
  items: readonly QueueReviewV2[];
}>;

export function selectOperatorReviewPageV1(
  items: readonly QueueReviewV2[],
  query: OperatorReviewQueryV1,
): OperatorReviewPageV1 {
  if (!["open", "resolved", "other", "all"].includes(query.status) ||
      typeof query.workstream !== "string" ||
      typeof query.search !== "string" ||
      !Number.isSafeInteger(query.page) || query.page < 1) {
    throw new TypeError("Invalid review selection");
  }
  const needle = query.search.trim().toLocaleLowerCase();
  const matches = items.filter((item) =>
    (query.status === "all" || item.status === query.status) &&
    (!query.workstream || item.workstream === query.workstream) &&
    (!needle || `${item.title} ${item.workstreamLabel} ${item.subjectType} ${item.id} ${item.sourceStatus}`.toLocaleLowerCase().includes(needle)),
  );
  const total = matches.length;
  const totalPages = Math.max(1, Math.ceil(total / OPERATOR_REVIEW_PAGE_SIZE));
  const currentPage = Math.min(query.page, totalPages);
  const startIndex = (currentPage - 1) * OPERATOR_REVIEW_PAGE_SIZE;
  return {
    total,
    totalPages,
    currentPage,
    start: total === 0 ? 0 : startIndex + 1,
    end: Math.min(total, startIndex + OPERATOR_REVIEW_PAGE_SIZE),
    items: matches.slice(startIndex, startIndex + OPERATOR_REVIEW_PAGE_SIZE),
  };
}

/** Inspect only a row from the already-authorized snapshot; never fetch a separate review by caller ID. */
export function selectReviewForInspectionV1(
  items: readonly QueueReviewV2[], id: string | null,
): QueueReviewV2 | null {
  if (id === null) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return items.find((item) => item.id === id) ?? null;
}
