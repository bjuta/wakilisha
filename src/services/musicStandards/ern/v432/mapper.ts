import { createHash } from "node:crypto";

import type {
  MusicMappingLoss,
  MusicStandardAdapterEnvelope,
} from "../../contracts";
import {
  parseErn432,
  type Ern432Projection,
} from "./parser";

export interface ErnIdentifierCandidate {
  subjectKind: "track" | "release";
  subjectReference: string;
  schemeKey: "isrc" | "gtin";
  sourceScheme: "ISRC" | "ICPN";
  sourceValue: string;
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
}

export interface ErnReleaseCandidate {
  releaseReference: string;
  releaseType: string | null;
  title: string | null;
  displayArtistName: string | null;
  releaseDate: string | null;
  genres: string[];
  resourceReferences: string[];
}

export interface ErnTrackCandidate {
  resourceReference: string;
  title: string | null;
  displayArtistName: string | null;
}

export interface Ern432MappedData {
  releaseCandidates: ErnReleaseCandidate[];
  trackCandidates: ErnTrackCandidate[];
  artistEvidence: ErnArtistEvidence[];
  contributorEvidence: ErnContributorEvidence[];
  identifierCandidates: ErnIdentifierCandidate[];
  labelEvidence: ErnLabelEvidence[];
  mediaEvidence: ErnMediaEvidence[];
}

function fingerprintPayload(xml: string): string {
  return createHash("sha256")
    .update(xml, "utf8")
    .digest("hex");
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
  const labelEvidence: ErnLabelEvidence[] = [];

  for (const track of projection.soundRecordings) {
    if (track.isrc) {
      identifierCandidates.push({
        subjectKind: "track",
        subjectReference: track.resourceReference,
        schemeKey: "isrc",
        sourceScheme: "ISRC",
        sourceValue: track.isrc,
      });
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
    if (release.icpn) {
      identifierCandidates.push({
        subjectKind: "release",
        subjectReference: release.releaseReference,
        schemeKey: "gtin",
        sourceScheme: "ICPN",
        sourceValue: release.icpn,
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

  for (const unsupportedKind of projection.unsupportedTopLevelKinds) {
    lossFlags.push({
      path: `NewReleaseMessage.${unsupportedKind}`,
      classification: "unsupported",
      detail:
        "This ERN 4.3.2 first tranche retains but does not semantically map this top-level section.",
    });
  }

  const data: Ern432MappedData = {
    releaseCandidates: projection.releases.map((release) => ({
      releaseReference: release.releaseReference,
      releaseType: release.releaseType,
      title: release.title,
      displayArtistName: release.displayArtistName,
      releaseDate: release.releaseDate,
      genres: release.genres,
      resourceReferences: release.resourceReferences,
    })),
    trackCandidates: projection.soundRecordings.map((track) => ({
      resourceReference: track.resourceReference,
      title: track.title,
      displayArtistName: track.displayArtistName,
    })),
    artistEvidence,
    contributorEvidence,
    identifierCandidates,
    labelEvidence,
    mediaEvidence: projection.images.map((image) => ({
      resourceReference: image.resourceReference,
      mediaKind: "image" as const,
      imageType: image.imageType,
      uri: image.uri,
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
    adapterVersion: 1,
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
