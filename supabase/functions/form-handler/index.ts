import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables");
}

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "https://wakilisha.com",
  "https://www.wakilisha.com",
  "https://wakilisha.vercel.app",
  "https://wakilisha.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const ALLOWED_FORM_TYPES = [
  "newsletter",
  "contact",
  "guide_download",
  "dakar_follow",
  "lyrics_contribution",
];

// Honeypot field names — bots auto-fill these hidden fields
const HONEYPOT_FIELDS = ["website", "url", "hp_field", "_gotcha", "fax"];

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 10) return false;

  entry.count++;
  return true;
}

function validateEmail(email: string): boolean {
  // Basic RFC-compliant check — catches most invalid addresses
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";

  // Reject requests from unknown origins
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes("https://wakilisha.africa")
            ? "https://wakilisha.africa"
            : ALLOWED_ORIGINS[0],
        },
      }
    );
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  const clientIp = getClientIp(request);

  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ success: false, error: "Too many requests. Please try again in a minute." }),
      { status: 429, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  let formData: Record<string, string> = {};

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await request.json();
      formData = json;
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      for (const [key, value] of params.entries()) {
        formData[key] = value;
      }
    }
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid form data" }),
      { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  // ── Honeypot check: reject if any honeypot field is filled ──
  for (const field of HONEYPOT_FIELDS) {
    const value = (formData[field] ?? "").trim();
    if (value.length > 0) {
      // Silently accept — don't tell bots they were caught
      console.log(`Honeypot triggered: field="${field}" ip="${clientIp}"`);
      return new Response(
        JSON.stringify({ success: true, message: "Submission received" }),
        { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }
  }

  const formType = formData["wk_form_type"] ?? formData["form_type"] ?? "";

  if (!ALLOWED_FORM_TYPES.includes(formType)) {
    return new Response(
      JSON.stringify({ success: false, error: `Invalid form type: "${formType}"` }),
      { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  // ── Email validation for newsletter / contact forms ──
  const emailField = formData["email"] ?? "";
  if (emailField && !validateEmail(String(emailField))) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid email address" }),
      { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  // ── Block submissions that arrive too fast (sub-2-second form fill = bot) ──
  const timestampField = formData["_timestamp"] ?? "";
  if (timestampField) {
    const elapsed = Date.now() - Number(timestampField);
    if (elapsed < 2000) {
      console.log(`Speed check failed: elapsed=${elapsed}ms ip="${clientIp}"`);
      return new Response(
        JSON.stringify({ success: true, message: "Submission received" }),
        { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase.from("form_submissions").insert({
    form_type: formType,
    data: formData,
    submitter_ip: clientIp,
  });

  if (error) {
    console.error("Insert error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to save submission" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Submission received" }),
    { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
  );
});
