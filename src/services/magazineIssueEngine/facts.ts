import type { MagazineIssue, MagazineIssueArticle } from '../magazineIssues';
import type { IssueArticleCluster, IssueFacts, SectionCount } from './types';
import { articleHaystack, articleSection, cleanText, distinctStrings } from './formatters';

const SOUND_SECTIONS = new Set(['The Sound of Now', 'On Record']);
const SCENE_SECTIONS = new Set(['The Scene Is a Place']);
const GUIDE_SECTIONS = new Set(['Field Notes']);
const MEMORY_SECTIONS = new Set(['Books, Language, Memory']);
const SYSTEM_SECTIONS = new Set(['Systems & Futures']);
const ARGUMENT_SECTIONS = new Set(['Sound, Conflict, Form']);

function byScoreDesc(a: MagazineIssueArticle, b: MagazineIssueArticle) {
  return b.score - a.score;
}

function sectionMix(articles: MagazineIssueArticle[]): SectionCount[] {
  return Array.from(
    articles.reduce((map, article) => {
      const key = articleSection(article);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => b.count - a.count || a.section.localeCompare(b.section));
}

function clusterArticles(articles: MagazineIssueArticle[]): IssueArticleCluster {
  const sorted = [...articles].sort(byScoreDesc);
  return {
    sound: sorted.filter((article) => SOUND_SECTIONS.has(articleSection(article))),
    scene: sorted.filter((article) => SCENE_SECTIONS.has(articleSection(article))),
    memory: sorted.filter((article) => MEMORY_SECTIONS.has(articleSection(article))),
    systems: sorted.filter((article) => SYSTEM_SECTIONS.has(articleSection(article))),
    guide: sorted.filter((article) => GUIDE_SECTIONS.has(articleSection(article))),
    argument: sorted.filter((article) => ARGUMENT_SECTIONS.has(articleSection(article))),
    image: sorted.filter((article) => Boolean(article.heroUrl)),
    review: sorted.filter((article) => /review|record|album|ep|single|release/i.test(articleHaystack(article))),
  };
}

function hasStrongKeyword(articles: MagazineIssueArticle[], pattern: RegExp): boolean {
  return articles.some((article) => pattern.test(articleHaystack(article)));
}

function deriveTension(sections: string[], clusters: IssueArticleCluster): string | undefined {
  const keys = new Set(sections);
  if (clusters.sound.length && clusters.scene.length) return 'sound moving through rooms, cities and scenes';
  if (clusters.memory.length && clusters.systems.length) return 'memory pushing against the systems that flatten culture';
  if (clusters.sound.length && clusters.systems.length) return 'artists, records and the machinery around them';
  if (clusters.argument.length && clusters.image.length) return 'form, image and the arguments culture leaves behind';
  if (keys.has('Field Notes') && clusters.scene.length) return 'routes, rooms and what to notice once you get there';
  if (clusters.memory.length) return 'what refuses to disappear';
  if (clusters.systems.length) return 'the machinery under the beautiful part';
  return undefined;
}

function thinnessFor(articleCount: number, coreCount: number): IssueFacts['thinness'] {
  if (articleCount <= 2 || coreCount === 0) return 'thin';
  if (articleCount <= 5 || coreCount <= 2) return 'medium';
  return 'rich';
}

export function buildIssueFacts(issue: MagazineIssue): IssueFacts {
  const usableArticles = issue.articles.filter((article) => article.role !== 'stale' && article.role !== 'excluded');
  const sortedArticles = [...usableArticles].sort(byScoreDesc);
  const mix = sectionMix(usableArticles);
  const clusters = clusterArticles(usableArticles);
  const sectionNames = distinctStrings(mix.map((item) => item.section));
  const coreCount = usableArticles.filter((article) => article.role === 'core').length;
  const supportCount = usableArticles.filter((article) => article.role === 'support').length;
  const excludedCount = issue.excludedArticles.length + issue.articles.filter((article) => article.role === 'stale' || article.role === 'excluded').length;

  return {
    issue,
    issueNumber: issue.issueNumber,
    issueLabel: issue.issueLabel,
    title: cleanText(issue.title),
    subtitle: cleanText(issue.subtitle),
    deck: cleanText(issue.deck),
    articleCount: usableArticles.length,
    coreCount,
    supportCount,
    excludedCount,
    dominantSection: mix[0]?.section,
    secondarySection: mix[1]?.section,
    sectionMix: mix,
    topArticle: sortedArticles[0],
    leadArticles: sortedArticles.slice(0, 6),
    clusters,
    hasStrongImage: clusters.image.length >= 2 || Boolean(sortedArticles[0]?.heroUrl),
    hasStrongSound: clusters.sound.length >= 2 || hasStrongKeyword(usableArticles, /song|album|ep|single|artist|playlist|dj|track|record|sound/i),
    hasStrongPlace: clusters.scene.length >= 2 || hasStrongKeyword(usableArticles, /city|venue|stage|festival|room|scene|nairobi|place/i),
    hasStrongArgument: clusters.argument.length >= 1 || hasStrongKeyword(usableArticles, /beef|criticism|argument|conflict|translation|form|debate/i),
    hasStrongGuide: clusters.guide.length >= 1 || hasStrongKeyword(usableArticles, /guide|where to|route|what to notice|carry this/i),
    hasStrongReview: clusters.review.length >= 1,
    hasStrongMemory: clusters.memory.length >= 1 || hasStrongKeyword(usableArticles, /memory|archive|language|book|oral|poem|literature/i),
    hasStrongSystems: clusters.systems.length >= 1 || hasStrongKeyword(usableArticles, /copyright|rights|platform|algorithm|ai|funding|policy|system/i),
    tension: deriveTension(sectionNames, clusters),
    thinness: thinnessFor(usableArticles.length, coreCount),
  };
}