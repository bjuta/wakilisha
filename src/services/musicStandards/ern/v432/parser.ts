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

export interface ErnPartyProjection {
  partyReference: string;
  fullName: string | null;
}

export interface ErnDisplayArtistProjection {
  partyReference: string | null;
  displayName: string | null;
  role: string | null;
}

export interface ErnContributorProjection {
  partyReference: string | null;
  fullName: string | null;
  roles: string[];
}

export interface ErnSoundRecordingProjection {
  resourceReference: string;
  title: string | null;
  isrc: string | null;
  displayArtistName: string | null;
  displayArtists: ErnDisplayArtistProjection[];
  contributors: ErnContributorProjection[];
}

export interface ErnImageProjection {
  resourceReference: string;
  imageType: string | null;
  uri: string | null;
}

export interface ErnReleaseProjection {
  releaseReference: string;
  releaseType: string | null;
  title: string | null;
  displayArtistName: string | null;
  displayArtists: ErnDisplayArtistProjection[];
  icpn: string | null;
  releaseDate: string | null;
  labelPartyReference: string | null;
  labelName: string | null;
  genres: string[];
  resourceReferences: string[];
}

export interface Ern432Projection {
  namespace: string;
  avsVersionId: string | null;
  messageSenderPartyId: string | null;
  messageRecipientPartyId: string | null;
  messageReference: string | null;
  messageCreatedDateTime: string | null;
  parties: ErnPartyProjection[];
  soundRecordings: ErnSoundRecordingProjection[];
  images: ErnImageProjection[];
  releases: ErnReleaseProjection[];
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

      const isrc =
        children(recording, "SoundRecordingEdition")
          .map((edition) => descendantText(edition, "ISRC"))
          .find((value): value is string => Boolean(value)) ??
        null;

      return {
        resourceReference,
        title:
          childText(recording, "DisplayTitleText") ??
          descendantText(firstChild(recording, "DisplayTitle"), "TitleText"),
        isrc,
        displayArtistName: childText(
          recording,
          "DisplayArtistName",
        ),
        displayArtists: resolveDisplayArtists(recording, parties),
        contributors: resolveContributors(recording, parties),
      };
    })
    .filter(
      (recording): recording is ErnSoundRecordingProjection =>
        recording !== null,
    );
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

      return {
        resourceReference,
        imageType: childText(image, "Type"),
        uri: descendantText(image, "URI"),
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

      return {
        releaseReference,
        releaseType: childText(release, "ReleaseType"),
        title:
          childText(release, "DisplayTitleText") ??
          descendantText(firstChild(release, "DisplayTitle"), "TitleText"),
        displayArtistName: childText(release, "DisplayArtistName"),
        displayArtists: resolveDisplayArtists(release, parties),
        icpn: descendantText(firstChild(release, "ReleaseId"), "ICPN"),
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
        resourceReferences: descendants(
          release,
          "ReleaseResourceReference",
        )
          .map((reference) => directText(reference))
          .filter((reference): reference is string =>
            Boolean(reference),
          ),
      };
    })
    .filter((release): release is ErnReleaseProjection => release !== null);
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

  return {
    namespace: root.namespace,
    avsVersionId:
      root.attributes.AvsVersionId ??
      localAttributeValue(
        root.attributes as unknown as Record<string, unknown>,
        "AvsVersionId",
      ),
    messageSenderPartyId: descendantText(sender, "PartyId"),
    messageRecipientPartyId: descendantText(recipient, "PartyId"),
    messageReference: childText(header, "MessageId"),
    messageCreatedDateTime: childText(header, "MessageCreatedDateTime"),
    parties,
    soundRecordings: parseSoundRecordings(root, partyMap),
    images: parseImages(root),
    releases: parseReleases(root, partyMap),
    unsupportedTopLevelKinds: root.children
      .map((child) => child.name)
      .filter((name) => !supportedTopLevel.has(name)),
  };
}
