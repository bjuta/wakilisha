import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_CANDIDATE_CONTRACT_VERSION,
  appleMusicSearchTermsV1,
  classifyAppleMusicCandidateV1,
  scoreAppleMusicCandidateV1,
} from "../../supabase/functions/_shared/provider-candidate-evidence.ts";

describe("Provider Identity candidate evidence", () => {
  it("preserves Apple search-term normalization including version stripping", () => {
    expect(
      appleMusicSearchTermsV1({
        trackTitle: "Song Name - Live",
        artistName: "Artist Name",
      }),
    ).toEqual([
      "Song Name - Live Artist Name",
      "Song Name Artist Name",
    ]);
  });

  it("scores exact title and artist deterministically", () => {
    expect(
      scoreAppleMusicCandidateV1(
        {
          trackTitle: "Example Song",
          artistName: "Example Artist",
        },
        {
          id: "apple-1",
          attributes: {
            name: "Example Song",
            artistName: "Example Artist",
          },
        },
      ),
    ).toBe(0.93);
  });

  it("elevates an exact ISRC match into strong identifier evidence", () => {
    const confidence = scoreAppleMusicCandidateV1(
      {
        trackTitle: "Different punctuation",
        artistName: "Artist",
        isrc: "KE-ABC-26-00001",
      },
      {
        id: "apple-1",
        attributes: {
          name: "Different Punctuation",
          artistName: "Artist",
          isrc: "KEABC2600001",
        },
      },
    );

    const candidate = classifyAppleMusicCandidateV1({
      input: {
        trackTitle: "Different punctuation",
        artistName: "Artist",
        isrc: "KE-ABC-26-00001",
      },
      song: {
        id: "apple-1",
        attributes: {
          name: "Different Punctuation",
          artistName: "Artist",
          isrc: "KEABC2600001",
        },
      },
      confidence,
      searchTerm: "Different punctuation Artist",
      minAutoAccept: 0.9,
    });

    expect(candidate).toMatchObject({
      contractVersion: PROVIDER_CANDIDATE_CONTRACT_VERSION,
      method: "isrc",
      evidenceClass: "strong_identifier",
      disposition: "auto_accept_candidate",
      confidence: 0.99,
    });
  });

  it("does not treat malformed equal identifier strings as strong ISRC evidence", () => {
    const candidate = classifyAppleMusicCandidateV1({
      input: {
        trackTitle: "Example Song",
        artistName: "Example Artist",
        isrc: "ABC123",
      },
      song: {
        id: "apple-short-id",
        attributes: {
          name: "Example Song",
          artistName: "Example Artist",
          isrc: "ABC123",
        },
      },
      confidence: 0.99,
      searchTerm: "Example Song Example Artist",
      minAutoAccept: 0.9,
    });

    expect(candidate.evidenceClass).toBe("metadata_similarity");
    expect(candidate.disposition).toBe("review_candidate");
    expect(candidate.method).toBe("exact_title_artist");
  });

  it("never auto-accepts similarity-only evidence even above the old threshold", () => {
    const candidate = classifyAppleMusicCandidateV1({
      input: {
        trackTitle: "Example Song",
        artistName: "Example Artist",
      },
      song: {
        id: "apple-1",
        attributes: {
          name: "Example Song",
          artistName: "Example Artist",
        },
      },
      confidence: 0.93,
      searchTerm: "Example Song Example Artist",
      minAutoAccept: 0.9,
    });

    expect(candidate).toMatchObject({
      method: "exact_title_artist",
      evidenceClass: "metadata_similarity",
      disposition: "review_candidate",
      confidence: 0.93,
    });
  });

  it("rejects weak similarity below the review floor", () => {
    const candidate = classifyAppleMusicCandidateV1({
      input: {
        trackTitle: "A",
        artistName: "Artist A",
      },
      song: {
        id: "apple-2",
        attributes: {
          name: "Something Else",
          artistName: "Different Artist",
        },
      },
      confidence: 0.3,
      searchTerm: "A Artist A",
      minAutoAccept: 0.9,
    });

    expect(candidate.disposition).toBe("reject_candidate");
    expect(candidate.evidenceClass).toBe("metadata_similarity");
  });

  it("is consumed by chart playback enrichment without similarity auto-admission", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/functions/run-chart-playback-enrichment/index.ts",
      ),
      "utf8",
    );

    expect(source).toContain("classifyAppleMusicCandidateV1");
    expect(source).toContain('candidate.disposition === "auto_accept_candidate"');
    expect(source).toContain('"accepted"');
    expect(source).toContain('"needs_review"');
    expect(source).toContain(
      'provider_candidate_evidence_class: match.evidenceClass',
    );

    expect(source).not.toMatch(/function scoreSearchMatch\s*\(/);
    expect(source).not.toMatch(/function scoreArtistMatch\s*\(/);
    expect(source).not.toMatch(/function searchTermsForItem\s*\(/);
    expect(source).not.toContain(
      'status: best.confidence >= minAutoAccept ? "accepted" : "needs_review"',
    );
  });

  it("contains no database client or canonical mutation path", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/functions/_shared/provider-candidate-evidence.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("createClient");
    expect(source).not.toMatch(/\.from\s*\(/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/registry_track_provider_links/i);
    expect(source).not.toMatch(/insert\s+into\s+public\.registry_/i);
  });
});
