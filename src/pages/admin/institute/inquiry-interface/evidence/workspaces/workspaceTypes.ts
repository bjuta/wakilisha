export type EvidenceWorkspaceProps<TMetadata = any> = {
  evidenceItemId?: string;
  initialMetadata?: TMetadata;
  onSave: (metadata: TMetadata, producedWork: string) => Promise<void>;
};

export type EvidenceKind =
  | "link"
  | "citation"
  | "chart_data"
  | "playlist_data"
  | "social_post"
  | "contributor_memory"
  | "personal_note"
  | "article"
  | "wakilisha_record"
  | "generic";
