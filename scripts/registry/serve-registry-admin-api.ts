/**
 * WAKILISHA Registry Admin API
 * ────────────────────────────
 * Dedicated HTTP server for the release-shell canonicalization workflow.
 * Provider intake (search, inspect, create) is handled exclusively by the
 * Supabase Edge Function `provider-intake-api`.
 *
 * Routes:
 *   GET  /api/v1/registry/enrichment-review/release-shells
 *   POST /api/v1/registry/enrichment-review/release-shells
 *   GET  /api/v1/registry/enrichment-review/release-shells/:id/audit
 *   POST /api/v1/registry/enrichment-review/release-shells/:id/lifecycle
 *   POST /api/v1/registry/enrichment-review/release-shells/suggestions/:id/decision
 *   POST /api/v1/registry/enrichment-review/release-shells/preview-apply
 *   POST /api/v1/registry/enrichment-review/release-shells/apply-approved
 */

import http from "node:http";
import { URL } from "node:url";
import {
  applyApprovedReleaseShellSuggestions,
  buildReleaseShellEnrichmentContexts,
  createRegistryEnrichmentPool,
  getReleaseShellCanonicalWriteEvents,
  listReleaseShellEnrichmentContexts,
  previewApprovedReleaseShellSuggestions,
  updateReleaseShellLifecycleStatus,
  updateReleaseShellSuggestionDecision,
  type ReleaseShellLookupInput,
} from "./enrichment-review-runtime-api";
import {
  extractBearerToken,
  decodeJwtUnsafe,
  loadAuthorizedAdmin,
  type AuthorizedAdmin,
} from "../lib/admin-authz";

const port = Number(process.env.WAKILISHA_REGISTRY_ADMIN_API_PORT ?? 4177);
const host = process.env.WAKILISHA_REGISTRY_ADMIN_API_HOST;

let enrichmentPool: ReturnType<typeof createRegistryEnrichmentPool> | null = null;

function getPool(): ReturnType<typeof createRegistryEnrichmentPool> {
  enrichmentPool ??= createRegistryEnrichmentPool();
  return enrichmentPool;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Accept, Authorization",
  });
  res.end(JSON.stringify(body, null, 2));
}

function ok(res: http.ServerResponse, data: unknown, meta: Record<string, unknown> = {}): void {
  json(res, 200, {
    data,
    meta: { apiVersion: "v1", generatedAt: new Date().toISOString(), ...meta },
  });
}

function err(res: http.ServerResponse, status: number, code: string, message: string): void {
  json(res, status, { code, message, status });
}

// ── Phase 8: Role-based authorization ───────────────────────────────────────
// Mutation routes require manage_registry; read routes require view_registry.

async function requireAuth(
  req: http.IncomingMessage,
  requiredCapability: string,
): Promise<AuthorizedAdmin> {
  const token = extractBearerToken(req.headers as Record<string, string | string[] | undefined>);
  if (!token) throw Object.assign(new Error("Missing bearer token."), { status: 401 });
  const payload = decodeJwtUnsafe(token);
  return loadAuthorizedAdmin(String(payload.sub), requiredCapability);
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 500_000) throw new Error("Request body too large.");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function isReleaseShellLookupInput(v: unknown): v is ReleaseShellLookupInput {
  if (!v || typeof v !== "object") return false;
  return typeof (v as Record<string, unknown>).shellKey === "string";
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") { json(res, 200, {}); return; }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const prefix = "/api/v1";

  if (!url.pathname.startsWith(prefix)) { err(res, 404, "not_found", "Route not found."); return; }

  const parts = url.pathname.slice(prefix.length).split("/").filter(Boolean).map(decodeURIComponent);

  // Health check
  if (parts.length === 0 || parts[0] === "health") {
    ok(res, { ok: true, service: "wakilisha-registry-admin-api", version: "v1" });
    return;
  }

  // Require registry/enrichment-review prefix for all remaining routes
  if (parts[0] !== "registry" || parts[1] !== "enrichment-review") {
    err(res, 404, "not_found", "Route not found.");
    return;
  }

  const subParts = parts.slice(2); // e.g. ["release-shells"] or ["release-shells", ":id", "lifecycle"]

  // ── GET/POST /release-shells ──────────────────────────────────────────────
  if (subParts.length === 1 && subParts[0] === "release-shells") {
    if (req.method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
      const includeResolved = url.searchParams.get("includeResolved") === "1";
      const contexts = await listReleaseShellEnrichmentContexts(getPool(), limit, includeResolved);
      ok(res, { contexts }, { count: contexts.length });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const shells = (body as { shells?: unknown }).shells;
      if (!Array.isArray(shells) || !shells.every(isReleaseShellLookupInput)) {
        err(res, 400, "invalid_request", "Expected { shells: ReleaseShellLookupInput[] }.");
        return;
      }
      const contexts = await buildReleaseShellEnrichmentContexts(getPool(), shells);
      ok(res, { contexts }, { count: contexts.length });
      return;
    }

    err(res, 405, "method_not_allowed", "Only GET and POST are supported here.");
    return;
  }

  // ── POST /release-shells/preview-apply ───────────────────────────────────
  if (subParts.length === 2 && subParts[0] === "release-shells" && subParts[1] === "preview-apply") {
    if (req.method !== "POST") { err(res, 405, "method_not_allowed", "Only POST supported."); return; }

    // Phase 8: require view_registry (preview is read-only + necessary for write gating)
    try {
      await requireAuth(req, "view_registry");
    } catch (authErr: unknown) {
      const status = (authErr as { status?: number }).status ?? 403;
      const message = authErr instanceof Error ? authErr.message : "Forbidden";
      err(res, status, "unauthorized", message);
      return;
    }

    const body = await readBody(req);
    const registryEntityId = String((body as { registryEntityId?: unknown }).registryEntityId ?? "").trim();
    if (!registryEntityId) { err(res, 400, "invalid_request", "Missing registryEntityId."); return; }
    const preview = await previewApprovedReleaseShellSuggestions(getPool(), registryEntityId);
    ok(res, preview);
    return;
  }

  // ── POST /release-shells/apply-approved ──────────────────────────────────
  if (subParts.length === 2 && subParts[0] === "release-shells" && subParts[1] === "apply-approved") {
    if (req.method !== "POST") { err(res, 405, "method_not_allowed", "Only POST supported."); return; }

    // Phase 8: require manage_registry for canonical writes
    let adminUser: AuthorizedAdmin;
    try {
      adminUser = await requireAuth(req, "manage_registry");
    } catch (authErr: unknown) {
      const status = (authErr as { status?: number }).status ?? 403;
      const message = authErr instanceof Error ? authErr.message : "Forbidden";
      err(res, status, "unauthorized", message);
      return;
    }

    const body = await readBody(req);
    const registryEntityId = String((body as { registryEntityId?: unknown }).registryEntityId ?? "").trim();
    if (!registryEntityId) { err(res, 400, "invalid_request", "Missing registryEntityId."); return; }
    const result = await applyApprovedReleaseShellSuggestions(getPool(), registryEntityId, adminUser.userId);
    json(res, result.failed.length > 0 ? 409 : 200, {
      data: result,
      meta: { apiVersion: "v1", generatedAt: new Date().toISOString() },
    });
    return;
  }

  // ── POST /release-shells/suggestions/:id/decision ────────────────────────
  if (subParts.length === 4 && subParts[0] === "release-shells" && subParts[1] === "suggestions" && subParts[3] === "decision") {
    if (req.method !== "POST") { err(res, 405, "method_not_allowed", "Only POST supported."); return; }

    // Phase 8: require manage_review_queue or manage_registry
    try {
      await requireAuth(req, "manage_review_queue");
    } catch (authErr: unknown) {
      const status = (authErr as { status?: number }).status ?? 403;
      const message = authErr instanceof Error ? authErr.message : "Forbidden";
      err(res, status, "unauthorized", message);
      return;
    }

    const suggestionId = subParts[2];
    const body = await readBody(req);
    const decisionStatus = String((body as { decisionStatus?: unknown }).decisionStatus ?? "").trim();
    if (!["approved", "rejected", "needs_review"].includes(decisionStatus)) {
      err(res, 400, "invalid_request", "decisionStatus must be approved, rejected, or needs_review.");
      return;
    }
    const decision = await updateReleaseShellSuggestionDecision(getPool(), suggestionId, decisionStatus as "approved" | "rejected" | "needs_review");
    ok(res, { decision });
    return;
  }

  // ── POST /release-shells/:id/lifecycle ───────────────────────────────────
  if (subParts.length === 3 && subParts[0] === "release-shells" && subParts[2] === "lifecycle") {
    if (req.method !== "POST") { err(res, 405, "method_not_allowed", "Only POST supported."); return; }

    // Phase 8: require manage_registry for lifecycle transitions
    let adminUser: AuthorizedAdmin;
    try {
      adminUser = await requireAuth(req, "manage_registry");
    } catch (authErr: unknown) {
      const status = (authErr as { status?: number }).status ?? 403;
      const message = authErr instanceof Error ? authErr.message : "Forbidden";
      err(res, status, "unauthorized", message);
      return;
    }

    const registryEntityId = subParts[1];
    const body = await readBody(req);
    const status = String((body as { status?: unknown }).status ?? "").trim();
    const reason = String((body as { reason?: unknown }).reason ?? "").trim();
    if (status !== "resolved" && status !== "reopened") {
      err(res, 400, "invalid_request", "status must be resolved or reopened.");
      return;
    }
    const lifecycle = await updateReleaseShellLifecycleStatus(getPool(), registryEntityId, status, reason, adminUser.userId);
    ok(res, { lifecycle });
    return;
  }

  // ── GET /release-shells/:id/audit ────────────────────────────────────────
  if (subParts.length === 3 && subParts[0] === "release-shells" && subParts[2] === "audit") {
    if (req.method !== "GET") { err(res, 405, "method_not_allowed", "Only GET supported."); return; }
    const registryEntityId = subParts[1];
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100);
    const events = await getReleaseShellCanonicalWriteEvents(getPool(), registryEntityId, limit);
    ok(res, { events }, { count: events.length });
    return;
  }

  err(res, 404, "not_found", "Route not found.");
}

async function start(): Promise<void> {
  const server = http.createServer((req, res) => {
    route(req, res).catch((routeErr) => {
      const message = routeErr instanceof Error ? routeErr.message : "Unknown error";
      json(res, 500, { code: "internal_error", message, status: 500 });
    });
  });

  server.on("error", (serverErr: NodeJS.ErrnoException) => {
    if (serverErr.code === "EADDRINUSE") {
      console.error(`[REGISTRY ADMIN API] Port ${port} is already in use.`);
    } else {
      console.error("[REGISTRY ADMIN API] Server error:", serverErr.message);
    }
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    const addr = `http://${host ?? "localhost"}:${port}`;
    console.log(`[REGISTRY ADMIN API] Listening on ${addr}/api/v1`);
  });
}

start().catch((startErr) => {
  console.error("[REGISTRY ADMIN API] Fatal startup error:", startErr instanceof Error ? startErr.message : startErr);
  process.exit(1);
});