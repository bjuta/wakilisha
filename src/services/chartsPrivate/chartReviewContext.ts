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

export const TRACK_INTAKE_BATCH_LIMIT = 10;

const BATCH_PARAM = "chart_batch";
const positionKey = (ref:ChartReviewReference) =>
  ref.source_key+":"+ref.receipt_id+":"+ref.rank;

function validBatch(references:ChartReviewReference[]):boolean {
  return references.length<=TRACK_INTAKE_BATCH_LIMIT &&
    references.every(isChartReviewReference) &&
    new Set(references.map(positionKey)).size===references.length;
}

// Navigation only: immutable observation coordinates, never decisions,
// provider data, review IDs, credentials, or consent. Every mutation still
// requires a fresh preview and the caller-bound Registry broker.
export function parseChartIntakeBatch(params:URLSearchParams):ChartReviewReference[] {
  const entries=params.getAll(BATCH_PARAM);
  if(entries.length>TRACK_INTAKE_BATCH_LIMIT)return [];
  const references:ChartReviewReference[]=[];
  for(const entry of entries){
    const parts=entry.split(":");
    if(parts.length!==4 || !/^[1-9][0-9]*$/.test(parts[2]))return [];
    const reference={
      source_key:parts[0],receipt_id:parts[1],rank:Number(parts[2]),original_sha256:parts[3],
    };
    if(!isChartReviewReference(reference))return [];
    references.push(reference);
  }
  return validBatch(references)?references:[];
}

export function writeChartIntakeBatch(params:URLSearchParams,references:ChartReviewReference[]):URLSearchParams {
  if(!validBatch(references))throw new Error("Invalid chart intake selection.");
  const next=new URLSearchParams(params);
  next.delete(BATCH_PARAM);
  for(const reference of references)
    next.append(BATCH_PARAM,positionKey(reference)+":"+reference.original_sha256);
  return next;
}

export function appendChartIntakeBatch(href:string,references:ChartReviewReference[]):string {
  const [pathname,existing=""]=href.split("?");
  if(!pathname.startsWith("/admin/")||pathname.startsWith("//"))
    throw new Error("Chart intake destinations must be WAKILISHA Admin routes.");
  const query=writeChartIntakeBatch(new URLSearchParams(existing),references).toString();
  return pathname+(query?"?"+query:"");
}

export function chartStudioReturnHref(reference:ChartReviewReference,batch:ChartReviewReference[]=[]):string {
  return appendChartIntakeBatch(
    appendChartReviewReference("/admin/charts/studio?tab=review",reference),batch,
  );
}

export type TrackIntakeBatchResult = {
  reference: ChartReviewReference;
  suggestionId: string | null;
  error: string | null;
};

// Stage only, through the existing caller-bound broker. Stop on uncertainty;
// the existing idempotency contract permits explicit recovery of a lost reply.
export async function prepareChartTrackIntakes(
  references: ChartReviewReference[],
  stage: (reference: ChartReviewReference) => Promise<unknown>,
  onResult: (result: TrackIntakeBatchResult) => void,
): Promise<TrackIntakeBatchResult[]> {
  if (!references.length || references.length > TRACK_INTAKE_BATCH_LIMIT ||
      references.some(ref => !isChartReviewReference(ref)))
    throw new Error("Select one to ten valid source positions.");
  if (!validBatch(references)) throw new Error("Duplicate source position.");
  const results: TrackIntakeBatchResult[] = [];
  for (const reference of references) {
    let result: TrackIntakeBatchResult;
    try {
      const value = await stage(reference) as { suggestion_id?: unknown } | null;
      if (typeof value?.suggestion_id !== "string" || !UUID.test(value.suggestion_id))
        throw new Error("Registry did not return a valid review reference.");
      result = {reference,suggestionId:value.suggestion_id,error:null};
    } catch (error) {
      result = {reference,suggestionId:null,error:error instanceof Error?error.message:"Intake request failed"};
    }
    results.push(result);
    onResult(result);
    if (result.error) break;
  }
  return results;
}
