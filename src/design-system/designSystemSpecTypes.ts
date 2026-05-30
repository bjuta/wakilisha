export type WkChapterGroup =
  | 'Foundations'
  | 'Product'
  | 'Media & Editorial'
  | 'Reach'
  | 'Implementation'
  | 'React App UI';

export interface WkQaCheck {
  id: string;
  label: string;
  description: string;
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
}

export const GROUPS = [
  'Foundations',
  'Product',
  'Media & Editorial',
  'Reach',
  'Implementation',
  'React App UI',
] as const;