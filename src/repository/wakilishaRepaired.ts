import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function getArtistById(artistId: string) {
  const res = await pool.query(
    `SELECT * FROM wakilisha_repaired.artist_genres ag
     JOIN wakilisha_repaired.track_artists ta ON ag.artist_id = ta.artist_id
     WHERE ag.artist_id = $1`,
    [artistId]
  );
  return res.rows;
}

export async function getTracksByArtist(artistId: string) {
  const res = await pool.query(
    `SELECT ta.track_id, ta.artist_id, ta.role, ta.position
     FROM wakilisha_repaired.track_artists ta
     WHERE ta.artist_id = $1
     ORDER BY ta.position`,
    [artistId]
  );
  return res.rows;
}

export async function getReleaseTracks(releaseId: string) {
  const res = await pool.query(
    `SELECT * FROM wakilisha_repaired.release_tracks
     WHERE release_id = $1
     ORDER BY disc_number, track_number`,
    [releaseId]
  );
  return res.rows;
}

export async function getChartEntries(trackId: string) {
  const res = await pool.query(
    `SELECT * FROM wakilisha_repaired.chart_entry_tracks
     WHERE track_id = $1`,
    [trackId]
  );
  return res.rows;
}

export async function getPlaybackSources(trackId: string) {
  const res = await pool.query(
    `SELECT * FROM wakilisha_repaired.track_playback_sources
     WHERE track_id = $1`,
    [trackId]
  );
  return res.rows;
}

export async function getContentRoute(slug: string) {
  const res = await pool.query(
    `SELECT * FROM wakilisha_repaired.content_route_classification
     WHERE slug = $1`,
    [slug]
  );
  return res.rows[0];
}