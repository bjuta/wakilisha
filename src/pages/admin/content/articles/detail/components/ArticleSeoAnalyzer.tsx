import { useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

interface Props {
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  focusKeyword?: string;
}

interface CheckItem {
  label: string;
  pass: boolean;
  detail: string;
  type: "keyword" | "readability" | "technical";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

function countParagraphs(html: string): number {
  const plain = stripHtml(html);
  return plain.split(/\n{2,}/).filter(Boolean).length;
}

function extractHeadings(html: string): string[] {
  const matches = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi) || [];
  return matches.map((h) => h.replace(/<[^>]*>/g, "").trim()).filter(Boolean);
}

function fleschReadingEase(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text) || 1;
  const syllables = text
    .toLowerCase()
    .replace(/[^a-z]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, word) => {
      const count = word.replace(/(?:[^aeiou]|ed|[^aeiou]e)$/, "").match(/[aeiou]{1,2}/g)?.length || 1;
      return sum + Math.min(count, 3);
    }, 0);

  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

export function ArticleSeoAnalyzer({
  title,
  content,
  excerpt,
  slug,
  seoTitle,
  seoDescription,
  seoKeywords,
  focusKeyword: externalFocusKeyword,
}: Props) {
  const plainContent = useMemo(() => stripHtml(content), [content]);
  const wordCount = useMemo(() => countWords(plainContent), [plainContent]);
  const sentenceCount = useMemo(() => countSentences(plainContent), [plainContent]);
  const paragraphCount = useMemo(() => countParagraphs(content), [content]);
  const headings = useMemo(() => extractHeadings(content), [content]);
  const readability = useMemo(() => fleschReadingEase(plainContent), [plainContent]);

  const focusKeyword = (externalFocusKeyword || seoKeywords?.split(",")[0] || "").trim().toLowerCase();

  const checks: CheckItem[] = useMemo(() => {
    const items: CheckItem[] = [
      // Keyword checks
      {
        label: "Focus keyword in title",
        pass: focusKeyword ? title.toLowerCase().includes(focusKeyword) : false,
        detail: focusKeyword ? (title.toLowerCase().includes(focusKeyword) ? "Keyword found in page title" : "Keyword not in page title — add it for better ranking") : "Set a focus keyword first",
        type: "keyword",
      },
      {
        label: "Keyword in first paragraph",
        pass: focusKeyword ? plainContent.substring(0, 200).toLowerCase().includes(focusKeyword) : false,
        detail: focusKeyword ? (plainContent.substring(0, 200).toLowerCase().includes(focusKeyword) ? "Keyword appears early in content" : "Try to include keyword in the first 200 characters") : "Set a focus keyword first",
        type: "keyword",
      },
      {
        label: "Keyword in SEO title",
        pass: focusKeyword ? seoTitle.toLowerCase().includes(focusKeyword) : false,
        detail: focusKeyword ? (seoTitle.toLowerCase().includes(focusKeyword) ? "Keyword in SEO title" : "Add keyword to SEO title for better CTR") : "Set SEO title with keyword",
        type: "keyword",
      },
      {
        label: "Keyword in meta description",
        pass: focusKeyword ? seoDescription.toLowerCase().includes(focusKeyword) : false,
        detail: focusKeyword ? (seoDescription.toLowerCase().includes(focusKeyword) ? "Keyword in meta description" : "Include keyword in meta description") : "Add meta description with keyword",
        type: "keyword",
      },
      {
        label: "Keyword in URL",
        pass: focusKeyword ? slug.toLowerCase().includes(focusKeyword.replace(/\s+/g, "-")) : false,
        detail: focusKeyword ? (slug.toLowerCase().includes(focusKeyword.replace(/\s+/g, "-")) ? "Keyword appears in URL slug" : "Consider adding keyword to slug") : "Set a focus keyword first",
        type: "keyword",
      },
      {
        label: "Keyword in headings",
        pass: focusKeyword ? headings.some((h) => h.toLowerCase().includes(focusKeyword)) : false,
        detail: focusKeyword ? (headings.some((h) => h.toLowerCase().includes(focusKeyword)) ? `Keyword found in ${headings.filter((h) => h.toLowerCase().includes(focusKeyword)).length} heading(s)` : "Add keyword to at least one heading") : "Set a focus keyword first",
        type: "keyword",
      },
      {
        label: "Keyword density",
        pass: focusKeyword ? (() => {
          const regex = new RegExp(focusKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          const matches = plainContent.match(regex)?.length || 0;
          const density = (matches / Math.max(wordCount, 1)) * 100;
          return density >= 0.5 && density <= 3;
        })() : false,
        detail: focusKeyword ? (() => {
          const regex = new RegExp(focusKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          const matches = plainContent.match(regex)?.length || 0;
          const density = ((matches / Math.max(wordCount, 1)) * 100).toFixed(1);
          return `${matches} occurrences · ${density}% density (aim for 0.5–3%)`;
        })() : "Set a focus keyword first",
        type: "keyword",
      },
      // Readability checks
      {
        label: "Reading ease",
        pass: readability >= 60,
        detail: `Flesch score: ${readability.toFixed(0)} — ${readability >= 60 ? "Fairly easy to read" : readability >= 30 ? "Difficult — consider shorter sentences" : "Very difficult — simplify language"}`,
        type: "readability",
      },
      {
        label: "Paragraph length",
        pass: wordCount > 0 && (wordCount / Math.max(paragraphCount, 1)) <= 150,
        detail: paragraphCount > 0 ? `${(wordCount / paragraphCount).toFixed(0)} words avg per paragraph — ${(wordCount / paragraphCount) > 150 ? "Some paragraphs are too long, break them up" : "Good paragraph length"}` : "No paragraphs found",
        type: "readability",
      },
      {
        label: "Sentence length",
        pass: sentenceCount > 0 && (wordCount / sentenceCount) <= 25,
        detail: sentenceCount > 0 ? `${(wordCount / sentenceCount).toFixed(0)} words avg per sentence — ${(wordCount / sentenceCount) > 25 ? "Sentences are long, vary rhythm" : "Good sentence rhythm"}` : "No sentences found",
        type: "readability",
      },
      {
        label: "Transition words",
        pass: /(?:however|therefore|moreover|furthermore|consequently|additionally|meanwhile|nevertheless|although|because|since|while|whereas|instead|otherwise|similarly|specifically|for example|in fact|in other words|as a result|on the other hand)/i.test(plainContent),
        detail: /(?:however|therefore|moreover|furthermore|consequently|additionally|meanwhile|nevertheless|although|because|since|while|whereas|instead|otherwise|similarly|specifically|for example|in fact|in other words|as a result|on the other hand)/i.test(plainContent) ? "Transition words detected — good flow" : "Add transition words for better readability",
        type: "readability",
      },
      // Technical checks
      {
        label: "Heading structure",
        pass: headings.length > 0,
        detail: headings.length > 0 ? `${headings.length} headings — good structure` : "No headings found — add H2/H3 tags for structure",
        type: "technical",
      },
      {
        label: "Image alt text",
        pass: /<img[^>]+alt="[^"]+"/i.test(content) || !/<img/i.test(content),
        detail: /<img/i.test(content) ? (/<img[^>]+alt="[^"]+"/i.test(content) ? "Images have alt text" : "Add alt text to images for accessibility and SEO") : "No images in content",
        type: "technical",
      },
      {
        label: "Word count",
        pass: wordCount >= 300,
        detail: `${wordCount} words — ${wordCount >= 300 ? "Meets minimum for SEO" : wordCount >= 100 ? "Consider expanding to 300+ words" : "Very short — aim for 300+ words"}`,
        type: "technical",
      },
      {
        label: "SEO title length",
        pass: seoTitle.length >= 30 && seoTitle.length <= 60,
        detail: `${seoTitle.length}/60 chars — ${seoTitle.length < 30 ? "Too short, add more context" : seoTitle.length > 60 ? "Too long, will be truncated" : "Good length"}`,
        type: "technical",
      },
      {
        label: "Meta description length",
        pass: seoDescription.length >= 120 && seoDescription.length <= 160,
        detail: `${seoDescription.length}/160 chars — ${seoDescription.length < 120 ? "Too short, add more detail" : seoDescription.length > 160 ? "Too long, will be truncated" : "Good length"}`,
        type: "technical",
      },
      {
        label: "Internal links",
        pass: /<a[^>]+href="\/magazine\//i.test(content) || /<a[^>]+href="\/artists\//i.test(content) || /<a[^>]+href="\/releases\//i.test(content),
        detail: /<a[^>]+href="\/magazine\//i.test(content) || /<a[^>]+href="\/artists\//i.test(content) || /<a[^>]+href="\/releases\//i.test(content) ? "Internal links found — good for SEO" : "No internal links — link to related articles/artists/releases",
        type: "technical",
      },
    ];
    return items;
  }, [title, content, excerpt, slug, seoTitle, seoDescription, seoKeywords, focusKeyword, plainContent, wordCount, sentenceCount, paragraphCount, headings, readability]);

  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.pass).length;
  const score = Math.round((passedChecks / totalChecks) * 100);
  const scoreColor = score >= 80 ? "text-wk-success" : score >= 50 ? "text-wk-warning" : "text-wk-danger";
  const scoreLabel = score >= 80 ? "Good" : score >= 50 ? "Needs work" : "Poor";

  const keywordChecks = checks.filter((c) => c.type === "keyword");
  const readabilityChecks = checks.filter((c) => c.type === "readability");
  const technicalChecks = checks.filter((c) => c.type === "technical");

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <WkSurface className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">SEO Analysis</h3>
          <div className="flex items-center gap-2">
            <span className={`text-[24px] font-black ${scoreColor}`}>{score}</span>
            <span className="text-[12px] text-[var(--wk-text-muted)]">/100 · {scoreLabel}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[var(--wk-surface-raised)] mb-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score >= 80 ? "bg-[var(--wk-success)]" : score >= 50 ? "bg-[var(--wk-warning)]" : "bg-[var(--wk-danger)]"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Readability stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-[var(--wk-bg-subtle)]">
            <div className="text-[18px] font-black text-[var(--wk-text)]">{wordCount}</div>
            <div className="text-[10px] text-[var(--wk-text-faint)] uppercase">Words</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-[var(--wk-bg-subtle)]">
            <div className="text-[18px] font-black text-[var(--wk-text)]">{headingCount(headings)}</div>
            <div className="text-[10px] text-[var(--wk-text-faint)] uppercase">Headings</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-[var(--wk-bg-subtle)]">
            <div className="text-[18px] font-black text-[var(--wk-text)]">{readability.toFixed(0)}</div>
            <div className="text-[10px] text-[var(--wk-text-faint)] uppercase">Readability</div>
          </div>
        </div>
      </WkSurface>

      {/* Keyword Analysis */}
      {focusKeyword && (
        <CheckGroup title="Keyword Analysis" icon="Target" checks={keywordChecks} />
      )}

      {/* Readability */}
      <CheckGroup title="Readability" icon="BookOpen" checks={readabilityChecks} />

      {/* Technical */}
      <CheckGroup title="Technical SEO" icon="Wrench" checks={technicalChecks} />
    </div>
  );
}

function headingCount(headings: string[]): number {
  return headings.length;
}

function CheckGroup({ title, icon, checks }: { title: string; icon: string; checks: CheckItem[] }) {
  const passed = checks.filter((c) => c.pass).length;
  return (
    <WkSurface className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wk-border)]">
        <div className="flex items-center gap-2">
          <WkIcon name={icon as never} size={14} className="text-[var(--wk-text-muted)]" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{title}</h4>
        </div>
        <span className="text-[11px] text-[var(--wk-text-faint)]">{passed}/{checks.length} passed</span>
      </div>
      <div className="divide-y divide-[var(--wk-border)]/50">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-3 px-4 py-2.5">
            <div className="mt-0.5">
              <WkIcon
                name={check.pass ? "CheckCircle2" : "AlertCircle"}
                size={14}
                className={check.pass ? "text-[var(--wk-success)]" : "text-[var(--wk-warning)]"}
              />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-[var(--wk-text)]">{check.label}</div>
              <div className="text-[11px] text-[var(--wk-text-muted)] leading-relaxed">{check.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}