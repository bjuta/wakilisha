import http from "node:http";
import { URL } from "node:url";
import { createMagazineVisualAssetsRepository, type VisualAssetStatus } from "./visual-assets-repository";

const port = Number(process.env.WAKILISHA_VISUAL_ASSETS_API_PORT ?? 4186);
const host = process.env.WAKILISHA_VISUAL_ASSETS_API_HOST;
const repo = createMagazineVisualAssetsRepository();

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return { data, meta: { apiVersion: "v2", generatedAt: new Date().toISOString(), namespace: "magazine", resource: "visual-assets", repository: repo.kind, ...meta } };
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "Content-Type, Accept",
  });
  res.end(JSON.stringify(body, null, 2));
}

function error(res: http.ServerResponse, status: number, code: string, message: string, meta: Record<string, unknown> = {}) {
  json(res, status, { code, message, status, meta });
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error("Request body must be valid JSON."); }
}

async function route(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    if (req.method === "OPTIONS") return json(res, 200, {});
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const prefix = "/wp-json/wakilisha/v2";
    if (!url.pathname.startsWith(prefix)) return error(res, 404, "not_found", "Route not found.");
    const parts = url.pathname.slice(prefix.length).split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] !== "magazine" || parts[1] !== "visual-assets") return error(res, 404, "not_found", "Route not found.");

    if (parts.length === 3 && parts[2] === "health" && req.method === "GET") {
      return json(res, 200, envelope({ ok: await repo.testConnection(), repository: repo.kind }));
    }
    if (parts.length === 3 && parts[2] === "clear-unlocked" && req.method === "DELETE") {
      return json(res, 200, envelope({ deleted: await repo.clearUnlocked() }));
    }
    if (parts.length === 2 && req.method === "GET") {
      return json(res, 200, envelope({ assets: await repo.list(url.searchParams.get("status")) }));
    }
    if (parts.length === 3 && req.method === "GET") {
      const asset = await repo.get(parts[2]);
      if (!asset) return error(res, 404, "visual_asset_not_found", "Magazine visual asset not found.", { id: parts[2] });
      return json(res, 200, envelope({ asset }));
    }
    if (parts.length === 2 && req.method === "POST") {
      return json(res, 200, envelope({ asset: await repo.upsert(await readBody(req)) }));
    }
    if (parts.length === 3 && req.method === "PATCH") {
      const body = await readBody(req);
      const asset = await repo.setStatus(parts[2], String(body.status ?? "generated") as VisualAssetStatus, String(body.actor ?? "Muiruri Beautah"));
      if (!asset) return error(res, 404, "visual_asset_not_found", "Magazine visual asset not found.", { id: parts[2] });
      return json(res, 200, envelope({ asset }));
    }
    if (parts.length === 3 && req.method === "DELETE") {
      return json(res, 200, envelope({ deleted: await repo.remove(parts[2]) }));
    }
    return error(res, 405, "method_not_allowed", "Unsupported magazine visual asset method or route.");
  } catch (err) {
    return error(res, 500, "visual_assets_error", err instanceof Error ? err.message : "Unknown visual assets error.");
  }
}

async function start() {
  const ok = await repo.testConnection();
  if (!ok && repo.kind === "database") {
    console.error("[WAKILISHA Visual Assets API] Database table wk_magazine_visual_assets is missing or unreachable.");
    process.exit(1);
  }
  const server = http.createServer((req, res) => { void route(req, res); });
  server.listen(port, host, () => {
    const addr = `http://${host ?? "localhost"}:${port}`;
    console.log(`[WAKILISHA Visual Assets API] Listening on ${addr}/wp-json/wakilisha/v2/magazine/visual-assets`);
    console.log(`[WAKILISHA Visual Assets API] Repository mode: ${repo.kind}`);
  });
}

start().catch((err) => {
  console.error("[WAKILISHA Visual Assets API] Fatal startup error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
