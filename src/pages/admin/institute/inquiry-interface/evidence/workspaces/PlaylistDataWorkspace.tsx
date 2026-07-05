import React, { useState } from "react";
import { EvidenceWorkspaceProps } from "./workspaceTypes";

export default function PlaylistDataWorkspace({
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps<{
  playlistName?: string;
  platform?: string;
  playlistUrl?: string;
  curator?: string;
  featuredImageUrl?: string;
  description?: string;
  dateObserved?: string;
  trackListNotes?: string;
  trackOrderNote?: string;
  featuredEntity?: string;
  signalType?: string;
  doesNotProve?: string;
}>) {
  const [playlistName, setPlaylistName] = useState(initialMetadata?.playlistName || "");
  const [platform, setPlatform] = useState(initialMetadata?.platform || "");
  const [playlistUrl, setPlaylistUrl] = useState(initialMetadata?.playlistUrl || "");
  const [curator, setCurator] = useState(initialMetadata?.curator || "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(
    initialMetadata?.featuredImageUrl || ""
  );
  const [description, setDescription] = useState(initialMetadata?.description || "");
  const [dateObserved, setDateObserved] = useState(initialMetadata?.dateObserved || "");
  const [trackListNotes, setTrackListNotes] = useState(initialMetadata?.trackListNotes || "");
  const [trackOrderNote, setTrackOrderNote] = useState(initialMetadata?.trackOrderNote || "");
  const [featuredEntity, setFeaturedEntity] = useState(initialMetadata?.featuredEntity || "");
  const [signalType, setSignalType] = useState(initialMetadata?.signalType || "");
  const [doesNotProve, setDoesNotProve] = useState(initialMetadata?.doesNotProve || "");

  const [producedWork, setProducedWork] = useState(playlistName);

  async function handleSave() {
    await onSave(
      {
        playlistName,
        platform,
        playlistUrl,
        curator,
        featuredImageUrl,
        description,
        dateObserved,
        trackListNotes,
        trackOrderNote,
        featuredEntity,
        signalType,
        doesNotProve,
      },
      producedWork
    );
  }

  return (
    <div>
      <h2>Playlist Data Workspace</h2>
      <p>Purpose: A playlist as cultural object and circulation signal.</p>

      <section>
        <h3>Playlist details</h3>
        <label>
          Playlist name
          <input
            type="text"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
          />
        </label>
        <label>
          Platform
          <input type="text" value={platform} onChange={(e) => setPlatform(e.target.value)} />
        </label>
        <label>
          Playlist URL
          <input type="url" value={playlistUrl} onChange={(e) => setPlaylistUrl(e.target.value)} />
        </label>
        <label>
          Curator/source
          <input type="text" value={curator} onChange={(e) => setCurator(e.target.value)} />
        </label>
        <label>
          Featured image URL or note
          <input
            type="text"
            value={featuredImageUrl}
            onChange={(e) => setFeaturedImageUrl(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Date observed
          <input
            type="date"
            value={dateObserved}
            onChange={(e) => setDateObserved(e.target.value)}
          />
        </label>
      </section>

      <section>
        <h3>Track list and curation</h3>
        <label>
          Track list notes
          <textarea value={trackListNotes} onChange={(e) => setTrackListNotes(e.target.value)} />
        </label>
        <label>
          Track order note
          <textarea value={trackOrderNote} onChange={(e) => setTrackOrderNote(e.target.value)} />
        </label>
        <label>
          Featured track, artist, or release
          <input
            type="text"
            value={featuredEntity}
            onChange={(e) => setFeaturedEntity(e.target.value)}
          />
        </label>
        <label>
          Signal type
          <select value={signalType} onChange={(e) => setSignalType(e.target.value)}>
            <option value="">Select signal type</option>
            <option value="editorial">Editorial</option>
            <option value="algorithmic">Algorithmic</option>
            <option value="user-made">User-made</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </section>

      <section>
        <h3>Human review</h3>
        <p>Curation signal and limits.</p>
        <label>
          What this does not prove
          <textarea value={doesNotProve} onChange={(e) => setDoesNotProve(e.target.value)} />
        </label>
      </section>

      <section>
        <h3>Assistant inspection (not wired yet)</h3>
        <p>The assistant will later inspect playlist metadata and context.</p>
      </section>

      <button onClick={handleSave}>Save evidence</button>
    </div>
  );
}
