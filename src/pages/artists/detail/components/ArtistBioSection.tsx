import { useState, useMemo } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface ArtistBioSectionProps {
  bio: string;
  fullBio: string;
  name: string;
  country: string;
  oldestReleaseLabel?: string;
  trackCount: number;
  releaseCount: number;
  artistType?: string | null;
}

interface BioSection {
  id: string;
  title: string;
  html: string;
  level: number;
}

function slugifySection(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseBioSections(html: string): BioSection[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;
  const sections: BioSection[] = [];
  let currentSection: { title: string; level: number; nodes: Node[] } | null = null;
  const nodesBeforeFirstHeading: Node[] = [];

  const isHeading = (node: Node): { is: boolean; title: string; level: number } => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "h2" || tag === "h3" || tag === "h4") {
        return { is: true, title: el.textContent?.trim() || "", level: parseInt(tag[1], 10) };
      }
      // Detect <p><strong>...</strong></p> or <p><b>...</b></p> as heading
      if (tag === "p" && el.children.length === 1) {
        const child = el.children[0];
        if (child.tagName === "STRONG" || child.tagName === "B") {
          const text = child.textContent?.trim() || "";
          // Short, no punctuation = likely a heading
          if (text.length > 0 && text.length < 60 && !text.includes(".") && !text.includes(",")) {
            return { is: true, title: text, level: 3 };
          }
        }
      }
    }
    return { is: false, title: "", level: 0 };
  };

  for (const child of Array.from(body.childNodes)) {
    const heading = isHeading(child);
    if (heading.is) {
      if (currentSection) {
        const tempDiv = document.createElement("div");
        for (const n of currentSection.nodes) tempDiv.appendChild(n.cloneNode(true));
        sections.push({
          id: `bio-${slugifySection(currentSection.title)}`,
          title: currentSection.title,
          level: currentSection.level,
          html: tempDiv.innerHTML,
        });
      } else if (nodesBeforeFirstHeading.length > 0) {
        const tempDiv = document.createElement("div");
        for (const n of nodesBeforeFirstHeading) tempDiv.appendChild(n.cloneNode(true));
        sections.push({
          id: "bio-intro",
          title: "Introduction",
          level: 2,
          html: tempDiv.innerHTML,
        });
      }
      currentSection = { title: heading.title, level: heading.level, nodes: [] };
    } else {
      if (currentSection) {
        currentSection.nodes.push(child);
      } else {
        nodesBeforeFirstHeading.push(child);
      }
    }
  }

  if (currentSection) {
    const tempDiv = document.createElement("div");
    for (const n of currentSection.nodes) tempDiv.appendChild(n.cloneNode(true));
    sections.push({
      id: `bio-${slugifySection(currentSection.title)}`,
      title: currentSection.title,
      level: currentSection.level,
      html: tempDiv.innerHTML,
    });
  } else if (nodesBeforeFirstHeading.length > 0) {
    const tempDiv = document.createElement("div");
    for (const n of nodesBeforeFirstHeading) tempDiv.appendChild(n.cloneNode(true));
    sections.push({
      id: "bio-intro",
      title: "Introduction",
      level: 2,
      html: tempDiv.innerHTML,
    });
  }

  return sections;
}

/** Extract clean paragraph text from bio HTML, stripping headings and their text */
export function cleanBioExcerpt(html: string, maxLength = 280): string {
  if (!html) return "";

  // Check if input looks like HTML
  const hasHtmlTags = /<\w+[^>]*>/.test(html);

  if (hasHtmlTags) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove all heading elements entirely
    const headings = doc.body.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headings.forEach((h) => h.remove());

    // Also remove <p><strong>Text</strong></p> or <p><b>Text</b></p> if they look like headings
    const paragraphs = doc.body.querySelectorAll("p");
    paragraphs.forEach((p) => {
      if (p.children.length === 1) {
        const child = p.children[0];
        if (child.tagName === "STRONG" || child.tagName === "B") {
          const text = child.textContent?.trim() || "";
          if (text.length > 0 && text.length < 60 && !text.includes(".") && !text.includes(",")) {
            p.remove();
          }
        }
      }
    });

    const text = (doc.body.textContent || "").trim().replace(/\s+/g, " ");
    return truncateCleanText(text, maxLength);
  }

  // Plain text fallback: strip heading-like prefixes manually
  let text = html.trim().replace(/\s+/g, " ");

  // Common heading patterns that appear at the start of plain-text bios
  const headingPatterns = [
    /^Early Life\s+(?:and|&)\s+Background\s*/i,
    /^Early Life\s*/i,
    /^Musical Career\s*/i,
    /^Career\s*/i,
    /^Introduction\s*/i,
    /^Biography\s*/i,
    /^Background\s*/i,
    /^Personal Life\s*/i,
    /^Artistic Style\s*/i,
    /^Discography\s*/i,
    /^Legacy\s*/i,
    /^Awards\s+(?:and|&)\s+Recognition\s*/i,
    /^Awards\s*/i,
    /^References\s*/i,
  ];

  for (const pattern of headingPatterns) {
    if (pattern.test(text)) {
      text = text.replace(pattern, "").trim();
      break;
    }
  }

  return truncateCleanText(text, maxLength);
}

function truncateCleanText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

export function ArtistBioSection({
  bio,
  fullBio,
  name,
  country,
  oldestReleaseLabel,
  trackCount,
  releaseCount,
  artistType,
}: ArtistBioSectionProps) {
  const hasFullBio = fullBio && fullBio.length > (bio?.length || 0);
  const [expanded, setExpanded] = useState(false);
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);

  const sections = useMemo(() => {
    if (!expanded || !fullBio) return [];
    return parseBioSections(fullBio);
  }, [expanded, fullBio]);

  const displayBio = cleanBioExcerpt(fullBio || bio || "");
  
  const showBio = displayBio.length > 0;

  const metaItems = [
    ...(artistType ? [{ icon: "ri-user-line", label: artistType }] : []),
    { icon: "ri-map-pin-line", label: country },
    ...(oldestReleaseLabel ? [{ icon: "ri-calendar-line", label: `Oldest WAKILISHA release: ${oldestReleaseLabel}` }] : []),
    { icon: "ri-music-2-line", label: `${trackCount} tracks, ${releaseCount} releases` },
  ];

  // Scroll to section when clicking nav
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      {/* ─── Section Eyebrow ─── */}
      <div className="wk-eyebrow mb-5">Biography</div>

      {/* ─── Meta Info Bar ─── */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {metaItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--wk-text-soft)]">
              <i className={`${item.icon} text-[13px] text-[var(--wk-brand)]`} />
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Section Navigation (expanded only) ─── */}
      {expanded && sections.length > 1 && (
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-text-faint)] mr-1">
              Sections
            </span>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1 text-[11px] font-bold text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] cursor-pointer"
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Bio Content ─── */}
      <div className="bio-editorial-container">
        {expanded && fullBio ? (
          <div className="bio-sections">
            {sections.length > 1 ? (
              sections.map((section, index) => (
                <div key={section.id} id={section.id} className="bio-section">
                  {/* Section heading */}
                  <h3 className="bio-section-heading">
                    {section.title}
                  </h3>
                  {/* Section body. drop cap on first section's first paragraph */}
                  <div
                    className={`bio-html-content ${index === 0 ? "bio-html-content-first" : ""}`}
                    dangerouslySetInnerHTML={{ __html: section.html }}
                  />
                </div>
              ))
            ) : (
              <div
                className="bio-html-content bio-html-content-first"
                dangerouslySetInnerHTML={{ __html: fullBio }}
              />
            )}
          </div>
        ) : (
          /* Collapsed state — plain text with drop cap */
          showBio && (
            <p className="bio-collapsed-text">
              {displayBio}
            </p>
          )
        )}
      </div>

      {/* ─── Expand Toggle ─── */}
      {hasFullBio && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand)] transition-all hover:border-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] cursor-pointer"
        >
          {expanded ? "Show less" : "Read full biography"}
          <i className={`${expanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} text-[15px]`} />
        </button>
      )}

      {/* ─── Inline Styles for Bio Editorial Content ─── */}
      <style>{`
        .bio-editorial-container {
          font-family: var(--wk-font-body);
        }
        
        /* Section heading */
        .bio-section-heading {
          font: 800 12px/1.2 var(--wk-font-ui);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--wk-brand);
          margin-bottom: 16px;
        }

        /* Section spacing */
        .bio-section + .bio-section {
          margin-top: 40px;
        }

        /* HTML content base */
        .bio-html-content {
          font-size: 16px;
          line-height: 1.72;
          color: var(--wk-text-soft);
        }
        
        .bio-html-content p {
          margin-bottom: 16px;
        }
        
        .bio-html-content p:last-child {
          margin-bottom: 0;
        }
        
        /* Headings inside HTML */
        .bio-html-content h2,
        .bio-html-content h3,
        .bio-html-content h4 {
          font-family: var(--wk-font-display);
          font-weight: 900;
          color: var(--wk-text);
          margin-top: 28px;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        
        .bio-html-content h2 {
          font-size: 20px;
        }
        
        .bio-html-content h3 {
          font-size: 18px;
        }
        
        .bio-html-content h4 {
          font-size: 16px;
        }
        
        .bio-html-content h2:first-child,
        .bio-html-content h3:first-child,
        .bio-html-content h4:first-child {
          margin-top: 0;
        }
        
        /* Strong / bold */
        .bio-html-content strong,
        .bio-html-content b {
          font-weight: 700;
          color: var(--wk-text);
        }
        
        /* Emphasis */
        .bio-html-content em,
        .bio-html-content i {
          font-style: italic;
        }
        
        /* Links */
        .bio-html-content a {
          color: var(--wk-brand);
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-thickness: 1px;
          transition: opacity 0.15s ease;
        }
        
        .bio-html-content a:hover {
          opacity: 0.7;
        }
        
        /* Lists */
        .bio-html-content ul,
        .bio-html-content ol {
          margin-bottom: 16px;
          padding-left: 24px;
        }
        
        .bio-html-content ul {
          list-style: disc;
        }
        
        .bio-html-content ol {
          list-style: decimal;
        }
        
        .bio-html-content li {
          margin-bottom: 6px;
          color: var(--wk-text-soft);
        }
        
        .bio-html-content li::marker {
          color: var(--wk-brand);
        }
        
        /* Blockquote */
        .bio-html-content blockquote {
          border-left: 3px solid var(--wk-brand);
          padding-left: 16px;
          margin: 20px 0;
          font-style: italic;
          color: var(--wk-text-muted);
        }
        
        /* Drop cap on first paragraph of first section */
        .bio-html-content-first > p:first-child::first-letter,
        .bio-html-content-first > div:first-child > p:first-child::first-letter {
          float: left;
          font-size: 64px;
          font-weight: 900;
          line-height: 0.7;
          color: var(--wk-brand);
          margin-right: 12px;
          margin-top: 4px;
          font-family: var(--wk-font-display);
        }
        
        /* Collapsed text with drop cap */
        .bio-collapsed-text {
          font-size: 17px;
          line-height: 1.72;
          color: var(--wk-text-soft);
        }
        
        .bio-collapsed-text::first-letter {
          float: left;
          font-size: 64px;
          font-weight: 900;
          line-height: 0.7;
          color: var(--wk-brand);
          margin-right: 12px;
          margin-top: 4px;
          font-family: var(--wk-font-display);
        }
        
        /* Horizontal rules in content */
        .bio-html-content hr {
          border: none;
          border-top: 1px solid var(--wk-border);
          margin: 28px 0;
        }
        
        /* Small text */
        .bio-html-content small {
          font-size: 13px;
          color: var(--wk-text-muted);
        }
        
        /* Image handling in bio */
        .bio-html-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 16px 0;
        }
        
        /* Sub/sup */
        .bio-html-content sub,
        .bio-html-content sup {
          font-size: 75%;
          line-height: 0;
          position: relative;
          vertical-align: baseline;
        }
        
        .bio-html-content sup {
          top: -0.5em;
        }
        
        .bio-html-content sub {
          bottom: -0.25em;
        }
        
        /* Table */
        .bio-html-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 14px;
        }
        
        .bio-html-content th,
        .bio-html-content td {
          padding: 10px 12px;
          border: 1px solid var(--wk-border);
          text-align: left;
        }
        
        .bio-html-content th {
          font-weight: 700;
          color: var(--wk-text);
          background: var(--wk-surface);
        }
        
        .bio-html-content td {
          color: var(--wk-text-soft);
        }
        
        /* Definition list */
        .bio-html-content dl {
          margin: 16px 0;
        }
        
        .bio-html-content dt {
          font-weight: 700;
          color: var(--wk-text);
          margin-top: 12px;
        }
        
        .bio-html-content dd {
          color: var(--wk-text-soft);
          margin-left: 0;
          margin-bottom: 8px;
        }
      `}</style>
    </section>
  );
}