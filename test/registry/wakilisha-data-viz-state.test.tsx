import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WkStateMark } from "../../src/components/data-viz/WkStateMark";
import { readFileSync } from "node:fs";

describe("shared source-defined visual status", () => {
  it("uses icons and labels as well as existing semantic WAKILISHA colours", () => {
    const open = renderToStaticMarkup(<WkStateMark state="open" />);
    const blocked = renderToStaticMarkup(<WkStateMark state="blocked" label="Decision recorded · blocked" />);
    const verified = renderToStaticMarkup(<WkStateMark state="verified" />);
    expect(open).toContain("Open");
    expect(open).toContain('data-wk-state-mark="open"');
    expect(blocked).toContain("Decision recorded · blocked");
    expect(blocked).toContain('data-wk-state-mark="blocked"');
    expect(verified).toContain("Verified complete");
    expect(verified).toContain('data-wk-state-mark="verified"');
    for (const output of [open, blocked, verified]) expect(output).toContain("<svg");
  });
  it("maps authority only from independently verified statuses", () => {
    const brief = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    const cores = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx", "utf8");
    expect(brief).toContain('item.status === "blocked" ? "blocked" : "unverified"');
    expect(cores).toContain('exactDecision?.status === "blocked" && selected.status === "open"');
    expect(cores).toContain('<WkStateMark state="blocked"');
  });
  it("renders exact IANA zoned time in visible Brief and Cores history", () => {
    const brief = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    const cores = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx", "utf8");
    expect(brief).toContain("<WkZonedTimestamp value={queue.readAt} />");
    expect(cores).toContain("Review opened · Nairobi");
    expect(cores).toContain("<WkZonedTimestamp value={fact.created_at} />");
    expect(cores).toContain("<WkZonedTimestamp value={fact.updated_at} />");
  });
});
