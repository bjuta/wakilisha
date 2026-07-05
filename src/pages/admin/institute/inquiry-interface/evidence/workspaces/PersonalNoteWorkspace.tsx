import React, { useState } from "react";
import { EvidenceWorkspaceProps } from "./workspaceTypes";

export default function PersonalNoteWorkspace({
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps<{
  note?: string;
  period?: string;
  noteType?: string;
  followUpNeeded?: string;
  linkToEvidenceNote?: string;
}>) {
  const [note, setNote] = useState(initialMetadata?.note || "");
  const [period, setPeriod] = useState(initialMetadata?.period || "");
  const [noteType, setNoteType] = useState(initialMetadata?.noteType || "");
  const [followUpNeeded, setFollowUpNeeded] = useState(initialMetadata?.followUpNeeded || "");
  const [linkToEvidenceNote, setLinkToEvidenceNote] = useState(
    initialMetadata?.linkToEvidenceNote || ""
  );

  const [producedWork, setProducedWork] = useState(note);

  async function handleSave() {
    await onSave(
      {
        note,
        period,
        noteType,
        followUpNeeded,
        linkToEvidenceNote,
      },
      producedWork
    );
  }

  return (
    <div>
      <h2>Personal Note Workspace</h2>
      <p>Purpose: A light workspace for thoughts that are not yet evidence.</p>

      <section>
        <h3>Note</h3>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </section>

      <section>
        <h3>Period (if relevant)</h3>
        <input type="text" value={period} onChange={(e) => setPeriod(e.target.value)} />
      </section>

      <section>
        <h3>Note type</h3>
        <select value={noteType} onChange={(e) => setNoteType(e.target.value)}>
          <option value="">Select note type</option>
          <option value="context">Context</option>
          <option value="hypothesis">Hypothesis</option>
          <option value="doubt">Doubt</option>
          <option value="task">Task</option>
        </select>
      </section>

      <section>
        <h3>Follow-up needed</h3>
        <textarea
          value={followUpNeeded}
          onChange={(e) => setFollowUpNeeded(e.target.value)}
        />
      </section>

      <section>
        <h3>Link to evidence note</h3>
        <textarea
          value={linkToEvidenceNote}
          onChange={(e) => setLinkToEvidenceNote(e.target.value)}
        />
      </section>

      <section>
        <h3>Assistant inspection (not wired yet)</h3>
        <p>The assistant will later inspect personal note metadata and context.</p>
      </section>

      <button onClick={handleSave}>Save evidence</button>
    </div>
  );
}
