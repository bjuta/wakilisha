Deno.serve(async (_req: Request) => {
  return new Response(JSON.stringify({ ok: true, env_keys: Object.keys(Deno.env.toObject()).filter(k => k.includes('SUPA') || k.includes('VITE')) }), {
    headers: { "Content-Type": "application/json" },
  });
});