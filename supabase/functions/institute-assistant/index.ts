// Inquiry Court assistant engine.
// Runs a registered assistant job for an inquiry, logs the run in
// institute_assistant_runs, and files the output as reviewable rows in
// institute_assistant_suggestions. This function never writes to
// inquiries, evidence, relationships, claims, or any other canonical table.
// The assistant creates candidates. Humans create the record.

// ── SHARED BLOCK (Phase A) ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","http://localhost:5173","http://localhost:3000"];

function corsRestricted(req: Request, methods="POST, OPTIONS"): Record<string,string> { const o=req.headers.get("Origin")??""; const isR=o.endsWith(".wakilisha.africa")||o==="https://wakilisha.africa"; const ao=ALLOWED_ORIGINS.includes(o)||isR?o:ALLOWED_ORIGINS[0]; return {"Access-Control-Allow-Origin":ao,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"}; }

async function verifyJwt(req: Request): Promise<{id:string;email?:string}|null> { const ah=req.headers.get("Authorization"); if(!ah||!ah.startsWith("Bearer ")) return null; const t=ah.replace("Bearer ",""); const uc=createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); const {data:{user},error}=await uc.auth.getUser(t); if(error||!user) return null; return {id:user.id,email:user.email}; }

async function requireCap(userId: string, cap: string, db?: ReturnType<typeof createClient>): Promise<boolean> { const c=db??createClient(SUPABASE_URL,SERVICE_KEY); const {data:roles}=await c.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id",userId).eq("status","active").or("expires_at.is.null,expires_at.gt.now()"); if(!roles||roles.length===0) return false; if(roles.some((r:{role_key:string})=>r.role_key==="administrator")) return true; const all=new Set<string>(); for(const r of roles){const caps=(r.role_definitions as {role_capabilities?:Array<{capability_key:string}>}|null)?.role_capabilities??[];for(const c2 of caps)all.add(c2.capability_key);} return all.has(cap); }

const rid=()=>crypto.randomUUID().slice(0,12);
const iso=()=>new Date().toISOString();
function jsonOk(data:unknown,cors:Record<string,string>,s=200):Response{return new Response(JSON.stringify({ok:true,data,meta:{requestId:rid(),servedAt:iso(),version:"1.0.0"}}),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
function jsonErr(code:string,msg:string,cors:Record<string,string>,s=400,detail?:string):Response{return new Response(JSON.stringify({ok:false,error:{code,message:msg,...(detail?{detail}:{})},meta:{requestId:rid(),servedAt:iso(),version:"1.0.0"}}),{status:s,headers:{...cors,"Content-Type":"application/json"}});}

async function readCred(envVar:string,dbKey:string,db?:ReturnType<typeof createClient>):Promise<string|null>{const ev=Deno.env.get(envVar);if(ev&&ev.trim())return ev.trim();if(!db)return null;try{const{data:row}=await db.from("admin_settings_secrets").select("setting_value").eq("setting_key",dbKey).maybeSingle();if(row&&(row.setting_value as string)?.trim())return(row.setting_value as string).trim();}catch{/*ignore*/}return null;}
// ── END SHARED BLOCK ──

import Anthropic from "npm:@anthropic-ai/sdk";
import { JOB_REGISTRY, type JobContext } from "./jobs.ts";

const DEFAULT_MODEL = "claude-opus-4-8";
// USD per token, used for the run's cost_estimate field only.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5 / 1_000_000, output: 25 / 1_000_000 },
};

async function gatherContext(db: ReturnType<typeof createClient>, inquiryId: string): Promise<JobContext | null> {
  const { data: inquiry } = await db
    .from("institute_inquiries")
    .select("id, code, raw_question, current_question, current_question_version_id, status, maturity")
    .eq("id", inquiryId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!inquiry) return null;

  const [{ data: version }, { data: snapshot }, { data: evidence }, { data: setup }] = await Promise.all([
    inquiry.current_question_version_id
      ? db.from("institute_question_versions").select("id, version_number, question_text").eq("id", inquiry.current_question_version_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("institute_anchor_context_snapshots")
      .select("id, anchor_label, anchor_entity_type, knowns, unknowns, relationship_leads, evidence_gaps, thin_data_notes")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("institute_evidence_items")
      .select("id, title, evidence_kind, summary, why_it_matters, review_state")
      .eq("inquiry_id", inquiryId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
    db.from("institute_workbench_setup")
      .select("inquiry_type, output_surfaces, evidence_formats, scope_edges, care_defaults")
      .eq("inquiry_id", inquiryId)
      .maybeSingle(),
  ]);

  return {
    inquiry: inquiry as JobContext["inquiry"],
    questionVersion: (version as JobContext["questionVersion"]) ?? null,
    anchorSnapshot: (snapshot as Record<string, unknown>) ?? null,
    evidence: (evidence as JobContext["evidence"]) ?? [],
    workbenchSetup: (setup as Record<string, unknown>) ?? null,
  };
}

Deno.serve(async (req) => {
  const cors = corsRestricted(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return jsonErr("method_not_allowed", "Use POST.", cors, 405);

  const auth = await verifyJwt(req);
  if (!auth) return jsonErr("unauthorized", "Sign in to use the Inquiry Assistant.", cors, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const allowed = await requireCap(auth.id, "institute_assistant_use", db);
  if (!allowed) return jsonErr("forbidden", "Your role cannot run Inquiry Assistant jobs.", cors, 403);

  let body: { inquiryId?: string; jobType?: string; input?: { evidenceItemId?: string } };
  try {
    body = await req.json();
  } catch {
    return jsonErr("bad_request", "Request body must be JSON.", cors, 400);
  }

  const inquiryId = String(body.inquiryId ?? "").trim();
  const jobType = String(body.jobType ?? "").trim();
  if (!inquiryId || !jobType) return jsonErr("bad_request", "inquiryId and jobType are required.", cors, 400);

  const job = JOB_REGISTRY[jobType];
  if (!job) return jsonErr("unknown_job", `Job type ${jobType} is not available.`, cors, 400);

  const ctx = await gatherContext(db, inquiryId);
  if (!ctx) return jsonErr("not_found", "That inquiry could not be found.", cors, 404);

  if (job.requiresTargetEvidence) {
    const evidenceItemId = String(body.input?.evidenceItemId ?? "").trim();
    if (!evidenceItemId) return jsonErr("bad_request", "This job needs an evidence item to read.", cors, 400);
    const { data: target } = await db
      .from("institute_evidence_items")
      .select("id, title, evidence_kind, source, source_url, summary, why_it_matters, review_state")
      .eq("id", evidenceItemId)
      .eq("inquiry_id", inquiryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!target) return jsonErr("not_found", "That evidence item could not be found on this inquiry.", cors, 404);
    ctx.targetEvidence = target as NonNullable<typeof ctx.targetEvidence>;
  }

  const apiKey = await readCred("ANTHROPIC_API_KEY", "anthropic_api_key", db);
  if (!apiKey) return jsonErr("provider_not_ready", "The assistant provider is not configured yet.", cors, 503);
  const model = (await readCred("INSTITUTE_ASSISTANT_MODEL", "institute_assistant_model", db)) || DEFAULT_MODEL;

  const sourceReferences = [
    ctx.targetEvidence ? { type: "evidence_item", id: ctx.targetEvidence.id, role: "target" } : null,
    ctx.questionVersion ? { type: "question_version", id: ctx.questionVersion.id } : null,
    ctx.anchorSnapshot?.id ? { type: "anchor_context_snapshot", id: ctx.anchorSnapshot.id } : null,
    ...ctx.evidence
      .filter((item) => item.id !== ctx.targetEvidence?.id)
      .map((item) => ({ type: "evidence_item", id: item.id })),
  ].filter(Boolean);

  // 1. Log the run before calling the provider. No invisible magic.
  const { data: run, error: runInsertError } = await db
    .from("institute_assistant_runs")
    .insert({
      inquiry_id: inquiryId,
      task: job.task,
      question_version_id: ctx.questionVersion?.id ?? null,
      anchor_context_snapshot_id: (ctx.anchorSnapshot?.id as string) ?? null,
      model_provider: "anthropic",
      model_name: model,
      prompt_version: job.promptVersion,
      input_context: {
        inputSchemaVersion: job.inputSchemaVersion,
        outputSchemaVersion: job.outputSchemaVersion,
        inquiryCode: ctx.inquiry.code,
        evidenceCount: ctx.evidence.length,
        hasAnchorSnapshot: Boolean(ctx.anchorSnapshot),
        targetEvidenceId: ctx.targetEvidence?.id ?? null,
      },
      source_references: sourceReferences,
      status: "running",
      created_by: auth.id,
    })
    .select("id")
    .single();

  if (runInsertError || !run) {
    return jsonErr("run_log_failed", "Could not start the assistant run.", cors, 500);
  }

  const startedAt = Date.now();

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model,
      max_tokens: job.maxTokens,
      thinking: { type: "adaptive" },
      system: job.system,
      output_config: { format: { type: "json_schema", schema: job.outputSchema } },
      messages: [{ role: "user", content: job.buildUserContent(ctx) }],
    });

    if (response.stop_reason !== "end_turn") {
      throw new Error(`Provider stopped with reason ${response.stop_reason}`);
    }

    const textBlock = response.content.find((block: { type: string }) => block.type === "text") as
      | { type: "text"; text: string }
      | undefined;
    if (!textBlock) throw new Error("Provider returned no text output");

    const output = JSON.parse(textBlock.text) as Record<string, unknown>;
    const suggestions = job.mapSuggestions(output, ctx);

    const pricing = MODEL_PRICING[model];
    const usage = response.usage as { input_tokens: number; output_tokens: number };
    const costEstimate = pricing
      ? usage.input_tokens * pricing.input + usage.output_tokens * pricing.output
      : null;

    await db
      .from("institute_assistant_runs")
      .update({
        status: "succeeded",
        output_json: output,
        latency_ms: Date.now() - startedAt,
        cost_estimate: costEstimate,
        completed_at: iso(),
      })
      .eq("id", run.id);

    const suggestionRows = suggestions.map((s) => ({
      assistant_run_id: run.id,
      inquiry_id: inquiryId,
      suggestion_type: s.suggestion_type,
      title: s.title,
      body: s.body,
      reason: s.reason,
      confidence: s.confidence,
      source_references: sourceReferences,
      payload: s.payload,
      status: "suggested",
    }));

    const { data: inserted, error: suggestionError } = await db
      .from("institute_assistant_suggestions")
      .insert(suggestionRows)
      .select("id, suggestion_type, title, body, reason, confidence, payload, status, created_at");

    if (suggestionError) {
      await db
        .from("institute_assistant_runs")
        .update({ status: "failed", error_message: `Suggestions could not be saved: ${suggestionError.message}` })
        .eq("id", run.id);
      return jsonErr("suggestions_failed", "The run finished but its suggestions could not be saved.", cors, 500);
    }

    return jsonOk({ runId: run.id, task: job.task, model, suggestions: inserted ?? [] }, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .from("institute_assistant_runs")
      .update({
        status: "failed",
        error_message: message.slice(0, 900),
        latency_ms: Date.now() - startedAt,
        completed_at: iso(),
      })
      .eq("id", run.id);
    console.error("[institute-assistant]", message);
    return jsonErr("run_failed", "The assistant run did not finish. The run log has the details.", cors, 502);
  }
});
