import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(name, "utf8");

describe("Workbook v4 is the only active product design authority", () => {
  it("has no split v5 mobile sheet, CSS player suppressor or old font faces", () => {
    const root = read("src/index.css");
    expect(root).toContain('wakilisha-mobile-workbook-v4.css');
    expect(root).toContain('wakilisha-workbook-fonts.css');
    for (const path of [
      "src/styles/wakilisha-mobile-v5.css",
      "src/styles/wakilisha-mobile-ch53-75.css",
      "src/styles/wakilisha-fonts.css",
      "src/components/design-system/player/playerChrome.css",
    ]) expect(existsSync(path)).toBe(false);
    expect(root).not.toMatch(/wakilisha-fonts\.css|mobile-v5|mobile-ch53-75/);
    expect(read("src/components/mobile/ResponsiveAppLayout.tsx")).not.toContain("playerChrome.css");
  });
  it("preserves authentic, hash-checked fonts and never imports a font fallback system", () => {
    const manifest = JSON.parse(read("public/assets/fonts/wakilisha-font-manifest.json"));
    expect(manifest.assets).toHaveLength(6);
    expect(manifest.faces.map((face: { family: string }) => face.family)).toEqual(["Figtree", "IBM Plex Mono"]);
    expect(read("src/pages/guides/field-guide/styles.css")).not.toContain("@font-face");
    expect(read("src/design-system/wakilisha.tokens.css"))
      .toBe(read("packages/design-system/src/wakilisha.tokens.css"));
  });
  it("does not fabricate photos for chart data, registry or design specimens", () => {
    for (const path of [
      "src/data/registry/registry.ts",
      "scripts/charts/generate-public-csv-data.ts",
      "scripts/charts/repaired-content-details-api.ts",
      "src/pages/admin/design-system/components/RichSpecimenBoards.ts",
      "src/design-system/wakilisha.elements.foundation.css",
    ]) expect(read(path)).not.toContain("picsum.photos");
    expect(read("src/pages/admin/design-system/components/RichSpecimenBoards.ts"))
      .toContain("/assets/logos/wakilisha-logo-dark.svg");
    const charts = read("src/styles/wakilisha-charts-39.css");
    expect(charts).toContain("background:var(--wk-success-soft)");
    expect(charts).toContain("background:var(--wk-warning-soft)");
    expect(charts).not.toMatch(/#(?:ecfdf5|fffbeb|065f46|92400e|059669|d97706)/i);
    expect(read("src/styles/wakilisha-embeds.css")).not.toMatch(/var\(--wk-(?:accent|secondary)-500,/);

  });
  it("does not globally override unrelated utility-class modal and legacy button chrome", () => {
    const css = read("src/index.css");
    expect(css).toContain("[data-wk-modal-panel]");
    expect(css).not.toContain(".fixed.inset-0.z-50.flex.items-center.justify-center");
    const foundation = read("src/design-system/wakilisha.elements.foundation.css");
    expect(foundation).toContain("min-height:44px");
    expect(foundation).toContain("font:500 16px/1.4 var(--wk-font-ui)");
    expect(foundation).not.toContain(".btn,.wk-action");
    expect(foundation).not.toContain(".wk-ds-panel,.panel");
    expect(read("src/components/design-system/primitives/Button.tsx")).toContain("data-wk-button");
  });
  it("maintains at least 44px interactive targets in the shared Workbook controls", () => {
    const field=read("src/components/design-system/primitives/Field.tsx");
    expect(field).toContain("h-11 w-11");
    expect(field).toContain("text-[16px]");
    expect(read("src/components/design-system/primitives/Tabs.tsx")).toContain("min-h-11");
    expect(read("src/components/design-system/primitives/WakilishaToggle.tsx")).toContain("h-11 w-11");
  });
});
