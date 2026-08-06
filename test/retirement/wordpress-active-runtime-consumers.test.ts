import fs from "node:fs";
import { describe, expect, it } from "vitest";

const authors = fs.readFileSync(
  "src/pages/admin/registry/authors/page.tsx",
  "utf8",
);

const mediaPicker = fs.readFileSync(
  "src/components/admin/MediaPickerModal.tsx",
  "utf8",
);

const mediaLibrary = fs.readFileSync(
  "src/components/admin/media/MediaLibraryCore.tsx",
  "utf8",
);

const mediaService = fs.readFileSync(
  "src/services/mediaService.ts",
  "utf8",
);

const chartClient = fs.readFileSync(
  "src/services/chartsIngestion/client.ts",
  "utf8",
);

const chartHealth = fs.readFileSync(
  "src/pages/admin/charts/ingest-health/page.tsx",
  "utf8",
);

const integrationMap = fs.readFileSync(
  "src/pages/admin/charts/integration-map/page.tsx",
  "utf8",
);

const notFound = fs.readFileSync(
  "src/pages/NotFound.tsx",
  "utf8",
);

describe(
  "WordPress active runtime consumer retirement",
  () => {
    it("removes the final author-sync caller", () => {
      expect(authors).not.toContain(
        "wp-connect-proxy",
      );
      expect(authors).not.toContain(
        "WordPress Author Sync",
      );
      expect(authors).not.toContain(
        "fetchWpUsers",
      );
    });

    it("prevents new Media from using the retired source", () => {
      expect(mediaPicker).not.toContain(
        'sourceKind: "wordpress_database"',
      );
      expect(mediaPicker).toContain(
        'sourceKind: "admin_upload"',
      );
      expect(mediaLibrary).not.toContain(
        'value="wordpress_database"',
      );
      expect(mediaService).not.toContain(
        '?? "wordpress_database"',
      );
      expect(mediaService).toContain(
        '?? "admin_upload"',
      );
    });

    it("removes the retired import-job client", () => {
      expect(
        fs.existsSync(
          "src/services/migrationImportJobs.ts",
        ),
      ).toBe(false);
    });

    it("exposes only the Supabase chart runtime", () => {
      for (const source of [
        chartClient,
        chartHealth,
        integrationMap,
      ]) {
        expect(source).not.toContain(
          "testWordPressConnection",
        );
        expect(source).not.toContain(
          "WORDPRESS_CHART_ENDPOINTS",
        );
        expect(source).not.toContain(
          "INGEST_STUDIO_WP_ENDPOINTS",
        );
        expect(source).not.toContain(
          "WP_API_BASE",
        );
        expect(source).not.toContain(
          "WAKILISHA_REST_NONCE",
        );
      }

      expect(chartClient).toContain(
        'backend: "supabase"',
      );
      expect(chartHealth).toContain(
        "authenticated Supabase session",
      );
      expect(chartHealth).toContain(
        "RUNTIME_CHART_ENDPOINTS",
      );
      expect(integrationMap).toContain(
        "testAPIConnection",
      );
    });

    it("does not classify retired routes in application code", () => {
      expect(notFound).not.toContain(
        'pathname.startsWith("/wp-content/")',
      );
      expect(notFound).not.toContain(
        'pathname.startsWith("/wp-admin/")',
      );
    });
  },
);
