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

export type SectionCount = {
  section: string;
  count: number;
};

export type IssueArticleCluster = {
  sound: MagazineIssueArticle[];
  scene: MagazineIssueArticle[];
  memory: MagazineIssueArticle[];
  systems: MagazineIssueArticle[];
  guide: MagazineIssueArticle[];
  argument: MagazineIssueArticle[];
  image: MagazineIssueArticle[];
  review: MagazineIssueArticle[];
};

export type IssueFacts = {
  issue: MagazineIssue;
  issueNumber: number;
  issueLabel: string;
  title: string;
  subtitle?: string;
  deck?: string;
  articleCount: number;
  coreCount: number;
  supportCount: number;
  excludedCount: number;
  dominantSection?: string;
  secondarySection?: string;
  sectionMix: SectionCount[];
  topArticle?: MagazineIssueArticle;
  leadArticles: MagazineIssueArticle[];
  clusters: IssueArticleCluster;
  hasStrongImage: boolean;
  hasStrongSound: boolean;
  hasStrongPlace: boolean;
  hasStrongArgument: boolean;
  hasStrongGuide: boolean;
  hasStrongReview: boolean;
  hasStrongMemory: boolean;
  hasStrongSystems: boolean;
  tension?: string;
  thinness: IssueThinness;
};

export type IssueScore = {
  archetype: IssueArchetype;
  mood: IssueMood;
  coverVariant: IssueCoverVariant;
  editorNoteMode: EditorNoteMode;
  featureVisualMode: FeatureVisualMode;
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