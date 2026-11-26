// Private, non-authoritative duplicate suggestions for Charts Studio.
// Similar titles and Artist aliases identify review work. They never merge
// Registry identities or award points.
export type ReviewObservation = {
  source_key: string;
  receipt_id: string;
  rank: number;
  title: string;
  artist: string | null;
  provider_track_id: string | null;
  reason?: string;
};

export type ReviewedArtistAlias = {
  alias_slug: string;
  alias_display_name: string | null;
  canonical_artist_id: string;
};

export type ReviewedArtist = {
  id: string;
  display_name: string;
};

export type RecordingReviewGroup = {
  key: string;
  title: string;
  reason: string;
  observations: ReviewObservation[];
};

const normalize = (text: string | null | undefined) =>
  (text ?? "").normalize("NFKD").toLocaleLowerCase("en")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

function nearTitle(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 8 || Math.abs(a.length - b.length) > 2) return false;
  // Bounded edit distance. Long unrelated titles cannot become review leads.
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1, current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    if (Math.min(...current) > 2) return false;
    previous = current;
  }
  return previous[b.length] <= 2;
}

function artistIndex(aliases: ReviewedArtistAlias[], artists: ReviewedArtist[]) {
  const byName = new Map<string, string>();
  for (const artist of artists) {
    const name = normalize(artist.display_name);
    if (name && artist.id) byName.set(name, artist.id);
  }
  for (const alias of aliases) {
    if (!alias.canonical_artist_id) continue;
    for (const value of [alias.alias_slug, alias.alias_display_name]) {
      const name = normalize(value);
      if (name) byName.set(name, alias.canonical_artist_id);
    }
  }
  return byName;
}

function pairReason(
  first: ReviewObservation, second: ReviewObservation,
  identities: Map<string, string>,
): string | null {
  if (first.source_key === second.source_key) return null;
  const a = normalize(first.title), b = normalize(second.title);
  if (!a || !b || !nearTitle(a, b)) return null;
  const exactTitle = a === b;
  const firstArtist = normalize(first.artist);
  const secondArtist = normalize(second.artist);
  if (!firstArtist || !secondArtist) {
    return exactTitle ? "Check Missing Artist Credit" : null;
  }
  if (firstArtist === secondArtist) {
    return exactTitle ? "Same Title And Artist" : "Check Similar Titles";
  }
  const one = identities.get(firstArtist), two = identities.get(secondArtist);
  if (one && two && one === two) {
    return exactTitle ? "Known Artist Alias" : "Known Alias, Similar Titles";
  }
  // Prefix matches are suggestions only, never proof of Artist identity.
  const shorter = firstArtist.length <= secondArtist.length ? firstArtist : secondArtist;
  const longer = shorter === firstArtist ? secondArtist : firstArtist;
  if (shorter.length >= 4 && longer.startsWith(shorter) &&
      longer.length - shorter.length <= 12) {
    return exactTitle ? "Check Artist Alias" : "Check Title And Artist Alias";
  }
  return null;
}

export function suggestRecordingReviewGroups(
  rows: ReviewObservation[],
  aliases: ReviewedArtistAlias[] = [],
  artists: ReviewedArtist[] = [],
): RecordingReviewGroup[] {
  const identities = artistIndex(aliases, artists);
  const parent = rows.map((_, i) => i);
  const rank = rows.map(() => 0);
  const find = (n: number): number => {
    while (parent[n] !== n) {
      parent[n] = parent[parent[n]];
      n = parent[n];
    }
    return n;
  };
  const unite = (a: number, b: number) => {
    const x = find(a), y = find(b);
    if (x === y) return;
    if (rank[x] < rank[y]) parent[x] = y;
    else if (rank[x] > rank[y]) parent[y] = x;
    else { parent[y] = x; rank[x]++; }
  };
  const reasons = new Map<string, Set<string>>();
  // Connected components alone are unsafe: a title-and-prefix chain can
  // accidentally combine two recording versions or two positions from one
  // source. Require every candidate to be compatible with the whole group.
  const membersOf = (root: number): number[] => rows.flatMap((_, i) =>
    find(i) === root ? [i] : []
  );
  const compatibleMerge = (a: number, b: number): boolean => {
    const left = membersOf(find(a)), right = membersOf(find(b));
    const sources = new Set([...left,...right].map(i=>rows[i].source_key));
    if(sources.size !== left.length + right.length)return false;
    return left.every(i=>right.every(j=>{
      const reason=pairReason(rows[i],rows[j],identities);
      return Boolean(reason) && reason !== "Check Missing Artist Credit";
    }));
  };
  // First form groups only through positive artist evidence. A missing artist
  // must never become a bridge joining two otherwise separate Artists.
  for (let i = 0; i < rows.length; i++) {
    if (!normalize(rows[i].artist)) continue;
    for (let j = i + 1; j < rows.length; j++) {
      if (!normalize(rows[j].artist)) continue;
      const reason = pairReason(rows[i], rows[j], identities);
      if (!reason || !compatibleMerge(i,j)) continue;
      unite(i,j);
      reasons.set(String(i) + ":" + String(j), new Set([reason]));
    }
  }

  // Missing-credit rows are still useful review leads, but only when *one*
  // established cross-source artist group fits. Never join two components,
  // invent a credit, or attach an ambiguous same-source second position.
  const anchored = new Map<number, number[]>();
  rows.forEach((row, i) => {
    if (!normalize(row.artist)) return;
    const root = find(i);
    anchored.set(root, [...(anchored.get(root) ?? []), i]);
  });
  const proposals: Array<{row: number; root: number; anchor: number}> = [];
  rows.forEach((row, i) => {
    if (normalize(row.artist)) return;
    const eligible = [...anchored.entries()].filter(([,members]) =>
      members.length >= 2 &&
      !members.some(j => rows[j].source_key === row.source_key) &&
      members.some(j => pairReason(rows[i], rows[j], identities) === "Check Missing Artist Credit")
    );
    if (eligible.length !== 1) return;
    const [root, members] = eligible[0];
    proposals.push({row:i,root,anchor:members.find(j =>
      pairReason(rows[i],rows[j],identities) === "Check Missing Artist Credit")!});
  });
  for (const proposal of proposals) {
    if (proposals.filter(p => p.root === proposal.root &&
      rows[p.row].source_key === rows[proposal.row].source_key).length !== 1) continue;
    unite(proposal.row, proposal.root);
    const i = Math.min(proposal.row,proposal.anchor);
    const j = Math.max(proposal.row,proposal.anchor);
    reasons.set(String(i) + ":" + String(j), new Set(["Check Missing Artist Credit"]));
  }
  const groups = new Map<number, number[]>();
  rows.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });
  return [...groups.values()]
    .filter(group => group.length > 1)
    .map(group => {
      const observations = group.map(i => rows[i]).sort((a, b) =>
        Number(Boolean(b.provider_track_id)) - Number(Boolean(a.provider_track_id)) ||
        a.source_key.localeCompare(b.source_key) || a.rank - b.rank,
      );
      const kinds = new Set<string>();
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
        const key = String(Math.min(group[i], group[j])) + ":" + String(Math.max(group[i], group[j]));
        for (const reason of reasons.get(key) ?? []) kinds.add(reason);
      }
      return {
        key: observations.map(x => x.source_key + ":" + x.receipt_id + ":" + x.rank).join("|"),
        title: observations.find(x => x.source_key === "youtube_ke")?.title ??
          observations.find(x => x.artist)?.title ?? observations[0].title,
        reason: [...kinds].sort().join("; ") || "Check Matching Recordings",
        observations,
      };
    })
    .sort((a, b) => b.observations.length - a.observations.length ||
      Math.min(...a.observations.map(x => x.rank)) -
      Math.min(...b.observations.map(x => x.rank)) ||
      a.key.localeCompare(b.key));
}

// A research workload is a partition of the supplied unresolved positions.
// Multi-source grouping is only a hypothesis; singletons are researchable too.
// The server must validate receipt authority and unresolved status before calling
// this pure helper. Its key identifies a receipt-scoped group, not a Registry
// identity or a durable case ID. No evidence, scoring, or mutation authority.
export function buildRecordingInvestigationGroups(
  rows: ReviewObservation[],
  aliases: ReviewedArtistAlias[] = [],
  artists: ReviewedArtist[] = [],
): RecordingReviewGroup[] {
  const coordinate = (row: ReviewObservation) =>
    JSON.stringify([row.source_key, row.receipt_id, row.rank]);
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.source_key || !row.receipt_id || !Number.isSafeInteger(row.rank) || row.rank < 1) {
      throw new Error("Invalid chart investigation coordinate");
    }
    const key = coordinate(row);
    if (seen.has(key)) throw new Error("Duplicate chart investigation coordinate");
    seen.add(key);
  }

  // The existing grouping is deliberately conservative and can depend on input
  // traversal. Canonicalize ordering before invoking it for repeatable workloads.
  const ordered = [...rows].sort((a, b) =>
    a.source_key.localeCompare(b.source_key) ||
    a.receipt_id.localeCompare(b.receipt_id) || a.rank - b.rank);
  const groups = suggestRecordingReviewGroups(ordered, aliases, artists);
  const covered = new Set<string>();
  for (const group of groups) {
    for (const row of group.observations) {
      const key = coordinate(row);
      if (!seen.has(key) || covered.has(key)) {
        throw new Error("Invalid chart investigation partition");
      }
      covered.add(key);
    }
  }
  for (const row of ordered) {
    const key = coordinate(row);
    if (covered.has(key)) continue;
    groups.push({
      key: row.source_key + ":" + row.receipt_id + ":" + row.rank,
      title: row.title,
      reason: row.artist?.trim() ? "Single source investigation" : "Investigate missing Artist credit",
      observations: [row],
    });
    covered.add(key);
  }
  return groups.sort((a, b) => b.observations.length - a.observations.length ||
    Math.min(...a.observations.map(row => row.rank)) -
    Math.min(...b.observations.map(row => row.rank)) || a.key.localeCompare(b.key));
}
