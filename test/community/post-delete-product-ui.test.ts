import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const actions =
  readFileSync(
    "src/components/community/PostActions.tsx",
    "utf8",
  );

const dialog =
  readFileSync(
    "src/components/community/PostDeleteDialog.tsx",
    "utf8",
  );

const service =
  readFileSync(
    "src/services/community/posts.ts",
    "utf8",
  );

const workflow =
  readFileSync(
    ".github/workflows/critical-control-plane.yml",
    "utf8",
  );

describe(
  "WAKILISHA public Post delete product UI",
  () => {
    it(
      "never asks the author to explain why they are deleting a Post",
      () => {
        expect(actions).not.toContain(
          "window.prompt",
        );
        expect(actions).not.toContain(
          "Why are you deleting this Post?",
        );
        expect(service).toContain(
          "export async function withdrawPost(postId: string): Promise<void>",
        );
        expect(service).toContain(
          'const POST_WITHDRAWAL_AUDIT_REASON = "Deleted by publisher";',
        );
      },
    );

    it(
      "uses a WAKILISHA-native destructive confirmation instead of browser chrome",
      () => {
        expect(actions).toContain(
          'import { PostDeleteDialog } from "@/components/community/PostDeleteDialog";',
        );
        expect(actions).toContain(
          "setDeleteOpen(true);",
        );
        expect(dialog).toContain(
          'role="dialog"',
        );
        expect(dialog).toContain(
          'aria-modal="true"',
        );
        expect(dialog).toContain(
          "Delete Post?",
        );
        expect(dialog).toContain(
          "This Post will be removed from WAKILISHA.",
        );
        expect(dialog).toContain(
          "Keep Post",
        );
        expect(dialog).toContain(
          "Delete Post",
        );
      },
    );

    it(
      "keeps the product contract in protected CI",
      () => {
        expect(workflow).toContain(
          "Enforce public Post delete product UI",
        );
        expect(workflow).toContain(
          "test/community/post-delete-product-ui.test.ts",
        );
      },
    );

    it(
      "keeps the new runtime copy free of sentence-break dashes",
      () => {
        expect(
          `${actions}\n${dialog}\n${service}`,
        ).not.toMatch(
          /[\u2013\u2014]/,
        );
      },
    );
  },
);
