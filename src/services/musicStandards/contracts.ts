export type MusicMappingClassification =
  | "exact"
  | "normalized_by_standard_rule"
  | "partial"
  | "unsupported"
  | "review_required"
  | "not_applicable";

export interface MusicMappingLoss {
  path: string;
  classification: MusicMappingClassification;
  detail: string;
}

export interface MusicStandardAdapterEnvelope<TData> {
  adapterKey: string;
  adapterVersion: number;
  externalStandard: string;
  externalVersion: string;
  messageOrRecordType: string;
  sourceParty: string | null;
  sourceReference: string | null;
  observedAt: string | null;
  payloadFingerprint: string;
  mappingProfile: string;
  mappingResult: "mapped" | "partial" | "review_required" | "rejected";
  lossFlags: MusicMappingLoss[];
  data: TData;
}
