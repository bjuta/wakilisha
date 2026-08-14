import { describe, expect, it } from "vitest";
import fs from "node:fs";

const replayFixName = fs
  .readdirSync("docs/engineering/replay-baseline/legacy-migrations")
  .find((name) =>
    name.endsWith("_phase_4b_m2_idempotent_replay_fix.sql"),
  );

if (!replayFixName) {
  throw new Error("M2 idempotent replay fix migration is missing.");
}

const replayFix = fs.readFileSync(
  `docs/engineering/replay-baseline/legacy-migrations/${replayFixName}`,
  "utf8",
);

const migration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260807125500_phase_4b_m2_durable_media_processing.sql",
  "utf8",
);

const worker = fs.readFileSync(
  "ops/media-processor/worker.py",
  "utf8",
);

const systemd = fs.readFileSync(
  "ops/systemd/wakilisha-media-processor.service",
  "utf8",
);

const nginx = fs.readFileSync(
  "ops/nginx/wakilisha-media.conf",
  "utf8",
);

const design = fs.readFileSync(
  "docs/engineering/phase-4b-m2-durable-media-processing-design.md",
  "utf8",
);

describe("Phase 4B M2 durable Media processing contract", () => {
  it("reuses the shared resource and job authorities", () => {
    expect(migration).toContain("'media_asset'");
    expect(migration).toContain("editorial.media_asset_resources");
    expect(migration).toContain("'media.process_revision'");
    expect(migration).toContain("platform_private.jobs");
    expect(migration).toContain("platform_private.outbox_events");

    expect(migration).not.toMatch(
      /create table\s+media\.(processing_jobs|processing_queue|processing_outbox)/i,
    );
  });

  it("qualifies the durable job lookup on idempotent replay", () => {
    const replayFunction = replayFix
      .split(
        "create or replace function public.submit_media_processing_command_v1(",
      )[1]
      ?.split("\nrevoke all\n")[0];

    expect(replayFunction).toBeTruthy();
    expect(replayFunction).toContain(
      "job.command_receipt_id = v_receipt_id",
    );
    expect(replayFunction).toContain(
      "job.job_key = 'primary'",
    );
    expect(replayFunction).toContain(
      "event.event_key =",
    );
    expect(replayFunction).not.toContain(
      "where command_receipt_id = v_receipt_id",
    );
  });

  it("claims only Media processing jobs", () => {
    expect(migration).toContain(
      "public.claim_media_processing_jobs_v1",
    );
    expect(migration).toContain(
      "job.command_type = 'media.process_revision'",
    );
    expect(migration).toContain(
      "job.job_type = 'media.process_revision'",
    );
    expect(worker).toContain(
      '"claim_media_processing_jobs_v1"',
    );
    expect(worker).not.toContain('"claim_jobs"');
  });

  it("recovers expired worker leases without another queue", () => {
    expect(migration).toContain(
      "public.recover_expired_media_processing_jobs_v1",
    );
    expect(migration).toContain("lease_expires_at <= now()");
    expect(migration).toContain("status = 'retry_wait'");
    expect(migration).toContain("status = 'dead_letter'");
    expect(worker).toContain(
      '"recover_expired_media_processing_jobs_v1"',
    );
    expect(migration).toContain(
      "public.renew_media_processing_lease_v1",
    );
    expect(worker).toContain(
      '"renew_media_processing_lease_v1"',
    );
    expect(worker).toContain(
      "HEARTBEAT_SECONDS",
    );
    expect(worker).toContain(
      "subprocess.Popen",
    );
  });

  it("preserves the submitting actor for canonical derivative writes", () => {
    expect(migration).toContain(
      "v_actor_id := v_receipt.actor_user_id",
    );
    expect(migration).toContain(
      "media.insert_verified_file_object_v2",
    );
    expect(migration).toContain(
      "'variant_registered'",
    );
    expect(migration).toContain(
      "'variant_activated'",
    );
  });

  it("supports the locked audio and video derivative profiles", () => {
    for (const token of [
      "audio_preview",
      "waveform_data",
      "video_transcode",
      "poster_frame",
      "thumbnail",
    ]) {
      expect(worker).toContain(token);
    }

    expect(worker).toContain("libmp3lame");
    expect(worker).toContain("libx264");
    expect(worker).toContain("peak_count");
    expect(worker).toContain('f"{role}.tmp.{extension}"');
    expect(worker).not.toContain('f"{role}.{extension}.tmp"');
    expect(worker).toContain('destination.name');
    expect(worker).toContain('".pcm"');
    expect(worker).not.toContain("samples.frombytes(raw)");
  });

  it("keeps protected derivative objects separate from public aliases", () => {
    expect(worker).toContain('"derived-objects"');
    expect(worker).toContain('"derivatives"');
    expect(worker).toContain("os.symlink");
    expect(worker).toContain("staged_sha256");
    expect(worker).toContain("canonical_sha256");
    expect(worker).toContain(
      "Immutable derivative path collision has different bytes.",
    );
    expect(nginx).toContain("location ^~ /derived-objects/");
    expect(nginx).toContain("location ^~ /derivatives/");
    expect(nginx).toContain("return 404;");
  });

  it("bounds the worker on the current Lightsail host", () => {
    expect(systemd).toContain("User=www-data");
    expect(systemd).toContain("NoNewPrivileges=true");
    expect(systemd).toContain("PrivateTmp=true");
    expect(systemd).toContain("ProtectSystem=full");
    expect(systemd).toContain("MemoryMax=768M");
    expect(systemd).toContain("CPUQuota=90%");
    expect(systemd).toContain("TasksMax=64");
  });

  it("keeps production acceptance requirements explicit", () => {
    expect(design).toContain(
      "PHASE_4B_M2_DURABLE_MEDIA_PROCESSING_ACCEPTANCE_PASS",
    );
    expect(design).toContain("retry_wait");
    expect(design).toContain("dead_letter");
    expect(design).toContain("expired worker lease");
    expect(design).toContain("audio_preview");
    expect(design).toContain("waveform_data");
  });
});
