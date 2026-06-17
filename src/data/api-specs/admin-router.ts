export const adminRouterSpec = {
  openapi: "3.0.3",
  info: {
    title: "WAKILISHA Admin API",
    description: "Admin gateway for WAKILISHA operations — registry CRUD, chart ingestion, provider credentials, and user management. All endpoints (except /health) require a Supabase JWT.",
    version: "4.0.0",
    contact: { name: "WAKILISHA Engineering", url: "https://wakilisha.africa" }
  },
  servers: [{ url: "https://pgzizndxdyhqmtyywjmt.supabase.co/functions/v1/admin-router", description: "Production" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "System", description: "Health check" },
    { name: "Registry", description: "Entity CRUD (artists, tracks, releases, labels, genres)" },
    { name: "Credentials", description: "Provider credential management" },
    { name: "Users", description: "Admin user invites, password resets, email testing" },
    { name: "Charts", description: "Chart ingestion pipeline — dry runs, scoring, normalization, carry-forward, shortlist, commit" }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check (public — no auth)",
        operationId: "healthCheck",
        tags: ["System"],
        security: [],
        responses: { "200": { description: "Service health", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, data: { type: "object", properties: { ok: { type: "boolean" }, service: { type: "string" }, version: { type: "string" }, timestamp: { type: "string" }, sections: { type: "array", items: { type: "string" } }, uptime: { type: "string" } } } } } } } } }
      }
    },
    "/registry/entities": {
      get: {
        summary: "List registry entities",
        operationId: "listRegistryEntities",
        tags: ["Registry"],
        parameters: [
          { name: "entityType", in: "query", required: true, schema: { type: "string", enum: ["artist", "track", "release", "label", "genre"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 250, maximum: 1000 } },
          { name: "orderBy", in: "query", schema: { type: "string", default: "updated_at" } },
          { name: "ascending", in: "query", schema: { type: "boolean", default: false } }
        ],
        responses: { "200": { description: "Entity list" }, "400": { description: "Invalid entityType" }, "403": { description: "Missing manage_registry capability" } }
      }
    },
    "/registry/entities/{entityType}/{entityId}": {
      get: {
        summary: "Get single registry entity",
        operationId: "getRegistryEntity",
        tags: ["Registry"],
        parameters: [
          { name: "entityType", in: "path", required: true, schema: { type: "string", enum: ["artist", "track", "release", "label", "genre"] } },
          { name: "entityId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "Entity data" }, "404": { description: "Entity not found" } }
      },
      patch: {
        summary: "Update registry entity fields",
        operationId: "patchRegistryEntity",
        tags: ["Registry"],
        parameters: [
          { name: "entityType", in: "path", required: true, schema: { type: "string", enum: ["artist", "track", "release", "label", "genre"] } },
          { name: "entityId", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { _expected_updated_at: { type: "string", description: "Stale-update guard" } }, additionalProperties: true } } }
        },
        responses: {
          "200": { description: "Fields saved" },
          "400": { description: "Malformed body" },
          "403": { description: "Missing manage_registry capability" },
          "404": { description: "Entity not found" },
          "409": { description: "Stale update or duplicate key" }
        }
      }
    },
    "/credentials": {
      post: {
        summary: "Save, clear, or health-check provider credentials",
        operationId: "manageCredentials",
        tags: ["Credentials"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["action", "provider"], properties: { action: { type: "string", enum: ["save", "clear", "health_check"] }, provider: { type: "string", enum: ["spotify", "apple_music", "acrcloud", "youtube", "airplay"] }, credentials: { type: "object" }, envVars: { type: "array", items: { type: "string" } } } } } }
        },
        responses: { "200": { description: "Operation result" }, "400": { description: "Missing provider or credentials" }, "403": { description: "Missing manage_settings capability" } }
      }
    },
    "/users": {
      post: {
        summary: "Invite users, send password resets, or test email delivery",
        operationId: "manageUsers",
        tags: ["Users"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["action"], properties: { action: { type: "string", enum: ["invite_user", "send_password_reset", "send_test_email"] }, email: { type: "string", format: "email" }, role_key: { type: "string" }, display_name: { type: "string" }, redirect_to: { type: "string", format: "uri" }, scopes: { type: "array", items: { type: "object", properties: { scope_type: { type: "string" }, scope_value: { type: "string" }, can_view: { type: "boolean" }, can_edit: { type: "boolean" }, can_publish: { type: "boolean" } } } }, user_id: { type: "string" } } } } }
        },
        responses: { "200": { description: "Operation result" }, "400": { description: "Missing required fields" }, "403": { description: "Missing manage_users capability" } }
      }
    },
    "/charts": {
      post: {
        summary: "Chart ingestion operations (action-based dispatch)",
        description: "All chart actions via POST /charts with { action, runId, ...params }. Capability-gated per action.",
        operationId: "chartAction",
        tags: ["Charts"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["action"], properties: { action: { type: "string", enum: ["create_dry_run", "list_runs", "get_run", "source_fetch", "normalize_run", "run_eligibility", "run_carry_forward", "run_scoring", "run_shortlist", "run_full_pipeline", "cancel_run", "retry_run", "reset_pipeline", "csv_list", "preflight", "get_stages", "get_sources", "get_candidates", "get_normalized", "get_kpis", "get_activity", "get_resource_guard", "get_review_issues", "get_matches_for_run", "validate_commit", "commit_run", "run_airplay_detection", "send_gaps_to_review", "fix_chart_artist_slugs", "reingest_edition"] }, runId: { type: "string" }, limit: { type: "integer" }, request: { type: "object" } } } } }
        },
        responses: {
          "200": { description: "Action result (shape varies by action)" },
          "400": { description: "Missing required params" },
          "403": { description: "Missing required capability" },
          "500": { description: "Internal error with detail" }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Supabase JWT from auth session" }
    },
    schemas: {
      ApiError: { type: "object", properties: { ok: { type: "boolean", enum: [false] }, error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, detail: { type: "string" } } }, meta: { type: "object", properties: { requestId: { type: "string" }, servedAt: { type: "string" }, version: { type: "string" } } } } },
      ApiSuccess: { type: "object", properties: { ok: { type: "boolean", enum: [true] }, data: {}, meta: { type: "object", properties: { requestId: { type: "string" }, servedAt: { type: "string" }, version: { type: "string" } } } } }
    }
  }
} as const;