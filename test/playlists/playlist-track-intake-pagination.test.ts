import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const intake =
  readFileSync(
    "src/pages/admin/registry/tracks/intake/page.tsx",
    "utf8",
  );

describe(
  "Track Intake render pagination",
  () => {
    it(
      "mounts only one ten-card review page at a time",
      () => {
        expect(intake)
          .toContain(
            "const TRACK_INTAKE_PAGE_SIZE = 10;",
          );

        expect(intake)
          .toContain(
            "return filtered.slice(",
          );

        expect(intake)
          .toContain(
            "{visible.map((row) => {",
          );

        expect(intake)
          .not.toContain(
            "{filtered.map((row) => {",
          );
      },
    );

    it(
      "keeps search over the full loaded queue before pagination",
      () => {
        expect(intake)
          .toContain(
            "const filtered = useMemo(() => {",
          );

        expect(intake)
          .toContain(
            "const visible = useMemo(() => {",
          );

        expect(
          intake.indexOf(
            "const filtered = useMemo(() => {",
          ),
        ).toBeLessThan(
          intake.indexOf(
            "const visible = useMemo(() => {",
          ),
        );
      },
    );

    it(
      "exposes bounded previous and next controls",
      () => {
        expect(intake)
          .toContain("Previous");

        expect(intake)
          .toContain("Next");

        expect(intake)
          .toContain(
            "Page {safePage + 1} of",
          );

        expect(intake)
          .toContain(
            "Showing ${visibleStart}-${visibleEnd} of ${filtered.length}",
          );
      },
    );

    it(
      "keeps deep-linked review outside list pagination",
      () => {
        expect(intake)
          .toContain(
            "return filtered;",
          );
      },
    );
  },
);
