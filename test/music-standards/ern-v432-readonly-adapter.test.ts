import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  mapErn432,
} from "../../src/services/musicStandards/ern/v432/mapper";
import {
  Ern432AdapterError,
  parseErn432,
} from "../../src/services/musicStandards/ern/v432/parser";

const root = process.cwd();
const fixtureDir = path.join(
  root,
  "test/music-standards/fixtures/ern-4.3.2",
);

function fixture(name: string): string {
  return fs.readFileSync(path.join(fixtureDir, name), "utf8");
}

function expectAdapterError(
  run: () => unknown,
  code: string,
): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Ern432AdapterError);
    expect((error as Ern432AdapterError).code).toBe(code);
    return;
  }

  throw new Error(`Expected Ern432AdapterError ${code}`);
}

describe("DDEX ERN 4.3.2 read-only adapter", () => {
  it("maps one Release and SoundRecording into the WAKILISHA adapter envelope", () => {
    const xml = fixture("basic-release.xml");
    const result = mapErn432(xml);

    expect(result.adapterKey).toBe("ddex_ern_import");
    expect(result.adapterVersion).toBe(1);
    expect(result.externalStandard).toBe("DDEX_ERN");
    expect(result.externalVersion).toBe("4.3.2");
    expect(result.mappingProfile).toBe("music-data-dictionary/v1");
    expect(result.messageOrRecordType).toBe("NewReleaseMessage");
    expect(result.sourceParty).toBe("PADPIDA20260923001");
    expect(result.sourceReference).toBe("MSG-ERN-432-001");
    expect(result.payloadFingerprint).toMatch(/^[0-9a-f]{64}$/);

    expect(result.data.trackCandidates).toEqual([
      {
        resourceReference: "A1",
        title: "Fixture Track",
        displayArtistName: "Fixture Artist",
      },
    ]);

    expect(result.data.releaseCandidates).toEqual([
      {
        releaseReference: "R0",
        releaseType: "Album",
        title: "Fixture Album",
        displayArtistName: "Fixture Artist",
        releaseDate: "2026-09-23",
        genres: ["Afropop"],
        resourceReferences: ["A1", "A_IMG1"],
      },
    ]);

    expect(result.data.identifierCandidates).toEqual([
      {
        subjectKind: "track",
        subjectReference: "A1",
        schemeKey: "isrc",
        sourceScheme: "ISRC",
        sourceValue: "KEAAA2600001",
      },
      {
        subjectKind: "release",
        subjectReference: "R0",
        schemeKey: "gtin",
        sourceScheme: "ICPN",
        sourceValue: "0123456789012",
      },
    ]);

    expect(result.data.mediaEvidence).toEqual([
      {
        resourceReference: "A_IMG1",
        mediaKind: "image",
        imageType: "FrontCoverImage",
        uri: "https://media.invalid/ern432/front-cover.jpg",
      },
    ]);
  });

  it("projects the authoritative ERN 4.3.2 namespace, AVS and wrapper semantics", () => {
    const projection = parseErn432(fixture("basic-release.xml"));

    expect(projection.namespace).toBe("http://ddex.net/xml/ern/432");
    expect(projection.avsVersionId).toBe("9");
    expect(projection.soundRecordings[0].isrc).toBe("KEAAA2600001");
    expect(projection.soundRecordings[0].contributors[0].roles).toEqual([
      "StudioProducer",
    ]);
    expect(projection.releases[0].genres).toEqual(["Afropop"]);
  });

  it("keeps Display Artist, contributor and label evidence semantically distinct", () => {
    const result = mapErn432(fixture("basic-release.xml"));

    expect(result.data.artistEvidence).toContainEqual({
      context: "track",
      subjectReference: "A1",
      displayName: "Fixture Artist",
      partyReference: "P1",
      role: "MainArtist",
    });

    expect(result.data.contributorEvidence).toEqual([
      {
        trackReference: "A1",
        partyReference: "P2",
        fullName: "Fixture Producer",
        roles: ["StudioProducer"],
      },
    ]);

    expect(result.data.labelEvidence).toEqual([
      {
        releaseReference: "R0",
        partyReference: "P3",
        labelName: "Fixture Label",
      },
    ]);

    expect(result.mappingResult).toBe("review_required");
    expect(result.lossFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "review_required",
          detail: expect.stringContaining(
            "does not itself create Person",
          ),
        }),
        expect.objectContaining({
          classification: "review_required",
          detail: expect.stringContaining(
            "does not itself establish a Registry Label",
          ),
        }),
      ]),
    );
  });

  it("supports one Release containing multiple SoundRecordings", () => {
    const result = mapErn432(fixture("multiple-recordings.xml"));

    expect(result.data.trackCandidates).toHaveLength(2);
    expect(result.data.releaseCandidates).toHaveLength(1);
    expect(
      result.data.releaseCandidates[0].resourceReferences,
    ).toEqual(["A1", "A2"]);

    expect(
      result.data.identifierCandidates
        .filter((candidate) => candidate.schemeKey === "isrc")
        .map((candidate) => candidate.sourceValue),
    ).toEqual(["KEAAA2600002", "KEAAA2600003"]);
  });

  it("is deterministic for identical bytes and mapping profile", () => {
    const xml = fixture("basic-release.xml");

    expect(mapErn432(xml)).toEqual(mapErn432(xml));
  });

  it("loss-flags unsupported first-tranche Deal content instead of silently discarding it", () => {
    const result = mapErn432(fixture("unsupported-deal.xml"));

    expect(result.mappingResult).toBe("partial");
    expect(result.lossFlags).toContainEqual({
      path: "NewReleaseMessage.DealList",
      classification: "unsupported",
      detail:
        "This ERN 4.3.2 first tranche retains but does not semantically map this top-level section.",
    });
  });

  it("fails closed on an unsupported ERN namespace", () => {
    expectAdapterError(
      () => parseErn432(fixture("wrong-namespace.xml")),
      "ERN_UNSUPPORTED_NAMESPACE",
    );
  });

  it("fails closed on malformed XML", () => {
    expectAdapterError(
      () => parseErn432(fixture("malformed.xml")),
      "ERN_XML_INVALID",
    );
  });

  it("rejects DOCTYPE declarations", () => {
    expectAdapterError(
      () => parseErn432(fixture("doctype.xml")),
      "ERN_DOCTYPE_FORBIDDEN",
    );
  });

  it("contains no network or canonical database mutation path", () => {
    const sourceFiles = [
      "src/services/musicStandards/contracts.ts",
      "src/services/musicStandards/ern/v432/parser.ts",
      "src/services/musicStandards/ern/v432/mapper.ts",
    ].map((relativePath) =>
      fs.readFileSync(path.join(root, relativePath), "utf8"),
    );

    for (const source of sourceFiles) {
      expect(source).not.toMatch(/\bfetch\s*\(/i);
      expect(source).not.toMatch(/\bXMLHttpRequest\b/i);
      expect(source).not.toMatch(/@supabase\/supabase-js/i);
      expect(source).not.toMatch(/\bcreateClient\s*\(/i);
      expect(source).not.toMatch(
        /\b(insert\s+into|update\s+public\.|delete\s+from|supabase\.rpc)\b/i,
      );
    }
  });

  it("keeps authoritative ERN 4.3.2 XSD validation pinned in protected CI", () => {
    const verifier = fs.readFileSync(
      path.join(
        root,
        "scripts/music-standards/verify-ern432-authoritative-conformance.sh",
      ),
      "utf8",
    );
    const workflow = fs.readFileSync(
      path.join(root, ".github/workflows/critical-control-plane.yml"),
      "utf8",
    );

    expect(verifier).toContain(
      "ERN-3305%20-%20ERN%20Part%201%20Definition%20of%20messages%20v4.3.2%20XSD.zip",
    );
    expect(verifier).toContain(
      "bbd5012204ea3dbf08025e58768570650d9f65775b0022f5a93770c0dd411938",
    );
    expect(verifier).toContain(
      "def25b4e72696c9bbc1fed84962acc3a9bae2bc92ef25f8393c99b362aa53a6a",
    );
    expect(verifier).toContain(
      "87e99fe74f57a640dce0d3247d16b3b52358562c1dbefc4617eb8a9b7360d943",
    );
    expect(workflow).toContain(
      "scripts/music-standards/verify-ern432-authoritative-conformance.sh",
    );
  });

  it("is wired into the protected critical contract", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.saxes).toBe("6.0.0");
    expect(packageJson.scripts?.["test:critical"]).toContain(
      "test/music-standards/ern-v432-readonly-adapter.test.ts",
    );
  });
});
