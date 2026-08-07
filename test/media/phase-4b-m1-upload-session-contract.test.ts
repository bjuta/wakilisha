import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260807103000_phase_4b_m1_upload_sessions.sql",
  "utf8",
);
const receiver = readFileSync("ops/media-receiver/server.py", "utf8");
const systemd = readFileSync(
  "ops/systemd/wakilisha-media-receiver.service",
  "utf8",
);
const nginx = readFileSync("ops/nginx/wakilisha-media.conf", "utf8");
const edge = readFileSync("supabase/functions/media-upload-api/index.ts", "utf8");
const design = readFileSync(
  "docs/engineering/phase-4b-m1-upload-ingress-resumable-session-design.md",
  "utf8",
);

describe("Phase 4B M1 resumable master contract", () => {
  it("reuses canonical Media file-object authority", () => {
    expect(migration).toContain("create table media.upload_sessions");
    expect(migration).toContain("media.insert_verified_file_object_v2(");
    expect(migration).toContain("storage_path ~");
    expect(migration).toContain("masters/audio/");
    expect(migration).toContain("'expired'");
    expect(migration).toContain("expire_media_upload_session_v1");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).not.toContain("create table platform_private.jobs");
  });

  it("keeps master bytes out of the Edge Function", () => {
    expect(edge).toContain('action === "create_resumable_session"');
    expect(edge).toContain('action === "finalize_resumable_session"');
    expect(edge).toContain("part_upload_base_url");
    expect(edge).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edge).toContain("const fileBytes = await fileValue.arrayBuffer()");
    expect(edge).toContain("if (requestContentType.toLowerCase().includes(\"application/json\"))");
  });

  it("preserves the narrow Phase 4A upload path", () => {
    expect(receiver).toContain('if parsed.path == "/upload"');
    expect(receiver).toContain("MAX_UPLOAD_BYTES");
    expect(edge).toContain('form.get("file")');
    expect(edge).toContain('MEDIA_UPLOAD_RECEIVER_URL');
  });

  it("enforces resumable part checksums and immutable final activation", () => {
    expect(receiver).toContain("X-Part-SHA256");
    expect(receiver).toContain("expected_part_size");
    expect(receiver).toContain("os.fsync");
    expect(receiver).toContain("os.link(staging, target)");
    expect(receiver).toContain("Immutable master destination already exists");
    expect(receiver).toContain("capability_sha256");
    expect(receiver).toContain('"byte_size": manifest.get("verified_byte_size")');
    expect(receiver).toContain('"sha256": manifest.get("verified_sha256")');
    expect(receiver).toContain("target.parent");
    expect(receiver).toContain(".assembling-");
    expect(receiver).toContain("expiry_sweeper_loop");
    expect(receiver).toContain("remove_partial_session_files");
    expect(receiver).not.toContain("os.replace(staging, target)");
  });

  it("streams resumable parts through Nginx and protects originals", () => {
    expect(nginx).toContain("location ^~ /__admin/media-upload-session/");
    expect(nginx).toContain("proxy_request_buffering off;");
    expect(nginx).toContain("client_max_body_size 9m;");
    expect(nginx).toContain("location ^~ /masters/");
    expect(nginx).toContain("return 404;");
  });

  it("source-controls the receiver service without embedding secrets", () => {
    expect(systemd).toContain("EnvironmentFile=/etc/wakilisha-media-upload.env");
    expect(systemd).toContain("/opt/wakilisha-media-upload-sessions");
    expect(systemd).not.toContain("MEDIA_UPLOAD_RECEIVER_SECRET=");
  });

  it("locks interruption, verification, cancellation, and rollback proof", () => {
    expect(design).toContain("intentional interruption");
    expect(design).toContain("exact final SHA-256");
    expect(design).toContain("exactly one canonical verified file object");
    expect(design).toContain("cancelled and its partial files removed");
    expect(design).toContain("expired session is reconciled and its partial files removed");
  });
});
