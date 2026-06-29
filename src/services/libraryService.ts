export type LibraryVisibility = "public" | "internal" | "embargoed" | "draft" | "archived";

export interface LibraryEntry {
  title: string;
  type: string;
  status: string;
  version: string;
  created: string;
  lastUpdated: string;
  author: string;
  origin: string;
  visibility: LibraryVisibility;
  reviewCycle: string;
  category: string;
  slug: string;
  route: string;
  sourcePath: string;
  body: string;
  excerpt: string;
}

type FrontMatter = Record<string, string>;

import prefaceRaw from "../../library/constitutions/00-preface-why-this-library-exists/index.md?raw";
import northStarRaw from "../../library/constitutions/01-north-star/index.md?raw";
import questionFrameworkRaw from "../../library/constitutions/02-question-framework/index.md?raw";
import inquiryModelRaw from "../../library/constitutions/03-inquiry-model/index.md?raw";
import relationshipConstitutionRaw from "../../library/constitutions/04-relationship-constitution/index.md?raw";
import editorialConstitutionRaw from "../../library/constitutions/05-editorial-constitution/index.md?raw";
import evidenceAndTruthRaw from "../../library/constitutions/06-evidence-and-truth/index.md?raw";
import productConstitutionRaw from "../../library/constitutions/07-product-constitution/index.md?raw";
import experienceArchitectureRaw from "../../library/constitutions/08-experience-architecture/index.md?raw";
import communityConstitutionRaw from "../../library/constitutions/09-community-constitution/index.md?raw";
import aiConstitutionRaw from "../../library/constitutions/10-ai-constitution/index.md?raw";
import institutionalMemoryRaw from "../../library/constitutions/11-institutional-memory/index.md?raw";
import sixtyYearTestRaw from "../../library/constitutions/13-sixty-year-test/index.md?raw";

const rawLibraryModules: Record<string, string> = {
  "../../library/constitutions/00-preface-why-this-library-exists/index.md": prefaceRaw,
  "../../library/constitutions/01-north-star/index.md": northStarRaw,
  "../../library/constitutions/02-question-framework/index.md": questionFrameworkRaw,
  "../../library/constitutions/03-inquiry-model/index.md": inquiryModelRaw,
  "../../library/constitutions/04-relationship-constitution/index.md": relationshipConstitutionRaw,
  "../../library/constitutions/05-editorial-constitution/index.md": editorialConstitutionRaw,
  "../../library/constitutions/06-evidence-and-truth/index.md": evidenceAndTruthRaw,
  "../../library/constitutions/07-product-constitution/index.md": productConstitutionRaw,
  "../../library/constitutions/08-experience-architecture/index.md": experienceArchitectureRaw,
  "../../library/constitutions/09-community-constitution/index.md": communityConstitutionRaw,
  "../../library/constitutions/10-ai-constitution/index.md": aiConstitutionRaw,
  "../../library/constitutions/11-institutional-memory/index.md": institutionalMemoryRaw,
  "../../library/constitutions/13-sixty-year-test/index.md": sixtyYearTestRaw,
};

export const LIBRARY_CATEGORY_ORDER = [
  "constitutions",
  "field-notes",
  "inquiries",
  "founder-letters",
  "things-we-laughed-about",
];

const CATEGORY_LABELS: Record<string, string> = {
  constitutions: "Constitutions",
  "field-notes": "Field Notes",
  inquiries: "Inquiries",
  "founder-letters": "Founder Letters",
  "things-we-laughed-about": "Things We Laughed About",
};

function stripQuotes(value: string): string {
  const clean = value.trim();
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    return clean.slice(1, -1);
  }
  return clean;
}

function parseFrontMatter(raw: string): { frontMatter: FrontMatter; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

  if (!match) {
    return { frontMatter: {}, body: raw.trim() };
  }

  const frontMatter: FrontMatter = {};
  const frontMatterText = match[1] || "";
  const body = (match[2] || "").trim();

  frontMatterText.split(/\r?\n/).forEach((line) => {
    const parsed = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!parsed) return;

    const key = parsed[1] || "";
    const value = parsed[2] || "";
    frontMatter[key] = stripQuotes(value);
  });

  return { frontMatter, body };
}

function excerptFromMarkdown(markdown: string): string {
  const clean = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/[`*_#[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177).replace(/[\s,.;:!?-]+$/, "")}...`;
}

function normalizeVisibility(value?: string): LibraryVisibility {
  if (
    value === "public" ||
    value === "internal" ||
    value === "embargoed" ||
    value === "draft" ||
    value === "archived"
  ) {
    return value;
  }

  return "internal";
}

function entryFromModule(sourcePath: string, raw: string): LibraryEntry | null {
  const normalizedPath = sourcePath.replace(/^\.\.\/\.\.\/library\//, "");

  if (normalizedPath === "README.md") {
    return null;
  }

  const parts = normalizedPath.split("/");
  const category = parts[0] || "";
  const slug = parts[1] || "";
  const fileName = parts[parts.length - 1] || "";

  if (!category || !slug || fileName !== "index.md") {
    return null;
  }

  const { frontMatter, body } = parseFrontMatter(raw);
  const title = frontMatter.title || slug.replace(/[-_]+/g, " ");

  return {
    title,
    type: frontMatter.type || "library-entry",
    status: frontMatter.status || "internal",
    version: frontMatter.version || "1.0",
    created: frontMatter.created || "",
    lastUpdated: frontMatter.last_updated || frontMatter.lastUpdated || "",
    author: frontMatter.author || "WAKILISHA",
    origin: frontMatter.origin || "",
    visibility: normalizeVisibility(frontMatter.visibility),
    reviewCycle: frontMatter.review_cycle || frontMatter.reviewCycle || "",
    category,
    slug,
    route: `/library/${category}/${slug}`,
    sourcePath: normalizedPath,
    body,
    excerpt: excerptFromMarkdown(body),
  };
}

const allEntries = Object.entries(rawLibraryModules)
  .map(([sourcePath, raw]) => entryFromModule(sourcePath, raw))
  .filter((entry): entry is LibraryEntry => Boolean(entry))
  .sort((a, b) => {
    const categoryA = LIBRARY_CATEGORY_ORDER.indexOf(a.category);
    const categoryB = LIBRARY_CATEGORY_ORDER.indexOf(b.category);
    const normalizedA = categoryA === -1 ? 999 : categoryA;
    const normalizedB = categoryB === -1 ? 999 : categoryB;

    if (normalizedA !== normalizedB) return normalizedA - normalizedB;
    return a.slug.localeCompare(b.slug);
  });

export function getLibraryCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category.replace(/[-_]+/g, " ");
}

export function getAllLibraryEntries(): LibraryEntry[] {
  return allEntries;
}

export function getPublicLibraryEntries(): LibraryEntry[] {
  return allEntries.filter((entry) => entry.visibility === "public");
}

export function getPublicLibraryEntry(category: string, slug: string): LibraryEntry | null {
  return (
    getPublicLibraryEntries().find(
      (entry) => entry.category === category && entry.slug === slug,
    ) || null
  );
}

export function getPublicLibraryEntriesByCategory(category: string): LibraryEntry[] {
  return getPublicLibraryEntries().filter((entry) => entry.category === category);
}
