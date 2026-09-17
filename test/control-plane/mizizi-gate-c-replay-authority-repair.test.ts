import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const historical = readFileSync(
  "supabase/migrations/20260916182000_registry_relationship_authority_convergence_v1.sql",
  "utf8",
);

const replay = readFileSync(
  "supabase/migrations/20260917121000_registry_relationship_replay_authority_v1.sql",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-mizizi-relationship-replay-authority.sql",
  "utf8",
);

describe("MIZIZI Gate C replay-authority repair Stage 1", () => {
  it("keeps historical Production reconciliation active until Stage 2", () => {
    expect(historical).toContain(
      "Gate C historical Siaka/Mtoto relationship drift",
    );
    expect(historical).toContain(
      "legacy_cultural_relationship_migration",
    );
  });

  it("extracts only enduring fail-closed authority into the forward replacement", () => {
    expect(replay).toContain(
      "reject_legacy_core_cultural_entity_mutation",
    );
    expect(replay).toContain(
      "reject_legacy_core_relationship_mutation",
    );
    expect(replay).toContain(
      "reject_legacy_core_relationship_evidence_mutation",
    );
    expect(replay).toContain(
      "('artist','track','release','label','genre')",
    );

    for (const productionIdentity of [
      "efdf79dc-9280-406a-b6e3-f8672f6b783f",
      "33b93023-0479-4feb-ade7-a1185f86cb23",
      "208e0284-93b8-43fd-991e-b17ffa624c4b",
      "e9a367d3-7cc4-4126-94ec-1e651dbe6ecf",
      "8c03e889-3c3a-47f2-a776-9f8534191180",
      "ea733423-2c3b-4d47-93ea-6af44b6577b3",
      "9e39f45d-10f4-45fc-af3e-9af17aa5e6a7",
      "164714b3-955d-4bfe-a456-c2a70a343685",
    ]) {
      expect(replay).not.toContain(productionIdentity);
    }

    expect(replay).not.toMatch(
      /\binsert\s+into\s+public\.(?:cultural_entities|entity_relationships|relationship_evidence|registry_entity_relationships|registry_relationship_evidence)\b/i,
    );
    expect(replay).not.toMatch(
      /\bupdate\s+public\.(?:cultural_entities|entity_relationships|relationship_evidence|registry_entity_relationships|registry_relationship_evidence)\b/i,
    );
    expect(replay).not.toMatch(
      /\bdelete\s+from\s+public\.(?:cultural_entities|entity_relationships|relationship_evidence|registry_entity_relationships|registry_relationship_evidence)\b/i,
    );
  });

  it("ships a zero-data-safe structural verifier", () => {
    expect(verifier).toContain(
      "MIZIZI_RELATIONSHIP_REPLAY_AUTHORITY_PASS",
    );
    expect(verifier).toContain(
      "trg_reject_legacy_core_cultural_entity_mutation",
    );
    expect(verifier).toContain(
      "trg_reject_legacy_core_relationship_mutation",
    );
    expect(verifier).toContain(
      "trg_reject_legacy_core_relationship_evidence_mutation",
    );
    expect(verifier).not.toContain(
      "8c03e889-3c3a-47f2-a776-9f8534191180",
    );
    expect(verifier).not.toContain(
      "ea733423-2c3b-4d47-93ea-6af44b6577b3",
    );
  });
});
