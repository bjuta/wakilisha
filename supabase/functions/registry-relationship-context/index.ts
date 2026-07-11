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
    Vary: "Origin",
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
  if (!user) return json({ error: "Sign in to draft a relationship review." }, headers, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  if (!(await hasReviewAccess(db, user.id))) {
    return json({ error: "Your role cannot draft Registry relationship reviews." }, headers, 403);
  }

  let body: { relationshipId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, headers, 400);
  }

  const relationshipId = String(body.relationshipId ?? "").trim();
  if (!relationshipId) return json({ error: "Relationship is required." }, headers, 400);

  const { data: relationship } = await db
    .from("registry_entity_relationships")
    .select("id, source_entity_id, target_entity_id, source_entity_type, target_entity_type, relationship_type, relationship_role, source_slug, target_slug, metadata")
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

  const sourceName = sourceArtist?.display_name ?? relationship.source_slug;
  const targetName = targetArtist?.display_name ?? targetTrack?.title ?? relationship.target_slug;
  const metadata = (relationship.metadata ?? {}) as Record<string, unknown>;
  const sharedTitles = Array.isArray(metadata.shared_titles)
    ? metadata.shared_titles.filter((value): value is string => typeof value === "string")
    : [];
  const sharedTrackCount = typeof metadata.shared_track_count === "number" ? metadata.shared_track_count : null;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "The Culture Context Engine is not configured." }, headers, 503);

  const model = Deno.env.get("INSTITUTE_ASSISTANT_MODEL") || "claude-opus-4-8";
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1100,
    thinking: { type: "adaptive" },
    system: `You are the WAKILISHA Culture Context Engine. Draft a complete, accurate, human-readable first-pass review packet for one cultural relationship.
Rules:
- Use only the supplied structured context.
- Draft every requested field, including the review reason.
- Write for a human editor. Do not mention databases, internal systems, the Registry, metadata tables, or queue states in drafted copy.
- Do not call an artist featured, credited, lead, producer, writer, or guest unless the structured context explicitly proves that role.
- A title containing “feat.” does not by itself prove each person's exact role. When roles are not explicit, say the named people appear together on the work.
- Keep the evidence title specific and natural.
- Keep the evidence summary factual and complete in one or two sentences.
- The main claim must state only what the supplied context supports.
- The public explanation should usually be one sentence and no more than 24 words.
- The review reason should explain why the evidence supports the limited public wording and what the wording intentionally does not claim.
- No marketing language, academic fog, database jargon, flowery phrasing, or em dashes.
- Do not invent cultural impact, influence, scene meaning, dates, labels, credits, or roles.
- Fix grammar and singular/plural agreement before returning the draft.
- If the context is thin, still produce the safest complete draft and state the exact verification gap in uncertainty_note.
- Suggest reliability and confidence using only low, medium, or high.
- Return valid JSON only.`,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "evidence_title",
            "evidence_type",
            "evidence_summary",
            "evidence_main_claim",
            "public_explanation",
            "review_reason",
            "uncertainty_note",
            "reliability",
            "confidence",
          ],
          properties: {
            evidence_title: { type: "string" },
            evidence_type: { type: "string", enum: ["track_metadata", "release_metadata", "artist_metadata"] },
            evidence_summary: { type: "string" },
            evidence_main_claim: { type: "string" },
            public_explanation: { type: "string" },
            review_reason: { type: "string" },
            uncertainty_note: { type: "string" },
            reliability: { type: "string", enum: ["low", "medium", "high"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
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
        sharedTitles,
        sharedTrackCount,
      }),
    }],
  });

  const block = response.content.find((item: any) => item.type === "text") as { text: string } | undefined;
  if (!block) return json({ error: "The Culture Context Engine returned no draft." }, headers, 502);

  return json({ ok: true, data: JSON.parse(block.text) }, headers);
});
