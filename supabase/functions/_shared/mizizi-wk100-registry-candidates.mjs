/**
 * MIZIZI research candidates for WK100 observations.
 * Uses current accepted Registry facts as lookup hints, not canonical authority.
 * The WK100 W4/W5/W8 exact-provider-link resolution rules are unchanged.
 */
const normalize = value => typeof value === 'string'
  ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
  : '';
const id = value => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const bounded = (value, limit) => Array.isArray(value) && value.length <= limit;

export const MIZIZI_WK100_CANDIDATE_CONTRACT = 'mizizi-wk100-registry-candidates-v1';
export const wk100CandidateTitleKey = normalize;

function artistParts(value) {
  return (typeof value === 'string' ? value : '')
    .split(/,|;|&|\b(?:feat|ft|featuring|with|and|x)\b/gi)
    .map(normalize).filter(Boolean);
}
function matchingCredit(observedArtist, credits) {
  const observed = normalize(observedArtist);
  if (!observed) return null;
  const parts = artistParts(observedArtist);
  let variation = false;
  for (const credited of credits) {
    const name = normalize(credited);
    if (!name) continue;
    if (observed === name) return 'exact_artist_credit';
    if (parts.includes(name)) return 'listed_artist_credit';
    // A label such as "Mejja Genge" may describe the same performer as
    // "Mejja", but is deliberately NOT an accepted Artist alias or identity.
    // Only one extra trailing word is tolerated for a research *candidate*.
    if (name.length >= 5 && observed.startsWith(name + ' ') &&
        observed.split(' ').length === name.split(' ').length + 1)
      variation = true;
  }
  return variation ? 'artist_credit_variant' : null;
}

/**
 * All arguments are already authorized read-only Registry records from the
 * existing W4 Admin reader. No external fetch and no Registry write.
 */
export function projectMiziziWk100RegistryCandidates({
  rows, registryTracks, registryCredits, registryArtists, registryAliases = [],
}) {
  if (!bounded(rows, 200) || !bounded(registryTracks, 400) ||
      !bounded(registryCredits, 1600) || !bounded(registryArtists, 800) ||
      !bounded(registryAliases, 800)) throw Error('mizizi_candidate_input_unbounded');

  const artists = new Map(registryArtists.filter(a => a && id(a.id) &&
    a.status === 'active').map(a => [a.id.toLowerCase(), a.display_name]));
  const aliases = new Map();
  for (const alias of registryAliases) {
    if (!alias || alias.status !== 'active' || !id(alias.canonical_artist_id) ||
        !normalize(alias.alias_display_name)) continue;
    const key = alias.canonical_artist_id.toLowerCase();
    aliases.set(key, [...(aliases.get(key) || []), alias.alias_display_name]);
  }
  const credits = new Map();
  for (const credit of registryCredits) {
    if (!credit || credit.status !== 'active' || !id(credit.track_id)) continue;
    const name = artists.get(String(credit.artist_id || '').toLowerCase()) ||
      (typeof credit.artist_name_text === 'string' ? credit.artist_name_text : '');
    const available = [name, ...(aliases.get(String(credit.artist_id || '').toLowerCase()) || [])]
      .filter(Boolean);
    const key = credit.track_id.toLowerCase();
    credits.set(key, [...(credits.get(key) || []), ...available]);
  }

  const tracksByTitle = new Map();
  for (const track of registryTracks) {
    if (!track || track.status !== 'active' || !id(track.id)) continue;
    const key = normalize(track.normalized_title || track.title);
    if (!key) continue;
    const bucket = tracksByTitle.get(key) || [];
    bucket.push(track);
    tracksByTitle.set(key, bucket);
  }
  const projected = rows.map(row => {
    const title = normalize(row.observedTitle);
    const artist = row.providerArtistName || row.observedArtist;
    const candidates = [];
    if (row.identityState !== 'resolved' && title && normalize(artist)) {
      for (const track of tracksByTitle.get(title) || []) {
        const basis = matchingCredit(artist, credits.get(track.id.toLowerCase()) || []);
        if (!basis) continue;
        candidates.push({
          trackId: track.id.toLowerCase(), title: track.title,
          registryIsrc: typeof track.isrc === 'string' ? track.isrc : null,
          basis, identifierCorroborated: false,
          status: 'research_candidate_only',
        });
      }
    }
    candidates.sort((a, b) => a.trackId.localeCompare(b.trackId));
    // No candidate is permitted to affect canonicalTrackId/identityState.
    return {...row, registryCandidates: candidates.slice(0, 8)};
  });
  return {
    contractVersion: MIZIZI_WK100_CANDIDATE_CONTRACT,
    rows: projected, candidateRows: projected.filter(r => r.registryCandidates.length).length,
    canWriteRegistry: false, canScore: false, canPublish: false,
  };
}
