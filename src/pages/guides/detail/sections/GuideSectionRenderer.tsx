import type { GuideSection, GuideSectionType } from "../sectionTypes";
import HeroSection from "./HeroSection";
import QuoteSection from "./QuoteSection";
import ContextColumnsSection from "./ContextColumnsSection";
import NumberedChaptersSection from "./NumberedChaptersSection";
import PreviewMosaicSection from "./PreviewMosaicSection";
import CuratorProfileSection from "./CuratorProfileSection";
import PavilionsGridSection from "./PavilionsGridSection";
import FocusCardsSection from "./FocusCardsSection";
import SamplePagesSection from "./SamplePagesSection";
import DownloadFormSection from "./DownloadFormSection";
import NumberedListSection from "./NumberedListSection";
import DisciplineGridSection from "./DisciplineGridSection";
import WatchlistSection from "./WatchlistSection";
import TimelineSection from "./TimelineSection";
import FollowFormSection from "./FollowFormSection";
import ShareBarSection from "./ShareBarSection";
import ProseArticleSection from "./ProseArticleSection";
import NextChapterSection from "./NextChapterSection";
import PageFooterSection from "./PageFooterSection";
import ArtistsGridSection from "./ArtistsGridSection";

interface GuideSectionRendererProps {
  section: GuideSection;
  // Pass-through props for special sections
  proseFontSize?: number;
  onProseFontChange?: (size: number) => void;
}

const SECTION_COMPONENTS: Record<GuideSectionType, React.ComponentType<{ data: any; variant?: string; fontSize?: number; onFontChange?: (size: number) => void }>> = {
  hero: HeroSection,
  hero_dossier: HeroSection,
  hero_literary: HeroSection,
  quote: QuoteSection,
  context_columns: ContextColumnsSection,
  numbered_chapters: NumberedChaptersSection,
  preview_mosaic: PreviewMosaicSection,
  curator_profile: CuratorProfileSection,
  pavilions_grid: PavilionsGridSection,
  focus_cards: FocusCardsSection,
  sample_pages: SamplePagesSection,
  download_form: DownloadFormSection,
  numbered_list: NumberedListSection,
  discipline_grid: DisciplineGridSection,
  watchlist: WatchlistSection,
  timeline: TimelineSection,
  follow_form: FollowFormSection,
  share_bar: ShareBarSection,
  prose_article: ProseArticleSection,
  next_chapter: NextChapterSection,
  page_footer: PageFooterSection,
  artists_grid: ArtistsGridSection,
};

export default function GuideSectionRenderer({ section, proseFontSize, onProseFontChange }: GuideSectionRendererProps) {
  const Component = SECTION_COMPONENTS[section.type];

  if (!Component) {
    console.warn(`Unknown section type: ${section.type}`);
    return null;
  }

  // Special handling for hero variants
  if (section.type === "hero_dossier") {
    return <Component data={section.data} variant="dossier" />;
  }
  if (section.type === "hero_literary") {
    return <Component data={section.data} variant="literary" />;
  }

  // Special handling for prose_article
  if (section.type === "prose_article") {
    return <Component data={section.data} fontSize={proseFontSize} onFontChange={onProseFontChange} />;
  }

  return <Component data={section.data} />;
}