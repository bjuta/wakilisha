import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

// ── Permission check ──
async function userCanManageRegistry(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await adminClient
    .from("user_role_assignments")
    .select("role_key")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error || !data || data.length === 0) return false;

  const roleKeys = data.map((r: { role_key: string }) => r.role_key);

  if (roleKeys.includes("administrator")) return true;

  const { data: caps } = await adminClient
    .from("role_capabilities")
    .select("capability_key")
    .in("role_key", roleKeys)
    .eq("capability_key", "manage_registry");

  return (caps && caps.length > 0);
}

// ── Write audit log ──
async function writeAuditLog(
  adminClient: ReturnType<typeof createClient>,
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
  await adminClient.from("registry_audit_log").insert({
    actor_id: params.actorId,
    actor_label: params.actorLabel,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    before_value: params.beforeValue ?? {},
    after_value: params.afterValue,
    metadata: params.metadata ?? {},
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({
      ok: false,
      error: "Missing Authorization header",
      errorCode: "not_authenticated",
    }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({
      ok: false,
      error: "Invalid or expired token",
      errorCode: "not_authenticated",
    }, 401);
  }

  const adminClient = createClient(supabaseUrl, supabaseKey);

  const canManage = await userCanManageRegistry(adminClient, user.id);
  if (!canManage) {
    return jsonResponse({
      ok: false,
      error: "Insufficient permissions. Requires manage_registry capability.",
      errorCode: "permission_denied",
    }, 403);
  }

  const actorLabel = user.email ?? user.id;
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/admin-registry-api\/?/, "");
  const segments = rawPath.split("/").filter(Boolean);

  try {
    if (req.method === "GET" && segments[0] === "entities" && segments.length === 1) {
      const entityType = url.searchParams.get("entityType") ?? "";
      if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
        return jsonResponse({
          ok: false,
          error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`,
          errorCode: "invalid_entity_type",
        }, 400);
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
        return jsonResponse({
          ok: false,
          error: error.message,
          errorCode: "query_failed",
        }, 500);
      }

      return jsonResponse({ ok: true, data: data ?? [] });
    }

    if (req.method === "GET" && segments[0] === "entities" && segments.length === 3) {
      const entityType = segments[1];
      const entityId = segments[2];

      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return jsonResponse({
          ok: false,
          error: `Invalid entityType: ${entityType}`,
          errorCode: "invalid_entity_type",
        }, 400);
      }

      const table = TABLE_MAP[entityType];
      const { data, error } = await adminClient
        .from(table)
        .select("*")
        .eq("id", entityId)
        .maybeSingle();

      if (error) {
        return jsonResponse({
          ok: false,
          error: error.message,
          errorCode: "query_failed",
        }, 500);
      }

      if (!data) {
        return jsonResponse({
          ok: false,
          error: "Entity not found",
          errorCode: "not_found",
        }, 404);
      }

      return jsonResponse({ ok: true, data });
    }

    if (req.method === "PATCH" && segments[0] === "entities" && segments.length === 3) {
      const entityType = segments[1];
      const entityId = segments[2];

      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return jsonResponse({
          ok: false,
          error: `Invalid entityType: ${entityType}`,
          errorCode: "invalid_entity_type",
        }, 400);
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({
          ok: false,
          error: "Invalid JSON body",
          errorCode: "malformed_body",
        }, 400);
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
        return jsonResponse({
          ok: true,
          entityType,
          entityId,
          savedFields: [],
          skippedFields,
          rejectedFields: [],
          warnings: skippedFields.length > 0
            ? [`${skippedFields.length} unsupported field(s) were not saved`]
            : [],
        });
      }

      const table = TABLE_MAP[entityType];

      const { data: currentEntity } = await adminClient
        .from(table)
        .select("*")
        .eq("id", entityId)
        .maybeSingle();

      if (!currentEntity) {
        return jsonResponse({
          ok: false,
          error: "Entity not found",
          errorCode: "not_found",
        }, 404);
      }

      if (expectedUpdatedAt) {
        const currentUpdatedAt = String(currentEntity.updated_at ?? "");
        if (currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
          return jsonResponse({
            ok: false,
            entityType,
            entityId,
            savedFields: [],
            skippedFields,
            rejectedFields: [],
            warnings: [],
            errorCode: "stale_update",
            message: "This record was modified by another user since you loaded it. Please refresh and try again.",
            currentEntity,
          }, 409);
        }
      }

      const beforeSnapshot: Record<string, unknown> = {};
      for (const key of Object.keys(safePatch)) {
        beforeSnapshot[key] = currentEntity[key] ?? null;
      }

      safePatch.updated_at = new Date().toISOString();

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
            const match = message.match(/unique constraint \"([^\"]+)\"/);
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

        return jsonResponse({
          ok: false,
          entityType,
          entityId,
          savedFields: [],
          skippedFields,
          rejectedFields: [],
          warnings: [],
          errorCode,
          message,
          conflictingEntity,
          duplicateField,
          duplicateValue,
        }, 409);
      }

      writeAuditLog(adminClient, {
        actorId: user.id,
        actorLabel,
        action: "update",
        entityType,
        entityId,
        beforeValue: beforeSnapshot,
        afterValue: safePatch,
        metadata: {
          changed_fields: Object.keys(safePatch).filter((k) => k !== "updated_at"),
        },
      }).catch((err) => console.error("Audit log write failed:", err));

      const savedFields = Object.entries(safePatch)
        .filter(([key]) => key !== "updated_at")
        .map(([key]) => ({
          key,
          label: key,
          previousValue: beforeSnapshot[key] ?? null,
          nextValue: safePatch[key],
        }));

      return jsonResponse({
        ok: true,
        entityType,
        entityId,
        savedFields,
        skippedFields,
        rejectedFields: [],
        warnings: skippedFields.length > 0
          ? [`${skippedFields.length} unsupported field(s) were not saved`]
          : [],
        updatedEntity: data,
      });
    }

    return jsonResponse({
      ok: false,
      error: "Not found",
      errorCode: "route_not_found",
    }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({
      ok: false,
      error: message,
      errorCode: "internal_error",
    }, 500);
  }
});
