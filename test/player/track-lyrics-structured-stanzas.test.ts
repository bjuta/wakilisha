import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  lyricsDocumentToDisplayText,
  lyricsDocumentToEditorText,
  parseLyricsEditorText,
  type TrackLyricsDocument,
} from "@/services/player/trackLyricsService";

const migration = readFileSync(
  "supabase/migrations/20260825102000_track_lyrics_structured_stanza_authority.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-track-lyrics-structured-stanza-authority.sql",
  "utf8",
);
const playerText = readFileSync(
  "src/components/design-system/player/PlayerTimedTextPanel.tsx",
  "utf8",
);
const playerSurface = readFileSync(
  "src/components/design-system/player/PlayerFullSurface.tsx",
  "utf8",
);
const trackSection = readFileSync(
  "src/pages/tracks/detail/components/TrackLyricsSection.tsx",
  "utf8",
);
const reviewWorkspace = readFileSync(
  "src/pages/admin/content/lyrics/components/LyricsContributionReviewWorkspace.tsx",
  "utf8",
);

function documentFromPlainInput(
  input: string,
): TrackLyricsDocument {
  const parsed = parseLyricsEditorText(input, "plain");

  return {
    trackId: "track-1",
    versionId: "version-1",
    versionNumber: 1,
    languageCode: "en",
    timingMode: "plain",
    lines: parsed.map((line, index) => ({
      id: `line-${index + 1}`,
      text: line.text,
      startSeconds: null,
      stanzaIndex: line.stanza_index,
      lineIndex: line.line_index,
    })),
    plainText: parsed.map((line) => line.text).join("\n"),
    sourceKind: "editorial",
    rightsNote: null,
    sourceContributionId: null,
    sourceContributorLabel: null,
    communityRevisionMode: null,
  };
}

describe(
  "structured Track Lyrics stanza authority",
  () => {
    it("preserves plain Lyrics stanza boundaries as canonical line metadata", () => {
      const input =
        "Intro one\nIntro two\n\nVerse one\nVerse two";

      expect(
        parseLyricsEditorText(input, "plain"),
      ).toEqual([
        {
          text: "Intro one",
          stanza_index: 0,
          line_index: 0,
        },
        {
          text: "Intro two",
          stanza_index: 0,
          line_index: 1,
        },
        {
          text: "Verse one",
          stanza_index: 1,
          line_index: 0,
        },
        {
          text: "Verse two",
          stanza_index: 1,
          line_index: 1,
        },
      ]);

      const document = documentFromPlainInput(input);

      expect(
        lyricsDocumentToEditorText(document),
      ).toBe(input);
      expect(
        lyricsDocumentToDisplayText(document),
      ).toBe(input);
    });

    it("preserves stanza boundaries for timed Lyrics without changing timestamps", () => {
      const input =
        "[00:01.00] First\n[00:02.50] Second\n\n[00:10.00] Third";

      const parsed = parseLyricsEditorText(
        input,
        "line",
      );

      expect(parsed).toEqual([
        {
          text: "First",
          start_seconds: 1,
          stanza_index: 0,
          line_index: 0,
        },
        {
          text: "Second",
          start_seconds: 2.5,
          stanza_index: 0,
          line_index: 1,
        },
        {
          text: "Third",
          start_seconds: 10,
          stanza_index: 1,
          line_index: 0,
        },
      ]);

      const document: TrackLyricsDocument = {
        ...documentFromPlainInput("First\nSecond\n\nThird"),
        timingMode: "line",
        lines: parsed.map((line, index) => ({
          id: `line-${index + 1}`,
          text: line.text,
          startSeconds: line.start_seconds ?? null,
          stanzaIndex: line.stanza_index,
          lineIndex: line.line_index,
        })),
      };

      expect(
        lyricsDocumentToEditorText(document),
      ).toBe(input);
    });

    it("keeps database, Track page, player, and review on one stanza contract", () => {
      expect(migration).toContain(
        "stanza_index",
      );
      expect(migration).toContain(
        "line_index",
      );
      expect(migration).toContain(
        "Legacy line arrays without stanza metadata remain valid as one stanza",
      );
      expect(migration).not.toMatch(
        /\balter\s+table\b/i,
      );

      expect(verifier).toContain(
        "TRACK_LYRICS_STRUCTURED_STANZA_AUTHORITY_PASS",
      );
      expect(verifier).toContain(
        "Structured Lyrics plain_text did not preserve stanza separation",
      );

      expect(playerText).toContain(
        "const stanzaStart =",
      );
      expect(trackSection).toContain(
        "lyricsDocumentToDisplayText(governedLyrics)",
      );
      expect(playerSurface).toContain(
        "Suggest correction",
      );
      expect(reviewWorkspace).toContain(
        "lyricsLinesToEditorText",
      );
      expect(reviewWorkspace).toContain(
        "stanza_index: line.stanzaIndex ?? 0",
      );
    });
  },
);
