import { lazy } from "react";

export const NotFound = lazy(
  () => import("../pages/NotFound"),
);

export const ResetPasswordPage = lazy(
  () => import("../pages/auth/reset-password/page"),
);

export const AuthorProfilePage = lazy(
  () => import("../pages/authors/detail/page"),
);

export const PersonDetailPage = lazy(
  () => import("../pages/people/detail/page"),
);

export const LegacyArticleRedirect = lazy(
  () => import("../pages/LegacyArticleRedirect"),
);

export const PublicApiDocsPage = lazy(
  () => import("../pages/api-docs/page"),
);

export const PublicProfilePage = lazy(
  () => import("../pages/profile/public/page"),
);

export const PublicBriefingsPage = lazy(
  () => import("../pages/briefings/page"),
);

export const BriefingConfirmPage = lazy(
  () => import("../pages/briefing/confirm/page"),
);

export const BriefingUnsubscribePage = lazy(
  () => import("../pages/briefing/unsubscribe/page"),
);

export const BriefingPreferencesPage = lazy(
  () => import("../pages/briefing/preferences/page"),
);

export const BriefingIssuePage = lazy(
  () => import("../pages/briefing/issue/page"),
);

export const PublicPlaylistsPage = lazy(
  () => import("../pages/playlists/page"),
);

export const PublicPlaylistDetailPage = lazy(
  () => import("../pages/playlists/detail/page"),
);

export const ChartsDirectory = lazy(
  () => import("../pages/charts/directory/page"),
);

export const ChartEdition = lazy(
  () => import("../pages/charts/edition/page"),
);

export const Artists = lazy(
  () => import("../pages/artists/page"),
);

export const ArtistDetail = lazy(
  () => import("../pages/artists/detail/page"),
);

export const Releases = lazy(
  () => import("../pages/releases/page"),
);

export const ReleaseDetail = lazy(
  () => import("../pages/releases/detail/page"),
);

export const MobileReleaseDetail = lazy(
  () => import("../pages/mobile/releases/detail/page"),
);

export const Genres = lazy(
  () => import("../pages/genres/page"),
);

export const GenreDetail = lazy(
  () => import("../pages/genres/detail/page"),
);

export const Labels = lazy(
  () => import("../pages/labels/page"),
);

export const LabelDetail = lazy(
  () => import("../pages/labels/detail/page"),
);

export const ArticlePage = lazy(
  () => import("../pages/magazine/article/page"),
);

export const PreviewPage = lazy(
  () => import("../pages/preview/page"),
);

export const TrackDetail = lazy(
  () => import("../pages/tracks/detail/page"),
);

export const LyricContribution = lazy(
  () => import("../pages/tracks/lyrics/contribute/page"),
);

export const ProfilePage = lazy(
  () => import("../pages/profile/page"),
);

export const MobileProfilePage = lazy(
  () => import("../pages/mobile/profile/page"),
);

export const SettingsPage = lazy(
  () => import("../pages/settings/page"),
);

export const MobileSettingsPage = lazy(
  () => import("../pages/mobile/settings/page"),
);

export const Search = lazy(
  () => import("../pages/search/page"),
);

export const GuidesPage = lazy(
  () => import("../pages/guides/page"),
);

export const GuideDetailPage = lazy(
  () => import("../pages/guides/detail/page"),
);

export const VeniceFieldGuidePage = lazy(
  () => import("../pages/guides/field-guide/page"),
);

export const MobileChartEdition = lazy(
  () => import("../pages/mobile/charts/edition/page"),
);

export const MobileGenres = lazy(
  () => import("../pages/mobile/genres/page"),
);

export const MobileLabels = lazy(
  () => import("../pages/mobile/labels/page"),
);

export const MobileArticlePage = lazy(
  () => import("../pages/mobile/magazine/article/page"),
);

export const AuthPage = lazy(
  () => import("../pages/auth/page"),
);

export const CategoriesIndex = lazy(
  () => import("../pages/categories/page"),
);

export const CategoryDetail = lazy(
  () => import("../pages/categories/detail/page"),
);

export const TagsIndex = lazy(
  () => import("../pages/tags/page"),
);

export const TagDetail = lazy(
  () => import("../pages/tags/detail/page"),
);

export const AboutPage = lazy(
  () => import("../pages/about/page"),
);

export const ContactPage = lazy(
  () => import("../pages/contact/page"),
);

export const FaqsPage = lazy(
  () => import("../pages/faqs/page"),
);

export const PrivacyPage = lazy(
  () => import("../pages/privacy/page"),
);

export const TermsPage = lazy(
  () => import("../pages/terms/page"),
);

export const MobileFullPlayer = lazy(
  () =>
    import("@/components/mobile/MobileFullPlayer").then(
      ({ MobileFullPlayer }) => ({
        default: MobileFullPlayer,
      }),
    ),
);
