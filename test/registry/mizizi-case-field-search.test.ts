import { describe, expect, it } from "vitest";
import { searchMiziziFieldHits, projectMiziziFieldFocus, type CaseSubject } from "../../src/services/miziziCaseField";

// Accepted, exact Production Registry review/source/artist-credit records, read-only on 2026-10-12.
const desire: CaseSubject = {
  reviewId: "2b8b2d52-6c5e-4397-914d-60c8bf0e34d2",
  sourceId: "f30846f0-8cf1-4df6-8875-38fa7a763e7b",
  kind: "track", title: "DESIRE", isrc: null, status: "open", workstream: "mizizi_data_hygiene",
  artists: [
    { id: "6056976b-9394-4780-8fc4-21610f6d3fa9", name: "Lilmaina", slug: "lilmaina", status: "needs_review" },
    { id: "9391d458-3f8c-4f1a-a42b-1faf2eb50fd4", name: "Lilmaina", slug: "lil-maina", status: "needs_review" },
    { id: "b142fa9d-ccaf-492c-8f5f-cf0b54a8693b", name: "Nikita Kering’", slug: "nikita-kering", status: "active" },
  ],
};
const ficha: CaseSubject = {
  reviewId: "6c521cd1-0438-44e7-b6b0-6b737096774b",
  sourceId: "a708a142-dc2b-4fd2-9dbb-d780b666667c",
  kind: "track", title: "Ficha", isrc: null, status: "resolved", workstream: "mizizi_data_hygiene",
  artists: [
    { id: "5a7b745c-bc04-43a8-b06f-577429d957de", name: "Charisma", slug: "charisma", status: "archived" },
  ],
};
const colors: CaseSubject = {
  reviewId: "49ec3921-3f3e-46d3-8c3a-62f826957dfd",
  sourceId: "aa2793e6-ed18-40a7-9654-dfd56769fcbe",
  kind: "track", title: "Colors", isrc: null, status: "resolved", workstream: "mizizi_data_hygiene",
  artists: [
    { id: "d2559616-1353-4325-9f24-75a5c384f8db", name: "Bensoul", slug: "bensoul", status: "archived" },
  ],
};
const fixtures = [desire, ficha, colors];

describe("MIZIZI Field uses genuine source relationships and deliberate selection", () => {
  it("does not produce node clusters for short or empty searches", () => {
    expect(searchMiziziFieldHits(fixtures, "")).toEqual([]);
    expect(searchMiziziFieldHits(fixtures, "de")).toEqual([]);
  });
  it("selects DESIRE by exact real recording review and shows only recorded credits", () => {
    const result = searchMiziziFieldHits(fixtures, "DESIRE");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("case:" + desire.reviewId);
    const focus = projectMiziziFieldFocus(fixtures, result[0].key);
    expect(focus?.kind).toBe("case");
    if (focus?.kind === "case") expect(focus.credits).toHaveLength(3);
  });
  it("does not merge two distinct Lilmaina artist identities", () => {
    const hits = searchMiziziFieldHits(fixtures, "Lilmaina");
    expect(hits).toHaveLength(2);
    expect(new Set(hits.map(hit => hit.key)).size).toBe(2);
    expect(hits.map(hit => hit.subtitle).join(" ")).toContain("lil-maina");
    expect(hits.map(hit => hit.subtitle).join(" ")).toContain("lilmaina");
    for (const hit of hits) {
      const focus = projectMiziziFieldFocus(fixtures, hit.key);
      expect(focus?.kind).toBe("artist");
      if (focus?.kind === "artist") {
        expect(focus.related.map(c => c.reviewId)).toEqual([desire.reviewId]);
        expect(focus.creditState).toBe("needs_review");
      }
    }
  });
  it("counts actual same-ID Lilmaina credits across name variants", () => {
    // Real reviewed recording Kionjo: recorded alias 'Lil Maina' shares artist ID
    // with DESIRE's 'Lilmaina', but its display name does not match the text query.
    const kionjo: CaseSubject = {
      reviewId: "827b82af-1bb4-4b82-abb0-80a9f7a1c2dc",
      sourceId: "d1890830-5e25-4c39-843e-bf5934b9dab7",
      kind: "track", title: "Kionjo (feat. Lilmaina)",
      isrc: "QMDA62554676", status: "open", workstream: "mizizi_data_hygiene",
      artists: [{
        id: "9391d458-3f8c-4f1a-a42b-1faf2eb50fd4",
        name: "Lil Maina", slug: "lil-maina", status: "active",
      }],
    };
    const inputs = [desire, kionjo];
    const sameId = searchMiziziFieldHits(inputs, "Lilmaina")
      .find(hit => hit.key === "artist:9391d458-3f8c-4f1a-a42b-1faf2eb50fd4");
    expect(sameId?.linkedCases).toBe(2);
    expect(sameId?.subtitle).toContain("2 linked reviews");
    const selected = projectMiziziFieldFocus(inputs, sameId!.key);
    expect(selected?.kind).toBe("artist");
    if (selected?.kind === "artist") {
      expect(selected.related).toHaveLength(2);
      expect(selected.creditState).toBe("needs_review");
    }
    expect(searchMiziziFieldHits(inputs, "Lilmaina")
      .some(hit => hit.key === "artist:6056976b-9394-4780-8fc4-21610f6d3fa9")).toBe(true);
  });
  it("maintains the open or resolved review filter without mislabelling archived credits", () => {
    expect(searchMiziziFieldHits(fixtures, "Ficha", "open")).toHaveLength(0);
    expect(searchMiziziFieldHits(fixtures, "Ficha", "resolved")).toHaveLength(1);
    expect(projectMiziziFieldFocus(fixtures, "case:" + ficha.reviewId, "open")).toBeNull();
    const result = projectMiziziFieldFocus(fixtures, "case:" + ficha.reviewId, "resolved");
    expect(result?.kind).toBe("case");
    if (result?.kind === "case") expect(result.credits[0].status).toBe("archived");
    const archived = projectMiziziFieldFocus(fixtures, "artist:" + ficha.artists[0].id);
    if (archived?.kind === "artist") expect(archived.creditState).toBe("archived");
    else throw new Error("Expected existing archived credit");
    const active = projectMiziziFieldFocus(fixtures, "artist:" + desire.artists[2].id);
    if (active?.kind === "artist") expect(active.creditState).toBe("active");
    else throw new Error("Expected existing active credit");
    expect(projectMiziziFieldFocus(fixtures, "artist:unrecorded")).toBeNull();
  });
});
