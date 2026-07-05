import React, { useState } from "react";
import { EvidenceWorkspaceProps } from "./workspaceTypes";

export default function ContributorMemoryWorkspace({
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps<{
  sourcePerson?: string;
  roleContext?: string;
  sceneRelationship?: string;
  memoryText?: string;
  periodDescribed?: string;
  place?: string;
  howTheyKnow?: string;
  consentUseLevel?: string;
  attributionPreference?: string;
  followUpQuestions?: string;
  corroborationNeeded?: string;
  sensitivityLevel?: string;
}>) {
  const [sourcePerson, setSourcePerson] = useState(initialMetadata?.sourcePerson || "");
  const [roleContext, setRoleContext] = useState(initialMetadata?.roleContext || "");
  const [sceneRelationship, setSceneRelationship] = useState(
    initialMetadata?.sceneRelationship || ""
  );
  const [memoryText, setMemoryText] = useState(initialMetadata?.memoryText || "");
  const [periodDescribed, setPeriodDescribed] = useState(initialMetadata?.periodDescribed || "");
  const [place, setPlace] = useState(initialMetadata?.place || "");
  const [howTheyKnow, setHowTheyKnow] = useState(initialMetadata?.howTheyKnow || "");
  const [consentUseLevel, setConsentUseLevel] = useState(initialMetadata?.consentUseLevel || "");
  const [attributionPreference, setAttributionPreference] = useState(
    initialMetadata?.attributionPreference || ""
  );
  const [followUpQuestions, setFollowUpQuestions] = useState(
    initialMetadata?.followUpQuestions || ""
  );
  const [corroborationNeeded, setCorroborationNeeded] = useState(
    initialMetadata?.corroborationNeeded || ""
  );
  const [sensitivityLevel, setSensitivityLevel] = useState(initialMetadata?.sensitivityLevel || "");

  const [producedWork, setProducedWork] = useState(
    `${sourcePerson} memory`.trim()
  );

  async function handleSave() {
    await onSave(
      {
        sourcePerson,
        roleContext,
        sceneRelationship,
        memoryText,
        periodDescribed,
        place,
        howTheyKnow,
        consentUseLevel,
        attributionPreference,
        followUpQuestions,
        corroborationNeeded,
        sensitivityLevel,
      },
      producedWork
    );
  }

  return (
    <div>
      <h2>Contributor Memory Workspace</h2>
      <p>Purpose: A consent-aware oral-history style workspace.</p>

      <section>
        <h3>Source and context</h3>
        <label>
          Source/person
          <input
            type="text"
            value={sourcePerson}
            onChange={(e) => setSourcePerson(e.target.value)}
          />
        </label>
        <label>
          Role or context
          <input
            type="text"
            value={roleContext}
            onChange={(e) => setRoleContext(e.target.value)}
          />
        </label>
        <label>
          Relationship to the scene
          <input
            type="text"
            value={sceneRelationship}
            onChange={(e) => setSceneRelationship(e.target.value)}
          />
        </label>
      </section>

      <section>
        <h3>Memory text</h3>
        <textarea
          value={memoryText}
          onChange={(e) => setMemoryText(e.target.value)}
        />
      </section>

      <section>
        <h3>Period described</h3>
        <input
          type="text"
          value={periodDescribed}
          onChange={(e) => setPeriodDescribed(e.target.value)}
        />
      </section>

      <section>
        <h3>Place (if relevant)</h3>
        <input type="text" value={place} onChange={(e) => setPlace(e.target.value)} />
      </section>

      <section>
        <h3>How they know</h3>
        <input
          type="text"
          value={howTheyKnow}
          onChange={(e) => setHowTheyKnow(e.target.value)}
        />
      </section>

      <section>
        <h3>Consent and use level</h3>
        <select
          value={consentUseLevel}
          onChange={(e) => setConsentUseLevel(e.target.value)}
        >
          <option value="">Select consent/use level</option>
          <option value="internal">Internal</option>
          <option value="anonymous">Anonymous</option>
          <option value="public">Public</option>
          <option value="not_yet">Not yet</option>
        </select>
      </section>

      <section>
        <h3>Attribution preference</h3>
        <input
          type="text"
          value={attributionPreference}
          onChange={(e) => setAttributionPreference(e.target.value)}
        />
      </section>

      <section>
        <h3>Follow-up questions</h3>
        <textarea
          value={followUpQuestions}
          onChange={(e) => setFollowUpQuestions(e.target.value)}
        />
      </section>

      <section>
        <h3>Corroboration needed</h3>
        <textarea
          value={corroborationNeeded}
          onChange={(e) => setCorroborationNeeded(e.target.value)}
        />
      </section>

      <section>
        <h3>Sensitivity level</h3>
        <input
          type="text"
          value={sensitivityLevel}
          onChange={(e) => setSensitivityLevel(e.target.value)}
        />
      </section>

      <section>
        <h3>Assistant inspection (not wired yet)</h3>
        <p>The assistant will later inspect contributor memory metadata and context.</p>
      </section>

      <section>
        <h3>Review</h3>
        <p>Consent, sensitivity, corroboration.</p>
      </section>

      <button onClick={handleSave}>Save evidence</button>
    </div>
  );
}
