import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe(
  "Article Author → Person convergence",
  () => {
    const migration = read(
      "supabase/migrations/20260819124500_article_author_person_convergence.sql",
    );

    const verifier = read(
      "scripts/control-plane/verify-article-author-person-convergence.sql",
    );

    const router = read(
      "src/router/config.tsx",
    );

    it(
      "locks Beautah as the approved Muiruri survivor",
      () => {
        expect(migration).toContain(
          "891bbfed-1d67-42a5-93d2-984e3f4ffe9f",
        );

        expect(migration).toContain(
          "75100f5b-0e76-47c4-91b8-d5f5557212c0",
        );

        expect(migration).toContain(
          "e0fa2ef4-8ec4-49f5-8fff-4b4230a9a65a",
        );

        expect(verifier).toContain(
          "/people/beautah",
        );
      },
    );

    it(
      "locks the exact reviewed human Article manifest",
      () => {
        expect(migration).toContain(
          "676c3a87f7e016715408d4f4f0f50699105a804fae7cfb11f540a2f216312ff0",
        );

        expect(migration).toContain(
          "1ff5ff3b56890cc9cf0d5004f899b679eef2225e19989d5fbd9bfdec424ee220",
        );

        expect(verifier).toContain(
          "human_articles",
        );

        expect(verifier).toContain(
          "134",
        );
      },
    );

    it(
      "keeps Wakilisha Staff outside Person authority",
      () => {
        expect(migration).toContain(
          "Wakilisha Staff",
        );

        expect(verifier).toContain(
          "staff_articles_deferred",
        );

        expect(verifier).toContain(
          "73",
        );
      },
    );

    it(
      "keeps Person merge and account erasure outside the data migration",
      () => {
        expect(migration).toContain(
          "public.merge_people(uuid,uuid,bigint,bigint,text,text,uuid)",
        );

        expect(migration).not.toContain(
          "do $merge_muiruri_people$",
        );

        expect(migration).not.toContain(
          "delete from auth.users",
        );

        expect(verifier).not.toContain(
          "authors_route_mode",
        );
      },
    );

    it(
      "keeps /u/:username as a first-class route",
      () => {
        expect(router).toContain(
          'path: "/u/:username"',
        );
      },
    );

    it(
      "does not yet claim /authors is removed before route convergence lands",
      () => {
        expect(router).toContain(
          'path: "/authors/:slug"',
        );
      },
    );
  },
);
