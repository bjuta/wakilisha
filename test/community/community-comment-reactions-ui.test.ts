import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const card =
  readFileSync(
    "src/components/feature/community/CommentCard.tsx",
    "utf8",
  );

const picker =
  readFileSync(
    "src/components/feature/community/CommunityReactionPicker.tsx",
    "utf8",
  );

describe(
  "shared Community emoji reaction UX",
  () => {
    it(
      "uses explicit optimistic reaction overrides",
      () => {
        expect(card)
          .toContain(
            "optimisticReactionState",
          );

        expect(card)
          .toContain(
            "[type]: !hasReacted",
          );
      },
    );

    it(
      "keeps persistent reaction state to glyphs and count only",
      () => {
        expect(card)
          .toContain(
            "getReactionGlyph",
          );

        expect(card)
          .toContain(
            "visibleReactionCount",
          );

        expect(card)
          .not.toContain(
            "primaryReaction?.label",
          );

        expect(card)
          .not.toContain(
            '"Reacted"',
          );

        expect(card)
          .not.toContain(
            "<span>React</span>",
          );
      },
    );

    it(
      "renders every active reaction instead of hiding reactions after three",
      () => {
        expect(card)
          .toContain(
            "activeReactions.map",
          );

        expect(card)
          .not.toMatch(
            /activeReactions\s*\.slice/,
          );

        expect(card)
          .toContain(
            'max-w-[16rem] flex-wrap',
          );
      },
    );

    it(
      "uses bare quick emoji without heavy icon containers",
      () => {
        expect(picker)
          .toContain(
            "QUICK_REACTIONS",
          );

        expect(picker)
          .toContain(
            "h-9 w-9",
          );

        expect(picker)
          .not.toContain(
            "h-8 w-8 items-center justify-center rounded-full",
          );
      },
    );

    it(
      "provides an expandable full emoji library",
      () => {
        expect(picker)
          .toContain(
            "lazy(",
          );

        expect(picker)
          .toContain(
            '"emoji-picker-react"',
          );

        expect(picker)
          .toContain(
            "More reactions",
          );

        expect(picker)
          .toContain(
            "emojiData.emoji",
          );
      },
    );

    it(
      "portals the picker outside scroll and overflow containers",
      () => {
        expect(picker)
          .toContain(
            "createPortal",
          );

        expect(picker)
          .toContain(
            "document.body",
          );

        expect(picker)
          .toContain(
            "fixed z-[200]",
          );

        expect(picker)
          .not.toContain(
            "absolute left-0 top-full",
          );
      },
    );

    it(
      "positions the picker against the viewport and flips when needed",
      () => {
        expect(picker)
          .toContain(
            "getBoundingClientRect",
          );

        expect(picker)
          .toContain(
            "hasRoomBelow",
          );

        expect(picker)
          .toContain(
            "ResizeObserver",
          );

        expect(picker)
          .toMatch(
            /window\.addEventListener\(\s*"scroll",\s*positionPanel,\s*true,\s*\)/,
          );

        expect(picker)
          .toMatch(
            /window\.addEventListener\(\s*"resize",\s*positionPanel,\s*\)/,
          );
      },
    );

    it(
      "dismisses the reaction surface on outside interaction",
      () => {
        expect(picker)
          .toContain(
            'document.addEventListener(\n        "pointerdown"',
          );

        expect(picker)
          .toContain(
            'document.addEventListener(\n        "keydown"',
          );

        expect(picker)
          .toContain(
            'event.key !== "Escape"',
          );

        expect(picker)
          .toContain(
            "panel?.contains(target)",
          );

        expect(picker)
          .toContain(
            "anchor?.contains(target)",
          );

        expect(picker)
          .toContain(
            "onClose();",
          );

        expect(card)
          .toContain(
            "onClose={() =>",
          );
      },
    );

    it(
      "preserves removal of legacy reactions",
      () => {
        expect(picker)
          .toContain(
            'signal: "⚡"',
          );

        expect(picker)
          .toContain(
            'agree: "👍"',
          );

        expect(picker)
          .toContain(
            "resolveReactionSelection",
          );
      },
    );
  },
);
