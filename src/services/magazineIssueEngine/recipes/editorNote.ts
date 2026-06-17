import type { MagazineIssueEditorNote, MagazineIssueRecipeContext } from '../types';
import { humanList, quoteTitle } from '../formatters';

export const WAKILISHA_MAGAZINE_EDITOR = {
  name: 'Muiruri Beautah',
  role: 'Founder & Editor-in-Chief',
} as const;

function startLine(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.topArticle?.title);
  switch (score.archetype) {
    case 'listeningIssue':
      return `Start with the sound. ${lead} gives this issue its pulse.`;
    case 'recordReviewIssue':
      return `Read this one with the records open. ${lead} is the cleanest door in.`;
    case 'sceneIssue':
      return `This issue has rooms in it. ${lead} is where the door opens.`;
    case 'fieldGuideIssue':
      return `Keep this one close. ${lead} turns the issue into a route.`;
    case 'memoryIssue':
      return `This issue is about what stays. ${lead} carries the quiet weight.`;
    case 'systemsIssue':
      return `Culture is never just the beautiful part. ${lead} looks under the hood.`;
    case 'imageIssue':
      return `Look first, then read. ${lead} sets the visual temperature.`;
    case 'argumentIssue':
      return `This issue has a raised eyebrow. ${lead} opens the argument.`;
    case 'thinIssue':
      return `This is a smaller issue. Start with ${lead}, then follow the thread that is already visible.`;
    default:
      return `Start with ${lead}. It makes the rest of the issue easier to follow.`;
  }
}

function secondLine(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const sections = humanList(facts.sectionMix.slice(0, 3).map((section) => section.section.toLowerCase()));
  const tension = facts.tension ? `The thread running through it is ${facts.tension}.` : `The strongest pieces gather around ${sections}.`;
  switch (score.archetype) {
    case 'systemsIssue':
      return `${tension} Rights, platforms, money and memory all sit closer to the work than people admit.`;
    case 'memoryIssue':
      return `${tension} It is quieter, but not softer.`;
    case 'sceneIssue':
      return `${tension} The culture is not abstract here. It has addresses, stages and people in motion.`;
    case 'listeningIssue':
      return `${tension} Read it like a listening session, one story opening the next.`;
    case 'fieldGuideIssue':
      return `${tension} It is built for movement, not just reading.`;
    case 'argumentIssue':
      return `${tension} These pieces do not sit politely. They talk back.`;
    case 'imageIssue':
      return `${tension} The images are not decoration. They are part of the argument.`;
    case 'thinIssue':
      return 'There is not enough here for a grand statement yet, so the issue stays honest and points you to what is strongest.';
    default:
      return tension;
  }
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
    pull: lead ? `Start with ${quoteTitle(lead.title)}.` : undefined,
    imageUrl: mode === 'image-note' ? lead?.heroUrl : undefined,
    imageCaption: mode === 'image-note' && lead ? `From ${quoteTitle(lead.title)}, the piece that sets the issue’s visual temperature.` : undefined,
    lovedRelease: mode === 'song-note' ? lead : undefined,
    playlist: mode === 'playlist-note' ? facts.clusters.sound.slice(0, 5) : undefined,
    body: [secondLine(context)],
  };
}