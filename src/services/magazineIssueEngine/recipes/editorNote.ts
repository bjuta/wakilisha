import type { MagazineIssueEditorNote, MagazineIssueRecipeContext } from '../types';
import { humanList, quoteTitle } from '../formatters';

export const WAKILISHA_MAGAZINE_EDITOR = {
  name: 'Muiruri Beautah',
  role: 'Founder & Editor-in-Chief',
} as const;

function sectionThread(context: MagazineIssueRecipeContext): string {
  const sections = context.facts.sectionMix.slice(0, 3).map((section) => section.section.toLowerCase());
  return humanList(sections, 'the culture');
}

function leadTitle(context: MagazineIssueRecipeContext): string {
  return quoteTitle(context.facts.readingDoor.article?.title ?? context.facts.topArticle?.title);
}

function editorTitle(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = leadTitle(context);

  if (facts.issueNumber === 1) {
    return 'We did not set out to build a music site. We set out to make sure the good nights got remembered.';
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return `Start with the sound. ${lead} gives this issue its pulse.`;
    case 'recordReviewIssue':
      return `Start with the records. ${lead} is where this issue begins listening closely.`;
    case 'sceneIssue':
      return `Enter the room through ${lead}. This issue has people, places and movement.`;
    case 'fieldGuideIssue':
      return `Keep this one close. ${lead} is the first stop on the route.`;
    case 'memoryIssue':
      return `This issue is about what stays. Start with ${lead}.`;
    case 'systemsIssue':
      return `Look under the hood. ${lead} opens the machinery around the culture.`;
    case 'imageIssue':
      return `Look first. ${lead} sets the visual temperature of the issue.`;
    case 'argumentIssue':
      return `This issue has a raised eyebrow. ${lead} opens the argument.`;
    case 'thinIssue':
      return `A smaller issue, one clear thread. Start with ${lead}.`;
    case 'mixedCultureIssue':
    default:
      return `This one moves across the culture. Start with ${lead}.`;
  }
}

function editorPull(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const thread = facts.tension ?? sectionThread(context);

  if (facts.issueNumber === 1) {
    return 'Documentation is a form of respect. Putting someone on the record is a way of saying: this counted.';
  }

  if (score.archetype === 'thinIssue') {
    return 'Small does not mean empty. It means we say only what the issue can honestly carry.';
  }

  return `Follow ${thread}. That is where the issue starts to speak.`;
}

function editorBody(context: MagazineIssueRecipeContext): string[] {
  const { facts, score } = context;
  const lead = leadTitle(context);
  const thread = facts.tension ?? sectionThread(context);

  if (facts.issueNumber === 1) {
    return [
      'The first time you understand what a culture is doing, it is rarely inside a dashboard. It is in the room, in the timing, in the argument, in the way a song or scene starts to feel inevitable.',
      'That is why WAKILISHA Magazine exists as an issue-based object. The app keeps moving. The magazine slows down long enough to say what the movement means.',
      'This issue moves the way the culture actually moves, across sound, scenes, places, memory and the systems underneath them.',
    ];
  }

  if (score.archetype === 'thinIssue') {
    return [
      `This is not a grand-claim issue. It is a small record with one visible thread, led by ${lead}.`,
      'Read it straight. Take the strongest piece first, then follow what it points toward.',
    ];
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return [
        `Some issues arrive through the door. This one comes through the speakers. ${lead} gives the issue its first signal.`,
        `The thread is ${thread}. Read it like a listening session, one story opening the next.`,
      ];
    case 'recordReviewIssue':
      return [
        `This issue is for close listening. The records are not decoration here, they are the argument. Start with ${lead}.`,
        `Follow ${thread}, then let the quieter notes around the issue fill in the shape.`,
      ];
    case 'sceneIssue':
      return [
        `This issue has addresses. Rooms, routes, stages and the people who made them matter. ${lead} is the best way in.`,
        `Follow ${thread}. By the end, the scene should feel less like a label and more like a place you almost entered.`,
      ];
    case 'fieldGuideIssue':
      return [
        `This one is built for movement. Start with ${lead}, then keep going where the issue points you.`,
        `The thread is ${thread}. Use it as a guide, not a monument.`,
      ];
    case 'memoryIssue':
      return [
        `This issue is quieter, but not softer. It is about what refuses to disappear. Start with ${lead}.`,
        `Follow ${thread}. The feeling it should leave is not nostalgia, but evidence that the past is still talking.`,
      ];
    case 'systemsIssue':
      return [
        `Culture is never just the beautiful part. Someone owns the platform. Someone writes the rules. Someone gets paid. Someone gets left out. Start with ${lead}.`,
        `The thread is ${thread}. Read this issue for the machinery around the work, not only the work itself.`,
      ];
    case 'imageIssue':
      return [
        `Look first. This issue lets image, style and visual memory carry the first hit. ${lead} sets the temperature.`,
        `Follow ${thread}. The feeling should be immediate before it becomes explainable.`,
      ];
    case 'argumentIssue':
      return [
        `This issue has a raised eyebrow. It is interested in form, conflict, taste and the parts of culture that talk back. Start with ${lead}.`,
        `Follow ${thread}. By the end, the issue should leave you with a position, not just a recap.`,
      ];
    case 'mixedCultureIssue':
    default:
      return [
        `This is a mixed culture issue, not a random pile. ${lead} is the doorway.`,
        `Follow ${thread}. The point is the conversation between the pieces.`,
      ];
  }
}

export function buildEditorNote(context: MagazineIssueRecipeContext): MagazineIssueEditorNote {
  const { facts, score } = context;
  const lead = facts.readingDoor.article ?? facts.topArticle;
  const mode = facts.issueNumber === 1 ? 'letter' : score.editorNoteMode;

  return {
    mode,
    eyebrow: mode === 'image-note' ? 'Editor’s image note' : mode === 'playlist-note' ? 'Editor’s listening note' : 'Editor’s note',
    title: editorTitle(context),
    pull: editorPull(context),
    imageUrl: mode === 'image-note' ? lead?.heroUrl : undefined,
    imageCaption: mode === 'image-note' && lead ? `${quoteTitle(lead.title)} carries the issue’s first visual feeling.` : undefined,
    lovedRelease: mode === 'song-note' ? lead : undefined,
    playlist: mode === 'playlist-note' ? facts.clusters.sound.slice(0, 5) : undefined,
    body: editorBody(context),
  };
}
