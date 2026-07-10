import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AnalyticsPayload = {
  event_name?: string;
  page_url?: string;
  page_path?: string;
  page_title?: string;
  client_id?: string;
  engagement_time_msec?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedHosts = new Set([
  "wakilisha.africa",
  "www.wakilisha.africa",
  "localhost",
  "127.0.0.1",
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function safeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function isAllowedPageUrl(pageUrl: string | null): boolean {
  if (!pageUrl) return false;

  try {
    const parsed = new URL(pageUrl);
    return allowedHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

function getRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

async function logDelivery(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  eventName: string;
  pageUrl: string | null;
  pagePath: string | null;
  clientId: string | null;
  statusCode: number | null;
  ok: boolean;
  errorMessage: string | null;
  requestId: string;
}) {
  const admin = createClient(params.supabaseUrl, params.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await admin.from("analytics_delivery_logs").insert({
    event_name: params.eventName,
    page_url: params.pageUrl,
    page_path: params.pagePath,
    client_id: params.clientId,
    delivery_target: "ga4_measurement_protocol",
    status_code: params.statusCode,
    ok: params.ok,
    error_message: params.errorMessage,
    request_id: params.requestId,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const requestId = getRequestId();

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const measurementId = Deno.env.get("GA4_MEASUREMENT_ID") ?? "";
  const apiSecret = Deno.env.get("GA4_API_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !measurementId || !apiSecret) {
    return jsonResponse(
      {
        error: "GA4 Measurement Protocol is not configured.",
        request_id: requestId,
      },
      500,
    );
  }

  let payload: AnalyticsPayload;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON.", request_id: requestId }, 400);
  }

  const eventName = safeString(payload.event_name, 64) ?? "page_view";
  const pageUrl = safeString(payload.page_url, 500);
  const pagePath = safeString(payload.page_path, 300);
  const pageTitle = safeString(payload.page_title, 300);
  const clientId = safeString(payload.client_id, 128) ?? requestId;
  const engagementTime = Number.isFinite(payload.engagement_time_msec)
    ? Math.max(1, Math.min(Number(payload.engagement_time_msec), 60000))
    : 100;

  if (!isAllowedPageUrl(pageUrl)) {
    await logDelivery({
      supabaseUrl,
      serviceRoleKey,
      eventName,
      pageUrl,
      pagePath,
      clientId,
      statusCode: 400,
      ok: false,
      errorMessage: "Rejected page_url host.",
      requestId,
    });

    return jsonResponse({ error: "Rejected page_url host.", request_id: requestId }, 400);
  }

  const gaPayload = {
    client_id: clientId,
    events: [
      {
        name: eventName,
        params: {
          page_location: pageUrl,
          page_path: pagePath,
          page_title: pageTitle,
          engagement_time_msec: engagementTime,
          session_id: Math.floor(Date.now() / 1000),
        },
      },
    ],
  };

  let statusCode: number | null = null;
  let ok = false;
  let errorMessage: string | null = null;

  try {
    const gaResponse = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
        measurementId,
      )}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gaPayload),
      },
    );

    statusCode = gaResponse.status;
    ok = gaResponse.status === 204 || gaResponse.ok;

    if (!ok) {
      errorMessage = await gaResponse.text();
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  await logDelivery({
    supabaseUrl,
    serviceRoleKey,
    eventName,
    pageUrl,
    pagePath,
    clientId,
    statusCode,
    ok,
    errorMessage,
    requestId,
  });

  if (!ok) {
    return jsonResponse(
      {
        ok,
        status_code: statusCode,
        error: errorMessage,
        request_id: requestId,
      },
      502,
    );
  }

  return jsonResponse({
    ok: true,
    status_code: statusCode,
    request_id: requestId,
  });
});
