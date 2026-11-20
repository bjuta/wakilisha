// Read-only transport for an immutable Charts 2.0 source observation.
// This is a navigation reference, never mutation authority. Its destination
// must independently verify the exact receipt and rank with charts2-capture.
export type ChartReviewSource =
  | "youtube_ke" | "mdundo_ke" | "apple_ke"
  | "audiomack_ke" | "shazam_ke";

export type ChartReviewReference = {
  source_key: ChartReviewSource;
  receipt_id: string;
  original_sha256: string;
  rank: number;
};

const SOURCE_DEPTH: Record<ChartReviewSource,number> = {
  youtube_ke:100,mdundo_ke:100,apple_ke:100,
  audiomack_ke:100,shazam_ke:200,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/;

export function isChartReviewReference(input: unknown): input is ChartReviewReference {
  if (!input || typeof input !== "object") return false;
  const value=input as Record<string,unknown>;
  const source=value.source_key;
  return typeof source==="string" &&
    Object.prototype.hasOwnProperty.call(SOURCE_DEPTH,source) &&
    typeof value.receipt_id==="string" && UUID.test(value.receipt_id) &&
    typeof value.original_sha256==="string" && SHA.test(value.original_sha256) &&
    Number.isSafeInteger(value.rank) && Number(value.rank)>0 &&
    Number(value.rank)<=SOURCE_DEPTH[source as ChartReviewSource];
}

export function parseChartReviewReference(params: URLSearchParams): ChartReviewReference | null {
  const result={
    source_key:params.get("chart_source"),
    receipt_id:params.get("chart_receipt"),
    original_sha256:params.get("chart_sha"),
    rank:Number(params.get("chart_rank")),
  };
  return isChartReviewReference(result) ? result : null;
}

export function appendChartReviewReference(
  href:string,reference:ChartReviewReference,trackId?:string|null,
): string {
  if(!isChartReviewReference(reference))throw new Error("Invalid Chart observation reference");
  const [pathname,existing=""]=href.split("?");
  if(!pathname.startsWith("/admin/")||pathname.startsWith("//"))
    throw new Error("Chart review destinations must be WAKILISHA Admin routes");
  const params=new URLSearchParams(existing);
  params.set("chart_source",reference.source_key);
  params.set("chart_receipt",reference.receipt_id);
  params.set("chart_sha",reference.original_sha256);
  params.set("chart_rank",String(reference.rank));
  if(trackId){
    if(!UUID.test(trackId))throw new Error("Invalid canonical Registry Track ID");
    params.set("chart_track",trackId);
  }
  return pathname+"?"+params.toString();
}

export function chartStudioReturnHref(reference:ChartReviewReference):string {
  return appendChartReviewReference("/admin/charts/studio?tab=review",reference);
}
