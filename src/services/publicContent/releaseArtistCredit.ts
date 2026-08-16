export type ReleaseArtistCreditCandidate = {
  artistId?: string | null;
  artistNameText?: string | null;
  artistSlug?: string | null;
  isPrimary?: boolean | null;
  creditOrder?: number | null;
  confidence?: number | null;
};

function hasName(value: string | null | undefined): boolean {
  const text = String(value || "").trim();
  return Boolean(text) && !/^unknown(?: artist)?$/i.test(text);
}

function orderValue(value: number | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 999;
}

function confidenceValue(value: number | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : -1;
}

export function selectPrimaryReleaseArtistCredit(
  rows: ReleaseArtistCreditCandidate[],
): ReleaseArtistCreditCandidate | null {
  const candidates = rows.filter((row) =>
    hasName(row.artistNameText || row.artistSlug),
  );

  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) {
      return a.isPrimary ? -1 : 1;
    }

    const aResolved = Boolean(String(a.artistId || "").trim());
    const bResolved = Boolean(String(b.artistId || "").trim());

    if (aResolved !== bResolved) {
      return aResolved ? -1 : 1;
    }

    const orderDelta =
      orderValue(a.creditOrder) -
      orderValue(b.creditOrder);

    if (orderDelta !== 0) {
      return orderDelta;
    }

    const confidenceDelta =
      confidenceValue(b.confidence) -
      confidenceValue(a.confidence);

    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return String(
      a.artistNameText ||
      a.artistSlug ||
      "",
    ).localeCompare(
      String(
        b.artistNameText ||
        b.artistSlug ||
        "",
      ),
    );
  })[0] || null;
}
