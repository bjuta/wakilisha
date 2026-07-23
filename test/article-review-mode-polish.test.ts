import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

function readSource(relativePath: string): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    "utf8",
  );
}

describe("Article review mode polish", () => {
  const workspace = readSource(
    "src/pages/admin/content/articles/detail/" +
      "ArticleEditorWorkspace.tsx",
  );

  const header = readSource(
    "src/pages/admin/content/articles/detail/components/" +
      "ArticleEditorHeader.tsx",
  );

  const workbenchNav = readSource(
    "src/pages/admin/content/articles/detail/components/" +
      "ArticleWorkbenchNav.tsx",
  );

  const richEditor = readSource(
    "src/components/design-system/editorial/" +
      "RichTextEditor.tsx",
  );

  it("keeps the upper workbench label neutral across document modes", () => {
    expect(workbenchNav).toContain(
      'key: "write",\n    label: "Document"',
    );

    expect(workbenchNav).toContain(
      'description: "Write, suggest, or view the Article document."',
    );
  });

  it("does not repeat the submitted version in the header mode label", () => {
    expect(workspace).not.toContain("Suggesting on v");
    expect(workspace).not.toContain("Viewing v");

    expect(workspace).toContain(
      'documentModeState.mode === "suggest"\n      ? "Suggesting"',
    );

    expect(workspace).toContain(
      'documentModeState.mode === "view"\n        ? "Viewing"',
    );
  });

  it("renders the document mode only once in the header", () => {
    expect(header).not.toMatch(
      /\{draftActionsDisabled\s*&&\s*documentModeLabel\s*\?\s*\(/,
    );

    expect(header).toContain(
      'documentModeLabel || "Submitted Version"',
    );
  });

  it("prioritizes active review guidance over draft submission guidance", () => {
    expect(workspace).toContain(
      "articlePermissions.canPublish &&\n    isPendingReview",
    );

    expect(workspace).toContain(
      "before approving it or requesting changes.",
    );
  });

  it("hides mutation menus whenever the document is read-only", () => {
    expect(richEditor).toContain(
      '{!readOnly ? (\n' +
        '          <div className="overflow-x-auto border-b border-wk-border">',
    );

    expect(richEditor).toContain(
      "<EditorialMenuBar\n" +
        "              resolveCommand={resolveMenuCommand}",
    );
  });
});
