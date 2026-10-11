/** Render real Registry-sourced recording subjects without inventing artists or outcomes.
 * A title inferred from a canonical slug is labelled by the source; never claim a
 * matching peer is a verified recording survivor or a resolved rights identity.
 */
export type RecordedCaseSubject = Readonly<{
  title: string;
  artistReference: string | null;
  specific: boolean;
}>;

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};

const readableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() && value.trim().length <= 160
    ? value.trim() : null;

const asSlug = (value: string): string =>
  value.toLocaleLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function projectRecordedCaseSubject(
  sourcePayload: unknown,
  fallbackTitle: string,
): RecordedCaseSubject {
  const source = record(sourcePayload);
  const evidence = record(source.evidence);
  const canonicalSlug = readableString(evidence.canonicalTitleSlug);
  const matchingPeer = canonicalSlug && Array.isArray(evidence.peers)
    ? evidence.peers.map(record).find((peer) => {
        const title = readableString(peer.title);
        return Boolean(title && asSlug(title) && asSlug(title) === asSlug(canonicalSlug));
      })
    : null;
  const peerTitle = matchingPeer ? readableString(matchingPeer.title) : null;
  const fallbackRecordedTitle = canonicalSlug && asSlug(canonicalSlug)
    ? canonicalSlug.replace(/[_-]+/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : null;
  // Other MIZIZI cases provide only a recorded Release public-identity slug.
  // Show its exact reference as such; never present the slug as a verified
  // recording or artist title and never infer missing peer relationships.
  const publicIdentity = readableString(source.fieldName) === "public_identity"
    ? readableString(source.currentValue) : null;
  const publicIdentitySlug = publicIdentity &&
    /^[a-z0-9][a-z0-9_-]{0,118}$/i.test(publicIdentity)
    ? publicIdentity : null;
  const artistReference = matchingPeer
    ? readableString(matchingPeer.sharedPrimaryArtistSlug)
    : null;

  return {
    title: peerTitle || fallbackRecordedTitle || (publicIdentitySlug ? `Public identity · ${publicIdentitySlug}` : fallbackTitle),
    artistReference,
    specific: Boolean(peerTitle || fallbackRecordedTitle || publicIdentitySlug),
  };
}
