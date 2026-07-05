import React, { useState } from "react";
import { EvidenceWorkspaceProps } from "./workspaceTypes";

export default function GenericEvidenceWorkspace({
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps) {
  const [producedWork, setProducedWork] = useState(
    (initialMetadata?.producedWork as string) || ""
  );

  async function handleSave() {
    await onSave(initialMetadata || {}, producedWork);
  }

  return (
    <div>
      <h2>Generic Evidence Workspace</h2>
      <p>This is a fallback workspace for unsupported evidence kinds.</p>
      <label>
        Produced Work / Source Summary
        <input
          type="text"
          value={producedWork}
          onChange={(e) => setProducedWork(e.target.value)}
        />
      </label>
      <button onClick={handleSave}>Save evidence</button>
    </div>
  );
}
