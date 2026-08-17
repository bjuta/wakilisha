import { describe, expect, it } from "vitest";
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
