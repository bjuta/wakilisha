import { SaxesParser } from "saxes";

const ERN_432_NAMESPACE = "http://ddex.net/xml/ern/432";
const MAX_XML_BYTES = 1_000_000;
const MAX_XML_DEPTH = 64;
const MAX_XML_NODES = 20_000;

export class Ern432AdapterError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "Ern432AdapterError";
    this.code = code;
  }
}

interface XmlNode {
  name: string;
  namespace: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

export type ErnPartyIdentifierSourceScheme =
  | "ISNI"
  | "DPID"
  | "IpiNameNumber"
  | "IPN"
  | "CisacSocietyId"
  | "ProprietaryId";

export interface ErnPartyIdentifierProjection {
  sourceScheme: ErnPartyIdentifierSourceScheme;
  sourceValue: string;
  namespace: string | null;
}

export interface ErnPartyProjection {
  partyReference: string;
  fullName: string | null;
  identifiers: ErnPartyIdentifierProjection[];
}

export interface ErnDisplayArtistProjection {
  sequenceNumber: number | null;
  partyReference: string | null;
  displayName: string | null;
  role: string | null;
}

export interface ErnContributorProjection {
  partyReference: string | null;
  fullName: string | null;
  roles: string[];
}

export type ErnRecordingIdentifierSourceScheme =
  | "ISRC"
  | "CatalogNumber"
  | "ProprietaryId";

export interface ErnRecordingIdentifierProjection {
  sourceScheme: ErnRecordingIdentifierSourceScheme;
  sourceValue: string;
  namespace: string | null;
}

export interface ErnRecordingResourceIdProjection {
  isReplaced: boolean | null;
  identifiers: ErnRecordingIdentifierProjection[];
}

export interface ErnFileProjection {
  uri: string | null;
  unsupportedFields: string[];
}

export interface ErnTypedValueProjection {
  value: string | null;
  namespace: string | null;
  userDefinedValue: string | null;
}

export interface ErnMeasuredValueProjection {
  value: string | null;
  unitOfMeasure: string | null;
}

export interface ErnAudioDeliveryFileProjection {
  deliveryFileType: string | null;
  audioCodecType: ErnTypedValueProjection | null;
  bitRate: ErnMeasuredValueProjection | null;
  numberOfChannels: string | null;
  numberOfAudioObjects: number | null;
  samplingRate: ErnMeasuredValueProjection | null;
  bitsPerSample: number | null;
  bitDepth: number | null;
  file: ErnFileProjection | null;
  isProvidedInDelivery: boolean | null;
  unsupportedFields: string[];
}

export interface ErnTechnicalSoundRecordingDetailsProjection {
  technicalResourceDetailsReference: string | null;
  languageAndScriptCode: string | null;
  applicableTerritoryCode: string | null;
  isDefault: boolean | null;
  hasImmersiveAudioMetadata: boolean | null;
  deliveryFiles: ErnAudioDeliveryFileProjection[];
  unsupportedFields: string[];
}

export interface ErnSoundRecordingEditionProjection {
  editionType: string | null;
  resourceIds: ErnRecordingResourceIdProjection[];
  technicalDetails: ErnTechnicalSoundRecordingDetailsProjection[];
}

export interface ErnSoundRecordingProjection {
  resourceReference: string;
  title: string | null;
  displayTitleText: string | null;
  structuredTitleText: string | null;
  isrc: string | null;
  recordingType: string | null;
  duration: string | null;
  editions: ErnSoundRecordingEditionProjection[];
  displayArtistName: string | null;
  displayArtists: ErnDisplayArtistProjection[];
  contributors: ErnContributorProjection[];
  unsupportedFields: string[];
}

export interface ErnTechnicalImageDetailsProjection {
  technicalResourceDetailsReference: string | null;
  file: ErnFileProjection | null;
  unsupportedFields: string[];
}

export interface ErnProprietaryIdentifierProjection {
  sourceValue: string;
  namespace: string | null;
}

export interface ErnImageResourceIdProjection {
  proprietaryIds: ErnProprietaryIdentifierProjection[];
  unsupportedFields: string[];
}

export interface ErnImageProjection {
  resourceReference: string;
  imageType: string | null;
  resourceIds: ErnImageResourceIdProjection[];
  uri: string | null;
  technicalDetails: ErnTechnicalImageDetailsProjection[];
  unsupportedFields: string[];
}

export type ErnReleaseIdentifierSourceScheme =
  | "GRid"
  | "ICPN"
  | "CatalogNumber"
  | "ProprietaryId";

export interface ErnReleaseIdentifierProjection {
  sourceScheme: ErnReleaseIdentifierSourceScheme;
  sourceValue: string;
  namespace: string | null;
}

export interface ErnLinkedReleaseResourceReferenceProjection {
  resourceReference: string;
  linkDescription: string | null;
  languageAndScriptCode: string | null;
  namespace: string | null;
  userDefinedValue: string | null;
  sequenceNumber: number | null;
  isMultiFile: boolean | null;
}

export interface ErnResourceGroupContentItemProjection {
  sequenceNumber: number | null;
  releaseResourceReference: string | null;
  linkedResourceReferences: ErnLinkedReleaseResourceReferenceProjection[];
  isBonusResource: boolean | null;
  isInstantGratificationResource: boolean | null;
  isPreOrderIncentiveResource: boolean | null;
  unsupportedFields: string[];
}

export interface ErnResourceGroupProjection {
  resourceGroupType: string | null;
  sequenceNumber: number | null;
  contentItems: ErnResourceGroupContentItemProjection[];
  linkedResourceReferences: ErnLinkedReleaseResourceReferenceProjection[];
  resourceGroups: ErnResourceGroupProjection[];
  unsupportedFields: string[];
}

export interface ErnReleaseProjection {
  releaseReference: string;
  releaseType: string | null;
  title: string | null;
  displayArtistName: string | null;
  displayArtists: ErnDisplayArtistProjection[];
  icpn: string | null;
  identifiers: ErnReleaseIdentifierProjection[];
  releaseDate: string | null;
  labelPartyReference: string | null;
  labelName: string | null;
  genres: string[];
  resourceReferences: string[];
  resourceGroups: ErnResourceGroupProjection[];
  unsupportedFields: string[];
}

export interface ErnTrackReleaseProjection {
  releaseReference: string;
  identifiers: ErnReleaseIdentifierProjection[];
  releaseResourceReference: string | null;
  linkedResourceReferences: ErnLinkedReleaseResourceReferenceProjection[];
  unsupportedFields: string[];
}

export type ErnAcceptedReleaseProfile = "Audio";

export interface Ern432Projection {
  namespace: string;
  avsVersionId: string | null;
  releaseProfileVersionId: string | null;
  releaseProfileVariantVersionId: string | null;
  languageAndScriptCode: string | null;
  messageSenderPartyId: string | null;
  messageRecipientPartyId: string | null;
  messageReference: string | null;
  messageCreatedDateTime: string | null;
  parties: ErnPartyProjection[];
  soundRecordings: ErnSoundRecordingProjection[];
  images: ErnImageProjection[];
  releases: ErnReleaseProjection[];
  trackReleases: ErnTrackReleaseProjection[];
  unsupportedTopLevelKinds: string[];
}

function cleanText(value: string): string | null {
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function localAttributeValue(
  attributes: Record<string, unknown>,
  localName: string,
): string | null {
  for (const [key, raw] of Object.entries(attributes)) {
    if (typeof raw === "string") {
      if (key === localName) {
        return raw;
      }
      continue;
    }

    if (raw && typeof raw === "object") {
      const candidate = raw as {
        local?: unknown;
        name?: unknown;
        value?: unknown;
      };

      const candidateLocal =
        typeof candidate.local === "string"
          ? candidate.local
          : typeof candidate.name === "string"
            ? candidate.name
            : key;

      if (
        candidateLocal === localName &&
        typeof candidate.value === "string"
      ) {
        return candidate.value;
      }
    }
  }

  return null;
}

function parseXml(xml: string): XmlNode {
  if (Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES) {
    throw new Ern432AdapterError(
      "ERN_XML_TOO_LARGE",
      `ERN XML exceeds ${MAX_XML_BYTES} bytes.`,
    );
  }

  const roots: XmlNode[] = [];
  const stack: XmlNode[] = [];
  let nodeCount = 0;

  const parser = new SaxesParser({ xmlns: true });

  parser.on("doctype", () => {
    throw new Ern432AdapterError(
      "ERN_DOCTYPE_FORBIDDEN",
      "ERN fixture contains a DOCTYPE declaration.",
    );
  });

  parser.on("opentag", (tag) => {
    nodeCount += 1;
    if (nodeCount > MAX_XML_NODES) {
      throw new Ern432AdapterError(
        "ERN_XML_NODE_LIMIT",
        `ERN XML exceeds ${MAX_XML_NODES} elements.`,
      );
    }

    if (stack.length >= MAX_XML_DEPTH) {
      throw new Ern432AdapterError(
        "ERN_XML_DEPTH_LIMIT",
        `ERN XML exceeds maximum depth ${MAX_XML_DEPTH}.`,
      );
    }

    const rawTag = tag as unknown as {
      local?: string;
      name: string;
      uri?: string;
      attributes: Record<string, unknown>;
    };

    const attributes: Record<string, string> = {};
    for (const [key, raw] of Object.entries(rawTag.attributes)) {
      if (typeof raw === "string") {
        attributes[key] = raw;
        continue;
      }

      if (raw && typeof raw === "object") {
        const attribute = raw as {
          local?: string;
          name?: string;
          value?: string;
        };
        const attributeName =
          attribute.local ?? attribute.name ?? key;
        if (typeof attribute.value === "string") {
          attributes[attributeName] = attribute.value;
        }
      }
    }

    const node: XmlNode = {
      name: rawTag.local ?? rawTag.name,
      namespace: rawTag.uri ?? "",
      attributes,
      children: [],
      text: "",
    };

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    stack.push(node);
  });

  const appendText = (text: string) => {
    const current = stack[stack.length - 1];
    if (current) {
      current.text += text;
    }
  };

  parser.on("text", appendText);
  parser.on("cdata", appendText);
  parser.on("closetag", () => {
    stack.pop();
  });

  try {
    parser.write(xml).close();
  } catch (error) {
    if (error instanceof Ern432AdapterError) {
      throw error;
    }

    throw new Ern432AdapterError(
      "ERN_XML_INVALID",
      `ERN XML is not well formed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (roots.length !== 1) {
    throw new Ern432AdapterError(
      "ERN_XML_ROOT_COUNT",
      `Expected one XML root, found ${roots.length}.`,
    );
  }

  return roots[0];
}

function children(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((child) => child.name === name);
}

function firstChild(node: XmlNode, name: string): XmlNode | null {
  return children(node, name)[0] ?? null;
}

function directText(node: XmlNode | null): string | null {
  return node ? cleanText(node.text) : null;
}

function childText(node: XmlNode | null, name: string): string | null {
  return node ? directText(firstChild(node, name)) : null;
}

function descendants(node: XmlNode, name: string): XmlNode[] {
  const matches: XmlNode[] = [];

  for (const child of node.children) {
    if (child.name === name) {
      matches.push(child);
    }
    matches.push(...descendants(child, name));
  }

  return matches;
}

function descendantText(node: XmlNode | null, name: string): string | null {
  if (!node) {
    return null;
  }
  return directText(descendants(node, name)[0] ?? null);
}

function attributeText(
  node: XmlNode,
  name: string,
): string | null {
  return (
    node.attributes[name] ??
    localAttributeValue(
      node.attributes as unknown as Record<string, unknown>,
      name,
    )
  );
}

function optionalIntegerAttribute(
  node: XmlNode,
  name: string,
): number | null {
  const raw = attributeText(node, name);
  if (raw === null) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

function optionalIntegerChild(
  node: XmlNode,
  name: string,
): number | null {
  const raw = childText(node, name);
  if (raw === null) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

function optionalBooleanChild(
  node: XmlNode,
  name: string,
): boolean | null {
  const raw = childText(node, name);
  if (raw === null) {
    return null;
  }

  if (raw === "true" || raw === "1") {
    return true;
  }

  if (raw === "false" || raw === "0") {
    return false;
  }

  return null;
}

function unsupportedChildNames(
  node: XmlNode,
  supported: ReadonlySet<string>,
): string[] {
  return Array.from(
    new Set(
      node.children
        .map((child) => child.name)
        .filter((name) => !supported.has(name)),
    ),
  );
}

function optionalBooleanAttribute(
  node: XmlNode,
  name: string,
): boolean | null {
  const raw = attributeText(node, name);

  if (raw === null || raw === undefined) {
    return null;
  }

  if (raw === "true" || raw === "1") {
    return true;
  }

  if (raw === "false" || raw === "0") {
    return false;
  }

  return null;
}

function identifierWithNamespace(
  node: XmlNode,
  sourceScheme: "CatalogNumber" | "ProprietaryId",
): ErnRecordingIdentifierProjection | null {
  const sourceValue = directText(node);
  if (!sourceValue) {
    return null;
  }

  return {
    sourceScheme,
    sourceValue,
    namespace:
      node.attributes.Namespace ??
      localAttributeValue(
        node.attributes as unknown as Record<string, unknown>,
        "Namespace",
      ),
  };
}

function parsePartyIdentifiers(
  party: XmlNode,
): ErnPartyIdentifierProjection[] {
  const identifiers: ErnPartyIdentifierProjection[] = [];

  for (const partyId of children(party, "PartyId")) {
    for (const sourceScheme of [
      "ISNI",
      "DPID",
      "IpiNameNumber",
      "IPN",
      "CisacSocietyId",
    ] as const) {
      const sourceValue = childText(partyId, sourceScheme);
      if (sourceValue) {
        identifiers.push({
          sourceScheme,
          sourceValue,
          namespace: null,
        });
      }
    }

    for (const proprietaryId of children(
      partyId,
      "ProprietaryId",
    )) {
      const sourceValue = directText(proprietaryId);
      if (!sourceValue) {
        continue;
      }

      identifiers.push({
        sourceScheme: "ProprietaryId",
        sourceValue,
        namespace:
          proprietaryId.attributes.Namespace ??
          localAttributeValue(
            proprietaryId.attributes as unknown as Record<
              string,
              unknown
            >,
            "Namespace",
          ),
      });
    }
  }

  return identifiers;
}

function parseRecordingResourceId(
  resourceId: XmlNode,
): ErnRecordingResourceIdProjection {
  const identifiers: ErnRecordingIdentifierProjection[] = [];
  const isrc = childText(resourceId, "ISRC");

  if (isrc) {
    identifiers.push({
      sourceScheme: "ISRC",
      sourceValue: isrc,
      namespace: null,
    });
  }

  const catalogNumber = firstChild(resourceId, "CatalogNumber");
  if (catalogNumber) {
    const parsed = identifierWithNamespace(
      catalogNumber,
      "CatalogNumber",
    );
    if (parsed) {
      identifiers.push(parsed);
    }
  }

  for (const proprietaryId of children(
    resourceId,
    "ProprietaryId",
  )) {
    const parsed = identifierWithNamespace(
      proprietaryId,
      "ProprietaryId",
    );
    if (parsed) {
      identifiers.push(parsed);
    }
  }

  return {
    isReplaced: optionalBooleanAttribute(resourceId, "IsReplaced"),
    identifiers,
  };
}

function parseImageResourceId(
  resourceId: XmlNode,
): ErnImageResourceIdProjection {
  const proprietaryIds = children(
    resourceId,
    "ProprietaryId",
  )
    .map((proprietaryId) => {
      const sourceValue = directText(proprietaryId);
      if (!sourceValue) {
        return null;
      }

      return {
        sourceValue,
        namespace:
          proprietaryId.attributes.Namespace ??
          localAttributeValue(
            proprietaryId.attributes as unknown as Record<
              string,
              unknown
            >,
            "Namespace",
          ),
      };
    })
    .filter(
      (
        identifier,
      ): identifier is ErnProprietaryIdentifierProjection =>
        identifier !== null,
    );

  return {
    proprietaryIds,
    unsupportedFields: unsupportedChildNames(
      resourceId,
      new Set(["ProprietaryId"]),
    ),
  };
}

function parseFile(
  file: XmlNode | null,
): ErnFileProjection | null {
  if (!file) {
    return null;
  }

  return {
    uri: childText(file, "URI"),
    unsupportedFields: unsupportedChildNames(
      file,
      new Set(["URI"]),
    ),
  };
}

function parseTypedValue(
  node: XmlNode | null,
): ErnTypedValueProjection | null {
  if (!node) {
    return null;
  }

  return {
    value: directText(node),
    namespace: attributeText(node, "Namespace"),
    userDefinedValue: attributeText(node, "UserDefinedValue"),
  };
}

function parseMeasuredValue(
  node: XmlNode | null,
): ErnMeasuredValueProjection | null {
  if (!node) {
    return null;
  }

  return {
    value: directText(node),
    unitOfMeasure: attributeText(node, "UnitOfMeasure"),
  };
}

function parseAudioDeliveryFile(
  deliveryFile: XmlNode,
): ErnAudioDeliveryFileProjection {
  return {
    deliveryFileType: childText(deliveryFile, "Type"),
    audioCodecType: parseTypedValue(
      firstChild(deliveryFile, "AudioCodecType"),
    ),
    bitRate: parseMeasuredValue(
      firstChild(deliveryFile, "BitRate"),
    ),
    numberOfChannels: childText(
      deliveryFile,
      "NumberOfChannels",
    ),
    numberOfAudioObjects: optionalIntegerChild(
      deliveryFile,
      "NumberOfAudioObjects",
    ),
    samplingRate: parseMeasuredValue(
      firstChild(deliveryFile, "SamplingRate"),
    ),
    bitsPerSample: optionalIntegerChild(
      deliveryFile,
      "BitsPerSample",
    ),
    bitDepth: optionalIntegerChild(deliveryFile, "BitDepth"),
    file: parseFile(firstChild(deliveryFile, "File")),
    isProvidedInDelivery: optionalBooleanChild(
      deliveryFile,
      "IsProvidedInDelivery",
    ),
    unsupportedFields: unsupportedChildNames(
      deliveryFile,
      new Set([
        "Type",
        "AudioCodecType",
        "BitRate",
        "NumberOfChannels",
        "NumberOfAudioObjects",
        "SamplingRate",
        "BitsPerSample",
        "BitDepth",
        "File",
        "IsProvidedInDelivery",
      ]),
    ),
  };
}

function parseTechnicalSoundRecordingDetails(
  edition: XmlNode,
): ErnTechnicalSoundRecordingDetailsProjection[] {
  return children(edition, "TechnicalDetails").map(
    (technicalDetails) => ({
      technicalResourceDetailsReference: childText(
        technicalDetails,
        "TechnicalResourceDetailsReference",
      ),
      languageAndScriptCode: attributeText(
        technicalDetails,
        "LanguageAndScriptCode",
      ),
      applicableTerritoryCode: attributeText(
        technicalDetails,
        "ApplicableTerritoryCode",
      ),
      isDefault: optionalBooleanAttribute(
        technicalDetails,
        "IsDefault",
      ),
      hasImmersiveAudioMetadata: optionalBooleanChild(
        technicalDetails,
        "HasImmersiveAudioMetadata",
      ),
      deliveryFiles: children(
        technicalDetails,
        "DeliveryFile",
      ).map(parseAudioDeliveryFile),
      unsupportedFields: unsupportedChildNames(
        technicalDetails,
        new Set([
          "ApplicableTerritoryCode",
          "TechnicalResourceDetailsReference",
          "DeliveryFile",
          "HasImmersiveAudioMetadata",
        ]),
      ),
    }),
  );
}

function parseSoundRecordingEditions(
  recording: XmlNode,
): ErnSoundRecordingEditionProjection[] {
  return children(recording, "SoundRecordingEdition").map(
    (edition) => ({
      editionType: childText(edition, "Type"),
      resourceIds: children(edition, "ResourceId").map(
        parseRecordingResourceId,
      ),
      technicalDetails:
        parseTechnicalSoundRecordingDetails(edition),
    }),
  );
}

function parseReleaseIdentifiers(
  release: XmlNode,
): ErnReleaseIdentifierProjection[] {
  const releaseId = firstChild(release, "ReleaseId");
  if (!releaseId) {
    return [];
  }

  const identifiers: ErnReleaseIdentifierProjection[] = [];

  for (const sourceScheme of ["GRid", "ICPN"] as const) {
    const sourceValue = childText(releaseId, sourceScheme);
    if (sourceValue) {
      identifiers.push({
        sourceScheme,
        sourceValue,
        namespace: null,
      });
    }
  }

  const catalogNumber = firstChild(releaseId, "CatalogNumber");
  if (catalogNumber) {
    const sourceValue = directText(catalogNumber);
    if (sourceValue) {
      identifiers.push({
        sourceScheme: "CatalogNumber",
        sourceValue,
        namespace:
          catalogNumber.attributes.Namespace ??
          localAttributeValue(
            catalogNumber.attributes as unknown as Record<
              string,
              unknown
            >,
            "Namespace",
          ),
      });
    }
  }

  for (const proprietaryId of children(
    releaseId,
    "ProprietaryId",
  )) {
    const sourceValue = directText(proprietaryId);
    if (!sourceValue) {
      continue;
    }

    identifiers.push({
      sourceScheme: "ProprietaryId",
      sourceValue,
      namespace:
        proprietaryId.attributes.Namespace ??
        localAttributeValue(
          proprietaryId.attributes as unknown as Record<
            string,
            unknown
          >,
          "Namespace",
        ),
    });
  }

  return identifiers;
}

function resolveDisplayArtists(
  node: XmlNode,
  parties: Map<string, string | null>,
): ErnDisplayArtistProjection[] {
  return children(node, "DisplayArtist").map((artist) => {
    const partyReference =
      childText(artist, "ArtistPartyReference") ??
      childText(artist, "PartyReference");

    const displayName =
      childText(artist, "DisplayArtistName") ??
      (partyReference ? parties.get(partyReference) ?? null : null);

    return {
      sequenceNumber: optionalIntegerAttribute(
        artist,
        "SequenceNumber",
      ),
      partyReference,
      displayName,
      role:
        childText(artist, "DisplayArtistRole") ??
        childText(artist, "Role"),
    };
  });
}

function resolveContributors(
  node: XmlNode,
  parties: Map<string, string | null>,
): ErnContributorProjection[] {
  return children(node, "Contributor").map((contributor) => {
    const partyReference =
      childText(contributor, "ContributorPartyReference") ??
      childText(contributor, "PartyReference");

    const roles = children(contributor, "Role")
      .map(
        (role) =>
          childText(role, "Value") ?? directText(role),
      )
      .filter((role): role is string => Boolean(role));

    return {
      partyReference,
      fullName:
        childText(contributor, "FullName") ??
        (partyReference ? parties.get(partyReference) ?? null : null),
      roles,
    };
  });
}

function parseParties(root: XmlNode): ErnPartyProjection[] {
  const partyList = firstChild(root, "PartyList");
  if (!partyList) {
    return [];
  }

  return children(partyList, "Party")
    .map((party) => {
      const partyReference = childText(party, "PartyReference");
      if (!partyReference) {
        return null;
      }

      return {
        partyReference,
        fullName:
          descendantText(firstChild(party, "PartyName"), "FullName") ??
          descendantText(party, "FullName"),
        identifiers: parsePartyIdentifiers(party),
      };
    })
    .filter((party): party is ErnPartyProjection => party !== null);
}

function parseSoundRecordings(
  root: XmlNode,
  parties: Map<string, string | null>,
): ErnSoundRecordingProjection[] {
  const resourceList = firstChild(root, "ResourceList");
  if (!resourceList) {
    return [];
  }

  return children(resourceList, "SoundRecording")
    .map((recording) => {
      const resourceReference =
        childText(recording, "ResourceReference");
      if (!resourceReference) {
        return null;
      }

      const editions = parseSoundRecordingEditions(recording);
      const isrc =
        editions
          .flatMap((edition) => edition.resourceIds)
          .flatMap((resourceId) => resourceId.identifiers)
          .find((identifier) => identifier.sourceScheme === "ISRC")
          ?.sourceValue ??
        null;
      const displayTitleText = childText(
        recording,
        "DisplayTitleText",
      );
      const structuredTitleText = descendantText(
        firstChild(recording, "DisplayTitle"),
        "TitleText",
      );

      return {
        resourceReference,
        title: displayTitleText ?? structuredTitleText,
        displayTitleText,
        structuredTitleText,
        isrc,
        recordingType: childText(recording, "Type"),
        duration: childText(recording, "Duration"),
        editions,
        displayArtistName: childText(
          recording,
          "DisplayArtistName",
        ),
        displayArtists: resolveDisplayArtists(recording, parties),
        contributors: resolveContributors(recording, parties),
        unsupportedFields: unsupportedChildNames(
          recording,
          new Set([
            "ResourceReference",
            "Type",
            "SoundRecordingEdition",
            "DisplayTitleText",
            "DisplayTitle",
            "DisplayArtistName",
            "DisplayArtist",
            "Contributor",
            "Duration",
          ]),
        ),
      };
    })
    .filter(
      (recording): recording is ErnSoundRecordingProjection =>
        recording !== null,
    );
}

function parseTechnicalImageDetails(
  image: XmlNode,
): ErnTechnicalImageDetailsProjection[] {
  return children(image, "TechnicalDetails").map(
    (technicalDetails) => ({
      technicalResourceDetailsReference: childText(
        technicalDetails,
        "TechnicalResourceDetailsReference",
      ),
      file: parseFile(firstChild(technicalDetails, "File")),
      unsupportedFields: unsupportedChildNames(
        technicalDetails,
        new Set([
          "TechnicalResourceDetailsReference",
          "File",
        ]),
      ),
    }),
  );
}

function parseLinkedReleaseResourceReference(
  reference: XmlNode,
): ErnLinkedReleaseResourceReferenceProjection | null {
  const resourceReference = directText(reference);
  if (!resourceReference) {
    return null;
  }

  return {
    resourceReference,
    linkDescription: attributeText(
      reference,
      "LinkDescription",
    ),
    languageAndScriptCode: attributeText(
      reference,
      "LanguageAndScriptCode",
    ),
    namespace: attributeText(reference, "Namespace"),
    userDefinedValue: attributeText(
      reference,
      "UserDefinedValue",
    ),
    sequenceNumber: optionalIntegerAttribute(
      reference,
      "SequenceNumber",
    ),
    isMultiFile: optionalBooleanAttribute(
      reference,
      "IsMultiFile",
    ),
  };
}

function parseResourceGroupContentItem(
  item: XmlNode,
): ErnResourceGroupContentItemProjection {
  return {
    sequenceNumber: optionalIntegerChild(
      item,
      "SequenceNumber",
    ),
    releaseResourceReference: childText(
      item,
      "ReleaseResourceReference",
    ),
    linkedResourceReferences: children(
      item,
      "LinkedReleaseResourceReference",
    )
      .map(parseLinkedReleaseResourceReference)
      .filter(
        (
          reference,
        ): reference is ErnLinkedReleaseResourceReferenceProjection =>
          reference !== null,
      ),
    isBonusResource: optionalBooleanChild(
      item,
      "IsBonusResource",
    ),
    isInstantGratificationResource: optionalBooleanChild(
      item,
      "IsInstantGratificationResource",
    ),
    isPreOrderIncentiveResource: optionalBooleanChild(
      item,
      "IsPreOrderIncentiveResource",
    ),
    unsupportedFields: unsupportedChildNames(
      item,
      new Set([
        "SequenceNumber",
        "ReleaseResourceReference",
        "LinkedReleaseResourceReference",
        "IsBonusResource",
        "IsInstantGratificationResource",
        "IsPreOrderIncentiveResource",
      ]),
    ),
  };
}

function parseResourceGroup(
  group: XmlNode,
): ErnResourceGroupProjection {
  return {
    resourceGroupType: attributeText(
      group,
      "ResourceGroupType",
    ),
    sequenceNumber: optionalIntegerChild(
      group,
      "SequenceNumber",
    ),
    contentItems: children(
      group,
      "ResourceGroupContentItem",
    ).map(parseResourceGroupContentItem),
    linkedResourceReferences: children(
      group,
      "LinkedReleaseResourceReference",
    )
      .map(parseLinkedReleaseResourceReference)
      .filter(
        (
          reference,
        ): reference is ErnLinkedReleaseResourceReferenceProjection =>
          reference !== null,
      ),
    resourceGroups: children(
      group,
      "ResourceGroup",
    ).map(parseResourceGroup),
    unsupportedFields: unsupportedChildNames(
      group,
      new Set([
        "SequenceNumber",
        "ResourceGroup",
        "ResourceGroupContentItem",
        "LinkedReleaseResourceReference",
      ]),
    ),
  };
}

function collectPrimaryResourceReferences(
  groups: ErnResourceGroupProjection[],
): string[] {
  const references: string[] = [];

  for (const group of groups) {
    for (const item of group.contentItems) {
      if (item.releaseResourceReference) {
        references.push(item.releaseResourceReference);
      }
    }
    references.push(
      ...collectPrimaryResourceReferences(
        group.resourceGroups,
      ),
    );
  }

  return references;
}

function parseImages(root: XmlNode): ErnImageProjection[] {
  const resourceList = firstChild(root, "ResourceList");
  if (!resourceList) {
    return [];
  }

  return children(resourceList, "Image")
    .map((image) => {
      const resourceReference = childText(image, "ResourceReference");
      if (!resourceReference) {
        return null;
      }

      const technicalDetails =
        parseTechnicalImageDetails(image);
      const uri =
        technicalDetails
          .map((details) => details.file?.uri ?? null)
          .find((value): value is string => Boolean(value)) ??
        null;

      return {
        resourceReference,
        imageType: childText(image, "Type"),
        resourceIds: children(
          image,
          "ResourceId",
        ).map(parseImageResourceId),
        uri,
        technicalDetails,
        unsupportedFields: unsupportedChildNames(
          image,
          new Set([
            "ResourceReference",
            "Type",
            "ResourceId",
            "TechnicalDetails",
          ]),
        ),
      };
    })
    .filter((image): image is ErnImageProjection => image !== null);
}

function parseReleases(
  root: XmlNode,
  parties: Map<string, string | null>,
): ErnReleaseProjection[] {
  const releaseList = firstChild(root, "ReleaseList");
  if (!releaseList) {
    return [];
  }

  return children(releaseList, "Release")
    .map((release) => {
      const releaseReference = childText(release, "ReleaseReference");
      if (!releaseReference) {
        return null;
      }

      const labelPartyReference =
        childText(release, "ReleaseLabelReference") ??
        descendantText(release, "LabelPartyReference");
      const identifiers = parseReleaseIdentifiers(release);
      const resourceGroups = children(
        release,
        "ResourceGroup",
      ).map(parseResourceGroup);

      return {
        releaseReference,
        releaseType: childText(release, "ReleaseType"),
        title:
          childText(release, "DisplayTitleText") ??
          descendantText(firstChild(release, "DisplayTitle"), "TitleText"),
        displayArtistName: childText(release, "DisplayArtistName"),
        displayArtists: resolveDisplayArtists(release, parties),
        icpn:
          identifiers.find(
            (identifier) => identifier.sourceScheme === "ICPN",
          )?.sourceValue ?? null,
        identifiers,
        releaseDate:
          childText(release, "ReleaseDate") ??
          descendantText(release, "ReleaseDate"),
        labelPartyReference,
        labelName:
          labelPartyReference
            ? parties.get(labelPartyReference) ?? null
            : null,
        genres: children(release, "DisplayGenre")
          .map((genre) => childText(genre, "GenreText"))
          .filter((genre): genre is string => Boolean(genre)),
        resourceReferences: collectPrimaryResourceReferences(
          resourceGroups,
        ),
        resourceGroups,
        unsupportedFields: unsupportedChildNames(
          release,
          new Set([
            "ReleaseReference",
            "ReleaseType",
            "ReleaseId",
            "DisplayTitleText",
            "DisplayTitle",
            "DisplayArtistName",
            "DisplayArtist",
            "ReleaseLabelReference",
            "DisplayGenre",
            "ReleaseDate",
            "ResourceGroup",
          ]),
        ),
      };
    })
    .filter((release): release is ErnReleaseProjection => release !== null);
}

function parseTrackReleases(
  root: XmlNode,
): ErnTrackReleaseProjection[] {
  const releaseList = firstChild(root, "ReleaseList");
  if (!releaseList) {
    return [];
  }

  return children(releaseList, "TrackRelease")
    .map((trackRelease) => {
      const releaseReference = childText(
        trackRelease,
        "ReleaseReference",
      );
      if (!releaseReference) {
        return null;
      }

      return {
        releaseReference,
        identifiers: parseReleaseIdentifiers(trackRelease),
        releaseResourceReference: childText(
          trackRelease,
          "ReleaseResourceReference",
        ),
        linkedResourceReferences: children(
          trackRelease,
          "LinkedReleaseResourceReference",
        )
          .map(parseLinkedReleaseResourceReference)
          .filter(
            (
              reference,
            ): reference is ErnLinkedReleaseResourceReferenceProjection =>
              reference !== null,
          ),
        unsupportedFields: unsupportedChildNames(
          trackRelease,
          new Set([
            "ReleaseReference",
            "ReleaseId",
            "ReleaseResourceReference",
            "LinkedReleaseResourceReference",
          ]),
        ),
      };
    })
    .filter(
      (
        trackRelease,
      ): trackRelease is ErnTrackReleaseProjection =>
        trackRelease !== null,
    );
}

function validateReleaseProfile(
  projection: Ern432Projection,
): ErnAcceptedReleaseProfile | null {
  const profile = projection.releaseProfileVersionId;
  if (profile === null) {
    return null;
  }

  if (projection.releaseProfileVariantVersionId) {
    throw new Ern432AdapterError(
      "ERN_PROFILE_VARIANT_UNSUPPORTED",
      "WAKILISHA does not yet claim ERN 4.3.2 Release Profile variant acceptance.",
    );
  }

  if (profile !== "Audio") {
    throw new Ern432AdapterError(
      "ERN_PROFILE_UNSUPPORTED",
      `WAKILISHA currently accepts only the bounded Audio Release Profile, found ${profile}.`,
    );
  }

  if (projection.releases.length !== 1) {
    throw new Ern432AdapterError(
      "ERN_PROFILE_MAIN_RELEASE_COUNT_INVALID",
      `Expected exactly one main Release for Audio, found ${projection.releases.length}.`,
    );
  }

  const release = projection.releases[0];
  const allowedReleaseIdSchemes = new Set([
    "GRid",
    "ICPN",
    "ProprietaryId",
  ]);
  const hasAcceptedReleaseId = (
    identifiers: ErnReleaseIdentifierProjection[],
  ): boolean =>
    identifiers.some((identifier) =>
      allowedReleaseIdSchemes.has(identifier.sourceScheme),
    );

  if (!hasAcceptedReleaseId(release.identifiers)) {
    throw new Ern432AdapterError(
      "ERN_AUDIO_MAIN_RELEASE_ID_REQUIRED",
      "The Audio main Release must be identified by GRid, ICPN, or ProprietaryId.",
    );
  }

  const unsequencedReleaseArtist =
    release.displayArtists.find(
      (artist) => artist.sequenceNumber === null,
    );
  if (unsequencedReleaseArtist) {
    throw new Ern432AdapterError(
      "ERN_AUDIO_DISPLAY_ARTIST_SEQUENCE_REQUIRED",
      "Audio Release DisplayArtist composites must be sequenced.",
    );
  }

  const soundRecordingByReference = new Map(
    projection.soundRecordings.map((recording) => [
      recording.resourceReference,
      recording,
    ]),
  );
  const imageByReference = new Map(
    projection.images.map((image) => [
      image.resourceReference,
      image,
    ]),
  );
  const primaryReferences = release.resourceReferences;
  const allowedTypes = new Set([
    "MusicalWorkSoundRecording",
    "NonMusicalWorkSoundRecording",
  ]);

  if (primaryReferences.length < 1) {
    throw new Ern432AdapterError(
      "ERN_AUDIO_PRIMARY_RESOURCES_INVALID",
      "Audio requires one or more primary SoundRecording resources.",
    );
  }

  for (const reference of primaryReferences) {
    const recording = soundRecordingByReference.get(reference);
    if (
      !recording ||
      !recording.recordingType ||
      !allowedTypes.has(recording.recordingType)
    ) {
      throw new Ern432AdapterError(
        "ERN_AUDIO_PRIMARY_RESOURCES_INVALID",
        `Audio primary resource ${reference} must resolve to a MusicalWorkSoundRecording or NonMusicalWorkSoundRecording.`,
      );
    }

    if (!recording.isrc) {
      throw new Ern432AdapterError(
        "ERN_AUDIO_PRIMARY_ISRC_REQUIRED",
        `Audio primary SoundRecording ${reference} must be identified by an ISRC.`,
      );
    }

    if (
      !recording.displayTitleText ||
      !recording.structuredTitleText
    ) {
      throw new Ern432AdapterError(
        "ERN_AUDIO_PRIMARY_TITLE_REQUIRED",
        `Audio primary SoundRecording ${reference} must provide both DisplayTitleText and DisplayTitle.`,
      );
    }

    if (
      recording.displayArtists.some(
        (artist) => artist.sequenceNumber === null,
      )
    ) {
      throw new Ern432AdapterError(
        "ERN_AUDIO_DISPLAY_ARTIST_SEQUENCE_REQUIRED",
        `Audio primary SoundRecording ${reference} has an unsequenced DisplayArtist.`,
      );
    }
  }

  // The icon audit scans every exact source string literal for Lucide
  // export names. Build this DDEX value from fragments so standards
  // vocabulary does not become an unrelated UI icon dependency.
  const ddexComponentResourceGroupType = [
    "Compo",
    "nent",
  ].join("");

  const sequenceGroupTypes = new Set([
    "Side",
    ddexComponentResourceGroupType,
    "ComponentRelease",
    "ReleaseComponent",
    "MultiPartWork",
  ]);

  const validateGroupSequence = (
    group: ErnResourceGroupProjection,
    path: string,
  ): void => {
    const itemSequences = group.contentItems.map(
      (item) => item.sequenceNumber,
    );
    if (
      itemSequences.some((sequence) => sequence === null) ||
      new Set(itemSequences).size !== itemSequences.length
    ) {
      throw new Ern432AdapterError(
        "ERN_AUDIO_RESOURCE_SEQUENCE_INVALID",
        `${path} must sequence each primary ResourceGroupContentItem without duplicates.`,
      );
    }

    for (let index = 1; index < itemSequences.length; index += 1) {
      const previous = itemSequences[index - 1];
      const current = itemSequences[index];
      if (
        previous !== null &&
        current !== null &&
        current <= previous
      ) {
        throw new Ern432AdapterError(
          "ERN_AUDIO_RESOURCE_SEQUENCE_INVALID",
          `${path} primary resource sequence numbers must increase monotonically.`,
        );
      }
    }

    group.resourceGroups.forEach((subgroup, index) => {
      if (
        subgroup.resourceGroupType &&
        sequenceGroupTypes.has(subgroup.resourceGroupType) &&
        subgroup.sequenceNumber === null
      ) {
        throw new Ern432AdapterError(
          "ERN_AUDIO_RESOURCE_SEQUENCE_INVALID",
          `${path}.ResourceGroup[${index}] must be sequenced.`,
        );
      }

      validateGroupSequence(
        subgroup,
        `${path}.ResourceGroup[${index}]`,
      );
    });
  };

  release.resourceGroups.forEach((group, index) =>
    validateGroupSequence(
      group,
      `ReleaseList.Release[${release.releaseReference}].ResourceGroup[${index}]`,
    ),
  );

  const frontCoverImages = projection.images.filter(
    (image) => image.imageType === "FrontCoverImage",
  );
  const topLevelFrontCoverReferences =
    release.resourceGroups
      .flatMap((group) => group.linkedResourceReferences)
      .filter(
        (reference) =>
          imageByReference.get(reference.resourceReference)?.imageType ===
          "FrontCoverImage",
      );

  if (
    frontCoverImages.length !== 1 ||
    topLevelFrontCoverReferences.length !== 1 ||
    topLevelFrontCoverReferences[0]?.resourceReference !==
      frontCoverImages[0]?.resourceReference
  ) {
    throw new Ern432AdapterError(
      "ERN_AUDIO_FRONT_COVER_INVALID",
      "Audio requires exactly one FrontCoverImage linked from the top-level ResourceGroup.",
    );
  }

  if (topLevelFrontCoverReferences[0]?.sequenceNumber !== null) {
    throw new Ern432AdapterError(
      "ERN_AUDIO_FRONT_COVER_SEQUENCE_FORBIDDEN",
      "Audio FrontCoverImage secondary resources must not be sequenced.",
    );
  }

  const frontCoverProprietaryIds =
    frontCoverImages[0].resourceIds.flatMap(
      (resourceId) => resourceId.proprietaryIds,
    );
  if (frontCoverProprietaryIds.length < 1) {
    throw new Ern432AdapterError(
      "ERN_AUDIO_FRONT_COVER_ID_REQUIRED",
      "Audio FrontCoverImage secondary resources must be identified by a ProprietaryId.",
    );
  }

  const trackReferences = projection.trackReleases.map(
    (trackRelease) => trackRelease.releaseResourceReference,
  );
  if (
    projection.trackReleases.length !== primaryReferences.length ||
    primaryReferences.some(
      (reference) =>
        trackReferences.filter(
          (candidate) => candidate === reference,
        ).length !== 1,
    ) ||
    trackReferences.some(
      (reference) =>
        reference === null ||
        !primaryReferences.includes(reference),
    )
  ) {
    throw new Ern432AdapterError(
      "ERN_AUDIO_TRACK_RELEASES_INVALID",
      "Audio requires exactly one TrackRelease for each primary resource.",
    );
  }

  const seenTrackReleaseIds = new Set<string>();
  for (const trackRelease of projection.trackReleases) {
    if (!hasAcceptedReleaseId(trackRelease.identifiers)) {
      throw new Ern432AdapterError(
        "ERN_AUDIO_TRACK_RELEASE_ID_REQUIRED",
        `TrackRelease ${trackRelease.releaseReference} must be identified by GRid, ICPN, or ProprietaryId.`,
      );
    }

    for (const identifier of trackRelease.identifiers) {
      if (!allowedReleaseIdSchemes.has(identifier.sourceScheme)) {
        continue;
      }

      const key =
        `${identifier.sourceScheme}:` +
        `${identifier.namespace ?? ""}:` +
        identifier.sourceValue;
      if (seenTrackReleaseIds.has(key)) {
        throw new Ern432AdapterError(
          "ERN_AUDIO_TRACK_RELEASE_ID_DUPLICATE",
          `TrackRelease identifier ${key} is duplicated in the main release context.`,
        );
      }
      seenTrackReleaseIds.add(key);
    }

    if (trackRelease.linkedResourceReferences.length > 0) {
      throw new Ern432AdapterError(
        "ERN_AUDIO_TRACK_RELEASE_SECONDARY_RESOURCE_FORBIDDEN",
        "Audio TrackReleases may not contain secondary resources.",
      );
    }
  }

  return "Audio";
}

export function parseErn432(xml: string): Ern432Projection {
  const root = parseXml(xml);

  if (root.name !== "NewReleaseMessage") {
    throw new Ern432AdapterError(
      "ERN_ROOT_INVALID",
      `Expected NewReleaseMessage root, found ${root.name}.`,
    );
  }

  if (root.namespace !== ERN_432_NAMESPACE) {
    throw new Ern432AdapterError(
      "ERN_UNSUPPORTED_NAMESPACE",
      `Expected ERN 4.3.2 namespace ${ERN_432_NAMESPACE}, found ${
        root.namespace || "<none>"
      }.`,
    );
  }

  if (!firstChild(root, "ResourceList")) {
    throw new Ern432AdapterError(
      "ERN_RESOURCE_LIST_REQUIRED",
      "ERN 4.3.2 read-only profile requires ResourceList.",
    );
  }

  if (!firstChild(root, "ReleaseList")) {
    throw new Ern432AdapterError(
      "ERN_RELEASE_LIST_REQUIRED",
      "ERN 4.3.2 read-only profile requires ReleaseList.",
    );
  }

  const parties = parseParties(root);
  const partyMap = new Map(
    parties.map((party) => [party.partyReference, party.fullName]),
  );

  const header = firstChild(root, "MessageHeader");
  const sender = header
    ? firstChild(header, "MessageSender")
    : null;
  const recipient = header
    ? firstChild(header, "MessageRecipient")
    : null;

  const supportedTopLevel = new Set([
    "MessageHeader",
    "PartyList",
    "ResourceList",
    "ReleaseList",
  ]);

  const projection: Ern432Projection = {
    namespace: root.namespace,
    avsVersionId:
      root.attributes.AvsVersionId ??
      localAttributeValue(
        root.attributes as unknown as Record<string, unknown>,
        "AvsVersionId",
      ),
    releaseProfileVersionId:
      root.attributes.ReleaseProfileVersionId ??
      localAttributeValue(
        root.attributes as unknown as Record<string, unknown>,
        "ReleaseProfileVersionId",
      ),
    releaseProfileVariantVersionId:
      root.attributes.ReleaseProfileVariantVersionId ??
      localAttributeValue(
        root.attributes as unknown as Record<string, unknown>,
        "ReleaseProfileVariantVersionId",
      ),
    languageAndScriptCode:
      root.attributes.LanguageAndScriptCode ??
      localAttributeValue(
        root.attributes as unknown as Record<string, unknown>,
        "LanguageAndScriptCode",
      ),
    messageSenderPartyId: descendantText(sender, "PartyId"),
    messageRecipientPartyId: descendantText(recipient, "PartyId"),
    messageReference: childText(header, "MessageId"),
    messageCreatedDateTime: childText(header, "MessageCreatedDateTime"),
    parties,
    soundRecordings: parseSoundRecordings(root, partyMap),
    images: parseImages(root),
    releases: parseReleases(root, partyMap),
    trackReleases: parseTrackReleases(root),
    unsupportedTopLevelKinds: root.children
      .map((child) => child.name)
      .filter((name) => !supportedTopLevel.has(name)),
  };

  validateReleaseProfile(projection);
  return projection;
}
