import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".wakilisha.africa");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

async function hasReviewAccess(db: ReturnType<typeof createClient>, userId: string) {
  const { data } = await db.rpc("current_user_is_administrator");
  if (data === true) return true;
  const { data: roles } = await db
    .from("user_role_assignments")
    .select("role_key, role_definitions!inner(role_capabilities(capability_key))")
    .eq("user_id", userId)
    .eq("status", "active");
  return (roles ?? []).some((row: any) => {
    if (row.role_key === "administrator") return true;
    const capabilities = row.role_definitions?.role_capabilities ?? [];
    return capabilities.some((item: any) =>
      ["manage_registry", "manage_review_queue", "institute_assistant_use"].includes(item.capability_key)
    );
  });
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Use POST." }, headers, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Sign in to draft a relationship explanation." }, headers, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  if (!(await hasReviewAccess(db, user.id))) {
    return json({ error: "Your role cannot draft Registry relationship explanations." }, headers, 403);
  }

  let body: {
    relationshipId?: string;
    evidenceTitle?: string;
    evidenceType?: string;
    evidenceSummary?: string;
    evidenceMainClaim?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, headers, 400);
  }

  const relationshipId = String(body.relationshipId ?? "").trim();
  const evidenceTitle = String(body.evidenceTitle ?? "").trim();
  const evidenceSummary = String(body.evidenceSummary ?? "").trim();
  if (!relationshipId || !evidenceTitle || !evidenceSummary) {
    return json({ error: "Relationship, evidence title, and evidence summary are required." }, headers, 400);
  }

  const { data: relationship } = await db
    .from("registry_entity_relationships")
    .select("id, source_entity_id, target_entity_id, source_entity_type, target_entity_type, relationship_type, relationship_role")
    .eq("id", relationshipId)
    .maybeSingle();
  if (!relationship) return json({ error: "Registry relationship not found." }, headers, 404);

  const [{ data: sourceArtist }, { data: targetArtist }, { data: targetTrack }] = await Promise.all([
    relationship.source_entity_type === "artist"
      ? db.from("registry_artists").select("display_name").eq("id", relationship.source_entity_id).maybeSingle()
      : Promise.resolve({ data: null }),
    relationship.target_entity_type === "artist"
      ? db.from("registry_artists").select("display_name").eq("id", relationship.target_entity_id).maybeSingle()
      : Promise.resolve({ data: null }),
    relationship.target_entity_type === "track"
      ? db.from("registry_tracks").select("title").eq("id", relationship.target_entity_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sourceName = sourceArtist?.display_name ?? "the source artist";
  const targetName = targetArtist?.display_name ?? targetTrack?.title ?? "the related work";
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "The Culture Context Engine is not configured." }, headers, 503);

  const model = Deno.env.get("INSTITUTE_ASSISTANT_MODEL") || "claude-opus-4-8";
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
    thinking: { type: "adaptive" },
    system: `You are the WAKILISHA Culture Context Engine. Draft one restrained public explanation for a reviewed cultural relationship.
Rules:
- Use only the supplied names and evidence.
- State what happened. Do not invent cultural impact, scene meaning, influence, or importance.
- Prefer one sentence. Maximum 24 words.
- No marketing language, academic language, database language, or flowery phrasing.
- No em dashes.
- If the evidence does not identify a specific work or event, say the artists collaborated without adding detail.
- Return JSON with draft and uncertainty_note.`,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["draft", "uncertainty_note"],
          properties: {
            draft: { type: "string" },
            uncertainty_note: { type: "string" },
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
        evidenceTitle,
        evidenceType: body.evidenceType ?? "",
        evidenceSummary,
        evidenceMainClaim: body.evidenceMainClaim ?? "",
      }),
    }],
  });

  const block = response.content.find((item: any) => item.type === "text") as { text: string } | undefined;
  if (!block) return json({ error: "The Culture Context Engine returned no draft." }, headers, 502);

  return json({ ok: true, data: JSON.parse(block.text) }, headers);
});
