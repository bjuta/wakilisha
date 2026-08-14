import fs from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  fs.readFileSync("package.json", "utf8"),
);

const lazyAdmin = fs.readFileSync(
  "src/router/lazyAdmin.tsx",
  "utf8",
);

const routes = fs.readFileSync(
  "src/router/config.tsx",
  "utf8",
);

const adminShell = fs.readFileSync(
  "src/pages/admin/AdminShell.tsx",
  "utf8",
);

const adminSearch = fs.readFileSync(
  "src/data/adminSearchIndex.ts",
  "utf8",
);

const migration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260806162000_retire_wordpress_runtime.sql",
  "utf8",
);

const blueprint = fs.readFileSync(
  "docs/engineering/wordpress-runtime-retirement-blueprint.md",
  "utf8",
);

describe("WordPress runtime retirement", () => {
  it("removes administrative WordPress execution routes", () => {
    expect(routes).not.toContain(
      'path: "imports"',
    );
    expect(routes).not.toContain(
      'path: "migrate"',
    );
    expect(lazyAdmin).not.toContain(
      "AdminImportsPage",
    );
    expect(lazyAdmin).not.toContain(
      "AdminMediaMigratePage",
    );
    expect(adminShell).not.toContain(
      "/admin/imports",
    );
    expect(adminShell).not.toContain(
      "/admin/media/migrate",
    );
    expect(adminSearch).not.toContain(
      "WordPress Import",
    );
  });

  it("removes dedicated connector and import source paths", () => {
    expect(
      fs.existsSync(
        "src/services/wordpressConnectService.ts",
      ),
    ).toBe(false);

    expect(
      fs.existsSync(
        "src/services/legacyImport/wordpress",
      ),
    ).toBe(false);

    expect(
      fs.existsSync(
        "supabase/functions/migrate-media-from-wp",
      ),
    ).toBe(false);

    expect(
      fs.existsSync(
        "supabase/functions/wp-connect-proxy",
      ),
    ).toBe(false);

    expect(
      fs.existsSync(
        "supabase/functions/wp-db-stage",
      ),
    ).toBe(false);
  });

  it("removes all WordPress package commands", () => {
    const scripts = packageJson.scripts ?? {};

    for (const [name, command] of Object.entries(scripts)) {
      expect(
        `${name} ${String(command)}`.toLowerCase(),
      ).not.toContain("wordpress");
    }
  });

  it("retires the empty raw table and twelve functions", () => {
    expect(migration).toContain(
      "drop table wakilisha_raw.wk_wordpress_items;",
    );

    expect(
      migration.match(/drop function/g),
    ).toHaveLength(12);

    expect(migration).toContain(
      "promote_ready_wp_relationships_safe",
    );

    expect(migration).not.toContain(
      "cascade",
    );
  });

  it("locks the architecture decision without erasing content", () => {
    expect(blueprint).toContain(
      "WordPress is retired.",
    );
    expect(blueprint).toContain(
      "will not retain WordPress as a runtime",
    );
    expect(blueprint).toContain(
      "does not erase WAKILISHA content",
    );
    expect(blueprint).toContain(
      "No new WordPress-aware code may be added",
    );
  });
});
