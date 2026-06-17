import type { MagazineIssue } from '../magazineIssues';
import type { MagazineIssueExperience, MagazineIssueFeatureFrame } from './types';
import { buildIssueFacts } from './facts';
import { scoreIssueArchetype } from './scoring';
import { sanitizePublicIssueCopy, sanitizePublicIssueCopyList, validatePublicIssueCopy } from './guards';
import { WAKILISHA_MAGAZINE_EDITOR, buildEditorNote } from './recipes/editorNote';
import { buildCoverLine } from './recipes/cover';
import { buildContentsIntro, buildContentsTitle, buildReadingPath } from './recipes/contents';
import { buildFeatureFrame } from './recipes/featureFrame';
import { buildSignalDeck, buildSignalReading, buildSignalTitle } from './recipes/signal';
import { buildBackMatterLine } from './recipes/backMatter';
import { buildArchiveBlurb, buildCardBlurb } from './recipes/card';
import { buildSearchSnippet } from './recipes/search';
import { buildSeoDescription } from './recipes/seo';
import { buildAdminQualityNote } from './recipes/admin';

export const MAGAZINE_ISSUE_ENGINE_VERSION = 'magazine-issue-engine.v0.4.0';

function sanitizeFeatureFrame(frame: MagazineIssueFeatureFrame): MagazineIssueFeatureFrame {
  const publicFieldNote = sanitizePublicIssueCopy(frame.publicFieldNote);
  return {
    ...frame,
    eyebrow: sanitizePublicIssueCopy(frame.eyebrow),
    routeLabel: frame.routeLabel,
    titlePrefix: frame.titlePrefix ? sanitizePublicIssueCopy(frame.titlePrefix) : undefined,
    imageCaption: frame.imageCaption ? sanitizePublicIssueCopy(frame.imageCaption) : undefined,
    publicFieldNote,
    fieldNote: publicFieldNote,
  };
}

export function buildMagazineIssueExperience(issue: MagazineIssue): MagazineIssueExperience {
  const facts = buildIssueFacts(issue);
  const score = scoreIssueArchetype(facts);
  const context = { facts, score };

  const rawEditorNote = buildEditorNote(context);
  const editorNote = {
    ...rawEditorNote,
    eyebrow: sanitizePublicIssueCopy(rawEditorNote.eyebrow),
    title: sanitizePublicIssueCopy(rawEditorNote.title),
    body: sanitizePublicIssueCopyList(rawEditorNote.body),
    pull: rawEditorNote.pull ? sanitizePublicIssueCopy(rawEditorNote.pull) : undefined,
    imageCaption: rawEditorNote.imageCaption ? sanitizePublicIssueCopy(rawEditorNote.imageCaption) : undefined,
  };

  const featureFrame = sanitizeFeatureFrame(buildFeatureFrame(context));
  const coverLine = sanitizePublicIssueCopy(buildCoverLine(context));
  const cardBlurb = sanitizePublicIssueCopy(buildCardBlurb(context));
  const archiveBlurb = sanitizePublicIssueCopy(buildArchiveBlurb(context));
  const searchSnippet = sanitizePublicIssueCopy(buildSearchSnippet(context));
  const seoDescription = sanitizePublicIssueCopy(buildSeoDescription(context));
  const contentsIntro = sanitizePublicIssueCopy(buildContentsIntro(context));
  const contentsTitle = sanitizePublicIssueCopy(buildContentsTitle(context));
  const signalTitle = sanitizePublicIssueCopy(buildSignalTitle(context));
  const signalDeck = sanitizePublicIssueCopy(buildSignalDeck(context));
  const signalReading = sanitizePublicIssueCopy(buildSignalReading(context));
  const backMatterLine = sanitizePublicIssueCopy(buildBackMatterLine(context));
  const adminQualityNote = buildAdminQualityNote(context);
  const readingPath = buildReadingPath(context).map((step) => ({
    ...step,
    label: sanitizePublicIssueCopy(step.label),
    title: sanitizePublicIssueCopy(step.title),
    description: sanitizePublicIssueCopy(step.description),
  }));

  const publicValues = [
    score.profile.readerPromise,
    score.profile.visualPromise,
    score.profile.cta,
    coverLine,
    cardBlurb,
    archiveBlurb,
    searchSnippet,
    seoDescription,
    contentsIntro,
    contentsTitle,
    signalTitle,
    signalDeck,
    signalReading,
    backMatterLine,
    editorNote.eyebrow,
    editorNote.title,
    editorNote.pull,
    editorNote.imageCaption,
    ...editorNote.body,
    featureFrame.eyebrow,
    featureFrame.titlePrefix,
    featureFrame.imageCaption,
    featureFrame.publicFieldNote,
    ...readingPath.flatMap((step) => [step.label, step.title, step.description]),
  ];

  const warnings = validatePublicIssueCopy(publicValues);

  return {
    issueMood: score.mood,
    coverVariant: score.coverVariant,
    editor: WAKILISHA_MAGAZINE_EDITOR,
    editorNote,
    featureVisualMode: score.featureVisualMode,
    featureFrame,
    contentsTitle,
    signalTitle,
    signalDeck,
    backMatterLine,
    archetype: score.archetype,
    archetypeLabel: score.profile.label,
    interactionPattern: score.interactionPattern,
    readerPromise: sanitizePublicIssueCopy(score.profile.readerPromise),
    visualPromise: sanitizePublicIssueCopy(score.profile.visualPromise),
    issueCta: sanitizePublicIssueCopy(score.profile.cta),
    coverLine,
    cardBlurb,
    archiveBlurb,
    searchSnippet,
    seoDescription,
    contentsIntro,
    readingPath,
    signalReading,
    adminQualityNote,
    adminNotes: {
      featureDesign: featureFrame.adminDesignNote,
      quality: adminQualityNote,
      scoring: score.reasons,
    },
    warnings,
    factsUsed: score.reasons,
    version: MAGAZINE_ISSUE_ENGINE_VERSION,
  };
}

export * from './types';
export * from './archetypes';
export { buildIssueFacts } from './facts';
export { scoreIssueArchetype } from './scoring';
