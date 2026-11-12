import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { verifyBriefingWebhookSignature } from "../../supabase/functions/_shared/briefing-webhook-verification";
import { resolvePublicContentApiBase } from "../../src/services/publicContent/runtimeBase";

const productionSupabase = "https://pgzizndxdyhqmtyywjmt.supabase.co";
const previewSupabase = "https://lorbuplbbhpqxonsfxml.supabase.co";
const productionPublicContent =
  `${productionSupabase}/functions/v1/public-content-read`;

describe("configured public-content Edge origin", () => {
  it("keeps production on its matching production Supabase origin", () => {
    expect(
      resolvePublicContentApiBase(productionSupabase, productionPublicContent),
    ).toBe(productionPublicContent);
  });

  it("rejects a production Supabase Function base when the app is bound to preview", () => {
    expect(
      resolvePublicContentApiBase(previewSupabase, productionPublicContent),
    ).toBe(`${previewSupabase}/functions/v1/public-content-read`);
  });

  it("derives public-content-read from the configured Supabase environment when no override exists", () => {
    expect(resolvePublicContentApiBase(previewSupabase, undefined)).toBe(
      `${previewSupabase}/functions/v1/public-content-read`,
    );
  });

  it("preserves a genuinely separate non-Supabase API base", () => {
    expect(
      resolvePublicContentApiBase(
        previewSupabase,
        "https://api.example.test/public-content",
      ),
    ).toBe("https://api.example.test/public-content");
  });
});

describe("briefing Resend Svix webhook admission and public Chart exclusion", () => {
  it("verifies a raw-body HMAC signature and rejects unsigned, tampered or stale events", async () => {
    const source = readFileSync("supabase/functions/briefing-handler/index.ts", "utf8");
    expect(source).toContain('if (!RW) return jE("webhook_not_configured"');
    expect(source).toContain("await verifyBriefingWebhookSignature(RW, req.headers, bodyText)");
    expect(source).toContain('.eq("status", "published")');
    expect(source).not.toContain("hexToBytes(");

    const key = Buffer.alloc(32, 7);
    const secret = "whsec_" + key.toString("base64");
    const nowMs = Date.UTC(2026, 10, 12, 12, 0, 0);
    const timestamp = String(Math.floor(nowMs / 1000));
    const id = "msg_wakilisha_test_001";
    const body = '{"type":"email.delivered","data":{"email_id":"fixture-123"}}';
    const signature = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`).digest("base64");
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    });
    const verify = (secretValue: string, h: Headers, payload: string, clock = nowMs) =>
      verifyBriefingWebhookSignature(secretValue, h, payload, clock);

    expect(await verify(secret, headers, body)).toBe(true);
    expect(await verify(secret, new Headers({
      ...Object.fromEntries(headers.entries()),
      "svix-signature": `v2,AAAA v1,${signature}`,
    }), body)).toBe(true);
    expect(await verify("", headers, body)).toBe(false);
    expect(await verify("whsec_invalid", headers, body)).toBe(false);
    expect(await verify(secret, headers, body + " ")).toBe(false);
    expect(await verify(secret, new Headers({
      ...Object.fromEntries(headers.entries()), "svix-id": "msg_different",
    }), body)).toBe(false);
    expect(await verify(secret, new Headers({
      ...Object.fromEntries(headers.entries()), "svix-signature": "v1,AAAA",
    }), body)).toBe(false);
    expect(await verify(secret, new Headers({
      ...Object.fromEntries(headers.entries()), "svix-signature": "v2," + signature,
    }), body)).toBe(false);
    expect(await verify(secret, new Headers(), body)).toBe(false);
    expect(await verify(secret, headers, body, nowMs + 301_000)).toBe(false);
    expect(await verify(secret, headers, body, nowMs - 301_000)).toBe(false);
  });
});
