export type InquiryMaturityState =
  | "Raw"
  | "Needs Refinement"
  | "Ready for Inquiry"
  | "Paused as Doubt"
  | "Archived with Reason"
  | "Merged into Existing Inquiry"
  | "Rejected with Reason";

export type InquiryLifecycleState =
  | "Framing"
  | "Gathering Evidence"
  | "Weighing Evidence"
  | "Current Understanding Drafted"
  | "Needs Review"
  | "Ready to Share"
  | "Shared"
  | "Paused"
  | "Closed as Learning";

export type EvidenceFormat = "Text" | "Audio" | "Video" | "Photo" | "Source Link" | "Chart Data" | "Interview";
export type ConsentLevel = "Public" | "Internal" | "Review Only";
export type ReviewDecision = "Needs More Work" | "Approved for Internal Use" | "Public Safe" | "Paused as Doubt";

export type QuestionVersion = {
  id: string;
  label: string;
  question: string;
  reason: string;
};

export type EvidenceItem = {
  id: string;
  title: string;
  format: EvidenceFormat;
  summary: string;
  source: string;
  investmentTime: "Five minutes" | "Fifteen minutes" | "An hour";
  strengthensUnderstanding: boolean;
  publicSafe: boolean;
};

export type InquiryClaim = {
  id: string;
  text: string;
  evidenceId: string;
  confidence: number;
  uncertainty: string;
};

export type InquiryRelationship = {
  id: string;
  from: string;
  to: string;
  reason: string;
  evidenceId: string;
  confidence: number;
};

export type ContributorMemory = {
  id: string;
  format: EvidenceFormat;
  about: string;
  memory: string;
  howTheyKnow: string;
  consent: ConsentLevel;
};

export type InquiryCorrection = {
  id: string;
  correction: string;
  whyItMatters: string;
  proposedBy: string;
  status: "Open" | "Accepted" | "Rejected" | "Paused";
};

export type CurrentUnderstanding = {
  safeToSay: string;
  cannotSayYet: string;
  openDoubt: string;
  confidence: number;
};

export type ReviewRecord = {
  id: string;
  decision: ReviewDecision;
  reason: string;
};

export type InquiryEvent = {
  id: string;
  text: string;
};

export type InquiryLabState = {
  inquiryId: string;
  title: string;
  question: string;
  maturityState: InquiryMaturityState;
  lifecycleState: InquiryLifecycleState;
  linkedEntity: {
    type: "Artist" | "Track" | "Release" | "Label" | "Genre";
    name: string;
    slug: string;
  };
  questionVersions: QuestionVersion[];
  evidence: EvidenceItem[];
  claims: InquiryClaim[];
  relationships: InquiryRelationship[];
  memories: ContributorMemory[];
  corrections: InquiryCorrection[];
  currentUnderstanding: CurrentUnderstanding;
  reviews: ReviewRecord[];
  events: InquiryEvent[];
};
