
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require admin authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized: admin access required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized: invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify admin capability
  const { data: roles } = await authClient
    .from("user_role_assignments")
    .select("role_key, role_definitions!inner(role_capabilities(capability_key))")
    .eq("user_id", user.id)
    .eq("status", "active")
    .or("expires_at.is.null,expires_at.gt.now()");

  if (!roles || roles.length === 0) {
    return new Response(JSON.stringify({ error: "Forbidden: admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isAdmin = roles.some((r: { role_key: string }) => r.role_key === "administrator");
  if (!isAdmin) {
    const allCaps = new Set<string>();
    for (const r of roles) {
      const caps = (r.role_definitions as { role_capabilities?: Array<{ capability_key: string }> } | null)
        ?.role_capabilities ?? [];
      for (const c of caps) allCaps.add(c.capability_key);
    }
    if (!allCaps.has("manage_charts")) {
      return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const anonKey = Deno.env.get("VITE_PUBLIC_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
  const url = "https://pgzizndxdyhqmtyywjmt.supabase.co/functions/v1/resolve-relationships-phase1";

  fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ingestion_run_id: "e7993517-3564-4265-9bb6-a337b22a824c",
    }),
  });

  return new Response(JSON.stringify({
    status: "triggered",
    triggered_by: user.id,
    message: "Phase 1 resolution started. Check Supabase Edge Function logs for progress."
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
