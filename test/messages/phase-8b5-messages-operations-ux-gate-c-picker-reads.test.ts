import fs from "node:fs";
import { describe, expect, it } from "vitest";

const authority = fs.readFileSync(
  "docs/engineering/messages-operations-ux-gate-c-picker-read-authority.md",
  "utf8",
);
const migration = fs.readFileSync(
  "supabase/migrations/20260910103000_messages_operations_ux_gate_c_legal_picker_reads.sql",
  "utf8",
);
const verifier = fs.readFileSync(
  "scripts/control-plane/verify-messages-operations-ux-gate-c-picker-reads.sql",
  "utf8",
);

describe("Phase 8B.5 Messages Operations UX Gate C picker reads", () => {
  it("implements exactly the two authority-approved browser read RPCs", () => {
    for (const signature of [
      "public.search_messages_legal_scope_targets_v1(",
      "public.search_messages_legal_reviewers_v1(",
    ]) {
      expect(authority).toContain(signature);
      expect(migration).toContain(`create function ${signature}`);
    }

    expect(
      migration.match(/\bcreate function public\./g) ?? [],
    ).toHaveLength(2);
  });

  it("keeps both reads case-bound, capability-guarded, stable and bounded", () => {
    expect(migration).toContain(
      "messaging.require_messages_legal_capability(",
    );
    expect(migration).toContain(
      "'manage_messages_legal_cases'",
    );
    expect(migration).toContain(
      "from messaging.legal_request_cases legal_case",
    );
    expect(migration).toContain(
      "where legal_case.id = p_case_id",
    );
    expect(migration.match(/\nstable\nsecurity definer/g) ?? []).toHaveLength(2);
    expect(
      migration.match(
        /least\(greatest\(coalesce\(p_limit, 20\), 1\), 20\)/g,
      ) ?? [],
    ).toHaveLength(2);
  });

  it("returns only the locked safe target and reviewer presentation shapes", () => {
    for (const field of [
      "target_kind text",
      "target_id uuid",
      "label text",
      "context text",
      "occurred_at timestamptz",
      "related_id uuid",
      "user_id uuid",
      "display_name text",
      "secondary_label text",
    ]) {
      expect(migration).toContain(field);
    }

    for (const prohibited of [
      "message_row.body",
      "file_row.storage_path",
      "file_row.delivery_url",
      "file_row.technical_metadata",
      "version_row.content_fingerprint",
      "profile.email",
      "profile.metadata",
    ]) {
      expect(migration).not.toContain(prohibited);
    }
  });

  it("does not create a new table, queue, command, worker, or ambient service-role read", () => {
    expect(migration).not.toMatch(/\bcreate table\b/i);
    expect(migration).not.toMatch(/\balter table\b/i);
    expect(migration).not.toMatch(/\bcreate index\b/i);
    expect(migration).not.toContain("platform_private.");
    expect(migration).not.toContain("legal_case_events");
    expect(migration).not.toContain("command_types");
    expect(migration).not.toContain("jobs");
    expect(migration).not.toContain("outbox");
    expect(migration).toContain(
      "from public, anon, authenticated, service_role;",
    );
    expect(migration).toContain("to authenticated;");
  });

  it("ships a permanent verifier that is transactionally read-only", () => {
    expect(verifier).toContain("set transaction read only;");
    expect(verifier).toContain(
      "GATE_C_PICKER_READ_VERIFIER=PASS",
    );
    expect(verifier).toContain(
      "scope target RPC grants are incorrect",
    );
    expect(verifier).toContain(
      "reviewer RPC grants are incorrect",
    );
    expect(verifier).toContain(
      "Gate C introduced table authority",
    );
    expect(verifier).toContain("rollback;");
  });
});
