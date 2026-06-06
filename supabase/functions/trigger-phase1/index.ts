
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (_req: Request) => {
  const anonKey = Deno.env.get("VITE_PUBLIC_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
  const url = "https://pgzizndxdyhqmtyywjmt.supabase.co/functions/v1/resolve-relationships-phase1";

  // Fire and forget — don't await
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
    message: "Phase 1 resolution started. Check Supabase Edge Function logs for progress." 
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
