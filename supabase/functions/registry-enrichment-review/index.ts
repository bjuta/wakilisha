import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  try {
    const supabase = getSupabaseClient();

    // ── POST /suggestions/:id/decision ─────────────────────────────────
    const suggestionDecisionMatch = path.match(/\/?suggestions\/([^/]+)\/decision/);
    if (suggestionDecisionMatch && req.method === "POST") {
      const suggestionId = suggestionDecisionMatch[1];
      let body = {};
      try { body = await req.json(); } catch { /* no body */ }
      const decisionStatus = body.decisionStatus;

      if (!decisionStatus) {
        return errorResponse("Missing decisionStatus", 400);
      }

      const { data, error } = await supabase
        .from("registry_enrichment_suggestions")
        .update({ decision_status: decisionStatus })
        .eq("id", suggestionId)
        .select("id, registry_entity_id, decision_status")
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      return jsonResponse({
        data: {
          decision: {
            suggestionId: data.id,
            registryEntityId: data.registry_entity_id,
            decisionStatus: data.decision_status,
          },
        },
      });
    }

    // ── POST /preview-apply ──────────────────────────────────────────────
    if (path.endsWith("/preview-apply") && req.method === "POST") {
      let body = {};
      try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId;

      if (!registryEntityId) {
        return errorResponse("Missing registryEntityId", 400);
      }

      const { data: shell } = await supabase
        .from("registry_release_shells")
        .select("release_id")
        .eq("id", registryEntityId)
        .maybeSingle();

      const { data: release } = await supabase
        .from("registry_releases")
        .select("id, title, release_date, artwork_url")
        .eq("id", shell?.release_id ?? "")
        .maybeSingle();

      const { data: suggestions } = await supabase
        .from("registry_enrichment_suggestions")
        .select("*")
        .eq("registry_entity_id", registryEntityId)
        .eq("registry_entity_type", "release")
        .eq("decision_status", "approved");

      const approved = suggestions ?? [];
      const writable = [];
      const skipped = [];

      const releaseFields = {
        title: release?.title ?? null,
        release_date: release?.release_date ?? null,
        artwork_url: release?.artwork_url ?? null,
      };

      const fieldMap = {
        title: "title",
        release_date: "release_date",
        artwork_url: "artwork_url",
      };

      for (const s of approved) {
        const fieldName = s.field_name;
        const targetPath = fieldMap[fieldName] ?? fieldName;
        const currentValue = releaseFields[targetPath] ?? null;
        const proposedValue = s.suggested_value;

        if (targetPath && ["title", "release_date", "artwork_url"].includes(targetPath)) {
          writable.push({
            suggestionId: s.id,
            fieldName,
            targetPath,
            currentValue,
            proposedValue,
            writable: true,
            reason: null,
          });
        } else {
          skipped.push({
            suggestionId: s.id,
            fieldName,
            targetPath,
            currentValue,
            proposedValue,
            writable: false,
            reason: "No matching release field",
          });
        }
      }

      return jsonResponse({
        data: {
          registryEntityId,
          canonicalReleaseExists: !!release,
          willCreateCanonicalRelease: !release,
          writable,
          skipped,
        },
      });
    }

    // ── POST /apply-approved ─────────────────────────────────────────────
    if (path.endsWith("/apply-approved") && req.method === "POST") {
      let body = {};
      try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId;
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");

      if (!registryEntityId) {
        return errorResponse("Missing registryEntityId", 400);
      }

      const { data: { user } } = await supabase.auth.getUser(token);
      const actor = user?.id ?? "system";

      const { data: shell } = await supabase
        .from("registry_release_shells")
        .select("release_id")
        .eq("id", registryEntityId)
        .maybeSingle();

      const releaseId = shell?.release_id;
      if (!releaseId) {
        return errorResponse("Shell has no linked release", 400);
      }

      const { data: release } = await supabase
        .from("registry_releases")
        .select("id, title, release_date, artwork_url")
        .eq("id", releaseId)
        .maybeSingle();

      if (!release) {
        return errorResponse("Linked release not found", 404);
      }

      const { data: suggestions } = await supabase
        .from("registry_enrichment_suggestions")
        .select("*")
        .eq("registry_entity_id", registryEntityId)
        .eq("registry_entity_type", "release")
        .eq("decision_status", "approved");

      const approved = suggestions ?? [];
      const applied = [];
      const skipped = [];
      const failed = [];
      const updates = {};

      const fieldMap = {
        title: "title",
        release_date: "release_date",
        artwork_url: "artwork_url",
      };

      for (const s of approved) {
        const fieldName = s.field_name;
        const targetPath = fieldMap[fieldName] ?? fieldName;

        if (targetPath && ["title", "release_date", "artwork_url"].includes(targetPath)) {
          updates[targetPath] = s.suggested_value;
          applied.push({
            suggestionId: s.id,
            fieldName,
            target: targetPath,
          });
        } else {
          skipped.push({
            suggestionId: s.id,
            fieldName,
            reason: "No matching release field",
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from("registry_releases")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", releaseId);

        if (updateErr) {
          failed.push({ registryEntityId, reason: updateErr.message });
          return errorResponse(`Failed to update release: ${updateErr.message}`, 500);
        }
      }

      for (const a of applied) {
        await supabase
          .from("registry_enrichment_suggestions")
          .update({ decision_status: "applied" })
          .eq("id", a.suggestionId);
      }

      for (const a of applied) {
        const beforeValue = release[a.target];
        await supabase.from("registry_canonical_write_events").insert({
          registry_entity_type: "release",
          registry_entity_id: registryEntityId,
          source_suggestion_id: a.suggestionId,
          source_table: "registry_enrichment_suggestions",
          field_name: a.fieldName,
          target_path: a.target,
          before_value: beforeValue,
          after_value: updates[a.target],
          action: "apply",
          status: "applied",
          error_message: null,
          actor,
          created_at: new Date().toISOString(),
        });
      }

      return jsonResponse({
        data: {
          registryEntityId,
          applied,
          skipped,
          failed,
        },
      });
    }

    // ── POST /:id/lifecycle ────────────────────────────────────────────
    const lifecycleMatch = path.match(/\/?([^/]+)\/lifecycle/);
    if (lifecycleMatch && !lifecycleMatch[1].includes("suggestions") && req.method === "POST") {
      const registryEntityId = lifecycleMatch[1];
      let body = {};
      try { body = await req.json(); } catch { /* no body */ }
      const status = body.status;
      const reason = body.reason ?? "";
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");

      if (!status) {
        return errorResponse("Missing status", 400);
      }

      const { data: { user } } = await supabase.auth.getUser(token);
      const actor = user?.id ?? "system";

      const { data, error } = await supabase
        .from("registry_release_shell_lifecycle_events")
        .insert({
          registry_entity_type: "release",
          registry_entity_id: registryEntityId,
          status,
          reason,
          actor,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      return jsonResponse({
        data: {
          lifecycle: {
            status: data.status,
            reason: data.reason,
            actor: data.actor,
            createdAt: data.created_at,
          },
        },
      });
    }

    // ── GET /:id/audit ─────────────────────────────────────────────────
    const auditMatch = path.match(/\/?([^/]+)\/audit/);
    if (auditMatch && req.method === "GET") {
      const registryEntityId = auditMatch[1];

      const { data, error } = await supabase
        .from("registry_canonical_write_events")
        .select("*")
        .eq("registry_entity_id", registryEntityId)
        .eq("registry_entity_type", "release")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        return errorResponse(error.message, 500);
      }

      return jsonResponse({ data: { events: data ?? [] } });
    }

    // ── 404 ─────────────────────────────────────────────────────────────
    return errorResponse("Not found", 404);
  } catch (err) {
    return errorResponse(err.message ?? "Internal server error", 500);
  }
});
