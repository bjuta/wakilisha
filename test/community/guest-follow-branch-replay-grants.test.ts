import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260815060000_guest_follow_intent_authority.sql",
  "utf8",
);

describe("Guest Follow branch replay grants", () => {
  it("removes explicit default function grants before restoring intended access", () => {
    expect(migration).toContain(
      `revoke all on function\n  public.community_create_guest_follow_intent(\n    uuid[]\n  )\nfrom public, anon, authenticated;`,
    );

    expect(migration).toContain(
      `revoke all on function\n  public.community_claim_guest_follow_intent(\n    text\n  )\nfrom public, anon, authenticated;`,
    );
  });

  it("keeps create public and claim authenticated-only", () => {
    expect(migration).toContain(
      `grant execute on function\n  public.community_create_guest_follow_intent(\n    uuid[]\n  )\nto\n  anon,\n  authenticated;`,
    );

    expect(migration).toContain(
      `grant execute on function\n  public.community_claim_guest_follow_intent(\n    text\n  )\nto\n  authenticated;`,
    );
  });

  it("keeps the postflight anonymous claim denial", () => {
    expect(migration).toContain(
      `has_function_privilege(\n          'anon',\n          'public.community_claim_guest_follow_intent(text)',\n          'EXECUTE'\n        )`,
    );
  });
});
