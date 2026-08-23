import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const primitive = readFileSync(
  "src/components/design-system/admin/AdminRecordActions.tsx",
  "utf8",
);
const article = readFileSync(
  "src/pages/admin/content/articles/detail/components/ArticleEditorHeader.tsx",
  "utf8",
);
const playlist = readFileSync(
  "src/pages/admin/content/playlists/detail/components/PlaylistEditorHeader.tsx",
  "utf8",
);
const audio = readFileSync(
  "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
  "utf8",
);
const registry = readFileSync(
  "scripts/control-plane/primitive-registry.json",
  "utf8",
);

describe(
  "canonical Admin Record Actions",
  () => {
    it("provides one semantic action descriptor", () => {
      expect(primitive).toContain("AdminRecordActionDescriptor");
      expect(primitive).toContain('"primary"');
      expect(primitive).toContain('"danger"');
    });

    it("is consumed by Article Playlist and Audio", () => {
      expect(article).toContain("AdminRecordActions");
      expect(playlist).toContain("AdminRecordActions");
      expect(audio).toContain("AdminRecordActions");
      expect(registry).toContain('"admin.record-actions"');
    });
  },
);
