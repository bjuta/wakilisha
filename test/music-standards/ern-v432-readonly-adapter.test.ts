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
    expect(result.adapterVersion).toBe(3);
    expect(result.externalStandard).toBe("DDEX_ERN");
    expect(result.externalVersion).toBe("4.3.2");
    expect(result.mappingProfile).toBe("music-data-dictionary/v1");
    expect(result.messageOrRecordType).toBe("NewReleaseMessage");
    expect(result.sourceParty).toBe("PADPIDA20260923001");
    expect(result.sourceReference).toBe("MSG-ERN-432-001");
    expect(result.payloadFingerprint).toMatch(/^[0-9a-f]{64}$/);

    expect(result.data.messageContext).toEqual({
      avsVersionId: "9",
      releaseProfileVersionId: "Audio",
      releaseProfileVariantVersionId: "Classical",
      languageAndScriptCode: "en",
    });

    expect(result.data.trackCandidates).toEqual([
      {
        resourceReference: "A1",
        title: "Fixture Track",
        displayArtistName: "Fixture Artist",
        recordingType: "MusicalWorkSoundRecording",
        duration: "PT3M",
        editions: [
          {
            editionType: "NonImmersiveEdition",
            resourceIds: [
              {
                isReplaced: false,
                identifiers: [
                  {
                    sourceScheme: "ISRC",
                    sourceValue: "KEAAA2600001",
                    namespace: null,
                  },
                ],
              },
              {
                isReplaced: null,
                identifiers: [
                  {
                    sourceScheme: "ISRC",
                    sourceValue: "KEAAA2600005",
                    namespace: null,
                  },
                ],
              },
            ],
            technicalDetails: [
              {
                technicalResourceDetailsReference: "T_AUDIO1",
                deliveryFiles: [
                  {
                    deliveryFileType: "AudioFile",
                    file: {
                      uri: "file://fixture-track.wav",
                      unsupportedFields: [],
                    },
                    unsupportedFields: [],
                  },
                ],
                unsupportedFields: [],
              },
            ],
          },
          {
            editionType: "ImmersiveEdition",
            resourceIds: [
              {
                isReplaced: null,
                identifiers: [
                  {
                    sourceScheme: "ISRC",
                    sourceValue: "KEAAA2600099",
                    namespace: null,
                  },
                ],
              },
            ],
            technicalDetails: [],
          },
        ],
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
        resourceReferences: ["A1"],
        resourceGroups: [
          {
            resourceGroupType: null,
            sequenceNumber: null,
            contentItems: [
              {
                sequenceNumber: 1,
                releaseResourceReference: "A1",
                linkedResourceReferences: [],
                isBonusResource: null,
                isInstantGratificationResource: null,
                isPreOrderIncentiveResource: null,
                unsupportedFields: [],
              },
            ],
            linkedResourceReferences: [
              {
                resourceReference: "A_IMG1",
                linkDescription: "CoverArt",
                languageAndScriptCode: null,
                namespace: null,
                userDefinedValue: null,
                sequenceNumber: null,
                isMultiFile: null,
              },
            ],
            resourceGroups: [],
            unsupportedFields: [],
          },
        ],
        identifiers: [
          {
            sourceScheme: "ICPN",
            sourceValue: "0123456789012",
            namespace: null,
          },
        ],
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
        subjectKind: "track",
        subjectReference: "A1",
        schemeKey: "isrc",
        sourceScheme: "ISRC",
        sourceValue: "KEAAA2600005",
      },
      {
        subjectKind: "track",
        subjectReference: "A1",
        schemeKey: "isrc",
        sourceScheme: "ISRC",
        sourceValue: "KEAAA2600099",
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
        technicalDetails: [
          {
            technicalResourceDetailsReference: "T_IMG1",
            file: {
              uri: "https://media.invalid/ern432/front-cover.jpg",
              unsupportedFields: [],
            },
            unsupportedFields: [],
          },
        ],
      },
    ]);
  });

  it("projects the authoritative ERN 4.3.2 namespace, AVS and wrapper semantics", () => {
    const projection = parseErn432(fixture("basic-release.xml"));

    expect(projection.namespace).toBe("http://ddex.net/xml/ern/432");
    expect(projection.avsVersionId).toBe("9");
    expect(projection.releaseProfileVersionId).toBe("Audio");
    expect(projection.releaseProfileVariantVersionId).toBe("Classical");
    expect(projection.languageAndScriptCode).toBe("en");
    expect(projection.soundRecordings[0].isrc).toBe("KEAAA2600001");
    expect(projection.soundRecordings[0].recordingType).toBe(
      "MusicalWorkSoundRecording",
    );
    expect(projection.soundRecordings[0].duration).toBe("PT3M");
    expect(projection.soundRecordings[0].editions).toHaveLength(2);
    expect(
      projection.soundRecordings[0].editions[0].technicalDetails,
    ).toEqual([
      {
        technicalResourceDetailsReference: "T_AUDIO1",
        deliveryFiles: [
          {
            deliveryFileType: "AudioFile",
            file: {
              uri: "file://fixture-track.wav",
              unsupportedFields: [],
            },
            unsupportedFields: [],
          },
        ],
        unsupportedFields: [],
      },
    ]);
    expect(
      projection.soundRecordings[0].editions
        .flatMap((edition) => edition.resourceIds)
        .flatMap((resourceId) => resourceId.identifiers)
        .filter((identifier) => identifier.sourceScheme === "ISRC")
        .map((identifier) => identifier.sourceValue),
    ).toEqual([
      "KEAAA2600001",
      "KEAAA2600005",
      "KEAAA2600099",
    ]);
    expect(projection.soundRecordings[0].contributors[0].roles).toEqual([
      "StudioProducer",
    ]);
    expect(projection.releases[0].genres).toEqual(["Afropop"]);
    expect(projection.releases[0].resourceReferences).toEqual(["A1"]);
    expect(projection.releases[0].resourceGroups).toEqual([
      {
        resourceGroupType: null,
        sequenceNumber: null,
        contentItems: [
          {
            sequenceNumber: 1,
            releaseResourceReference: "A1",
            linkedResourceReferences: [],
            isBonusResource: null,
            isInstantGratificationResource: null,
            isPreOrderIncentiveResource: null,
            unsupportedFields: [],
          },
        ],
        linkedResourceReferences: [
          {
            resourceReference: "A_IMG1",
            linkDescription: "CoverArt",
            languageAndScriptCode: null,
            namespace: null,
            userDefinedValue: null,
            sequenceNumber: null,
            isMultiFile: null,
          },
        ],
        resourceGroups: [],
        unsupportedFields: [],
      },
    ]);
    expect(projection.images[0].technicalDetails).toEqual([
      {
        technicalResourceDetailsReference: "T_IMG1",
        file: {
          uri: "https://media.invalid/ern432/front-cover.jpg",
          unsupportedFields: [],
        },
        unsupportedFields: [],
      },
    ]);
  });

  it("keeps Party identifiers as evidence without inferring canonical identity", () => {
    const result = mapErn432(fixture("basic-release.xml"));

    expect(result.data.partyIdentifierEvidence).toEqual(
      expect.arrayContaining([
        {
          partyReference: "P1",
          fullName: "Fixture Artist",
          schemeKey: "isni",
          sourceScheme: "ISNI",
          sourceValue: "000000012146438X",
          namespace: null,
        },
        {
          partyReference: "P1",
          fullName: "Fixture Artist",
          schemeKey: "ddex_party_id",
          sourceScheme: "DPID",
          sourceValue: "PADPIDAARTIST001",
          namespace: null,
        },
        {
          partyReference: "P2",
          fullName: "Fixture Producer",
          schemeKey: "ipi",
          sourceScheme: "IpiNameNumber",
          sourceValue: "00123456789",
          namespace: null,
        },
        {
          partyReference: "P2",
          fullName: "Fixture Producer",
          schemeKey: "ipn",
          sourceScheme: "IPN",
          sourceValue: "IPN-FIXTURE-PRODUCER",
          namespace: null,
        },
      ]),
    );

    expect(result.lossFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "review_required",
          path: "PartyList.Party[P1].PartyId.ISNI",
        }),
        expect.objectContaining({
          classification: "review_required",
          path: "PartyList.Party[P1].PartyId.DPID",
        }),
      ]),
    );
  });

  it("retains valid but unmapped identifier evidence and loss-flags it", () => {
    const result = mapErn432(fixture("multiple-recordings.xml"));

    expect(result.data.partyIdentifierEvidence).toEqual(
      expect.arrayContaining([
        {
          partyReference: "P2",
          fullName: "Fixture Label",
          schemeKey: null,
          sourceScheme: "CisacSocietyId",
          sourceValue: "FIXTURE-SOCIETY",
          namespace: null,
        },
        {
          partyReference: "P2",
          fullName: "Fixture Label",
          schemeKey: null,
          sourceScheme: "ProprietaryId",
          sourceValue: "LABEL-PARTY-001",
          namespace: "FixtureParty",
        },
      ]),
    );

    expect(result.data.trackCandidates[0].editions[0].resourceIds[0].identifiers)
      .toEqual(
        expect.arrayContaining([
          {
            sourceScheme: "CatalogNumber",
            sourceValue: "TRACK-001",
            namespace: "FixtureCatalog",
          },
          {
            sourceScheme: "ProprietaryId",
            sourceValue: "A1-PROP-001",
            namespace: "FixtureTrack",
          },
        ]),
      );

    expect(result.data.releaseCandidates[0].identifiers).toEqual(
      expect.arrayContaining([
        {
          sourceScheme: "GRid",
          sourceValue: "FIXTURE-GRID-001",
          namespace: null,
        },
        {
          sourceScheme: "CatalogNumber",
          sourceValue: "ALBUM-001",
          namespace: "FixtureCatalog",
        },
        {
          sourceScheme: "ProprietaryId",
          sourceValue: "R0-PROP-001",
          namespace: "FixtureRelease",
        },
      ]),
    );

    expect(result.mappingResult).toBe("partial");
    expect(result.lossFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "partial",
          path: "PartyList.Party[P2].PartyId.CisacSocietyId",
        }),
        expect.objectContaining({
          classification: "partial",
          path:
            "ResourceList.SoundRecording[A1].SoundRecordingEdition[0].ResourceId[0].CatalogNumber",
        }),
        expect.objectContaining({
          classification: "partial",
          path: "ReleaseList.Release[R0].ReleaseId.GRid",
        }),
      ]),
    );
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
      result.data.releaseCandidates[0].resourceGroups,
    ).toEqual([
      {
        resourceGroupType: null,
        sequenceNumber: null,
        contentItems: [],
        linkedResourceReferences: [],
        resourceGroups: [
          {
            resourceGroupType: "Component",
            sequenceNumber: 1,
            contentItems: [
              {
                sequenceNumber: 1,
                releaseResourceReference: "A1",
                linkedResourceReferences: [],
                isBonusResource: null,
                isInstantGratificationResource: null,
                isPreOrderIncentiveResource: null,
                unsupportedFields: [],
              },
              {
                sequenceNumber: 2,
                releaseResourceReference: "A2",
                linkedResourceReferences: [],
                isBonusResource: null,
                isInstantGratificationResource: null,
                isPreOrderIncentiveResource: null,
                unsupportedFields: [],
              },
            ],
            linkedResourceReferences: [],
            resourceGroups: [],
            unsupportedFields: [],
          },
        ],
        unsupportedFields: [],
      },
    ]);

    expect(
      result.data.identifierCandidates
        .filter((candidate) => candidate.schemeKey === "isrc")
        .map((candidate) => candidate.sourceValue),
    ).toEqual(["KEAAA2600002", "KEAAA2600003"]);
  });

  it("keeps linked cover art secondary to the primary Release resource", () => {
    const result = mapErn432(fixture("basic-release.xml"));

    expect(result.data.releaseCandidates[0].resourceReferences).toEqual([
      "A1",
    ]);
    expect(
      result.data.releaseCandidates[0].resourceGroups[0]
        .linkedResourceReferences,
    ).toEqual([
      expect.objectContaining({
        resourceReference: "A_IMG1",
        linkDescription: "CoverArt",
      }),
    ]);
  });

  it("loss-flags valid technical fields outside the bounded v1 projection", () => {
    const xml = fixture("basic-release.xml").replace(
      "<TechnicalResourceDetailsReference>T_IMG1</TechnicalResourceDetailsReference>",
      "<TechnicalResourceDetailsReference>T_IMG1</TechnicalResourceDetailsReference>\n        <ImageCodecType>JPEG</ImageCodecType>",
    );
    const result = mapErn432(xml);

    expect(result.mappingResult).toBe("partial");
    expect(result.lossFlags).toContainEqual(
      expect.objectContaining({
        classification: "partial",
        path:
          "ResourceList.Image[A_IMG1].TechnicalDetails[0].ImageCodecType",
      }),
    );
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
