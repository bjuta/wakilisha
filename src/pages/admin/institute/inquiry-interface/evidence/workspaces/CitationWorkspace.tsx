import React, { useState } from "react";
import { EvidenceWorkspaceProps } from "./workspaceTypes";

export default function CitationWorkspace({
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps<{
  sourceTitle?: string;
  authorOrInstitution?: string;
  publisher?: string;
  sourceType?: string;
  dateOrPeriod?: string;
  quoteOrExcerpt?: string;
  locator?: string;
  archiveReference?: string;
  citationQualityNote?: string;
  publicUseReadiness?: string;
  corroborationNeeded?: string;
}>) {
  const [sourceTitle, setSourceTitle] = useState(initialMetadata?.sourceTitle || "");
  const [authorOrInstitution, setAuthorOrInstitution] = useState(
    initialMetadata?.authorOrInstitution || ""
  );
  const [publisher, setPublisher] = useState(initialMetadata?.publisher || "");
  const [sourceType, setSourceType] = useState(initialMetadata?.sourceType || "");
  const [dateOrPeriod, setDateOrPeriod] = useState(initialMetadata?.dateOrPeriod || "");
  const [quoteOrExcerpt, setQuoteOrExcerpt] = useState(initialMetadata?.quoteOrExcerpt || "");
  const [locator, setLocator] = useState(initialMetadata?.locator || "");
  const [archiveReference, setArchiveReference] = useState(
    initialMetadata?.archiveReference || ""
  );
  const [citationQualityNote, setCitationQualityNote] = useState(
    initialMetadata?.citationQualityNote || ""
  );
  const [publicUseReadiness, setPublicUseReadiness] = useState(
    initialMetadata?.publicUseReadiness || ""
  );
  const [corroborationNeeded, setCorroborationNeeded] = useState(
    initialMetadata?.corroborationNeeded || ""
  );

  const [producedWork, setProducedWork] = useState(sourceTitle);

  async function handleSave() {
    await onSave(
      {
        sourceTitle,
        authorOrInstitution,
        publisher,
        sourceType,
        dateOrPeriod,
        quoteOrExcerpt,
        locator,
        archiveReference,
        citationQualityNote,
        publicUseReadiness,
        corroborationNeeded,
      },
      producedWork
    );
  }

  return (
    <div>
      <h2>Citation Workspace</h2>
      <p>Purpose: A serious archive and research citation desk.</p>

      <section>
        <h3>Source</h3>
        <label>
          Source title
          <input
            type="text"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
          />
        </label>
        <label>
          Author or institution
          <input
            type="text"
            value={authorOrInstitution}
            onChange={(e) => setAuthorOrInstitution(e.target.value)}
          />
        </label>
        <label>
          Publisher
          <input
            type="text"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
          />
        </label>
        <label>
          Source type
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            <option value="">Select type</option>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="tertiary">Tertiary</option>
            <option value="archive">Archive</option>
            <option value="interview">Interview</option>
            <option value="oral_history">Oral history</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Date or period
          <input
            type="text"
            value={dateOrPeriod}
            onChange={(e) => setDateOrPeriod(e.target.value)}
          />
        </label>
        <label>
          Quote or excerpt
          <textarea
            value={quoteOrExcerpt}
            onChange={(e) => setQuoteOrExcerpt(e.target.value)}
          />
        </label>
        <label>
          Locator (page, timestamp, edition, etc.)
          <input
            type="text"
            value={locator}
            onChange={(e) => setLocator(e.target.value)}
          />
        </label>
        <label>
          Archive URL or reference
          <input
            type="text"
            value={archiveReference}
            onChange={(e) => setArchiveReference(e.target.value)}
          />
        </label>
      </section>

      <section>
        <h3>Human review</h3>
        <label>
          Citation quality note
          <textarea
            value={citationQualityNote}
            onChange={(e) => setCitationQualityNote(e.target.value)}
          />
        </label>
        <label>
          Public-use readiness
          <textarea
            value={publicUseReadiness}
            onChange={(e) => setPublicUseReadiness(e.target.value)}
          />
        </label>
        <label>
          What needs corroboration
          <textarea
            value={corroborationNeeded}
            onChange={(e) => setCorroborationNeeded(e.target.value)}
          />
        </label>
      </section>

      <section>
        <h3>Assistant inspection (not wired yet)</h3>
        <p>The assistant will later inspect citation quality and metadata.</p>
      </section>

      <button onClick={handleSave}>Save evidence</button>
    </div>
  );
}
