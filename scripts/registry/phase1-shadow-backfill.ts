import { cleanText, createRegistryPool, hasTable, normalizeText, parseJsonObject } from "./phase1-db";

type Artist = {
  id: string;
  slug: string;
  name: string;
  normalized: string;
};

type ReleaseArtistPlan = {
  releaseId: string;
  releaseTitle: string;
  artist: Artist;
  confidence: number;
  sourceReason: string;
};

type TrackArtistPlan = {
  trackId: string;
  trackTitle: string;
  artist: Artist;
  confidence: number;
  sourceReason: string;
};

type ReleaseTrackPlan = {
  releaseId: string;
  trackId: string;
  trackTitle: string;
  discNumber: number;
  trackNumber: number | null;
};

type SkippedRow = {
  id: string;
  title: string;
  reason: string;
  artistText: string;
};

const writeMode = process.argv.includes("--write");

function slugFromText(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hasMultiArtistSyntax(value: string): boolean {
  const clean = ` ${normalizeText(value)} `;
  return /\b(feat|ft|featuring|with)\b/i.test(clean)
    || clean.includes(" x ")
    || clean.includes(",")
    || clean.includes(" & ")
    || clean.includes(" and ");
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function artistCandidateFromMetadata(metadata: Record<string, unknown>): { slug: string; name: string; reason: string } | null {
  const slug = firstString(
    metadata.artist_slug,
    metadata.primary_artist_slug,
    metadata.artistSlug,
    metadata.primaryArtistSlug
  );

  if (slug) {
    return { slug, name: "", reason: "metadata_artist_slug" };
  }

  const names = [
    metadata.primary_artist_name,
    metadata.primaryArtistName,
    metadata.artist_name,
    metadata.artistName,
    metadata.artist_display,
    metadata.artistDisplay,
    metadata.artists,
  ].map(cleanText).filter(Boolean);

  for (const name of names) {
    if (!hasMultiArtistSyntax(name)) {
      return { slug: "", name, reason: "metadata_artist_name_exact_single" };
    }
  }

  return null;
}

function matchArtist(
  candidate: { slug: string; name: string },
  artistsBySlug: Map<string, Artist>,
  artistsByName: Map<string, Artist>
): { artist: Artist; confidence: number } | null {
  if (candidate.slug) {
    const bySlug = artistsBySlug.get(candidate.slug) || artistsBySlug.get(slugFromText(candidate.slug));
    if (bySlug) return { artist: bySlug, confidence: 100 };
  }

  if (candidate.name) {
    const byName = artistsByName.get(normalizeText(candidate.name));
    if (byName) return { artist: byName, confidence: 95 };
  }

  return null;
}

function numberOrNull(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

async function assertRequiredTables(pool: ReturnType<typeof createRegistryPool>): Promise<void> {
  const required = [
    "registry_artists",
    "registry_releases",
    "registry_tracks",
    "registry_release_artists",
    "registry_track_artists",
    "registry_release_tracks",
    "registry_audit_log",
  ];

  for (const table of required) {
    if (!(await hasTable(pool, `public.${table}`))) {
      throw new Error(`Required table missing: public.${table}. Run npm run registry:phase1:schema first.`);
    }
  }
}

async function main() {
  const pool = createRegistryPool();

  try {
    await pool.query("select 1");
    await assertRequiredTables(pool);

    console.log("\nWAKILISHA Phase 1 Shadow Backfill");
    console.log("=".repeat(80));
    console.log(writeMode ? "Mode: WRITE. Only high-confidence shadow rows will be inserted." : "Mode: DRY RUN. No data will be written.");
    console.log("");

    const artistRows = await pool.query(`
      select
        id::text,
        slug,
        coalesce(display_name, normalized_name, slug) as name,
        coalesce(normalized_name, display_name, slug) as normalized
      from public.registry_artists
      where coalesce(status, 'active') not in ('archived', 'deleted', 'trash')
    `);

    const artists: Artist[] = artistRows.rows.map((row) => ({
      id: cleanText(row.id),
      slug: cleanText(row.slug),
      name: cleanText(row.name),
      normalized: normalizeText(row.normalized || row.name || row.slug),
    }));

    const artistsBySlug = new Map<string, Artist>();
    const artistsByName = new Map<string, Artist>();

    for (const artist of artists) {
      if (artist.slug) artistsBySlug.set(artist.slug, artist);
      if (artist.slug) artistsBySlug.set(slugFromText(artist.slug), artist);
      if (artist.name) artistsByName.set(normalizeText(artist.name), artist);
      if (artist.normalized) artistsByName.set(normalizeText(artist.normalized), artist);
    }

    const releaseRows = await pool.query(`
      select id::text, slug, title, metadata
      from public.registry_releases
      where coalesce(status, 'active') not in ('archived', 'deleted', 'trash')
    `);

    const releaseArtistPlans: ReleaseArtistPlan[] = [];
    const releaseArtistSkipped: SkippedRow[] = [];

    for (const release of releaseRows.rows) {
      const metadata = parseJsonObject(release.metadata);
      const candidate = artistCandidateFromMetadata(metadata);
      const releaseTitle = cleanText(release.title);

      if (!candidate) {
        releaseArtistSkipped.push({
          id: cleanText(release.id),
          title: releaseTitle,
          reason: "no_single_high_confidence_artist_metadata",
          artistText: firstString(metadata.artist_name, metadata.artist_display, metadata.artists),
        });
        continue;
      }

      const matched = matchArtist(candidate, artistsBySlug, artistsByName);
      if (!matched) {
        releaseArtistSkipped.push({
          id: cleanText(release.id),
          title: releaseTitle,
          reason: "candidate_not_found_in_registry_artists",
          artistText: candidate.slug || candidate.name,
        });
        continue;
      }

      releaseArtistPlans.push({
        releaseId: cleanText(release.id),
        releaseTitle,
        artist: matched.artist,
        confidence: matched.confidence,
        sourceReason: candidate.reason,
      });
    }

    const trackRows = await pool.query(`
      select
        id::text,
        release_id::text,
        slug,
        title,
        metadata,
        to_jsonb(registry_tracks)->>'track_number' as track_number,
        to_jsonb(registry_tracks)->>'disc_number' as disc_number
      from public.registry_tracks
      where coalesce(status, 'active') not in ('archived', 'deleted', 'trash')
    `);

    const releaseTrackPlans: ReleaseTrackPlan[] = trackRows.rows
      .filter((track) => cleanText(track.release_id))
      .map((track) => ({
        releaseId: cleanText(track.release_id),
        trackId: cleanText(track.id),
        trackTitle: cleanText(track.title),
        discNumber: numberOrNull(track.disc_number) || 1,
        trackNumber: numberOrNull(track.track_number),
      }));

    const trackArtistPlans: TrackArtistPlan[] = [];
    const trackArtistSkipped: SkippedRow[] = [];

    for (const track of trackRows.rows) {
      const metadata = parseJsonObject(track.metadata);
      const candidate = artistCandidateFromMetadata(metadata);
      const trackTitle = cleanText(track.title);

      if (!candidate) {
        trackArtistSkipped.push({
          id: cleanText(track.id),
          title: trackTitle,
          reason: "no_single_high_confidence_artist_metadata",
          artistText: firstString(metadata.artist_name, metadata.artist_display, metadata.artists),
        });
        continue;
      }

      const matched = matchArtist(candidate, artistsBySlug, artistsByName);
      if (!matched) {
        trackArtistSkipped.push({
          id: cleanText(track.id),
          title: trackTitle,
          reason: "candidate_not_found_in_registry_artists",
          artistText: candidate.slug || candidate.name,
        });
        continue;
      }

      trackArtistPlans.push({
        trackId: cleanText(track.id),
        trackTitle,
        artist: matched.artist,
        confidence: matched.confidence,
        sourceReason: candidate.reason,
      });
    }

    console.log("Planned high-confidence shadow rows");
    console.log("-".repeat(80));
    console.table([{
      release_artist_links: releaseArtistPlans.length,
      release_track_links: releaseTrackPlans.length,
      track_artist_links: trackArtistPlans.length,
      skipped_release_artist_links: releaseArtistSkipped.length,
      skipped_track_artist_links: trackArtistSkipped.length,
    }]);

    console.log("\nSample release artist plans");
    console.table(releaseArtistPlans.slice(0, 10).map((item) => ({
      release: item.releaseTitle,
      artist: item.artist.name,
      confidence: item.confidence,
      reason: item.sourceReason,
    })));

    console.log("\nSample skipped release artist rows");
    console.table(releaseArtistSkipped.slice(0, 10));

    console.log("\nSample track artist plans");
    console.table(trackArtistPlans.slice(0, 10).map((item) => ({
      track: item.trackTitle,
      artist: item.artist.name,
      confidence: item.confidence,
      reason: item.sourceReason,
    })));

    if (!writeMode) {
      console.log("\nDry run complete. No writes performed.");
      console.log("To write only these high-confidence shadow rows, rerun with: npm run registry:phase1:backfill -- --write");
      return;
    }

    await pool.query("begin");

    for (const item of releaseArtistPlans) {
      await pool.query(`
        insert into public.registry_release_artists (
          release_id,
          artist_id,
          artist_slug,
          artist_name_text,
          role,
          is_primary,
          is_featured,
          credit_order,
          display_credit,
          source,
          confidence,
          status,
          metadata,
          updated_at
        )
        values ($1::uuid, $2::uuid, $3, $4, 'primary_artist', true, false, 1, $4, 'phase1_shadow_backfill', $5, 'shadow', $6::jsonb, now())
        on conflict do nothing
      `, [
        item.releaseId,
        item.artist.id,
        item.artist.slug,
        item.artist.name,
        item.confidence,
        JSON.stringify({ reason: item.sourceReason, releaseTitle: item.releaseTitle }),
      ]);
    }

    for (const item of releaseTrackPlans) {
      await pool.query(`
        insert into public.registry_release_tracks (
          release_id,
          track_id,
          disc_number,
          track_number,
          source,
          confidence,
          status,
          metadata,
          updated_at
        )
        values ($1::uuid, $2::uuid, $3, $4, 'phase1_shadow_backfill', 100, 'shadow', $5::jsonb, now())
        on conflict do nothing
      `, [
        item.releaseId,
        item.trackId,
        item.discNumber,
        item.trackNumber,
        JSON.stringify({ reason: "existing_registry_tracks_release_id", trackTitle: item.trackTitle }),
      ]);
    }

    for (const item of trackArtistPlans) {
      await pool.query(`
        insert into public.registry_track_artists (
          track_id,
          artist_id,
          artist_slug,
          artist_name_text,
          role,
          is_primary,
          is_featured,
          credit_order,
          display_credit,
          source,
          confidence,
          status,
          metadata,
          updated_at
        )
        values ($1::uuid, $2::uuid, $3, $4, 'primary_artist', true, false, 1, $4, 'phase1_shadow_backfill', $5, 'shadow', $6::jsonb, now())
        on conflict do nothing
      `, [
        item.trackId,
        item.artist.id,
        item.artist.slug,
        item.artist.name,
        item.confidence,
        JSON.stringify({ reason: item.sourceReason, trackTitle: item.trackTitle }),
      ]);
    }

    await pool.query(`
      insert into public.registry_audit_log (actor_label, action, entity_type, metadata)
      values ('system', 'phase1_shadow_backfill_written', 'registry_shadow_relationships', $1::jsonb)
    `, [JSON.stringify({
      releaseArtistLinks: releaseArtistPlans.length,
      releaseTrackLinks: releaseTrackPlans.length,
      trackArtistLinks: trackArtistPlans.length,
      skippedReleaseArtistLinks: releaseArtistSkipped.length,
      skippedTrackArtistLinks: trackArtistSkipped.length,
      destructiveChanges: false,
      publicRenderingChanged: false,
      publicApiChanged: false,
    })]);

    await pool.query("commit");

    console.log("\nWrite complete. Only shadow relationship rows were inserted.");
    console.log("No public rendering or public API code was changed.");
  } catch (error) {
    await pool.query("rollback").catch(() => undefined);
    console.error("[phase1-shadow-backfill] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
