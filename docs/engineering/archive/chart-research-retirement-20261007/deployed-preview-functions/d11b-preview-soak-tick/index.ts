const WINDOW_ID = "a759d574-aa1c-4037-92b9-abc929a89e0c";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const token = req.headers.get("x-wk-scheduler-token") ?? "";
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "scheduler_environment_missing" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const validation = await fetch(
    `${supabaseUrl}/rest/v1/rpc/d11b_preview_soak_scheduler_token_valid_v1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    },
  );

  if (!validation.ok || await validation.json() !== true) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/chart-research-collect`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "collect_due",
        windowId: WINDOW_ID,
      }),
    },
  );

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
});
