import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");

describe("configured Supabase CSP", () => {
  it("allows exactly the Supabase origin configured for the current environment", () => {
    expect(html).toContain("%VITE_PUBLIC_SUPABASE_URL%");
    expect(html).toContain("connect-src 'self'");
    expect(html).not.toContain("https://pgzizndxdyhqmtyywjmt.supabase.co");
    expect(html).not.toContain("https://*.supabase.co");
  });
});
