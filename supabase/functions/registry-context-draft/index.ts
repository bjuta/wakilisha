import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_MODEL = "claude-opus-4-8";
const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".wakilisha.africa");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, headers: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

async function getUser(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const client = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

async function hasReviewAccess(db: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await db.rpc("current_user_is_administrator", {}, { headers: { "x-user-id": userId } });
  if (data === true) return true;
  const { data: rows } = await db
    .from("user_role_assignments")
    .select("role_key, role_definitions!inner(role_capabilities(capability_key))")
    .eq("user_id", userId)
    .eq("status", "active");
  return (rows ?? []).some((row: any) => {
    if (row.role_key === "administrator") return true;
    return (row.role_definitions?.role_capabilities ?? []).some((cap: any) =>
      ["manage_registry", "manage_review_queue"].includes(cap.capability_key)
    );
  });
}

async function readCredential(db: ReturnType<typeof createClient>, envKey: string, settingKey: string) {
  const envValue = Deno.env.get(envKey)?.trim();
  if (envValue) return envValue;
  const { data } = await db.from("admin_settings_secrets").select("setting_value").eq("setting_key", settingKey).maybeSingle();
  return data?.setting_value?.trim() || null;
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, headers, 405);

  const user = await getUser(req);
  if (!user) return json({ ok: false, error: "Sign in to draft an explanation." }, headers, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  if (!(await hasReviewAccess(db, user.id))) {
    return json({ ok: false, error: "Your role cannot draft Registry relationship explanations." }, headers, 403);
  }

  let body: { relationshipId?: string; evidenceId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Request body must be JSON." }, headers, 400);
  }

  const relationshipId = String(body.relationshipId ?? "").trim();
  const evidenceId = String(body.evidenceId ?? "").trim();
  if (!relationshipId || !evidenceId) {
    return json({ ok: false, error: "Choose a relationship and evidence item first." }, headers, 400);
  }

  const { data: relationship } = await db
    .from("registry_entity_relationships")
    .select("id, source_entity_type, source_entity_id, source_slug, target_entity_type, target_entity_id, target_slug, relationship_type, relationship_role")
    .eq("id", relationshipId)
    .maybeSingle();
  if (!relationship) return json({ ok: false, error: "Relationship not found." }, headers, 404);

  const { data: evidence } = await db
    .from("evidence_items")
    .select("id, title, evidence_type, source_url, summary, main_claim, why_it_matters, review_status, retrieval_status")
    .eq("id", evidenceId)
    .in("review_status", ["reviewed", "approved"])
    .maybeSingle();
  if (!evidence) return json({ ok: false, error: "Choose reviewed evidence." }, headers, 400);

  async function entityName(type: string, id: string | null, fallback: string) {
    if (!id) return fallback;
    if (type === "artist") {
      const { data } = await db.from("registry_artists").select("display_name").eq("id", id).maybeSingle();
      return data?.display_name || fallback;
    }
    if (type === "track") {
      const { data } = await db.from("registry_tracks").select("title").eq("id", id).maybeSingle();
      return data?.title || fallback;
    }
    return fallback;
  }

  const [sourceName, targetName] = await Promise.all([
    entityName(relationship.source_entity_type, relationship.source_entity_id, relationship.source_slug),
    entityName(relationship.target_entity_type, relationship.target_entity_id, relationship.target_slug),
  ]);

  const apiKey = await readCredential(db, "ANTHROPIC_API_KEY", "anthropic_api_key");
  if (!apiKey) return json({ ok: false, error: "The assistant provider is not configured." }, headers, 503);
  const model = (await readCredential(db, "INSTITUTE_ASSISTANT_MODEL", "institute_assistant_model")) || DEFAULT_MODEL;

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 700,
    thinking: { type: "adaptive" },
    system: `You are the WAKILISHA Culture Context Engine. Draft one restrained public explanation of a reviewed cultural relationship.
Rules:
- Use only the supplied relationship and evidence.
- State what happened. Do not invent cultural importance.
- Prefer one sentence. Use two only when the second adds a necessary factual limit.
- Name the specific work and year when the evidence supplies them.
- No marketing language, academic language, database language, or scene commentary.
- Never use em dashes.
- Do not write phrases such as distinct voices, shaping the sound, connecting scenes, or cultural impact unless the evidence directly proves them.
- If the evidence cannot support a clean explanation, say so in uncertainty_note.
- The human reviewer will edit and approve the final text.`,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["draft", "uncertainty_note", "facts_used"],
          properties: {
            draft: { type: "string" },
            uncertainty_note: { type: "string" },
            facts_used: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    messages: [{
      role: "user",
      content: JSON.stringify({
        sourceName,
        targetName,
        relationshipType: relationship.relationship_type,
        relationshipRole: relationship.relationship_role,
        evidence: {
          title: evidence.title,
          type: evidence.evidence_type,
          summary: evidence.summary,
          mainClaim: evidence.main_claim,
          whyItMatters: evidence.why_it_matters,
          sourceUrl: evidence.source_url,
        },
      }, null, 2),
    }],
  });

  const text = response.content.find((block: any) => block.type === "text") as { text: string } | undefined;
  if (!text) return json({ ok: false, error: "The Culture Context Engine returned no draft." }, headers, 502);

  return json({ ok: true, data: JSON.parse(text.text), meta: { model } }, headers);
});