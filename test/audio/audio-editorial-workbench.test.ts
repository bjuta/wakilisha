import {
  describe,
  expect,
  it,
} from "vitest";
import {
  readFileSync,
  readdirSync,
} from "node:fs";

function read(
  path: string,
): string {
  return readFileSync(
    path,
    "utf8",
  );
}

const migrationName =
  readdirSync(
    "supabase/migrations",
  ).find((name) =>
    name.endsWith(
      "_audio_editorial_workbench_time_anchored_review.sql",
    ),
  );

if (!migrationName) {
  throw new Error(
    "Audio Editorial Workbench migration is missing",
  );
}

const migration = read(
  `supabase/migrations/${migrationName}`,
);

const verifier = read(
  "scripts/control-plane/verify-audio-editorial-workbench.sql",
);

const page = read(
  "src/pages/admin/content/audio/page.tsx",
);

const workspace = read(
  "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
);

const review = read(
  "src/pages/admin/content/audio/detail/components/AudioReviewWorkspace.tsx",
);

const service = read(
  "src/services/audio/audioReviewService.ts",
);

const timeline = read(
  "src/components/design-system/editorial/MediaTimeline.tsx",
);

const commentEditor = read(
  "src/components/design-system/editorial/EditorialCommentEditor.tsx",
);

const workflowRail = read(
  "src/components/design-system/editorial/EditorialWorkflowRail.tsx",
);

describe(
  "Audio Editorial Workbench",
  () => {
    it(
      "adds version-bound point and range review authority",
      () => {
        expect(
          migration,
        ).toContain(
          "audio.publication_review_threads",
        );

        expect(
          migration,
        ).toContain(
          "audio.publication_review_comments",
        );

        expect(
          migration,
        ).toContain(
          "'time_point', 'time_range'",
        );

        expect(
          migration,
        ).toContain(
          "current_submitted_version_id",
        );

        expect(
          migration,
        ).toContain(
          "version_kind <> 'submitted'",
        );

        expect(
          migration,
        ).toContain(
          "duration_seconds",
        );

        expect(
          migration,
        ).toContain(
          "body_html",
        );

        expect(
          migration,
        ).toContain(
          "body_text",
        );
      },
    );

    it(
      "uses existing Audio review authority and closes anonymous access",
      () => {
        expect(
          migration,
        ).toContain(
          "current_user_can_participate_audio_review",
        );

        expect(
          migration,
        ).toContain(
          "public.get_audio_editorial_workbench",
        );

        expect(
          migration,
        ).toContain(
          "public.create_audio_time_review_thread",
        );

        expect(
          migration,
        ).toContain(
          "from public, anon",
        );

        expect(
          migration,
        ).toContain(
          "to authenticated",
        );

        expect(
          verifier,
        ).toContain(
          "authenticated must not mutate Audio review tables directly",
        );
      },
    );

    it(
      "uses canonical Media delivery, waveform and source probe context",
      () => {
        expect(
          migration,
        ).toContain(
          "public.get_audio_editorial_media_context",
        );

        expect(
          migration,
        ).toContain(
          "waveform_data",
        );

        expect(
          migration,
        ).toContain(
          "audio_delivery_variant_id",
        );

        expect(
          migration,
        ).toContain(
          "source_probe",
        );

        expect(
          service,
        ).toContain(
          "fetchAudioEditorialMediaContext",
        );

        expect(
          review,
        ).toContain(
          "target.waveformUrl",
        );

        expect(
          review,
        ).toContain(
          "target.deliveryUrl",
        );

        expect(
          review,
        ).toContain(
          "target.sourceProbe",
        );
      },
    );

    it(
      "provides reusable workflow, rich comment, transport and timeline primitives",
      () => {
        expect(
          workflowRail,
        ).toContain(
          "EditorialWorkflowRail",
        );

        expect(
          commentEditor,
        ).toContain(
          "@tiptap/react",
        );

        expect(
          commentEditor,
        ).toContain(
          "StarterKit",
        );

        expect(
          timeline,
        ).toContain(
          "time_range",
        );

        expect(
          timeline,
        ).toContain(
          "onAnchorChange",
        );

        expect(
          review,
        ).toContain(
          "MediaTransport",
        );

        expect(
          review,
        ).toContain(
          "EditorialCommentEditor",
        );
      },
    );

    it(
      "turns Audio Review into anchored discussion instead of one note textarea",
      () => {
        expect(
          review,
        ).toContain(
          "Comment at playhead",
        );

        expect(
          review,
        ).toContain(
          "Add anchored comment",
        );

        expect(
          review,
        ).toContain(
          "Resolve",
        );

        expect(
          review,
        ).toContain(
          "Reopen",
        );

        expect(
          review,
        ).toContain(
          "Reply",
        );

        expect(
          service,
        ).toContain(
          "createAudioTimeReviewThread",
        );

        expect(
          service,
        ).toContain(
          "setAudioReviewThreadStatus",
        );
      },
    );

    it(
      "uses one Audio composer and lifecycle-aware record browsing",
      () => {
        expect(
          page,
        ).toContain(
          "AdminModeComposer",
        );

        expect(
          page,
        ).toContain(
          "New Show",
        );

        expect(
          page,
        ).toContain(
          "New Season",
        );

        expect(
          page,
        ).toContain(
          "New Recording",
        );

        expect(
          page,
        ).toContain(
          "Search Audio",
        );

        expect(
          page,
        ).toContain(
          "Changes Requested",
        );

        expect(
          page,
        ).toContain(
          "In Review",
        );
      },
    );

    it(
      "groups Audio detail by ontology workflow",
      () => {
        expect(
          workspace,
        ).toContain(
          "EditorialWorkflowRail",
        );

        expect(
          workspace,
        ).toContain(
          'label: "Compose"',
        );

        expect(
          workspace,
        ).toContain(
          'label: "Prepare"',
        );

        expect(
          workspace,
        ).toContain(
          'label: "Workflow"',
        );

        expect(
          workspace,
        ).toContain(
          'label: "Record"',
        );

        expect(
          workspace,
        ).toContain(
          "Sound & Chapters",
        );

        expect(
          workspace,
        ).toContain(
          "Credits & Citations",
        );

        expect(
          workspace,
        ).toContain(
          "AudioReviewWorkspace",
        );
      },
    );

    it(
      "keeps the permanent verifier read-only",
      () => {
        const body = verifier
          .toLowerCase()
          .replace(
            /raise exception/g,
            "",
          )
          .replace(
            /raise notice/g,
            "",
          );

        expect(
          body,
        ).not.toMatch(
          /\binsert\s+into\b/,
        );

        expect(
          body,
        ).not.toMatch(
          /\bupdate\s+[a-z_]/,
        );

        expect(
          body,
        ).not.toMatch(
          /\bdelete\s+from\b/,
        );

        expect(
          body,
        ).not.toMatch(
          /\bcreate\s+(table|function|trigger|index|policy)\b/,
        );
      },
    );
  },
);
