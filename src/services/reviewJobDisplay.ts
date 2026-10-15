import type { QueueReviewV2 } from "@/services/miziziHeadquartersBrief";
import type { CaseSubject } from "@/services/miziziCaseField";

/** A name is source-backed only when it comes from the canonical Registry read.
 * Review classification and generated issue titles are not subject identity.
 */
export function reviewJobDisplay(item: QueueReviewV2, subject?: CaseSubject) {
  if (!subject || subject.reviewId !== item.id ||
      subject.kind !== item.subjectType || !subject.title.trim()) {
    return {
      title: item.subjectType === "track" ? "Recording name unavailable"
        : item.subjectType === "release" ? "Release name unavailable"
        : item.title,
      type: item.subjectType === "track" ? "Recording"
        : item.subjectType === "release" ? "Release" : item.subjectType,
      credits: [] as string[],
      isrc: null as string | null,
      issue: item.title,
      sourced: false,
    };
  }
  const credits = [...new Set(subject.artists
    .filter(artist => artist.status !== "archived")
    .map(artist => artist.name.trim()).filter(Boolean))];
  return {
    title: subject.title,
    type: subject.kind === "track" ? "Recording" : "Release",
    credits,
    isrc: subject.isrc,
    issue: item.title,
    sourced: true,
  };
}
