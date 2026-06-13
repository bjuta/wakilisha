// ── Universal Guide Section Types ──
// Every section has a `type` and `data` shape.
// The GuideSectionRenderer maps type → component.

export type GuideSectionType =
  | "hero"
  | "hero_dossier"
  | "hero_literary"
  | "quote"
  | "context_columns"
  | "numbered_chapters"
  | "preview_mosaic"
  | "curator_profile"
  | "pavilions_grid"
  | "focus_cards"
  | "sample_pages"
  | "download_form"
  | "numbered_list"
  | "discipline_grid"
  | "watchlist"
  | "timeline"
  | "follow_form"
  | "share_bar"
  | "prose_article"
  | "next_chapter"
  | "page_footer"
  | "artists_grid";

/* ─── Shared sub-types ─── */

export interface StatItem {
  number: string;
  label: string;
}

export interface ButtonItem {
  label: string;
  url: string;
  variant: "primary" | "secondary";
}

export interface FactItem {
  label: string;
  value: string;
}

export interface ActionItem {
  label: string;
  href: string;
  primary: boolean;
}

export interface ColumnItem {
  title: string;
  body: string;
}

export interface PreviewCard {
  number: string;
  label: string;
  title: string;
  description: string;
  image: string;
  size?: "large";
}

export interface TimelineEntry {
  year: string;
  event: string;
}

export interface PavilionItem {
  number: string;
  country: string;
  title: string;
  type: string;
  venue: string;
  route: string;
  flag: string;
  commissioner: string;
  curator: string;
  exhibitors: string;
  context: string;
  why: string;
  how_to_read?: string;
  howToRead?: string;
}

export interface FocusCard {
  number: string;
  label: string;
  title: string;
  description: string;
  image: string;
}

export interface SamplePage {
  image: string;
  alt: string;
}

export interface NumberedItem {
  number: string;
  name: string;
  description?: string;
  route?: string;
}

export interface DisciplineItem {
  number: string;
  name: string;
}

export interface WatchlistItem {
  number: string;
  signal: string;
  question: string;
  body: string;
}

export interface TimelineEvent {
  date: string;
  event: string;
}

export interface ChapterItem {
  number: string;
  title: string;
  description: string;
}

export interface ArtistItem {
  name: string;
  origin: string;
  location: string;
  image: string;
}

export interface ChapterSection {
  id: string;
  num: string;
  title: string;
  paragraphs: ProseParagraph[];
  pullQuote?: string;
  aside?: { kicker: string; title: string; body: string };
  paragraphsAfter?: ProseParagraph[];
  paragraphsAfterPull?: ProseParagraph[];
  listBurst?: string[];
  epigraph?: { text: string; cite: string };
  label?: string;
}

export interface ProseParagraph {
  html: string;
  isDropCap?: boolean;
  isCentered?: boolean;
}

export interface TOCItem {
  id: string;
  label: string;
  subtitle?: string;
  num: string;
}

export interface PersonaOption {
  value: string;
  label: string;
}

export interface FormConfig {
  heading: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  personaLabel?: string;
  personaOptions?: PersonaOption[];
  consentLabel: string;
  submitLabel: string;
}

/* ─── Section data shapes ─── */

export interface HeroData {
  heroImage?: string;
  hero_image?: string;
  mastheadImage?: string;
  masthead_image?: string;
  issueBadge?: string;
  issue_badge?: string;
  badge?: string;
  title: string;
  kicker?: string;
  curatorLabel?: string;
  curator_label?: string;
  curatorName?: string;
  curator_name?: string;
  eventDate?: string;
  event_date?: string;
  locations?: string;
  subtitle?: string;
  stats?: StatItem[];
  facts?: FactItem[];
  buttons?: ButtonItem[];
  actions?: ActionItem[];
  // Literary hero
  lede?: string;
  author?: { name: string; url: string };
  publisher?: string;
  coverImage?: string;
  cover_image?: string;
}

export interface QuoteData {
  text?: string;
  quote?: string;
  attribution: string;
}

export interface ContextColumnsData {
  eyebrow: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  label?: string;
  columns: ColumnItem[];
}

export interface NumberedChaptersData {
  label: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  chaptersLabel?: string;
  chapters_label?: string;
  prose?: string[];
  chapters: ChapterItem[];
}

export interface PreviewMosaicData {
  eyebrow: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  label?: string;
  cards: PreviewCard[];
}

export interface CuratorProfileData {
  eyebrow: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  image: string;
  bio: string;
  timeline: TimelineEntry[];
}

export interface PavilionsGridData {
  eyebrow: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  label?: string;
  pavilions: PavilionItem[];
  fieldNote?: string;
  field_note?: string;
}

export interface FocusCardsData {
  number: string;
  eyebrow: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  description: string;
  cards: FocusCard[];
  note: string;
}

export interface SamplePagesData {
  eyebrow: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  label?: string;
  pages: SamplePage[];
}

export interface DownloadFormData {
  eyebrow: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  description: string;
  features: string[];
  formAction?: string;
}

export interface NumberedListData {
  label: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  items: NumberedItem[];
}

export interface DisciplineGridData {
  label: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  note?: string;
  items: DisciplineItem[];
}

export interface WatchlistData {
  label: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  items: WatchlistItem[];
}

export interface TimelineData {
  label: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  note?: string;
  events: TimelineEvent[];
}

export interface FollowFormData {
  label: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  copy: string[];
  form: FormConfig;
}

export interface ShareBarData {
  url: string;
  title: string;
  description: string;
  position?: "top" | "bottom";
}

export interface ProseArticleData {
  label?: string;
  num?: string;
  title?: string;
  epigraph?: { text: string; cite: string };
  toc?: TOCItem[];
  chapters: ChapterSection[];
  nextChapter?: {
    title: string;
    subtitle: string;
  };
  publisher?: string;
  issue?: string;
  shareUrl?: string;
  shareTitle?: string;
  shareDescription?: string;
}

export interface NextChapterData {
  title: string;
  subtitle: string;
}

export interface PageFooterData {
  publisher?: string;
  issue?: string;
  section?: string;
}

export interface ArtistsGridData {
  eyebrow: string;
  title: string;
  titleItalic?: string;
  title_italic?: string;
  label?: string;
  artists: ArtistItem[];
}

/* ─── The universal section type ─── */

export interface GuideSection {
  key: string;
  title: string;
  type: GuideSectionType;
  data: Record<string, unknown>;
}

export interface GuidePageRecord {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  guide_format?: string;
  color_var?: string;
  icon?: string;
  framing?: string;
  hero_url?: string;
  sections: GuideSection[];
  status: string;
  published_at?: string;
  updated_at?: string;
}