// WAKILISHA Design System v5 — full structured content
// Generated from wakilisha-design-system-v5.html as structured data, not raw HTML.
// This is used by /admin/design-system to render the complete living bible.

export type WkDesignContentBlock =
  | { type: 'text'; text: string }
  | { type: 'callout'; title: string; text: string }
  | { type: 'code'; text: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'do-dont'; text: string };

export type WkDesignSubsection = {
  title: string;
  level: 'h3' | 'h4';
  blocks: WkDesignContentBlock[];
};

export type WkDesignChapterDetail = {
  id: string;
  anchor: string;
  number: string;
  title: string;
  description: string;
  sections: WkDesignSubsection[];
};

export const wakilishaDesignChapterDetails: WkDesignChapterDetail[] = [];

export const wakilishaDesignChapterDetailById = Object.fromEntries(
  wakilishaDesignChapterDetails.map((chapter) => [chapter.id, chapter])
) as Record<string, WkDesignChapterDetail>;
