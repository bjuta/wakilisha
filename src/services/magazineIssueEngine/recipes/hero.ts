import type { MagazineIssueRecipeContext } from '../types';

function leadTitle(context: MagazineIssueRecipeContext): string {
  return context.facts.readingDoor.article?.title || context.facts.topArticle?.title || context.facts.title;
}

export function buildHeroIntro(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const title = leadTitle(context);

  if (facts.thinness === 'thin') {
    return `This is a short ${score.profile.publicName.toLowerCase()} built around one clear thread. Start with ${title}, then follow what it opens.`;
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return `A listening issue with the sound in front. Start with ${title}, then follow the songs, rooms and people orbiting it.`;
    case 'recordReviewIssue':
      return `A record-led issue for the projects that needed a closer listen. Start with ${title}, then follow the taste, argument and texture around it.`;
    case 'sceneIssue':
      return `A scene issue with rooms, routes and people in motion. Start with ${title}, then move through the places carrying the culture.`;
    case 'fieldGuideIssue':
      return `A guide issue built to be used. Start with ${title}, then carry the route into the next story.`;
    case 'memoryIssue':
      return `A memory issue about what refuses to disappear. Start with ${title}, then follow the fragments, language and names that keep returning.`;
    case 'systemsIssue':
      return `A systems issue looking under the beautiful part. Start with ${title}, then follow the rules, rights and machinery shaping the work.`;
    case 'imageIssue':
      return `An image-led issue. Look first at ${title}, then read what the image is doing to the rest of the issue.`;
    case 'argumentIssue':
      return `An argument issue with a raised eyebrow. Start with ${title}, then follow the counterpoints and pressure points around it.`;
    case 'mixedCultureIssue':
      return `A mixed culture issue with several doors into the same room. Start with ${title}, then choose the thread that pulls hardest.`;
    default:
      return `${score.profile.readerPromise} Start with ${title}, then follow the issue path.`;
  }
}
