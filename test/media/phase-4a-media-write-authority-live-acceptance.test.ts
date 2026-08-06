import fs from "node:fs";
import { describe, expect, it } from "vitest";

const plan = fs.readFileSync(
  "docs/institute/two-workspace-pilot-audit-and-build-plan.md",
  "utf8",
);

const record = fs.readFileSync(
  "docs/engineering/phase-4a-media-write-authority-live-acceptance-record.md",
  "utf8",
);

const verifier = fs.readFileSync(
  "scripts/control-plane/verify-phase-4a-media-write-live-acceptance.sql",
  "utf8",
);

const cors = fs.readFileSync(
  "ops/nginx/wakilisha-media-cors-headers.conf",
  "utf8",
);

describe(
  "Phase 4A Media write authority live acceptance",
  () => {
    it("records the exact immutable replacement proof", () => {
      expect(record).toContain(
        "7e6866dd-8a40-4a0f-bea5-aae08db721b0",
      );
      expect(record).toContain(
        "authority revision: 4",
      );
      expect(record).toContain(
        "proof authority revision: 5",
      );
      expect(record).toContain(
        "current immutable revision: 2",
      );
      expect(record).toContain(
        "file objects: 4",
      );
      expect(record).toContain(
        "asset revisions: 2",
      );
      expect(record).toContain(
        "variants: 2",
      );
      expect(record).toContain(
        "variant selections: 2",
      );
    });

    it("records all four accepted delivery hashes", () => {
      expect(record).toContain(
        "a05ddf7335b8babfe6b88f78d5a115d2598bf5586bccf87925fcac2833a3822a",
      );
      expect(record).toContain(
        "51516aa3e5288d51d42963c615373481f0f780013df5acb621874fc1effdf020",
      );
      expect(record).toContain(
        "869c180cd70eccac6ab508bbc56439d841749c7b7ee989eb22f66a4eec066719",
      );
      expect(record).toContain(
        "2b4cdae532e614796c4a300382d4bdc9aa22408b1ec7b2e67c77bb249c9867a4",
      );
    });

    it("records only the two confirmed orphan paths", () => {
      expect(record).toContain(
        "1786016706831-014b10d5",
      );
      expect(record).toContain(
        "1786018965027-1d375aa6",
      );
      expect(record).toContain(
        "Only those two exact unregistered files are removed",
      );
      expect(verifier).toContain(
        "Confirmed orphan paths became registered",
      );
    });

    it("preserves the narrow CORS contract", () => {
      expect(cors).toContain(
        'Access-Control-Allow-Origin "https://wakilisha.africa"',
      );
      expect(cors).not.toContain(
        'Access-Control-Allow-Origin "*"',
      );
      expect(cors).not.toContain(
        "Access-Control-Allow-Credentials",
      );
      expect(record).toContain(
        "/etc/nginx/wakilisha-backups/media-cors-20260806T135247Z",
      );
    });

    it("updates the authoritative plan without closing Phase 4A", () => {
      expect(plan).toContain(
        "Media Library command cutover",
      );
      expect(plan).toContain(
        "immutable original and derivative proof",
      );
      expect(plan).toContain(
        "in-place overwrite removal",
      );
      expect(plan).toContain(
        "WordPress Media migration dependency",
      );
      expect(plan).toContain(
        "compatibility policy and grant hardening",
      );
      expect(record).toContain(
        "Phase 4A is not closed.",
      );
      expect(plan).not.toContain(
        "Phase 4A is closed",
      );
    });

    it("keeps the accepted live verifier explicit", () => {
      expect(verifier).toContain(
        "PHASE_4A_MEDIA_WRITE_LIVE_ACCEPTANCE_PASS",
      );
      expect(verifier).toContain(
        "authority_revision = 5",
      );
      expect(verifier).toContain(
        "lifecycle_state = 'archived'",
      );
      expect(verifier).toContain(
        "authenticated",
      );
      expect(verifier).toContain(
        "media.asset_governance_versions",
      );
    });
  },
);
