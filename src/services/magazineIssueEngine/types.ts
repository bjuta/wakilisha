import type { MagazineIssue, MagazineIssueArticle } from '../magazineIssues';

export type IssueArchetype =
  | 'listeningIssue'
  | 'sceneIssue'
  | 'recordReviewIssue'
  | 'fieldGuideIssue'
  | 'memoryIssue'
  | 'systemsIssue'
  | 'imageIssue'
  | 'argumentIssue'
  | 'mixedCultureIssue'
  | 'thinIssue';

export type IssueMood = 'night' | 'paper' | 'travel' | 'signal' | 'archive' | 'image';
export type IssueCoverVariant = 'seal-key-visual' | 'image-trace' | 'paper-cover' | 'signal-grid' | 'type-cover';
export type EditorNoteMode = 'letter' | 'one-line' | 'image-note' | 'song-note' | 'playlist-note';
export type FeatureVisualMode = 'issue-one-route' | 'photo-led' | 'type-led' | 'archive-board' | 'signal-board' | 'paper-file';
export type IssueThinness = 'rich' | 'medium' | 'thin';

export type IssueSignalName =
  | 'sound'
  | 'scene'
  | 'memory'
  | 'systems'
  | 'guide'
  | 'argument'
  | 'image'
  | 'review';

export type IssueInteractionPattern =
  | 'listeningPath'
  | 'sceneRoute'
  | 'recordStack'
  | 'fieldGuide'
  | 'memoryFragments'
  | 'signalBoard'
  | 'imageGallery'
  | 'argumentStack'
  | 'constellation'
  | 'singleThread';

export type IssueArchetypeProfile = {
  archetype: IssueArchetype;
  label: string;
  publicName: string;
  signal?: IssueSignalName;
  mood: IssueMood;
  coverVariant: IssueCoverVariant;
  editorNoteMode: EditorNoteMode;
  featureVisualMode: FeatureVisualMode;
  interactionPattern: IssueInteractionPattern;
  readerPromise: string;
  visualPromise: string;
  openingVerb: string;
  pathVerb: string;
  cta: string;
  surfaceTone: string;
  scoreBias: number;
  minSignalScore: number;
};

export type SectionCount = {
  section: string;
  count: number;
  weight: number;
};

export type IssueArticleCluster = Record<IssueSignalName, MagazineIssueArticle[]>;

export type IssueRoleCounts = {
  core: number;
  support: number;
  backup: number;
  needsReview: number;
  stale: number;
  excluded: number;
};

export type IssueSignalScore = {
  signal: IssueSignalName;
  label: string;
  count: number;
  score: number;
  articles: MagazineIssueArticle[];
};

export type IssueTension = {
  primary: IssueSignalName;
  secondary?: IssueSignalName;
  label: string;
  description: string;
};

export type IssueReadingDoor = {
  mode: IssueSignalName | 'mixed' | 'thin';
  title: string;
  reason: string;
  article?: MagazineIssueArticle;
};

export type IssueFacts = {
  issue: MagazineIssue;
  issueNumber: number;
  issueLabel: string;
  title: string;
  subtitle?: string;
  deck?: string;
  articleCount: number;
  usableArticles: MagazineIssueArticle[];
  heldArticles: MagazineIssueArticle[];
  coreCount: number;
  supportCount: number;
  excludedCount: number;
  roleCounts: IssueRoleCounts;
  dominantSection?: string;
  secondarySection?: string;
  topSections: string[];
  sectionMix: SectionCount[];
  sectionEntropy: number;
  hasBalancedMix: boolean;
  hasSingleDominantSection: boolean;
  topArticle?: MagazineIssueArticle;
  topArticleReason?: string;
  featureCandidate?: MagazineIssueArticle;
  leadArticles: MagazineIssueArticle[];
  leadArticleTitles: string[];
  imageArticles: MagazineIssueArticle[];
  imageCount: number;
  clusters: IssueArticleCluster;
  signalScores: IssueSignalScore[];
  primarySignal?: IssueSignalScore;
  secondarySignal?: IssueSignalScore;
  hasStrongImage: boolean;
  hasStrongSound: boolean;
  hasStrongPlace: boolean;
  hasStrongArgument: boolean;
  hasStrongGuide: boolean;
  hasStrongReview: boolean;
  hasStrongMemory: boolean;
  hasStrongSystems: boolean;
  tension?: string;
  tensionDetail?: IssueTension;
  readingDoor: IssueReadingDoor;
  averageScore: number;
  scoreSpread: number;
  thinness: IssueThinness;
  factSummary: string[];
};

export type IssueScore = {
  archetype: IssueArchetype;
  profile: IssueArchetypeProfile;
  mood: IssueMood;
  coverVariant: IssueCoverVariant;
  editorNoteMode: EditorNoteMode;
  featureVisualMode: FeatureVisualMode;
  interactionPattern: IssueInteractionPattern;
  reasons: string[];
};

export type ReadingPathStep = {
  id: string;
  label: string;
  title: string;
  description: string;
  articleSlug?: string;
};

export type MagazineIssueEditor = {
  name: string;
  role: string;
};

export type MagazineIssueEditorNote = {
  mode: EditorNoteMode;
  eyebrow: string;
  title: string;
  body: string[];
  pull?: string;
  imageUrl?: string;
  imageCaption?: string;
  playlist?: MagazineIssueArticle[];
  lovedRelease?: MagazineIssueArticle;
};

export type MagazineIssueFeatureFrame = {
  eyebrow: string;
  routeLabel?: string;
  titlePrefix?: string;
  imageCaption?: string;
  publicFieldNote: string;
  adminDesignNote: string;
  /** @deprecated Public compatibility alias. Prefer publicFieldNote. */
  fieldNote: string;
};

export type MagazineIssueExperience = {
  issueMood: IssueMood;
  coverVariant: IssueCoverVariant;
  editor: MagazineIssueEditor;
  editorNote: MagazineIssueEditorNote;
  featureVisualMode: FeatureVisualMode;
  featureFrame: MagazineIssueFeatureFrame;
  contentsTitle: string;
  signalTitle: string;
  signalDeck: string;
  backMatterLine: string;
  archetype: IssueArchetype;
  archetypeLabel: string;
  interactionPattern: IssueInteractionPattern;
  readerPromise: string;
  visualPromise: string;
  issueCta: string;
  coverLine: string;
  cardBlurb: string;
  archiveBlurb: string;
  searchSnippet: string;
  seoDescription: string;
  contentsIntro: string;
  readingPath: ReadingPathStep[];
  signalReading: string;
  adminQualityNote: string;
  warnings: string[];
  factsUsed: string[];
  version: string;
};

export type MagazineIssueRecipeContext = {
  facts: IssueFacts;
  score: IssueScore;
};
