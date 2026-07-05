import React, { useState } from "react";
import { EvidenceWorkspaceProps } from "./workspaceTypes";

export default function SocialPostWorkspace({
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps<{
  platform?: string;
  postUrl?: string;
  screenshotNote?: string;
  account?: string;
  accountType?: string;
  postedAt?: string;
  captionExcerpt?: string;
  mediaNote?: string;
  engagementSnapshot?: string;
  signalType?: string;
  careLevel?: string;
  needsChecking?: string;
}>) {
  const [platform, setPlatform] = useState(initialMetadata?.platform || "");
  const [postUrl, setPostUrl] = useState(initialMetadata?.postUrl || "");
  const [screenshotNote, setScreenshotNote] = useState(initialMetadata?.screenshotNote || "");
  const [account, setAccount] = useState(initialMetadata?.account || "");
  const [accountType, setAccountType] = useState(initialMetadata?.accountType || "");
  const [postedAt, setPostedAt] = useState(initialMetadata?.postedAt || "");
  const [captionExcerpt, setCaptionExcerpt] = useState(initialMetadata?.captionExcerpt || "");
  const [mediaNote, setMediaNote] = useState(initialMetadata?.mediaNote || "");
  const [engagementSnapshot, setEngagementSnapshot] = useState(
    initialMetadata?.engagementSnapshot || ""
  );
  const [signalType, setSignalType] = useState(initialMetadata?.signalType || "");
  const [careLevel, setCareLevel] = useState(initialMetadata?.careLevel || "");
  const [needsChecking, setNeedsChecking] = useState(initialMetadata?.needsChecking || "");

  const [producedWork, setProducedWork] = useState(
    `${platform} ${account} ${postedAt}`.trim()
  );

  async function handleSave() {
    await onSave(
      {
        platform,
        postUrl,
        screenshotNote,
        account,
        accountType,
        postedAt,
        captionExcerpt,
        mediaNote,
        engagementSnapshot,
        signalType,
        careLevel,
        needsChecking,
      },
      producedWork
    );
  }

  return (
    <div>
      <h2>Social Post Workspace</h2>
      <p>Purpose: A contextual signal workspace with care and source fragility built in.</p>

      <section>
        <h3>Post details</h3>
        <label>
          Platform
          <input type="text" value={platform} onChange={(e) => setPlatform(e.target.value)} />
        </label>
        <label>
          Post URL
          <input type="url" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} />
        </label>
        <label>
          Screenshot or archive note
          <textarea
            value={screenshotNote}
            onChange={(e) => setScreenshotNote(e.target.value)}
          />
        </label>
        <label>
          Account/author
          <input type="text" value={account} onChange={(e) => setAccount(e.target.value)} />
        </label>
        <label>
          Account type
          <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
            <option value="">Select account type</option>
            <option value="artist">Artist</option>
            <option value="fan">Fan</option>
            <option value="label">Label</option>
            <option value="media">Media</option>
            <option value="platform">Platform</option>
            <option value="critic">Critic</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Posted date or approximate date
          <input type="date" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} />
        </label>
        <label>
          Caption or excerpt
          <textarea value={captionExcerpt} onChange={(e) => setCaptionExcerpt(e.target.value)} />
        </label>
        <label>
          Media note
          <textarea value={mediaNote} onChange={(e) => setMediaNote(e.target.value)} />
        </label>
        <label>
          Engagement snapshot
          <textarea
            value={engagementSnapshot}
            onChange={(e) => setEngagementSnapshot(e.target.value)}
          />
        </label>
        <label>
          Signal type
          <select value={signalType} onChange={(e) => setSignalType(e.target.value)}>
            <option value="">Select signal type</option>
            <option value="promo">Promo</option>
            <option value="fan_reaction">Fan reaction</option>
            <option value="dispute">Dispute</option>
            <option value="memory">Memory</option>
            <option value="announcement">Announcement</option>
            <option value="weak_signal">Weak signal</option>
          </select>
        </label>
        <label>
          Care level
          <select value={careLevel} onChange={(e) => setCareLevel(e.target.value)}>
            <option value="">Select care level</option>
            <option value="public">Public</option>
            <option value="sensitive">Sensitive</option>
            <option value="private">Private/permission needed</option>
          </select>
        </label>
        <label>
          What still needs checking
          <textarea
            value={needsChecking}
            onChange={(e) => setNeedsChecking(e.target.value)}
          />
        </label>
      </section>

      <section>
        <h3>Assistant inspection (not wired yet)</h3>
        <p>The assistant will later inspect social post metadata and context.</p>
      </section>

      <section>
        <h3>Review</h3>
        <p>Care level and source fragility.</p>
      </section>

      <button onClick={handleSave}>Save evidence</button>
    </div>
  );
}
