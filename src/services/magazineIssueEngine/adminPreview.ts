import type { IssueWithDetails } from '../magazineIssueProduction';
import type { MagazineIssue, MagazineIssueArticle, MagazineSpread } from '../magazineIssues';
import { buildMagazineIssueExperience } from './index';

function safeDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function sectionFromIssue(issue: IssueWithDetails, index: number): MagazineIssueArticle {
  const section = issue.sections[index];
  const publishedAt = issue.timeframe_start ?? issue.created_at;
  const title = section?.title || issue.title || `Issue section ${index + 1}`;
  return {
    id: section?.id ?? `${issue.id}-section-${index}`,
    slug: section?.spread_id ?? `${issue.slug}-section-${index}`,
    title,
    dek: section?.deck ?? issue.dek ?? '',
    body: section?.body ? [section.body] : [],
    author: 'WAKILISHA Editorial',
    date: publishedAt,
    readingTime: Math.max(2, Math.min(10, Math.round((section?.body?.length ?? 600) / 700))),
    section: section?.section_type ?? issue.issue_type ?? 'Issue',
    tags: [issue.issue_type, section?.layout, section?.section_type].filter(Boolean) as string[],
    heroUrl: undefined,
    sourceDate: safeDate(publishedAt),
    score: Math.max(20, 52 - index * 4),
    role: index === 0 ? 'core' : 'support',
    canonicalSection: section?.section_type ?? issue.issue_type ?? 'Field Notes',
  } as MagazineIssueArticle;
}

function makeFallbackArticle(issue: IssueWithDetails): MagazineIssueArticle {
  const date = issue.timeframe_start ?? issue.created_at;
  return {
    id: `${issue.id}-fallback-article`,
    slug: issue.slug,
    title: issue.title,
    dek: issue.dek ?? '',
    body: issue.dek ? [issue.dek] : [],
    author: 'WAKILISHA Editorial',
    date,
    readingTime: 3,
    section: issue.issue_type || 'Issue',
    tags: [issue.issue_type, issue.visual_family, issue.treatment].filter(Boolean) as string[],
    heroUrl: undefined,
    sourceDate: safeDate(date),
    score: 32,
    role: 'support',
    canonicalSection: issue.issue_type || 'Field Notes',
  } as MagazineIssueArticle;
}

function productionSectionsToSpreads(issue: IssueWithDetails, articles: MagazineIssueArticle[]): MagazineSpread[] {
  if (issue.sections.length === 0) {
    return [
      {
        id: `${issue.id}-admin-preview`,
        type: 'article-list',
        title: issue.title,
        deck: issue.dek ?? undefined,
        articles,
        variant: issue.treatment ?? undefined,
        metadata: {
          source: 'production-preview',
          status: issue.status,
        },
      },
    ];
  }

  return issue.sections.map((section, index) => ({
    id: section.id,
    type: 'article-list',
    title: section.title,
    deck: section.deck ?? undefined,
    section: section.section_type,
    articles: articles[index] ? [articles[index]] : [],
    variant: section.layout,
    metadata: {
      spreadId: section.spread_id,
      status: section.status,
      sortOrder: section.sort_order,
    },
  }));
}

export function productionIssueToMagazineIssue(issue: IssueWithDetails): MagazineIssue {
  const start = safeDate(issue.timeframe_start ?? issue.created_at);
  const end = safeDate(issue.timeframe_end ?? issue.updated_at ?? issue.created_at);
  const articles = issue.sections.length > 0
    ? issue.sections.map((_, index) => sectionFromIssue(issue, index))
    : [makeFallbackArticle(issue)];

  return {
    id: issue.id,
    issueNumber: 0,
    issueLabel: issue.title,
    slug: issue.slug,
    title: issue.title,
    subtitle: issue.issue_type,
    deck: issue.dek ?? '',
    sourceStartDate: start,
    sourceEndDate: end,
    sourceWindowLabel: `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
    status: issue.status === 'published' ? 'published' : 'draft',
    coverTheme: issue.visual_family ?? issue.issue_type ?? 'production-preview',
    primaryVerticals: Array.from(new Set(issue.sections.map((section) => section.section_type).filter(Boolean))).slice(0, 4),
    articles,
    excludedArticles: [],
    spreads: productionSectionsToSpreads(issue, articles),
    generatedFromRange: false,
  };
}

export function buildAdminPreviewIssueExperience(issue: IssueWithDetails) {
  const normalizedIssue = productionIssueToMagazineIssue(issue);
  return buildMagazineIssueExperience(normalizedIssue);
}

export function buildAdminPreviewQualityNote(issue: IssueWithDetails): string {
  return buildAdminPreviewIssueExperience(issue).adminQualityNote;
}
