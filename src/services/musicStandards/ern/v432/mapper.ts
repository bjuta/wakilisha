import { createHash } from "node:crypto";

import type {
  MusicMappingLoss,
  MusicStandardAdapterEnvelope,
} from "../../contracts";
import {
  parseErn432,
  type Ern432Projection,
  type ErnReleaseIdentifierProjection,
  type ErnResourceGroupProjection,
  type ErnSoundRecordingEditionProjection,
  type ErnTechnicalImageDetailsProjection,
} from "./parser";

export interface ErnIdentifierCandidate {
  subjectKind: "track" | "release";
  subjectReference: string;
  schemeKey: "isrc" | "gtin";
  sourceScheme: "ISRC" | "ICPN";
  sourceValue: string;
}

export interface ErnPartyIdentifierEvidence {
  partyReference: string;
  fullName: string | null;
  schemeKey:
    | "isni"
    | "ipi"
    | "ipn"
    | "ddex_party_id"
    | null;
  sourceScheme:
    | "ISNI"
    | "DPID"
    | "IpiNameNumber"
    | "IPN"
    | "CisacSocietyId"
    | "ProprietaryId";
  sourceValue: string;
  namespace: string | null;
}

export interface ErnMessageContext {
  avsVersionId: string | null;
  releaseProfileVersionId: string | null;
  releaseProfileVariantVersionId: string | null;
  languageAndScriptCode: string | null;
}

export interface ErnArtistEvidence {
  context: "track" | "release";
  subjectReference: string;
  displayName: string | null;
  partyReference: string | null;
  role: string | null;
}

export interface ErnContributorEvidence {
  trackReference: string;
  partyReference: string | null;
  fullName: string | null;
  roles: string[];
}

export interface ErnLabelEvidence {
  releaseReference: string;
  partyReference: string;
  labelName: string | null;
}

export interface ErnMediaEvidence {
  resourceReference: string;
  mediaKind: "image";
  imageType: string | null;
  uri: string | null;
  technicalDetails: ErnTechnicalImageDetailsProjection[];
}

export interface ErnReleaseCandidate {
  releaseReference: string;
  releaseType: string | null;
  title: string | null;
  displayArtistName: string | null;
  releaseDate: string | null;
  genres: string[];
  resourceReferences: string[];
  resourceGroups: ErnResourceGroupProjection[];
  identifiers: ErnReleaseIdentifierProjection[];
}

export interface ErnTrackCandidate {
  resourceReference: string;
  title: string | null;
  displayArtistName: string | null;
  recordingType: string | null;
  duration: string | null;
  editions: ErnSoundRecordingEditionProjection[];
}

export interface Ern432MappedData {
  messageContext: ErnMessageContext;
  releaseCandidates: ErnReleaseCandidate[];
  trackCandidates: ErnTrackCandidate[];
  artistEvidence: ErnArtistEvidence[];
  contributorEvidence: ErnContributorEvidence[];
  partyIdentifierEvidence: ErnPartyIdentifierEvidence[];
  identifierCandidates: ErnIdentifierCandidate[];
  labelEvidence: ErnLabelEvidence[];
  mediaEvidence: ErnMediaEvidence[];
}

function fingerprintPayload(xml: string): string {
  return createHash("sha256")
    .update(xml, "utf8")
    .digest("hex");
}

function partySchemeKey(
  sourceScheme: ErnPartyIdentifierEvidence["sourceScheme"],
): ErnPartyIdentifierEvidence["schemeKey"] {
  switch (sourceScheme) {
    case "ISNI":
      return "isni";
    case "DPID":
      return "ddex_party_id";
    case "IpiNameNumber":
      return "ipi";
    case "IPN":
      return "ipn";
    case "CisacSocietyId":
    case "ProprietaryId":
      return null;
  }
}

function addUnsupportedFields(
  lossFlags: MusicMappingLoss[],
  basePath: string,
  unsupportedFields: string[],
): void {
  for (const field of unsupportedFields) {
    lossFlags.push({
      path: `${basePath}.${field}`,
      classification: "partial",
      detail:
        "Valid ERN 4.3.2 technical/resource-topology evidence is retained only at the structural boundary in this tranche and is not yet semantically projected.",
    });
  }
}

function addResourceGroupLossFlags(
  lossFlags: MusicMappingLoss[],
  groups: ErnResourceGroupProjection[],
  basePath: string,
): void {
  groups.forEach((group, groupIndex) => {
    const groupPath =
      `${basePath}.ResourceGroup[${groupIndex}]`;

    addUnsupportedFields(
      lossFlags,
      groupPath,
      group.unsupportedFields,
    );

    group.contentItems.forEach((item, itemIndex) => {
      addUnsupportedFields(
        lossFlags,
        `${groupPath}.ResourceGroupContentItem[${itemIndex}]`,
        item.unsupportedFields,
      );
    });

    addResourceGroupLossFlags(
      lossFlags,
      group.resourceGroups,
      groupPath,
    );
  });
}

function dedupeLossFlags(lossFlags: MusicMappingLoss[]): MusicMappingLoss[] {
  const seen = new Set<string>();

  return lossFlags.filter((flag) => {
    const key = `${flag.path}\u0000${flag.classification}\u0000${flag.detail}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mappingResult(
  lossFlags: MusicMappingLoss[],
): "mapped" | "partial" | "review_required" {
  if (
    lossFlags.some(
      (flag) =>
        flag.classification === "unsupported" ||
        flag.classification === "partial",
    )
  ) {
    return "partial";
  }

  if (
    lossFlags.some(
      (flag) => flag.classification === "review_required",
    )
  ) {
    return "review_required";
  }

  return "mapped";
}

function mapProjection(
  projection: Ern432Projection,
): {
  data: Ern432MappedData;
  lossFlags: MusicMappingLoss[];
} {
  const lossFlags: MusicMappingLoss[] = [];
  const identifierCandidates: ErnIdentifierCandidate[] = [];
  const artistEvidence: ErnArtistEvidence[] = [];
  const contributorEvidence: ErnContributorEvidence[] = [];
  const partyIdentifierEvidence: ErnPartyIdentifierEvidence[] = [];
  const labelEvidence: ErnLabelEvidence[] = [];

  for (const party of projection.parties) {
    for (const identifier of party.identifiers) {
      const schemeKey = partySchemeKey(identifier.sourceScheme);

      partyIdentifierEvidence.push({
        partyReference: party.partyReference,
        fullName: party.fullName,
        schemeKey,
        sourceScheme: identifier.sourceScheme,
        sourceValue: identifier.sourceValue,
        namespace: identifier.namespace,
      });

      lossFlags.push({
        path:
          `PartyList.Party[${party.partyReference}].PartyId.` +
          identifier.sourceScheme,
        classification:
          schemeKey === null ? "partial" : "review_required",
        detail:
          schemeKey === null
            ? "ERN Party identifier evidence is retained, but the source identifier scheme has no direct music-data-dictionary/v1 mapping."
            : "ERN Party identifier evidence requires typed Person, Organisation, or Artist identity resolution before canonical admission.",
      });
    }
  }

  for (const track of projection.soundRecordings) {
    for (const [editionIndex, edition] of track.editions.entries()) {
      for (const [technicalIndex, technical] of edition.technicalDetails.entries()) {
        const technicalPath =
          `ResourceList.SoundRecording[${track.resourceReference}]` +
          `.SoundRecordingEdition[${editionIndex}]` +
          `.TechnicalDetails[${technicalIndex}]`;

        addUnsupportedFields(
          lossFlags,
          technicalPath,
          technical.unsupportedFields,
        );

        technical.deliveryFiles.forEach(
          (deliveryFile, deliveryFileIndex) => {
            const deliveryPath =
              `${technicalPath}.DeliveryFile[${deliveryFileIndex}]`;

            addUnsupportedFields(
              lossFlags,
              deliveryPath,
              deliveryFile.unsupportedFields,
            );

            if (deliveryFile.file) {
              addUnsupportedFields(
                lossFlags,
                `${deliveryPath}.File`,
                deliveryFile.file.unsupportedFields,
              );
            }
          },
        );
      }

      for (const [resourceIdIndex, resourceId] of edition.resourceIds.entries()) {
        for (const identifier of resourceId.identifiers) {
          if (identifier.sourceScheme === "ISRC") {
            identifierCandidates.push({
              subjectKind: "track",
              subjectReference: track.resourceReference,
              schemeKey: "isrc",
              sourceScheme: "ISRC",
              sourceValue: identifier.sourceValue,
            });
            continue;
          }

          lossFlags.push({
            path:
              `ResourceList.SoundRecording[${track.resourceReference}]` +
              `.SoundRecordingEdition[${editionIndex}]` +
              `.ResourceId[${resourceIdIndex}]` +
              `.${identifier.sourceScheme}`,
            classification: "partial",
            detail:
              "ERN recording identifier evidence is retained, but the source identifier scheme has no direct music-data-dictionary/v1 Track identifier mapping.",
          });
        }
      }
    }

    for (const artist of track.displayArtists) {
      artistEvidence.push({
        context: "track",
        subjectReference: track.resourceReference,
        displayName: artist.displayName,
        partyReference: artist.partyReference,
        role: artist.role,
      });

      if (artist.partyReference) {
        lossFlags.push({
          path: `ResourceList.SoundRecording[${track.resourceReference}].DisplayArtist`,
          classification: "review_required",
          detail:
            "ERN DisplayArtist Party evidence does not itself establish a canonical Registry Artist UUID.",
        });
      }
    }

    for (const contributor of track.contributors) {
      contributorEvidence.push({
        trackReference: track.resourceReference,
        partyReference: contributor.partyReference,
        fullName: contributor.fullName,
        roles: contributor.roles,
      });

      lossFlags.push({
        path: `ResourceList.SoundRecording[${track.resourceReference}].Contributor`,
        classification: "review_required",
        detail:
          "ERN contributor evidence does not itself create Person, Organisation, or Recording Contribution authority.",
      });
    }
  }

  for (const release of projection.releases) {
    addResourceGroupLossFlags(
      lossFlags,
      release.resourceGroups,
      `ReleaseList.Release[${release.releaseReference}]`,
    );

    for (const identifier of release.identifiers) {
      if (identifier.sourceScheme === "ICPN") {
        identifierCandidates.push({
          subjectKind: "release",
          subjectReference: release.releaseReference,
          schemeKey: "gtin",
          sourceScheme: "ICPN",
          sourceValue: identifier.sourceValue,
        });
        continue;
      }

      lossFlags.push({
        path:
          `ReleaseList.Release[${release.releaseReference}]` +
          `.ReleaseId.${identifier.sourceScheme}`,
        classification: "partial",
        detail:
          "ERN Release identifier evidence is retained, but the source identifier scheme has no direct music-data-dictionary/v1 Release identifier mapping.",
      });
    }

    for (const artist of release.displayArtists) {
      artistEvidence.push({
        context: "release",
        subjectReference: release.releaseReference,
        displayName: artist.displayName,
        partyReference: artist.partyReference,
        role: artist.role,
      });

      if (artist.partyReference) {
        lossFlags.push({
          path: `ReleaseList.Release[${release.releaseReference}].DisplayArtist`,
          classification: "review_required",
          detail:
            "ERN DisplayArtist Party evidence does not itself establish a canonical Registry Artist UUID.",
        });
      }
    }

    if (release.labelPartyReference) {
      labelEvidence.push({
        releaseReference: release.releaseReference,
        partyReference: release.labelPartyReference,
        labelName: release.labelName,
      });

      lossFlags.push({
        path: `ReleaseList.Release[${release.releaseReference}].ReleaseLabelReference`,
        classification: "review_required",
        detail:
          "ERN label Party evidence does not itself establish a Registry Label or Organisation-to-Label identity.",
      });
    }
  }

  for (const image of projection.images) {
    image.technicalDetails.forEach(
      (technical, technicalIndex) => {
        const technicalPath =
          `ResourceList.Image[${image.resourceReference}]` +
          `.TechnicalDetails[${technicalIndex}]`;

        addUnsupportedFields(
          lossFlags,
          technicalPath,
          technical.unsupportedFields,
        );

        if (technical.file) {
          addUnsupportedFields(
            lossFlags,
            `${technicalPath}.File`,
            technical.file.unsupportedFields,
          );
        }
      },
    );
  }

  for (const unsupportedKind of projection.unsupportedTopLevelKinds) {
    lossFlags.push({
      path: `NewReleaseMessage.${unsupportedKind}`,
      classification: "unsupported",
      detail:
        "This ERN 4.3.2 first tranche retains but does not semantically map this top-level section.",
    });
  }

  const data: Ern432MappedData = {
    messageContext: {
      avsVersionId: projection.avsVersionId,
      releaseProfileVersionId: projection.releaseProfileVersionId,
      releaseProfileVariantVersionId:
        projection.releaseProfileVariantVersionId,
      languageAndScriptCode: projection.languageAndScriptCode,
    },
    releaseCandidates: projection.releases.map((release) => ({
      releaseReference: release.releaseReference,
      releaseType: release.releaseType,
      title: release.title,
      displayArtistName: release.displayArtistName,
      releaseDate: release.releaseDate,
      genres: release.genres,
      resourceReferences: release.resourceReferences,
      resourceGroups: release.resourceGroups,
      identifiers: release.identifiers,
    })),
    trackCandidates: projection.soundRecordings.map((track) => ({
      resourceReference: track.resourceReference,
      title: track.title,
      displayArtistName: track.displayArtistName,
      recordingType: track.recordingType,
      duration: track.duration,
      editions: track.editions,
    })),
    artistEvidence,
    contributorEvidence,
    partyIdentifierEvidence,
    identifierCandidates,
    labelEvidence,
    mediaEvidence: projection.images.map((image) => ({
      resourceReference: image.resourceReference,
      mediaKind: "image" as const,
      imageType: image.imageType,
      uri: image.uri,
      technicalDetails: image.technicalDetails,
    })),
  };

  return {
    data,
    lossFlags: dedupeLossFlags(lossFlags),
  };
}

export function mapErn432(
  xml: string,
): MusicStandardAdapterEnvelope<Ern432MappedData> {
  const projection = parseErn432(xml);
  const mapped = mapProjection(projection);

  return {
    adapterKey: "ddex_ern_import",
    adapterVersion: 3,
    externalStandard: "DDEX_ERN",
    externalVersion: "4.3.2",
    messageOrRecordType: "NewReleaseMessage",
    sourceParty: projection.messageSenderPartyId,
    sourceReference: projection.messageReference,
    observedAt: projection.messageCreatedDateTime,
    payloadFingerprint: fingerprintPayload(xml),
    mappingProfile: "music-data-dictionary/v1",
    mappingResult: mappingResult(mapped.lossFlags),
    lossFlags: mapped.lossFlags,
    data: mapped.data,
  };
}
