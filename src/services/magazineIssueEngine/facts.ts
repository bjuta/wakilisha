import type { MagazineIssue, MagazineIssueArticle } from '../magazineIssues';
import type {
  IssueArticleCluster,
  IssueFacts,
  IssueReadingDoor,
  IssueRoleCounts,
  IssueSignalName,
  IssueSignalScore,
  IssueTension,
  SectionCount,
} from './types';
import { articleHaystack, articleSection, cleanText, distinctStrings, quoteTitle } from './formatters';

const SIGNAL_LABELS: Record<IssueSignalName, string> = {
  sound: 'Sound',
  scene: 'Scene',
  memory: 'Memory',
  systems: 'Systems',
  guide: 'Guide',
  argument: 'Argument',
  image: 'Image',
  review: 'Review',
};

const SECTION_SIGNAL_MAP: Partial<Record<string, IssueSignalName>> = {
  'The Sound of Now': 'sound',
  'On Record': 'review',
  'The Scene Is a Place': 'scene',
  'Field Notes': 'guide',
  'Books, Language, Memory': 'memory',
  'Systems & Futures': 'systems',
  'Sound, Conflict, Form': 'argument',
};

const SIGNAL_PATTERNS: Record<IssueSignalName, RegExp> = {
  sound: /music|song|album|ep|single|artist|playlist|dj|track|record|sound|producer|afrohouse|gengetone|benga|rhumba/i,
  scene: /city|venue|stage|festival|room|scene|nairobi|place|blankets|theatre|public culture|crowd|nightlife/i,
  memory: /memory|archive|language|book|oral|poem|literature|library|history|remember|heritage|translation/i,
  systems: /copyright|rights|platform|algorithm|ai|funding|policy|system|future|climate|ownership|money|bill/i,
  guide: /guide|field guide|where to|route|what to notice|carry this|travel|biennale|dakar|venice|places/i,
  argument: /beef|rival|criticism|argument|conflict|translation|form|debate|visuali[sz]er|vernacular|tension/i,
  image: /image|photo|visual|film|fashion|design|cover|poster|gallery|cinema|screen/i,
  review: /review|record|album|ep|single|release|listen|track-by-track/i,
};

const EMPTY_CLUSTERS: IssueArticleCluster = {
  sound: [],
  scene: [],
  memory: [],
  systems: [],
  guide: [],
  argument: [],
  image: [],
  review: [],
};

function byScoreDesc(a: MagazineIssueArticle, b: MagazineIssueArticle) {
  return b.score - a.score;
}

function sectionMix(articles: MagazineIssueArticle[]): SectionCount[] {
  const map = articles.reduce((acc, article) => {
    const section = articleSection(article);
    const current = acc.get(section) ?? { count: 0, weight: 0 };
    current.count += 1;
    current.weight += Math.max(1, article.score);
    acc.set(section, current);
    return acc;
  }, new Map<string, { count: number; weight: number }>());

  return Array.from(map)
    .map(([section, value]) => ({ section, count: value.count, weight: Math.round(value.weight) }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || a.section.localeCompare(b.section));
}

function articleSignals(article: MagazineIssueArticle): IssueSignalName[] {
  const signals = new Set<IssueSignalName>();
  const sectionSignal = SECTION_SIGNAL_MAP[articleSection(article)];
  const haystack = articleHaystack(article);

  if (sectionSignal) signals.add(sectionSignal);
  (Object.entries(SIGNAL_PATTERNS) as Array<[IssueSignalName, RegExp]>).forEach(([signal, pattern]) => {
    if (pattern.test(haystack)) signals.add(signal);
  });
  if (article.heroUrl) signals.add('image');

  return Array.from(signals);
}

function clusterArticles(articles: MagazineIssueArticle[]): IssueArticleCluster {
  const clusters: IssueArticleCluster = {
    sound: [],
    scene: [],
    memory: [],
    systems: [],
    guide: [],
    argument: [],
    image: [],
    review: [],
  };

  [...articles].sort(byScoreDesc).forEach((article) => {
    articleSignals(article).forEach((signal) => {
      clusters[signal].push(article);
    });
  });

  return clusters;
}

function signalScores(clusters: IssueArticleCluster): IssueSignalScore[] {
  return (Object.keys(EMPTY_CLUSTERS) as IssueSignalName[])
    .map((signal) => {
      const articles = clusters[signal];
      const score = articles.reduce((sum, article) => sum + Math.max(1, article.score), 0);
      return {
        signal,
        label: SIGNAL_LABELS[signal],
        count: articles.length,
        score: Math.round(score),
        articles,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label));
}

function roleCountsFor(issue: MagazineIssue, usableArticles: MagazineIssueArticle[]): IssueRoleCounts {
  return {
    core: usableArticles.filter((article) => article.role === 'core').length,
    support: usableArticles.filter((article) => article.role === 'support').length,
    backup: usableArticles.filter((article) => article.role === 'backup').length,
    needsReview: usableArticles.filter((article) => article.role === 'needs_review').length,
    stale: issue.articles.filter((article) => article.role === 'stale').length,
    excluded: issue.excludedArticles.length + issue.articles.filter((article) => article.role === 'excluded').length,
  };
}

function hasStrongKeyword(articles: MagazineIssueArticle[], pattern: RegExp): boolean {
  return articles.some((article) => pattern.test(articleHaystack(article)));
}

function sectionEntropy(mix: SectionCount[], total: number): number {
  if (!total) return 0;
  const entropy = mix.reduce((sum, item) => {
    const p = item.count / total;
    return p > 0 ? sum - p * Math.log2(p) : sum;
  }, 0);
  return Math.round(entropy * 100) / 100;
}

function tensionFromSignals(primary?: IssueSignalScore, secondary?: IssueSignalScore): IssueTension | undefined {
  if (!primary) return undefined;
  const pair = `${primary.signal}:${secondary?.signal ?? ''}`;

  const pairMap: Record<string, IssueTension> = {
    'sound:scene': {
      primary: 'sound',
      secondary: 'scene',
      label: 'sound moving through rooms, cities and scenes',
      description: 'Songs, artists and the places that give them weight are pulling the issue together.',
    },
    'scene:sound': {
      primary: 'scene',
      secondary: 'sound',
      label: 'rooms, routes and the music that follows them',
      description: 'The issue has physical places in it, but the sound keeps moving through those places.',
    },
    'memory:systems': {
      primary: 'memory',
      secondary: 'systems',
      label: 'memory pushing against the systems that flatten culture',
      description: 'The issue is interested in what gets kept, what gets erased and who controls the record.',
    },
    'systems:memory': {
      primary: 'systems',
      secondary: 'memory',
      label: 'the machinery around memory',
      description: 'Rights, platforms and power sit close to what culture gets to remember.',
    },
    'sound:systems': {
      primary: 'sound',
      secondary: 'systems',
      label: 'artists, records and the machinery around them',
      description: 'The issue keeps the music close while asking who owns, funds and shapes the work around it.',
    },
    'systems:sound': {
      primary: 'systems',
      secondary: 'sound',
      label: 'the systems around the sound',
      description: 'The issue looks under the music to see the platforms, rules and money around it.',
    },
    'argument:image': {
      primary: 'argument',
      secondary: 'image',
      label: 'form, image and the arguments culture leaves behind',
      description: 'The issue is driven by public tension, visual language and the way culture talks back.',
    },
    'image:argument': {
      primary: 'image',
      secondary: 'argument',
      label: 'images doing more than decoration',
      description: 'The issue lets visual culture carry part of the argument.',
    },
    'guide:scene': {
      primary: 'guide',
      secondary: 'scene',
      label: 'routes, rooms and what to notice once you get there',
      description: 'The issue works as something to use, not just something to read.',
    },
    'scene:guide': {
      primary: 'scene',
      secondary: 'guide',
      label: 'places with a route through them',
      description: 'The issue points toward rooms, stages and the path between them.',
    },
  };

  if (pairMap[pair]) return pairMap[pair];

  const singleMap: Record<IssueSignalName, IssueTension> = {
    sound: {
      primary: 'sound',
      label: 'sound as the door into everything else',
      description: 'Songs, records and artists are the clearest way into the issue.',
    },
    scene: {
      primary: 'scene',
      label: 'culture with addresses',
      description: 'The issue is grounded in rooms, stages, routes and public life.',
    },
    memory: {
      primary: 'memory',
      label: 'what refuses to disappear',
      description: 'The issue keeps returning to books, language, archives and cultural memory.',
    },
    systems: {
      primary: 'systems',
      label: 'the machinery under the beautiful part',
      description: 'The issue looks at rights, platforms, money, policy and power around culture.',
    },
    guide: {
      primary: 'guide',
      label: 'a route through the culture',
      description: 'The issue behaves like something to keep open while moving.',
    },
    argument: {
      primary: 'argument',
      label: 'culture talking back',
      description: 'The issue gathers conflict, criticism, form and public debate.',
    },
    image: {
      primary: 'image',
      label: 'the image as the first argument',
      description: 'The issue is led by visual force before explanation.',
    },
    review: {
      primary: 'review',
      label: 'records asking to be replayed',
      description: 'The issue circles releases, reviews and the afterlife of records.',
    },
  };

  return singleMap[primary.signal];
}

function thinnessFor(articleCount: number, roleCounts: IssueRoleCounts, averageScore: number): IssueFacts['thinness'] {
  if (articleCount <= 2 || roleCounts.core === 0) return 'thin';
  if (articleCount <= 5 || roleCounts.core <= 2 || averageScore < 32) return 'medium';
  return 'rich';
}

function leadArticleReason(article: MagazineIssueArticle | undefined, clusters: IssueArticleCluster): string | undefined {
  if (!article) return undefined;
  const signals = articleSignals(article).map((signal) => SIGNAL_LABELS[signal].toLowerCase());
  const hasImage = clusters.image.includes(article);
  const signalPhrase = signals.length ? `It carries ${signals.slice(0, 3).join(', ')}.` : 'It has the strongest editorial weight.';
  return hasImage ? `${signalPhrase} It also has the strongest visual door.` : signalPhrase;
}

function readingDoorFor(facts: Omit<IssueFacts, 'readingDoor' | 'factSummary'>): IssueReadingDoor {
  if (facts.thinness === 'thin') {
    return {
      mode: 'thin',
      title: 'Start with what is strongest',
      reason: 'There is not enough material for a grand route yet, so the issue should stay honest.',
      article: facts.topArticle,
    };
  }

  const primary = facts.primarySignal?.signal;
  if (primary && facts.primarySignal?.articles[0]) {
    const article = facts.primarySignal.articles[0];
    return {
      mode: primary,
      title: quoteTitle(article.title),
      reason: facts.tensionDetail?.description ?? `This is the clearest ${SIGNAL_LABELS[primary].toLowerCase()} door into the issue.`,
      article,
    };
  }

  return {
    mode: 'mixed',
    title: quoteTitle(facts.topArticle?.title),
    reason: 'The issue is mixed, so the safest opening is the strongest story by editorial weight.',
    article: facts.topArticle,
  };
}

function factSummaryFor(facts: Omit<IssueFacts, 'factSummary'>): string[] {
  return [
    `${facts.articleCount} usable articles`,
    facts.dominantSection ? `dominant section: ${facts.dominantSection}` : 'no dominant section',
    facts.primarySignal ? `primary signal: ${facts.primarySignal.label}` : 'no primary signal',
    facts.secondarySignal ? `secondary signal: ${facts.secondarySignal.label}` : 'no secondary signal',
    facts.tension ? `tension: ${facts.tension}` : 'no clear tension yet',
    facts.hasBalancedMix ? 'balanced issue mix' : 'single-lane issue mix',
    `${facts.thinness} issue`,
  ];
}

export function buildIssueFacts(issue: MagazineIssue): IssueFacts {
  const usableArticles = issue.articles.filter((article) => article.role !== 'stale' && article.role !== 'excluded');
  const heldArticles = [
    ...issue.excludedArticles,
    ...issue.articles.filter((article) => article.role === 'stale' || article.role === 'excluded'),
  ];
  const sortedArticles = [...usableArticles].sort(byScoreDesc);
  const mix = sectionMix(usableArticles);
  const clusters = clusterArticles(usableArticles);
  const scores = signalScores(clusters);
  const sectionNames = distinctStrings(mix.map((item) => item.section));
  const roleCounts = roleCountsFor(issue, usableArticles);
  const totalScore = usableArticles.reduce((sum, article) => sum + Math.max(1, article.score), 0);
  const averageScore = usableArticles.length ? Math.round((totalScore / usableArticles.length) * 10) / 10 : 0;
  const scoreSpread = usableArticles.length ? sortedArticles[0].score - sortedArticles[sortedArticles.length - 1].score : 0;
  const entropy = sectionEntropy(mix, usableArticles.length);
  const dominantCount = mix[0]?.count ?? 0;
  const hasBalancedMix = mix.length >= 3 && dominantCount / Math.max(1, usableArticles.length) <= 0.55;
  const hasSingleDominantSection = Boolean(mix[0] && dominantCount / Math.max(1, usableArticles.length) >= 0.6);
  const imageArticles = sortedArticles.filter((article) => Boolean(article.heroUrl));
  const tensionDetail = tensionFromSignals(scores[0], scores[1]);

  const factsWithoutDerived = {
    issue,
    issueNumber: issue.issueNumber,
    issueLabel: issue.issueLabel,
    title: cleanText(issue.title),
    subtitle: cleanText(issue.subtitle),
    deck: cleanText(issue.deck),
    articleCount: usableArticles.length,
    usableArticles,
    heldArticles,
    coreCount: roleCounts.core,
    supportCount: roleCounts.support,
    excludedCount: heldArticles.length,
    roleCounts,
    dominantSection: mix[0]?.section,
    secondarySection: mix[1]?.section,
    topSections: sectionNames.slice(0, 4),
    sectionMix: mix,
    sectionEntropy: entropy,
    hasBalancedMix,
    hasSingleDominantSection,
    topArticle: sortedArticles[0],
    topArticleReason: leadArticleReason(sortedArticles[0], clusters),
    featureCandidate: imageArticles[0] ?? sortedArticles[0],
    leadArticles: sortedArticles.slice(0, 6),
    leadArticleTitles: sortedArticles.slice(0, 6).map((article) => cleanText(article.title)).filter(Boolean),
    imageArticles,
    imageCount: imageArticles.length,
    clusters,
    signalScores: scores,
    primarySignal: scores[0],
    secondarySignal: scores[1],
    hasStrongImage: imageArticles.length >= 2 || Boolean(sortedArticles[0]?.heroUrl),
    hasStrongSound: (clusters.sound.length >= 2 && (scores.find((item) => item.signal === 'sound')?.score ?? 0) >= 40) || hasStrongKeyword(usableArticles, SIGNAL_PATTERNS.sound),
    hasStrongPlace: (clusters.scene.length >= 2 && (scores.find((item) => item.signal === 'scene')?.score ?? 0) >= 40) || hasStrongKeyword(usableArticles, SIGNAL_PATTERNS.scene),
    hasStrongArgument: clusters.argument.length >= 1 || hasStrongKeyword(usableArticles, SIGNAL_PATTERNS.argument),
    hasStrongGuide: clusters.guide.length >= 1 || hasStrongKeyword(usableArticles, SIGNAL_PATTERNS.guide),
    hasStrongReview: clusters.review.length >= 1,
    hasStrongMemory: clusters.memory.length >= 1 || hasStrongKeyword(usableArticles, SIGNAL_PATTERNS.memory),
    hasStrongSystems: clusters.systems.length >= 1 || hasStrongKeyword(usableArticles, SIGNAL_PATTERNS.systems),
    tension: tensionDetail?.label,
    tensionDetail,
    averageScore,
    scoreSpread,
    thinness: thinnessFor(usableArticles.length, roleCounts, averageScore),
  } satisfies Omit<IssueFacts, 'readingDoor' | 'factSummary'>;

  const readingDoor = readingDoorFor(factsWithoutDerived);
  const facts = {
    ...factsWithoutDerived,
    readingDoor,
    factSummary: [],
  } satisfies IssueFacts;

  return {
    ...facts,
    factSummary: factSummaryFor(facts),
  };
}
