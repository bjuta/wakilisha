import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const original = readFileSync(
  "supabase/migrations/20261010161101_mizizi_case_resource_jobs_bridge_v1.sql", "utf8");
const replacement = readFileSync(
  "scripts/control-plane/mizizi-case-research-conflict-target-repair-v1.sql", "utf8");

function gatewayBody(text: string, marker: string): string {
  const start = text.indexOf(marker);
  const end = text.indexOf("\n$admit$;", start);
  if (start < 0 || end < 0) throw new Error("exact MIZIZI research gateway body absent");
  return text.slice(start, end + "\n$admit$;".length);
}

describe("MIZIZI shared research gateway forward repair", () => {
  it("changes precisely the three collision targets, not historical behavior", () => {
    const oldBody = gatewayBody(original,
      "create function mizizi_private.admit_case_research_job_v1(");
    const fixedBody = gatewayBody(replacement,
      "create or replace function mizizi_private.admit_case_research_job_v1(");
    let expected = oldBody.replace(
      "create function mizizi_private.admit_case_research_job_v1(",
      "create or replace function mizizi_private.admit_case_research_job_v1(");
    for (const [from, to] of [
      ["on conflict (case_id) do nothing", "on conflict on constraint case_resource_bindings_pkey do nothing"],
      ["on conflict (command_receipt_id,job_key) do nothing", "on conflict on constraint jobs_receipt_job_key do nothing"],
      ["on conflict (case_id,relation_type,authority_schema,authority_object_type,authority_id)",
        "on conflict on constraint mizizi_case_receipt_links_unique"],
    ]) {
      expect(expected.split(from)).toHaveLength(2);
      expected = expected.replace(from, to);
    }
    expect(fixedBody).toBe(expected);
  });

  it("fails closed unless the historical 223 substrate and exact constraints exist", () => {
    expect(replacement).toContain("exact 223-migration base required");
    expect(replacement).toContain("accepted exact unique constraints have drifted");
    expect(replacement).toContain("installed gateway source or owner drifted");
    expect(replacement).toContain("to mizizi_executor");
    expect(replacement).toContain("from public,anon,authenticated,service_role");
    expect(replacement).not.toMatch(/create\s+(?:table|role|policy)\b/i);
    expect(replacement).not.toMatch(/security\s+invoker/i);
  });
});
