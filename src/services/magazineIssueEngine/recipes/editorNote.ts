import type { MagazineIssueEditorNote, MagazineIssueRecipeContext } from '../types';
import { humanList, quoteTitle } from '../formatters';

export const WAKILISHA_MAGAZINE_EDITOR = {
  name: 'Muiruri Beautah',
  role: 'Founder & Editor-in-Chief',
} as const;

function startLine(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.topArticle?.title);

  if (score.archetype === 'thinIssue') {
    return `This is a smaller issue. Start with ${lead}, then follow the thread that is already visible.`;
  }

  return `${score.profile.openingVerb}. ${lead} is the cleanest door into ${score.profile.publicName}.`;
}

function secondLine(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const sections = humanList(facts.sectionMix.slice(0, 3).map((section) => section.section.toLowerCase()));
  const tension = facts.tension ? `The thread running through it is ${facts.tension}.` : `The strongest pieces gather around ${sections}.`;

  if (score.archetype === 'thinIssue') {
    return 'There is not enough here for a grand statement yet, so the issue stays honest and points you to what is strongest.';
  }

  return `${tension} ${score.profile.readerPromise}`;
}

export function buildEditorNote(context: MagazineIssueRecipeContext): MagazineIssueEditorNote {
  const { facts, score } = context;

  if (facts.issueNumber === 1) {
    return {
      mode: 'letter',
      eyebrow: 'Editor’s note',
      title: 'We did not set out to build a music site. We set out to make sure the good nights got remembered.',
      pull: 'Documentation is a form of respect. Putting someone on the record is a way of saying: this counted.',
      body: [
        'The first time you understand what a culture is doing, it is rarely inside a dashboard. It is in the room, in the timing, in the argument, in the way a song or scene starts to feel inevitable.',
        'That is why WAKILISHA Magazine exists as an issue-based object. The app keeps moving. The magazine slows down long enough to say what the movement means.',
        'This issue moves the way the culture actually moves, across sound, scenes, places, memory and the systems underneath them.'
      ],
    };
  }

  const lead = facts.topArticle;
  const mode = score.editorNoteMode;

  return {
    mode,
    eyebrow: mode === 'image-note' ? 'Editor’s image note' : mode === 'playlist-note' ? 'Editor’s listening note' : 'Editor’s note',
    title: startLine(context),
    pull: lead ? `${score.profile.cta}: ${quoteTitle(lead.title)}.` : score.profile.readerPromise,
    imageUrl: mode === 'image-note' ? lead?.heroUrl : undefined,
    imageCaption: mode === 'image-note' && lead ? `From ${quoteTitle(lead.title)}, the piece that sets the issue’s visual temperature.` : undefined,
    lovedRelease: mode === 'song-note' ? lead : undefined,
    playlist: mode === 'playlist-note' ? facts.clusters.sound.slice(0, 5) : undefined,
    body: [secondLine(context)],
  };
}
