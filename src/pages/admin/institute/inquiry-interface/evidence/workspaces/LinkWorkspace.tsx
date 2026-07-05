import React, { useState } from "react";
import { EvidenceWorkspaceProps } from "./workspaceTypes";

export default function LinkWorkspace({
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps<{
  url?: string;
  sourceLabel?: string;
  publishedAt?: string;
  accessedAt?: string;
  whyItMatters?: string;
  careNote?: string;
  needsChecking?: string;
  // assistant inspection fields
  httpStatus?: number;
  finalUrl?: string;
  domain?: string;
  pageTitle?: string;
  detectedAuthor?: string;
  detectedPublishedAt?: string;
  inspectionState?: string;
  assistantSummary?: string;
  assistantClaims?: string;
  assistantEntities?: string;
  assistantWarnings?: string;
}>) {
  const [url, setUrl] = useState(initialMetadata?.url || "");
  const [sourceLabel, setSourceLabel] = useState(initialMetadata?.sourceLabel || "");
  const [publishedAt, setPublishedAt] = useState(initialMetadata?.publishedAt || "");
  const [accessedAt, setAccessedAt] = useState(initialMetadata?.accessedAt || "");
  const [whyItMatters, setWhyItMatters] = useState(initialMetadata?.whyItMatters || "");
  const [careNote, setCareNote] = useState(initialMetadata?.careNote || "");
  const [needsChecking, setNeedsChecking] = useState(initialMetadata?.needsChecking || "");

  const [producedWork, setProducedWork] = useState(
    initialMetadata?.sourceLabel || url || ""
  );

  async function handleSave() {
    await onSave(
      {
        url,
        sourceLabel,
        publishedAt,
        accessedAt,
        whyItMatters,
        careNote,
        needsChecking,
        httpStatus: initialMetadata?.httpStatus,
        finalUrl: initialMetadata?.finalUrl,
        domain: initialMetadata?.domain,
        pageTitle: initialMetadata?.pageTitle,
        detectedAuthor: initialMetadata?.detectedAuthor,
        detectedPublishedAt: initialMetadata?.detectedPublishedAt,
        inspectionState: initialMetadata?.inspectionState,
        assistantSummary: initialMetadata?.assistantSummary,
        assistantClaims: initialMetadata?.assistantClaims,
        assistantEntities: initialMetadata?.assistantEntities,
        assistantWarnings: initialMetadata?.assistantWarnings,
      },
      producedWork
    );
  }

  return (
    <div>
      <h2>Link Workspace</h2>
      <p>Purpose: A source inspection room, not a URL field.</p>

      <section>
        <h3>Source</h3>
        <label>
          URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>
          Source label or page title
          <input
            type="text"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
          />
        </label>
        <label>
          Published date or period
          <input
            type="date"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </label>
        <label>
          Accessed date
          <input
            type="date"
            value={accessedAt}
            onChange={(e) => setAccessedAt(e.target.value)}
          />
        </label>
      </section>

      <section>
        <h3>Human input</h3>
        <label>
          Why this link matters
          <textarea
            value={whyItMatters}
            onChange={(e) => setWhyItMatters(e.target.value)}
          />
        </label>
        <label>
          Care or credibility note
          <textarea value={careNote} onChange={(e) => setCareNote(e.target.value)} />
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
        <p>
          The assistant will later check whether the link is alive, capture final URL/domain/title,
          read available context, detect blocked/dead/thin pages, and suggest usefulness.
        </p>
      </section>

      <section>
        <h3>Review</h3>
        <p>Source usefulness, credibility, archive needed.</p>
      </section>

      <button onClick={handleSave}>Save evidence</button>
    </div>
  );
}
