import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function chunkedInsert(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  label: string,
  rpcName: string,
  chunkSize: number
): Promise<number> {
  let total = 0;
  let cursor: string | null = null;
  let num = 0;
  console.log(`${label} (chunk=${chunkSize})...`);
  while (true) {
    num++;
    const { data, error } = await supabase.rpc(rpcName, {
      p_run_id: runId, p_limit: chunkSize, p_min_id: cursor,
    });
    if (error) throw new Error(`${label} chunk ${num}: ${error.message}`);
    if (!data || data.last_id === null) break;
    const n = data.count ?? 0;
    total += n;
    if (num % 10 === 0) {
      console.log(`  -> ${label} chunk ${num}: +${n} (total ${total})`);
    }
    cursor = data.last_id;
    if (n === 0 && total === 0) break;
  }
  console.log(`  -> ${label} done: ${total} (${num} chunks)`);
  return total;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase config missing." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { runId, step } = body;
    if (!runId) {
      return new Response(JSON.stringify({ error: "runId is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: runData, error: runErr } = await supabase
      .from("wk_ingestion_runs")
      .select("id,status")
      .eq("id", runId)
      .single();

    if (runErr || !runData) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedStep = (step ?? "all") as string;

    // ===== REVIEW-ONLY =====
    if (requestedStep === "review") {
      if (runData.status !== "finalized" && runData.status !== "staged") {
        return new Response(JSON.stringify({ error: `Run must be finalized or staged. Current: ${runData.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Entity relationships — chunked via v8 (single CTE, no OFFSET)
      const cRel = await chunkedInsert(supabase, runId, "ER", "finalize_step_ers_chunk_v8", 500);

      // Custom fields — also chunked now (was the hidden monster at 20K rows)
      const cCf = await chunkedInsert(supabase, runId, "CF", "finalize_step_cf_chunk", 500);

      const cReview = cRel + cCf;
      await supabase.rpc("finalize_step_complete", {
        p_run_id: runId, p_content: 0, p_authors: 0, p_tax: 0, p_media: 0, p_entities: 0, p_review: cReview, p_errors: [],
      });

      return new Response(JSON.stringify({ success: true, review_artifacts: cReview, entity_relationships: cRel, custom_fields: cCf }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== ENTITIES-ONLY =====
    if (requestedStep === "entities") {
      if (runData.status !== "staged" && runData.status !== "finalizing") {
        return new Response(JSON.stringify({ error: `Run must be staged. Current: ${runData.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (runData.status === "staged") {
        await supabase.from("wk_ingestion_runs").update({ status: "finalizing", errors: [] }).eq("id", runId);
      }

      const allErrors: string[] = [];
      let cEntities = 0;

      console.log("Entities-only: Wakilisha entities (chunk=2000)...");
      let lastId: string | null = null;
      let chunkNum = 0;
      while (true) {
        chunkNum++;
        const { data: chunk, error: chunkErr } = await supabase.rpc("finalize_step_entities_chunk", {
          p_run_id: runId, p_limit: 2000, p_min_id: lastId,
        });
        if (chunkErr) throw new Error(`Entity chunk ${chunkNum} failed: ${chunkErr.message}`);
        if (!chunk || chunk.last_id === null) break;
        const n = chunk.count ?? 0;
        cEntities += n;
        console.log(`  -> chunk ${chunkNum}: ${n} rows (last_id ${lastId?.slice(0,8)} -> ${chunk.last_id?.slice(0,8)})`);
        lastId = chunk.last_id;
      }
      console.log(`  -> wakilisha_entities total: ${cEntities}`);

      await supabase.rpc("finalize_step_complete", {
        p_run_id: runId, p_content: 0, p_authors: 0, p_tax: 0, p_media: 0, p_entities: cEntities, p_review: 0, p_errors: allErrors,
      });

      return new Response(JSON.stringify({ success: true, wakilisha_entities: cEntities }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== ALL (phase 1: content + entities) =====
    if (runData.status !== "staged") {
      return new Response(JSON.stringify({ error: `Run must be staged. Current: ${runData.status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("wk_ingestion_runs").update({ status: "finalizing", errors: [] }).eq("id", runId);
    let allErrors: string[] = [];
    let cContent = 0, cAuthors = 0, cTax = 0, cEntities = 0;

    console.log("Step 1: Content, authors, taxonomy...");
    const { data: r1, error: e1 } = await supabase.rpc("finalize_step_content", { p_run_id: runId });
    if (e1) throw new Error(`Step 1 failed: ${e1.message}`);
    cContent = r1.content_items ?? 0;
    cAuthors = r1.authors ?? 0;
    cTax = r1.taxonomy_terms ?? 0;
    if (r1.errors?.length) allErrors.push(...r1.errors);
    console.log(`  -> content:${cContent} authors:${cAuthors} taxonomy:${cTax}`);

    console.log("Step 2: Media assets — SKIPPED");

    console.log("Step 3: Wakilisha entities (cursor-chunked)...");
    let lastId: string | null = null;
    let chunkNum = 0;
    while (true) {
      chunkNum++;
      const { data: chunk, error: chunkErr } = await supabase.rpc("finalize_step_entities_chunk", {
        p_run_id: runId, p_limit: 2000, p_min_id: lastId,
      });
      if (chunkErr) throw new Error(`Entity chunk ${chunkNum} failed: ${chunkErr.message}`);
      if (!chunk || chunk.last_id === null) break;
      const n = chunk.count ?? 0;
      cEntities += n;
      console.log(`  -> chunk ${chunkNum}: ${n} rows (last_id ${lastId?.slice(0,8)} -> ${chunk.last_id?.slice(0,8)})`);
      lastId = chunk.last_id;
    }
    console.log(`  -> wakilisha_entities total: ${cEntities}`);

    console.log("Marking run finalized...");
    const { data: result, error: e5 } = await supabase.rpc("finalize_step_complete", {
      p_run_id: runId, p_content: cContent, p_authors: cAuthors, p_tax: cTax,
      p_media: 0, p_entities: cEntities, p_review: 0, p_errors: allErrors,
    });
    if (e5) throw new Error(`Complete step failed: ${e5.message}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
