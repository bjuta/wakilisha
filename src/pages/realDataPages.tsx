import React, { useEffect, useState } from 'react';
import { getArtistById, getTracksByArtist, getReleaseTracks, getChartEntries, getPlaybackSources, getContentRoute } from '../repository/wakilishaRepaired';

// Example artist page
export function ArtistPage({ artistId }: { artistId: string }) {
  const [artistData, setArtistData] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const artist = await getArtistById(artistId);
      const artistTracks = await getTracksByArtist(artistId);
      setArtistData(artist);
      setTracks(artistTracks);
    }
    fetchData();
  }, [artistId]);

  if (!artistData) return <div>Loading...</div>;

  return (
    <div>
      <h1>{artistData[0]?.artist_name_snapshot || 'Unknown Artist'}</h1>
      <ul>
        {tracks.map((t) => (
          <li key={t.track_id}>{t.track_id} - {t.role}</li>
        ))}
      </ul>
    </div>
  );
}

// Example track page
export function TrackPage({ trackId }: { trackId: string }) {
  const [chartEntries, setChartEntries] = useState<any[]>([]);
  const [playback, setPlayback] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const entries = await getChartEntries(trackId);
      const sources = await getPlaybackSources(trackId);
      setChartEntries(entries);
      setPlayback(sources);
    }
    fetchData();
  }, [trackId]);

  return (
    <div>
      <h1>Track {trackId}</h1>
      <div>Chart entries: {chartEntries.length}</div>
      <div>Playback sources: {playback.length}</div>
    </div>
  );
}

// Release page
export function ReleasePage({ releaseId }: { releaseId: string }) {
  const [releaseTracks, setReleaseTracks] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const tracks = await getReleaseTracks(releaseId);
      setReleaseTracks(tracks);
    }
    fetchData();
  }, [releaseId]);

  return (
    <div>
      <h1>Release {releaseId}</h1>
      <ul>
        {releaseTracks.map((t) => (
          <li key={`${t.release_id}-${t.track_id}`}>{t.track_id} - {t.disc_number}:{t.track_number}</li>
        ))}
      </ul>
    </div>
  );
}