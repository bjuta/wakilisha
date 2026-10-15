import { describe, expect, it } from "vitest";
import {
  admitMiziziFindingCaseV1,
  transitionMiziziCaseSystemV1,
  type CaseDbPoolV1,
  type CaseDbSessionV1,
  type CaseDbResultV1,
} from "../../scripts/registry/agents/mizizi/runtime/case-journal";
import type { MiziziFinding } from "../../scripts/registry/agents/mizizi/core";

const workspaceId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const subjectId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const caseId = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const hash1 = "a".repeat(64);
const hash2 = "b".repeat(64);

const finding: MiziziFinding = {
  entityType: "track", entityId: subjectId, ruleId: "track_slug_identity_noise",
  ruleVersion: "1.1.0", fieldName: "slug", currentValue: "original",
  proposedValue: "revised", disposition: "review", fingerprint: hash1,
  confidence: 0.85, severity: "medium", reason: "Slug contains a feature credit",
  evidence: {},
};
const bound = {
  id: caseId, workspace_id: workspaceId,
  case_key: "", subject_type: "track", subject_id: subjectId,
  claim_family_key: "track_identity_metadata_review_v1",
  claim_key: "mizizi.track_slug_identity_noise.slug",
  revision: 1, case_state: "open", current_stage: "triage", next_action_at: null,
  last_observation_fingerprint: hash1, policy_ruleset_version: "1.1.0",
};

function database(
  accept: (sql: string, params: readonly unknown[] | undefined) => CaseDbResultV1<any>,
) {
  const calls: string[] = [];
  let released = false;
  const session: CaseDbSessionV1 = {
    query: async <T>(sql: string, params?: readonly unknown[]) => {
      calls.push(sql.trim());
      return accept(sql, params) as CaseDbResultV1<T>;
    },
    release: () => { released = true; },
  };
  const pool: CaseDbPoolV1 = { connect: async () => session };
  return { pool, calls, get released() { return released; } };
}
const result = (rows: any[]) => ({ rows, rowCount: rows.length });
const passControl = (sql: string) => /^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/.test(sql.trim());
const input = { workspaceId, policyRulesetVersion: "1.1.0", finding };

describe("MIZIZI Headquarters DB02 durable journal adapter", () => {
  it("creates a stable case exactly once; DB02 trigger owns its event", async () => {
    const db = database((sql) => {
      if (passControl(sql)) return result([]);
      if (sql.includes("from mizizi_private.workspaces")) return result([{ id:workspaceId }]);
      if (sql.includes("insert into mizizi_private.cases")) return result([{ id:caseId, revision:1 }]);
      throw new Error(`unexpected SQL ${sql}`);
    });
    const r = await admitMiziziFindingCaseV1(db.pool,input);
    expect(r).toMatchObject({ status:"created", caseId, revision:1 });
    expect(db.calls.some((s) => s.includes("insert into mizizi_private.case_events"))).toBe(false);
    expect(db.calls.some((s) => s.includes("on conflict (workspace_id,case_key) do nothing"))).toBe(true);
    expect(db.calls.at(-1)).toBe("COMMIT");
    expect(db.released).toBe(true);
  });

  it("replays the same observation without an event or update", async () => {
    const db = database((sql,values) => {
      if (passControl(sql)) return result([]);
      if (sql.includes("from mizizi_private.workspaces")) return result([{ id:workspaceId }]);
      if (sql.includes("insert into mizizi_private.cases")) return result([]);
      if (sql.includes("from mizizi_private.cases")) return result([{ ...bound, case_key: String(values?.[1]) }]);
      throw new Error(`unexpected SQL ${sql}`);
    });
    const r = await admitMiziziFindingCaseV1(db.pool,input);
    expect(r.status).toBe("unchanged");
    expect(db.calls.some((s) => s.includes("update mizizi_private.cases"))).toBe(false);
  });

  it("records an altered observation with a CAS revision, preserving review state", async () => {
    const db = database((sql,values) => {
      if (passControl(sql)) return result([]);
      if (sql.includes("from mizizi_private.workspaces")) return result([{ id:workspaceId }]);
      if (sql.includes("insert into mizizi_private.cases")) return result([]);
      if (sql.includes("from mizizi_private.cases")) return result([{ ...bound, case_key: String(values?.[1]), last_observation_fingerprint:hash1,
        case_state:"awaiting_review", current_stage:"human_review" }]);
      if (sql.includes("update mizizi_private.cases")) {
        expect(values?.[2]).toBe(1);
        expect(sql.includes("case_state=")).toBe(false);
        return result([{ id:caseId,revision:2 }]);
      }
      throw new Error(`unexpected SQL ${sql}`);
    });
    const r=await admitMiziziFindingCaseV1(db.pool,{...input,finding:{...finding,fingerprint:hash2}});
    expect(r).toMatchObject({ status:"observation_recorded", revision:2 });
  });

  it("refuses silent re-opening of completed cases", async () => {
    const db=database((sql,values)=>{
      if (passControl(sql)) return result([]);
      if (sql.includes("from mizizi_private.workspaces")) return result([{id:workspaceId}]);
      if (sql.includes("insert into mizizi_private.cases")) return result([]);
      if (sql.includes("from mizizi_private.cases")) return result([{...bound,case_key:String(values?.[1]),case_state:"resolved"}]);
      throw new Error(`unexpected SQL ${sql}`);
    });
    const x=await admitMiziziFindingCaseV1(db.pool,{...input,finding:{...finding,fingerprint:hash2}});
    expect(x.status).toBe("requires_manual_reopen");
    expect(db.calls.some((s)=>s.includes("update mizizi_private.cases"))).toBe(false);
  });

  it("fails closed and rolls back when stored claim binding disagrees", async () => {
    const db=database((sql,values)=>{
      if (passControl(sql)) return result([]);
      if (sql.includes("from mizizi_private.workspaces")) return result([{id:workspaceId}]);
      if (sql.includes("insert into mizizi_private.cases")) return result([]);
      if (sql.includes("from mizizi_private.cases")) return result([{...bound,case_key:String(values?.[1]),subject_id:workspaceId}]);
      throw new Error(`unexpected SQL ${sql}`);
    });
    await expect(admitMiziziFindingCaseV1(db.pool,input)).rejects.toThrow(/identity disagrees/);
    expect(db.calls.at(-1)).toBe("ROLLBACK");
    expect(db.released).toBe(true);
  });

  it("plans and CAS-updates a system-only research transition", async () => {
    const db=database((sql)=>{
      if(passControl(sql))return result([]);
      if(sql.includes("from mizizi_private.cases"))return result([{...bound,case_key:"mizizi:case:v1:abc"}]);
      if(sql.includes("update mizizi_private.cases"))return result([{id:caseId,revision:2}]);
      throw new Error(`unexpected SQL ${sql}`);
    });
    const r=await transitionMiziziCaseSystemV1(db.pool,{workspaceId,caseId,expectedRevision:1,command:"start_research",reason:"Investigate registered evidence sources."});
    expect(r).toMatchObject({status:"changed",revision:2});
    expect(db.calls.some((s)=>s.includes("set\n        revision=$4::int"))).toBe(true);
  });

  it("rejects stale system commands before update and rolls back", async()=>{
    const db=database((sql)=>{
      if(passControl(sql))return result([]);
      if(sql.includes("from mizizi_private.cases"))return result([{...bound,case_key:"mizizi:case:v1:abc",revision:4}]);
      throw new Error(`unexpected SQL ${sql}`);
    });
    await expect(transitionMiziziCaseSystemV1(db.pool,{workspaceId,caseId,expectedRevision:1,command:"start_research",reason:"Inspect the new Registry evidence."})).rejects.toThrow(/stale/);
    expect(db.calls.at(-1)).toBe("ROLLBACK");
  });

  it("never opens a database transaction for unsupported MIZIZI rule IDs", async()=>{
    const db=database(()=>{throw new Error("unexpected query");});
    await expect(admitMiziziFindingCaseV1(db.pool,{...input,finding:{...finding,ruleId:"unknown_rule"}})).rejects.toThrow(/unregistered rule/);
    expect(db.calls).toEqual([]);
  });
});
