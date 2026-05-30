import type { WkCanonicalChapterEnhancement } from './designSystemSpecTypes';

export const canonicalChapterEnhancements: WkCanonicalChapterEnhancement[] = [];

export const canonicalChapterEnhancementByNumber = Object.fromEntries(canonicalChapterEnhancements.map((chapter) => [chapter.number, chapter])) as Record<string, WkCanonicalChapterEnhancement>;

export const canonicalChapterEnhancementByAnchor = Object.fromEntries(canonicalChapterEnhancements.map((chapter) => [chapter.canonicalAnchor, chapter])) as Record<string, WkCanonicalChapterEnhancement>;
