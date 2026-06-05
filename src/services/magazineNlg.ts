import type { MagazineIssue, MagazineIssueArticle } from './magazineIssues';

export type EditorNoteMode = 'letter' | 'one-line' | 'image-note' | 'song-note' | 'playlist-note';
export type FeatureVisualMode = 'issue-one-route' | 'photo-led' | 'type-led' | 'archive-board' | 'signal-board' | 'paper-file';

export type MagazineEditorialSystem = {
  issueMood: 'night' | 'paper' | 'travel' | 'signal' | 'archive' | 'image';
  coverVariant: 'seal-key-visual' | 'image-trace' | 'paper-cover' | 'signal-grid' | 'type-cover';
  editorNote: {
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
  featureVisualMode: FeatureVisualMode;
  featureFrame: {
    eyebrow: string;
    routeLabel?: string;
    titlePrefix?: string;
    imageCaption?: string;
    fieldNote: string;
  };
  contentsTitle: string;
  signalTitle: string;
  signalDeck: string;
  backMatterLine: string;
};

function dominantSection(issue: MagazineIssue): string {
  return issue.primaryVerticals[0] ?? issue.articles[0]?.canonicalSection ?? 'Field Notes';
}

function sectionArticles(issue: MagazineIssue, section: string) {
  return issue.articles.filter((article) => article.canonicalSection === section);
}

function topArticle(issue: MagazineIssue): MagazineIssueArticle | undefined {
  return [...issue.articles].sort((a, b) => b.score - a.score)[0];
}

function issueSeed(issue: MagazineIssue) {
  return issue.issueNumber % 5;
}

function moodForIssue(issue: MagazineIssue): MagazineEditorialSystem['issueMood'] {
  const dominant = dominantSection(issue);
  if (dominant === 'Field Notes') return 'travel';
  if (dominant === 'Books, Language, Memory') return 'paper';
  if (dominant === 'Systems & Futures') return 'signal';
  if (dominant === 'The Scene Is a Place') return 'image';
  if (issue.issueNumber % 6 === 0) return 'archive';
  return 'night';
}

function coverVariantForIssue(issue: MagazineIssue): MagazineEditorialSystem['coverVariant'] {
  if (issue.issueNumber === 1) return 'seal-key-visual';
  const mood = moodForIssue(issue);
  if (mood === 'paper') return 'paper-cover';
  if (mood === 'signal') return 'signal-grid';
  if (mood === 'image' || mood === 'travel') return 'image-trace';
  if (issue.issueNumber % 5 === 0) return 'type-cover';
  return 'seal-key-visual';
}

function editorModeForIssue(issue: MagazineIssue): EditorNoteMode {
  if (issue.issueNumber === 1) return 'letter';
  const soundCount = sectionArticles(issue, 'The Sound of Now').length + sectionArticles(issue, 'On Record').length;
  const seed = issueSeed(issue);
  if (soundCount >= 5 && seed === 1) return 'playlist-note';
  if (soundCount >= 3 && seed === 2) return 'song-note';
  if (topArticle(issue)?.heroUrl && seed === 3) return 'image-note';
  if (seed === 4) return 'one-line';
  return 'letter';
}

function featureModeForIssue(issue: MagazineIssue): FeatureVisualMode {
  if (issue.issueNumber === 1) return 'issue-one-route';
  const dominant = dominantSection(issue);
  if (dominant === 'Systems & Futures') return 'signal-board';
  if (dominant === 'Books, Language, Memory') return 'paper-file';
  if (dominant === 'Field Notes') return 'archive-board';
  if (topArticle(issue)?.heroUrl && issue.issueNumber % 2 === 0) return 'photo-led';
  if (issue.issueNumber % 3 === 0) return 'type-led';
  return 'archive-board';
}

function humanList(items: string[]) {
  if (items.length <= 1) return items[0] ?? 'the culture';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function editorNoteForIssue(issue: MagazineIssue): MagazineEditorialSystem['editorNote'] {
  const mode = editorModeForIssue(issue);
  const dominant = dominantSection(issue);
  const feature = topArticle(issue);
  const soundArticles = [...sectionArticles(issue, 'The Sound of Now'), ...sectionArticles(issue, 'On Record')].slice(0, 6);
  const verticals = issue.primaryVerticals.slice(0, 3);

  if (issue.issueNumber === 1) {
    return {
      mode: 'letter',
      eyebrow: 'Why we made this',
      title: 'We did not set out to build a music site. We set out to make sure the good nights got remembered.',
      pull: 'Documentation is a form of respect. Putting someone on the record is a way of saying: this counted.',
      body: [
        'The first time you understand what a culture is doing, it is rarely inside a dashboard. It is in the room, in the timing, in the argument, in the way a song or scene starts to feel inevitable.',
        'That is why WAKILISHA Magazine exists as an issue-based object. The app keeps moving. The magazine slows down long enough to say what the movement means.',
        'This issue moves the way the culture actually moves — across sound, scenes, places, memory and the systems underneath them.'
      ],
    };
  }

  if (mode === 'one-line') {
    return {
      mode,
      eyebrow: 'Editor’s note',
      title: `This one is mostly about ${dominant.toLowerCase()} — and the trace it left behind.`,
      body: [`Sometimes the editor’s note is not an essay. Sometimes it is a pin dropped on the issue: start with “${feature?.title ?? issue.title}” and let the rest of the record open from there.`],
    };
  }

  if (mode === 'image-note') {
    return {
      mode,
      eyebrow: 'Editor’s image note',
      title: 'I kept coming back to this image.',
      imageUrl: feature?.heroUrl,
      imageCaption: feature ? `From “${feature.title}” — the piece that set the visual temperature for ${issue.issueLabel}.` : undefined,
      body: [
        `This issue did not arrive as a thesis first. It arrived as an image, then a cluster of pieces around ${humanList(verticals)}.`,
        'The note here is simple: pay attention to what repeats. The archive is often trying to tell you what it thinks matters.'
      ],
    };
  }

  if (mode === 'song-note') {
    const loved = soundArticles[0] ?? feature;
    return {
      mode,
      eyebrow: 'What the editor is playing',
      title: loved ? `I built this issue with “${loved.title}” open.` : 'I built this issue with one song on repeat.',
      lovedRelease: loved,
      body: [
        'Not every issue needs a long manifesto. This one needed a listening note: one release or story that made the rest of the archive feel connected.',
        `The window is ${issue.sourceWindowLabel}. The mood is ${dominant.toLowerCase()}. The invitation is to listen before you sort.`
      ],
    };
  }

  if (mode === 'playlist-note') {
    return {
      mode,
      eyebrow: 'Editor’s playlist note',
      title: 'Five pieces to play before you read the issue.',
      playlist: soundArticles.slice(0, 5),
      body: [
        'This issue is best entered sideways: through the records, reviews and scenes that give it a pulse.',
        'The playlist is not a ranking. It is a door.'
      ],
    };
  }

  return {
    mode,
    eyebrow: 'Editor’s note',
    title: `The archive gathered around ${dominant.toLowerCase()}.`,
    pull: feature ? `Start with “${feature.title}.” It is the piece that made the rest of the issue make sense.` : undefined,
    body: [
      `Every back-issue is generated from a source window, but the window is not the story. The story is what the pieces start saying to each other.`,
      `Here, the strongest signals cluster around ${humanList(verticals.map((v) => v.toLowerCase()))}. Some pieces are central, some are supporting evidence, and some are held back because they became too time-sensitive.`,
      'That is the job of the magazine engine: not just to group content, but to keep asking what kind of issue this wants to become.'
    ],
  };
}

function featureFrameForIssue(issue: MagazineIssue): MagazineEditorialSystem['featureFrame'] {
  const feature = topArticle(issue);
  const dominant = dominantSection(issue);
  const mode = featureModeForIssue(issue);

  if (mode === 'issue-one-route') {
    return {
      eyebrow: 'Feature · Sound migration',
      routeLabel: 'Johannesburg → Nairobi',
      titlePrefix: 'A route through sound',
      fieldNote: 'This route treatment belongs to Issue 001 because that feature specifically carried the Johannesburg-to-Nairobi visual logic.',
    };
  }

  if (mode === 'photo-led') {
    return {
      eyebrow: `Feature · ${dominant}`,
      imageCaption: feature ? `Image trace from “${feature.title}.”` : undefined,
      fieldNote: 'This issue lets the strongest available image carry the opener instead of forcing a route map onto unrelated content.',
    };
  }

  if (mode === 'type-led') {
    return {
      eyebrow: `Feature · ${dominant}`,
      titlePrefix: 'A typographic opener',
      fieldNote: 'This feature is led by language and tension rather than a literal image treatment.',
    };
  }

  if (mode === 'signal-board') {
    return {
      eyebrow: 'Feature · Systems file',
      titlePrefix: 'Evidence board',
      fieldNote: 'Systems and futures pieces need diagrams, claims, fragments and receipts — not nightlife maps.',
    };
  }

  if (mode === 'paper-file') {
    return {
      eyebrow: 'Feature · Archive paper',
      titlePrefix: 'A reading note',
      fieldNote: 'Books, memory and language features should feel quieter, like a paper file opened on a desk.',
    };
  }

  return {
    eyebrow: `Feature · ${dominant}`,
    titlePrefix: 'Field evidence',
    fieldNote: 'The feature opener changes shape depending on what the issue is actually about.',
  };
}

export function buildIssueEditorialSystem(issue: MagazineIssue): MagazineEditorialSystem {
  const dominant = dominantSection(issue);
  return {
    issueMood: moodForIssue(issue),
    coverVariant: coverVariantForIssue(issue),
    editorNote: editorNoteForIssue(issue),
    featureVisualMode: featureModeForIssue(issue),
    featureFrame: featureFrameForIssue(issue),
    contentsTitle: issue.issueNumber === 1 ? 'The culture, on record.' : `What ${dominant.toLowerCase()} left behind.`,
    signalTitle: dominant === 'Systems & Futures' ? 'What the machinery reveals.' : 'What the issue is quietly telling us.',
    signalDeck: dominant === 'The Sound of Now'
      ? 'A listening map of the strongest records, rooms and music signals inside this issue.'
      : `A cultural-intelligence reading of ${dominant.toLowerCase()} and the signals gathered around it.`,
    backMatterLine: issue.issueNumber === 1 ? 'Your people are here.' : 'The record remains open.',
  };
}
