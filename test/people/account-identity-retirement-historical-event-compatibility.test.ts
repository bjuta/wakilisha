import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260915213000_historical_event_actor_retirement_compatibility.sql",
  ),
  "utf8",
);

const verifier = fs.readFileSync(
  path.join(
    root,
    "scripts/control-plane/verify-historical-event-account-retirement-compatibility.sql",
  ),
  "utf8",
);

describe("Historical event freeze / account retirement compatibility", () => {
  const actorConstraints = [
    "article_lifecycle_events_actor_id_fkey",
    "playlist_lifecycle_events_actor_fkey",
    "playlist_review_events_actor_fkey",
    "publication_lifecycle_events_actor_id_fkey",
    "publication_review_events_actor_id_fkey",
  ];

  const freezeTriggers = [
    "article_lifecycle_events_historical_freeze",
    "playlist_lifecycle_events_historical_freeze",
    "playlist_review_events_historical_freeze",
    "audio_publication_lifecycle_events_historical_freeze",
    "audio_publication_review_events_historical_freeze",
  ];

  it("retains all five historical actor ON DELETE SET NULL contracts", () => {
    for (const name of actorConstraints) {
      expect(migration).toContain(name);
      expect(verifier).toContain(name);
    }
    expect(migration).toContain("constraint_row.confdeltype = 'n'");
    expect(migration).not.toMatch(/drop constraint\s+\w*actor/i);
  });

  it("keeps all five historical stores frozen with row-scoped guards", () => {
    for (const name of freezeTriggers) {
      expect(migration).toContain(name);
      expect(verifier).toContain(name);
    }
    expect(migration.match(/for each row/g)?.length).toBe(5);
    expect(verifier).toContain("FOR EACH ROW");
  });

  it("permits only nested actor UUID to NULL maintenance with all other fields unchanged", () => {
    for (const contract of [
      "pg_trigger_depth() > 1",
      "old.actor_id is not null",
      "new.actor_id is null",
      "to_jsonb(old) - 'actor_id'",
      "to_jsonb(new) - 'actor_id'",
    ]) {
      expect(migration).toContain(contract);
    }

    for (const verifierContract of [
      "position('pg_trigger_depth() > 1' in v_definition) = 0",
      "position('old.actor_id is not null' in v_definition) = 0",
      "position('new.actor_id is null' in v_definition) = 0",
      "position('to_jsonb(old) - ''actor_id''' in v_definition) = 0",
      "position('to_jsonb(new) - ''actor_id''' in v_definition) = 0",
    ]) {
      expect(verifier).toContain(verifierContract);
    }

    expect(migration).toContain(
      "Historical typed event tables are frozen evidence. Use shared Resource event authority.",
    );
  });

  it("keeps the permanent verifier read-only", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
    expect(verifier).toContain(
      "HISTORICAL_EVENT_ACCOUNT_RETIREMENT_COMPATIBILITY_PASS",
    );
  });
});
