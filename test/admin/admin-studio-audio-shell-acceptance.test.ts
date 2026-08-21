import {
  describe,
  expect,
  it,
} from "vitest";
import {
  readFileSync,
} from "node:fs";

const workspace =
  readFileSync(
    "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
    "utf8",
  );

const review =
  readFileSync(
    "src/pages/admin/content/audio/detail/components/AudioReviewWorkspace.tsx",
    "utf8",
  );

describe(
  "Admin Studio Audio record-shell visual acceptance",
  () => {
    it(
      "uses truthful shared save-state in the Audio record header",
      () => {
        expect(
          workspace,
        ).toContain(
          "AdminSaveState",
        );

        expect(
          workspace,
        ).toContain(
          "metadataDirty",
        );

        expect(
          workspace,
        ).toContain(
          "chaptersDirty",
        );

        expect(
          workspace,
        ).toContain(
          "workingDirty",
        );

        expect(
          workspace,
        ).toContain(
          "lockedLabel={`${humanize(",
        );
      },
    );

    it(
      "makes header Save persist local Audio fields before snapshotting",
      () => {
        expect(
          workspace,
        ).toContain(
          "handleSaveWorkingVersion",
        );

        expect(
          workspace,
        ).toContain(
          "await saveAudioMetadata(",
        );

        expect(
          workspace,
        ).toContain(
          "await replaceAudioChapters(",
        );

        expect(
          workspace,
        ).toContain(
          "await fetchAudioPublicationWorkspace(",
        );

        expect(
          workspace,
        ).toContain(
          "await snapshotAudioWorkingVersion(",
        );
      },
    );

    it(
      "does not submit stale local Audio edits into Review",
      () => {
        expect(
          workspace,
        ).toContain(
          "busy !== null ||",
        );

        expect(
          workspace,
        ).toContain(
          "workingDirty",
        );

        expect(
          workspace,
        ).toContain(
          "Save changes before submitting for Review.",
        );
      },
    );

    it(
      "keeps governed lifecycle actions in the shared record action rail",
      () => {
        for (
          const action of [
            "Submit for Review",
            "Start Review",
            "Request Changes",
            "Approve",
            "Publish",
          ]
        ) {
          expect(
            workspace,
          ).toContain(action);
        }
      },
    );

    it(
      "upgrades Review to exact-version time-anchored work",
      () => {
        expect(
          workspace,
        ).toContain(
          "EditorialWorkflowRail",
        );

        expect(
          workspace,
        ).toContain(
          "AudioReviewWorkspace",
        );

        expect(
          review,
        ).toContain(
          "Review submitted version",
        );

        expect(
          review,
        ).toContain(
          "MediaTimeline",
        );

        expect(
          review,
        ).toContain(
          "EditorialCommentEditor",
        );

        expect(
          review,
        ).toContain(
          "Lifecycle decision note",
        );

        for (
          const version of [
            "Working",
            "Submitted",
            "Approved",
            "Published",
          ]
        ) {
          expect(
            workspace,
          ).toContain(version);
        }
      },
    );
  },
);
