
// ── SHARED BLOCK (Phase A) ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://readdy.ai","https://readdy.cc","https://www.readdy.cc","http://localhost:5173","http://localhost:3000"];

function corsRestricted(req: Request, methods="GET, POST, OPTIONS"): Record<string,string> { const o=req.headers.get("Origin")??""; const isR=o.endsWith(".readdy.cc")||o==="https://readdy.cc"; const ao=ALLOWED_ORIGINS.includes(o)||isR?o:ALLOWED_ORIGINS[0]; return {"Access-Control-Allow-Origin":ao,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"}; }

async function verifyJwt(req: Request): Promise<{id:string;email?:string}|null> { const ah=req.headers.get("Authorization"); if(!ah||!ah.startsWith("Bearer ")) return null; const t=ah.replace("Bearer ",""); const uc=createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); const {data:{user},error}=await uc.auth.getUser(t); if(error||!user) return null; return {id:user.id,email:user.email}; }

async function requireCap(userId: string, cap: string, db?: ReturnType<typeof createClient>): Promise<boolean> { const c=db??createClient(SUPABASE_URL,SERVICE_KEY); const {data:roles}=await c.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id",userId).eq("status","active").or("expires_at.is.null,expires_at.gt.now()"); if(!roles||roles.length===0) return false; if(roles.some((r:{role_key:string})=>r.role_key==="administrator")) return true; const all=new Set<string>(); for(const r of roles){const caps=(r.role_definitions as {role_capabilities?:Array<{capability_key:string}>}|null)?.role_capabilities??[];for(const c of caps)all.add(c.capability_key);} return all.has(cap); }

const rid=()=>crypto.randomUUID().slice(0,12);
const iso=()=>new Date().toISOString();

function jsonOk(data:unknown,cors:Record<string,string>,s=200):Response{return new Response(JSON.stringify({ok:true,data,meta:{requestId:rid(),servedAt:iso(),version:"1.0.0"}}),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
function jsonErr(code:string,msg:string,cors:Record<string,string>,s=400,detail?:string):Response{return new Response(JSON.stringify({ok:false,error:{code,message:msg,...(detail?{detail}:{})},meta:{requestId:rid(),servedAt:iso(),version:"1.0.0"}}),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
function jsonRaw(data:unknown,cors:Record<string,string>,s=200):Response{return new Response(JSON.stringify(data),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
// ── END SHARED BLOCK ──

// ── Table mapping ──
const TABLE_MAP: Record<string, string> = {
  artist: "registry_artists",
  track: "registry_tracks",
  release: "registry_releases",
  label: "registry_labels",
  genre: "registry_genres",
};

// ── Server-side editable field whitelist per entity type ──
const EDITABLE_FIELDS: Record<string, string[]> = {
  artist: [
    "display_name", "slug", "sort_name", "origin_iso2", "bio",
    "artist_type", "gender", "public_image_url", "status",
  ],
  track: [
    "title", "slug", "isrc", "duration_ms", "artwork_url",
    "preview_url", "explicit", "track_number", "disc_number", "status",
  ],
  release: [
    "title", "slug", "release_type", "release_date", "upc",
    "artwork_url", "description", "status",
  ],
  label: [
    "name", "slug", "country_code", "description", "status",
  ],
  genre: [
    "name", "slug", "description", "status",
  ],
};

const VALID_ENTITY_TYPES = Object.keys(TABLE_MAP);

// ── Registry-specific audit log (separate from chart_ingest_audit_events) ──
async function writeRegistryAudit(
  params: {
    actorId: string;
    actorLabel: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeValue: Record<string, unknown> | null;
    afterValue: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    await db.from("registry_audit_log").insert({
      actor_id: params.actorId,
      actor_label: params.actorLabel,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      before_value: params.beforeValue ?? {},
      after_value: params.afterValue,
      metadata: params.metadata ?? {},
    });
  } catch (e) {
    console.error("[admin-registry] audit write failed:", e instanceof Error ? e.message : String(e));
  }
}

Deno.serve(async (req) => {
  const cors = corsRestricted(req, "GET, PATCH, OPTIONS");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const auth = await verifyJwt(req);
  if (!auth) {
    return jsonErr("not_authenticated", "Missing or invalid Authorization header", cors, 401);
  }

  const canManage = await requireCap(auth.id, "manage_registry");
  if (!canManage) {
    return jsonErr("permission_denied", "Insufficient permissions. Requires manage_registry capability.", cors, 403);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const actorLabel = auth.email ?? auth.id;
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/admin-registry-api\/?/, "");
  const segments = rawPath.split("/").filter(Boolean);

  try {
    // ── GET /entities?entityType=artist&limit=50&orderBy=updated_at&ascending=false ──
    if (req.method === "GET" && segments[0] === "entities" && segments.length === 1) {
      const entityType = url.searchParams.get("entityType") ?? "";
      if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
        return jsonErr("invalid_entity_type", `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`, cors, 400);
      }

      const table = TABLE_MAP[entityType];
      const limit = Math.min(Number(url.searchParams.get("limit")) || 250, 1000);
      const orderBy = url.searchParams.get("orderBy") || "updated_at";
      const ascending = url.searchParams.get("ascending") === "true";

      const { data, error } = await adminClient
        .from(table)
        .select("*")
        .order(orderBy, { ascending, nullsFirst: false })
        .limit(limit);

      if (error) {
        return jsonErr("query_failed", error.message, cors, 500);
      }

      return jsonOk(data ?? [], cors);
    }

    // ── GET /entities/:entityType/:entityId ──
    if (req.method === "GET" && segments[0] === "entities" && segments.length === 3) {
      const entityType = segments[1];
      const entityId = segments[2];

      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return jsonErr("invalid_entity_type", `Invalid entityType: ${entityType}`, cors, 400);
      }

      const table = TABLE_MAP[entityType];
      const { data, error } = await adminClient
        .from(table)
        .select("*")
        .eq("id", entityId)
        .maybeSingle();

      if (error) {
        return jsonErr("query_failed", error.message, cors, 500);
      }

      if (!data) {
        return jsonErr("not_found", "Entity not found", cors, 404);
      }

      return jsonOk(data, cors);
    }

    // ── PATCH /entities/:entityType/:entityId ──
    if (req.method === "PATCH" && segments[0] === "entities" && segments.length === 3) {
      const entityType = segments[1];
      const entityId = segments[2];

      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return jsonErr("invalid_entity_type", `Invalid entityType: ${entityType}`, cors, 400);
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return jsonErr("malformed_body", "Invalid JSON body", cors, 400);
      }

      const expectedUpdatedAt = body._expected_updated_at as string | undefined;
      delete body._expected_updated_at;

      const allowedFields = EDITABLE_FIELDS[entityType];
      const safePatch: Record<string, unknown> = {};
      const skippedFields: Array<{ key: string; reason: string }> = [];

      for (const [key, value] of Object.entries(body)) {
        if (!allowedFields.includes(key)) {
          skippedFields.push({ key, reason: "Field is not editable or does not exist" });
          continue;
        }
        safePatch[key] = value;
      }

      if (Object.keys(safePatch).length === 0) {
        return jsonRaw({
          ok: true,
          entityType,
          entityId,
          savedFields: [],
          skippedFields,
          rejectedFields: [],
          warnings: skippedFields.length > 0
            ? [`${skippedFields.length} unsupported field(s) were not saved`]
            : [],
          meta: { requestId: rid(), servedAt: iso(), version: "1.0.0" },
        }, cors);
      }

      const table = TABLE_MAP[entityType];

      const { data: currentEntity } = await adminClient
        .from(table)
        .select("*")
        .eq("id", entityId)
        .maybeSingle();

      if (!currentEntity) {
        return jsonErr("not_found", "Entity not found", cors, 404);
      }

      if (expectedUpdatedAt) {
        const currentUpdatedAt = String(currentEntity.updated_at ?? "");
        if (currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
          return jsonRaw({
            ok: false,
            entityType,
            entityId,
            savedFields: [],
            skippedFields,
            rejectedFields: [],
            warnings: [],
            error: {
              code: "stale_update",
              message: "This record was modified by another user since you loaded it. Please refresh and try again.",
            },
            currentEntity,
            meta: { requestId: rid(), servedAt: iso(), version: "1.0.0" },
          }, cors, 409);
        }
      }

      const beforeSnapshot: Record<string, unknown> = {};
      for (const key of Object.keys(safePatch)) {
        beforeSnapshot[key] = currentEntity[key] ?? null;
      }

      safePatch.updated_at = iso();

      const { data, error } = await adminClient
        .from(table)
        .update(safePatch)
        .eq("id", entityId)
        .select("*")
        .single();

      if (error) {
        const message = error.message ?? "Unknown error";
        let errorCode = "save_failed";
        let conflictingEntity: Record<string, unknown> | null = null;
        let duplicateField: string | null = null;
        let duplicateValue: string | null = null;

        const msgLower = message.toLowerCase();
        if (msgLower.includes("duplicate key value violates unique constraint")) {
          errorCode = "duplicate_key";
          const valueMatch = message.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
          if (valueMatch) {
            duplicateField = valueMatch[1];
            duplicateValue = valueMatch[2];
          }
          if (!duplicateField) {
            const match = message.match(/unique constraint "([^"]+)"/);
            if (match) {
              const parts = match[1].split("_");
              if (parts.length >= 3) {
                duplicateField = parts[parts.length - 2];
              }
            }
          }
          if (duplicateField && duplicateValue && duplicateField !== "id") {
            const { data: conflict } = await adminClient
              .from(table)
              .select("id, title, slug, name, display_name, status")
              .eq(duplicateField, duplicateValue)
              .neq("id", entityId)
              .limit(1)
              .maybeSingle();
            if (conflict) {
              const displayName = conflict.title || conflict.name || conflict.display_name || conflict.slug || conflict.id;
              conflictingEntity = {
                id: conflict.id,
                title: displayName,
                slug: conflict.slug,
                status: conflict.status,
              };
            }
          }
        } else if (msgLower.includes("foreign key")) {
          errorCode = "foreign_key_violation";
        } else if (msgLower.includes("not null")) {
          errorCode = "required_field_missing";
        }

        return jsonRaw({
          ok: false,
          entityType,
          entityId,
          savedFields: [],
          skippedFields,
          rejectedFields: [],
          warnings: [],
          error: {
            code: errorCode,
            message,
            conflictingEntity,
            duplicateField,
            duplicateValue,
          },
          meta: { requestId: rid(), servedAt: iso(), version: "1.0.0" },
        }, cors, 409);
      }

      writeRegistryAudit({
        actorId: auth.id,
        actorLabel,
        action: "update",
        entityType,
        entityId,
        beforeValue: beforeSnapshot,
        afterValue: safePatch,
        metadata: {
          changed_fields: Object.keys(safePatch).filter((k) => k !== "updated_at"),
        },
      });

      const savedFields = Object.entries(safePatch)
        .filter(([key]) => key !== "updated_at")
        .map(([key]) => ({
          key,
          label: key,
          previousValue: beforeSnapshot[key] ?? null,
          nextValue: safePatch[key],
        }));

      return jsonOk({
        entityType,
        entityId,
        savedFields,
        skippedFields,
        rejectedFields: [],
        warnings: skippedFields.length > 0
          ? [`${skippedFields.length} unsupported field(s) were not saved`]
          : [],
        updatedEntity: data,
      }, cors);
    }

    return jsonErr("route_not_found", "Not found", cors, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonErr("internal_error", message, cors, 500);
  }
});
