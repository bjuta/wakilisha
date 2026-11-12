// Resend uses the Svix signing contract. Never parse JSON before verification.
// This helper is intentionally Web Crypto-only for Edge and Node test parity.
export async function verifyBriefingWebhookSignature(
  signingSecret: string,
  headers: Headers,
  rawBody: string,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!signingSecret.startsWith("whsec_") || signingSecret.length <= 6) return false;

  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || id.length > 256 || !timestamp || !signatures) return false;
  if (!/^[0-9]+$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || !Number.isFinite(nowMs) ||
      Math.abs(Math.floor(nowMs / 1000) - seconds) > 300) return false;

  try {
    // whsec_ is followed by a BASE64-encoded binary HMAC key, not UTF-8.
    const keyBytes = Uint8Array.from(atob(signingSecret.slice(6)), ch => ch.charCodeAt(0));
    if (keyBytes.length < 16) return false;
    const key = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
    );
    const signedBytes = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);
    // Svix sends space-delimited versioned signatures, e.g. v1,<base64>.
    for (const token of signatures.trim().split(/\s+/).slice(0, 8)) {
      const match = /^v1,([A-Za-z0-9+/]+={0,2})$/.exec(token);
      if (!match) continue;
      const signatureBytes = Uint8Array.from(atob(match[1]), ch => ch.charCodeAt(0));
      if (signatureBytes.length !== 32) continue;
      if (await crypto.subtle.verify("HMAC", key, signatureBytes, signedBytes)) return true;
    }
    return false;
  } catch {
    // Malformed keys, signatures and browser crypto errors never grant admission.
    return false;
  }
}
