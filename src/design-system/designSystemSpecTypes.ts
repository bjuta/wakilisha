export type WkChapterGroup =
  | 'Foundations'
  | 'Product'
  | 'Media & Editorial'
  | 'Reach'
  | 'Implementation'
  | 'React App UI'
  | 'Mobile-First Experience'
  | 'Mobile High-Fidelity Screens';

export interface WkQaCheck {
  id: string;
  label: string;
  description: string;
}

export type WkRichMediaKind =
  | 'brand'
  | 'token'
  | 'component'
  | 'pattern'
  | 'page'
  | 'mobile'
  | 'animation'
  | 'data-viz';

export interface WkRichMediaSpecimen {
  id: string;
  label: string;
  kind: WkRichMediaKind;
  canonicalClass: string | null;
  count: number;
  implementation: string;
}

export interface WkCanonicalMetrics {
  subsections: number;
  tables: number;
  codeBlocks: number;
  callouts: number;
  doDontCards: number;
  visualSpecimens: number;
}

export interface WkCanonicalChapterEnhancement {
  number: string;
  canonicalAnchor: string;
  group: WkChapterGroup;
  title: string;
  canonicalDescription: string;
  canonicalSubsections: string[];
  richMedia: WkRichMediaSpecimen[];
  canonicalMetrics: WkCanonicalMetrics;
  parityInstruction: string;
}

export interface WkDesignChapterSpec {
  id: string;
  number: string;
  group: WkChapterGroup;
  title: string;
  summary: string;
  adminSections: string[];
  implementationRules: string[];
  componentsRequired: string[];
  tables: string[];
  parityTargets: string[];
  qaChecks: WkQaCheck[];
  canonical?: WkCanonicalChapterEnhancement;
}

export interface WkParityPage {
  route: string;
  archetype: string;
  chapters: string[];
  qaChecks: string[];
}

export interface WkDesignSystemSpec {
  meta: {
    name: string;
    version: string;
    sourceDocument: string;
    northStar: string;
    principles: string[];
    rule: string;
  };
  chapters: WkDesignChapterSpec[];
  parityPageMap: WkParityPage[];
  globalQaGates: WkQaCheck[];
  canonicalParity?: {
    canonicalChapterCount: number;
    implementedChapterCount: number;
    richMediaSpecimens: number;
    sourceTables: number;
    sourceCodeBlocks: number;
    sourceCallouts: number;
    sourceDoDontCards: number;
    parityPercent: number;
  };
}

export const GROUPS = [
  'Foundations',
  'Product',
  'Media & Editorial',
  'Reach',
  'Implementation',
  'React App UI',
  'Mobile-First Experience',
  'Mobile High-Fidelity Screens',
] as const;
