import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { hashBlobSha256 } from "@/services/mediaHash";

const migrationName = fs.readdirSync("supabase/migrations").find((name) =>
  name.endsWith("_phase_4b_m3_media_library_workflow_delivery.sql"),
);
if (!migrationName) throw new Error("M3 workflow migration is missing.");

const migration = fs.readFileSync(`supabase/migrations/${migrationName}`, "utf8");

const migration204Name = fs
  .readdirSync("supabase/migrations")
  .find((name) =>
    name.endsWith(
      "_phase_4b_m3_upload_session_constraints_v2.sql",
    ),
  );

if (!migration204Name) {
  throw new Error(
    "M3 upload-session constraint recovery migration is missing.",
  );
}

const migration204 = fs.readFileSync(
  `supabase/migrations/${migration204Name}`,
  "utf8",
);

const receiver = fs.readFileSync("ops/media-receiver/server.py", "utf8");
const edge = fs.readFileSync("supabase/functions/media-upload-api/index.ts", "utf8");
const service = fs.readFileSync("src/services/mediaService.ts", "utf8");
const library = fs.readFileSync("src/components/admin/media/MediaLibraryCore.tsx", "utf8");
const preview = fs.readFileSync("src/components/admin/media/MediaLibraryPreviewPanel.tsx", "utf8");
const picker = fs.readFileSync("src/components/admin/MediaPickerModal.tsx", "utf8");
const design = fs.readFileSync("docs/engineering/phase-4b-m3-media-library-workflow-delivery-design.md", "utf8");

describe("Phase 4B M3 Media Library workflow contract", () => {
  it("hashes browser blobs incrementally with exact SHA-256", async () => {
    const digest = await hashBlobSha256(new Blob(["abc"]), { chunkSizeBytes: 1 });
    expect(digest).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("preserves M1 v1 and adds a forward audio/video session v2", () => {
    expect(migration).toContain("create or replace function public.create_media_upload_session_v2");
    expect(migration).toContain("v_master_kind := 'audio'");
    expect(migration).toContain("v_master_kind := 'video'");
    expect(migration).not.toContain("create or replace function public.create_media_upload_session_v1");
  });

  it(


    "widens the shared upload-session table constraints for M3 v2",


    () => {


      expect(migration204).toContain(


        "expected_byte_size > 0",


      );


      expect(migration204).toContain(


        "total_parts >= 1",


      );


      expect(migration204).toContain(


        "'mp4'::text",


      );


      expect(migration204).toContain(


        "mime_type like 'video/%'",


      );


      expect(migration204).toContain(


        "^masters/(audio|video)/",


      );


      expect(migration204).not.toContain(


        "create or replace function public.create_media_upload_session_v1",


      );


    },


  );



  it("widens the receiver only for resumable masters", () => {
    expect(receiver).toContain("ALLOWED_VIDEO_EXTENSIONS");
    expect(receiver).toContain('normalized.startswith("masters/video/")');
    expect(receiver).toContain("expected_byte_size <= 0");
    expect(receiver).toContain("total_parts < 1");
    expect(receiver).toContain('parsed.path == "/upload"');
    expect(receiver).toContain("MAX_UPLOAD_BYTES");
  });

  it("keeps master bytes out of the Edge Function", () => {
    expect(edge).toContain('"create_resumable_session_v2"');
    expect(edge).toContain('"create_media_upload_session_v2"');
    expect(edge).toContain("part_upload_base_url");
    expect(edge).not.toContain('if (action === "upload_resumable_part")');
  });

  it(
    "extends canonical Media event authority for verified master adoption",
    () => {
      expect(migration).toContain(
        "events_event_type_check",
      );
      expect(migration).toContain(
        "'resumable_master_adopted'::text",
      );
      expect(migration).toContain(
        "'physical_purge_completed'::text",
      );
      expect(migration).toContain(
        "'compatibility_projection_created'::text",
      );
    },
  );

  it(


    "uses a non-deliverable compatibility identity URL for resumable masters",


    () => {


      const migration205Name = fs


        .readdirSync("supabase/migrations")


        .find((name) =>


          name.endsWith(


            "_phase_4b_m3_adoption_compatibility_identity_url.sql",


          ),


        );





      expect(migration205Name).toBeTruthy();





      const migration205 = fs.readFileSync(


        `supabase/migrations/${migration205Name}`,


        "utf8",


      );





      expect(migration205).toContain(


        "https://media.wakilisha.africa/__private/media-asset/",


      );


      expect(migration205).not.toContain(


        "https://media.wakilisha.africa/__private/media-master/",


      );


      expect(migration205).toContain(


        "registry_media_assets_url_unique_idx",


      );


    },


  );



  it("adopts a verified session without rewriting the master", () => {
    expect(migration).toContain("adopt_verified_media_upload_session_v1");
    expect(migration).toContain("public.create_media_asset(");
    expect(migration).toContain("public.create_media_asset_revision(");
    expect(migration).toContain("v_session.file_object_id");
    expect(migration).not.toContain("insert_verified_file_object_v2");
  });

  it("enriches the existing admin read boundary with workflow state", () => {
    expect(migration).toContain("create or replace function public.read_media_assets_admin_v2");
    expect(migration).toContain("'processing_job_status'");
    expect(migration).toContain("'selected_derivatives'");
    expect(migration).toContain("'upload_session_state'");
    expect(migration).toContain("'primary_delivery_url'");
    expect(migration).toContain("'delivery_ready'");
  });

  it("uploads direct parts with capability and per-part checksums", () => {
    expect(service).toContain("create_resumable_session_v2");
    expect(service).toContain("X-Part-SHA256");
    expect(service).toContain("Bearer ${context.capabilityToken}");
    expect(service).toContain("submit_media_processing_command_v1");
    expect(service).toContain("adopt_verified_media_upload_session_v1");
  });

  it("acknowledges Resume immediately before durable session reconciliation", () => {
    expect(library).toContain(
      "Resuming from ${context.uploadedParts} of ${context.totalParts} accepted parts...",
    );
    expect(library).toContain('stage: "uploading"');

    const resumeHandler = library.indexOf(
      "const resumeUpload = useCallback",
    );
    const feedback = library.indexOf(
      "Resuming from ${context.uploadedParts}",
      resumeHandler,
    );
    const resumedUpload = library.indexOf(
      "void uploadFile(file);",
      resumeHandler,
    );

    expect(resumeHandler).toBeGreaterThanOrEqual(0);
    expect(feedback).toBeGreaterThan(resumeHandler);
    expect(resumedUpload).toBeGreaterThan(feedback);
  });

  it("preserves image/PDF upload while adding pause resume and cancel", () => {
    expect(library).toContain('"image/*"');
    expect(library).toContain('"application/pdf"');
    expect(library).toContain('"audio/*"');
    expect(library).toContain('"video/*"');
    expect(library).toContain("pauseUpload");
    expect(library).toContain("resumeUpload");
    expect(library).toContain("cancelUpload");
    expect(library).toContain("mediaService.upload(");
    expect(library).toContain("uploadResumableMaster");
  });

  it("renders governed audio and video derivatives", () => {
    expect(preview).toContain("<audio");
    expect(preview).toContain("waveform_data");
    expect(preview).toContain("<video");
    expect(preview).toContain("video_transcode");
    expect(preview).toContain("poster_frame");
    expect(preview).toContain("Retry processing");
  });

  it("keeps picker audio/video support explicit and opt-in", () => {
    expect(picker).toContain('allowedKinds = ["image", "document"]');
    expect(picker).toContain("allowedKinds={allowedKinds}");
  });

  it("records the receiver as an explicit implementation surface", () => {
    expect(design).toContain("`ops/media-receiver/server.py`");
    expect(design).toContain("`package.json` and `package-lock.json`");
    expect(design).toContain("M3 should remain one coherent milestone PR.");
  });
});
