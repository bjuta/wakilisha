import React from "react";
import { EvidenceKind } from "../types";
import LinkWorkspace from "./workspaces/LinkWorkspace";
import CitationWorkspace from "./workspaces/CitationWorkspace";
import ChartDataWorkspace from "./workspaces/ChartDataWorkspace";
import PlaylistDataWorkspace from "./workspaces/PlaylistDataWorkspace";
import SocialPostWorkspace from "./workspaces/SocialPostWorkspace";
import ContributorMemoryWorkspace from "./workspaces/ContributorMemoryWorkspace";
import PersonalNoteWorkspace from "./workspaces/PersonalNoteWorkspace";
import GenericEvidenceWorkspace from "./workspaces/GenericEvidenceWorkspace";

type EvidenceWorkspaceProps = {
  kind: EvidenceKind;
  initialMetadata?: any;
  onSave: (metadata: any, producedWork: string) => Promise<void>;
};

export default function EvidenceWorkspace({
  kind,
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps) {
  switch (kind) {
    case "link":
      return <LinkWorkspace initialMetadata={initialMetadata} onSave={onSave} />;
    case "citation":
      return <CitationWorkspace initialMetadata={initialMetadata} onSave={onSave} />;
    case "chart_data":
      return <ChartDataWorkspace initialMetadata={initialMetadata} onSave={onSave} />;
    case "playlist_data":
      return <PlaylistDataWorkspace initialMetadata={initialMetadata} onSave={onSave} />;
    case "social_post":
      return <SocialPostWorkspace initialMetadata={initialMetadata} onSave={onSave} />;
    case "contributor_memory":
      return <ContributorMemoryWorkspace initialMetadata={initialMetadata} onSave={onSave} />;
    case "personal_note":
      return <PersonalNoteWorkspace initialMetadata={initialMetadata} onSave={onSave} />;
    default:
      return <GenericEvidenceWorkspace initialMetadata={initialMetadata} onSave={onSave} />;
  }
}
