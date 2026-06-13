import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import type { GuideSection, GuideSectionType } from "@/pages/guides/detail/sectionTypes";

interface AddSectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (section: GuideSection) => void;
  existingCount: number;
}

const SECTION_TEMPLATES: { type: GuideSectionType; label: string; description: string; defaultKey: string; defaultData: Record<string, unknown> }[] = [
  { type: "hero", label: "Hero (Standard)", description: "Full-bleed hero with stats, facts, and CTAs", defaultKey: "hero", defaultData: { title: "New Guide Title", issue_badge: "Guide 01", stats: [{ number: "100", label: "Stat" }] } },
  { type: "hero_dossier", label: "Hero (Dossier)", description: "Dossier-style hero with facts grid and dual CTAs", defaultKey: "hero-dossier", defaultData: { title: "New Dossier Title", badge: "ADVANCE DOSSIER", facts: [{ label: "Fact", value: "Value" }], actions: [{ label: "Action", href: "#", primary: true }] } },
  { type: "hero_literary", label: "Hero (Literary)", description: "Literary-style hero with author, publisher, lede", defaultKey: "hero-literary", defaultData: { title: "Chapter Title", lede: "Opening lede text", author: { name: "Author Name", url: "#" }, publisher: "Publisher Name", cover_image: "" } },
  { type: "quote", label: "Quote / Pullquote", description: "Centered pullquote with attribution", defaultKey: "quote", defaultData: { quote: "Quote text goes here", attribution: "— Attribution" } },
  { type: "context_columns", label: "Context Columns", description: "Eyebrow + title + multi-column text layout", defaultKey: "context-columns", defaultData: { eyebrow: "CONTEXT", title: "Section Title", columns: [{ title: "Column 1", body: "Body text" }] } },
  { type: "numbered_chapters", label: "Numbered Chapters", description: "Numbered argument/analysis chapters", defaultKey: "numbered-chapters", defaultData: { label: "THE ARGUMENT", title: "Argument Title", chapters: [{ number: "01", title: "Chapter", description: "Description" }] } },
  { type: "preview_mosaic", label: "Preview Mosaic", description: "Image-heavy preview card mosaic", defaultKey: "preview-mosaic", defaultData: { eyebrow: "PREVIEW", title: "Preview Title", cards: [{ number: "01", label: "Label", title: "Card Title", description: "Description", image: "" }] } },
  { type: "curator_profile", label: "Curator Profile", description: "Curator bio with timeline", defaultKey: "curator-profile", defaultData: { eyebrow: "CURATOR", title: "Curator Name", image: "", bio: "Biography text", timeline: [{ year: "2020", event: "Event" }] } },
  { type: "pavilions_grid", label: "Pavilions Grid", description: "Expandable pavilions/items grid", defaultKey: "pavilions-grid", defaultData: { eyebrow: "PAVILIONS", title: "Pavilions Title", pavilions: [{ number: "01", country: "Country", title: "Pavilion Name", type: "National", venue: "Venue", route: "Route", flag: "", commissioner: "", curator: "", exhibitors: "", context: "", why: "" }] } },
  { type: "focus_cards", label: "Focus Cards", description: "Focused highlight cards with images", defaultKey: "focus-cards", defaultData: { number: "01", eyebrow: "FOCUS", title: "Focus Title", description: "Section description", cards: [{ number: "01", label: "Label", title: "Card Title", description: "Description", image: "" }], note: "Footer note" } },
  { type: "sample_pages", label: "Sample Pages", description: "Horizontal-scrolling sample page images", defaultKey: "sample-pages", defaultData: { eyebrow: "SAMPLE", title: "Sample Pages", pages: [{ image: "", alt: "Page 1" }] } },
  { type: "download_form", label: "Download Form", description: "Download CTA with feature checkmarks", defaultKey: "download-form", defaultData: { eyebrow: "DOWNLOAD", title: "Download Title", description: "Form description", features: ["Feature 1", "Feature 2"], formAction: "" } },
  { type: "numbered_list", label: "Numbered List", description: "Numbered items with descriptions", defaultKey: "numbered-list", defaultData: { label: "THE ANATOMY", title: "List Title", items: [{ number: "01", name: "Item name", description: "Item description", route: "" }] } },
  { type: "discipline_grid", label: "Discipline Grid", description: "Grid of discipline/field items", defaultKey: "discipline-grid", defaultData: { label: "DISCIPLINES", title: "Disciplines Title", items: [{ number: "01", name: "Discipline" }], note: "Grid note" } },
  { type: "watchlist", label: "Watchlist", description: "Watchlist items with signal/questions", defaultKey: "watchlist", defaultData: { label: "WATCHLIST", title: "Watchlist Title", items: [{ number: "01", signal: "Signal", question: "Key question?", body: "Body text" }] } },
  { type: "timeline", label: "Timeline", description: "Vertical timeline with date/event pairs", defaultKey: "timeline", defaultData: { label: "TIMELINE", title: "Timeline Title", events: [{ date: "January 2026", event: "Event description" }], note: "Timeline note" } },
  { type: "follow_form", label: "Follow Form", description: "Newsletter follow CTA with persona options", defaultKey: "follow-form", defaultData: { label: "STAY INFORMED", title: "Follow Title", copy: ["Copy line 1"], form: { heading: "Form heading", description: "Form description", emailLabel: "Email", emailPlaceholder: "you@email.com", personaLabel: "I am a...", personaOptions: [{ value: "option1", label: "Option 1" }], consentLabel: "I agree to receive updates", submitLabel: "Submit" } } },
  { type: "share_bar", label: "Share Bar", description: "Social sharing bar", defaultKey: "share-bar", defaultData: { url: "", title: "Share title", description: "Share description", position: "top" } },
  { type: "prose_article", label: "Prose Article", description: "Full prose article with chapters, TOC, epigraph", defaultKey: "prose-article", defaultData: { label: "PROLOGUE", num: "01", title: "Article Title", epigraph: { text: "Epigraph text", cite: "Citation" }, toc: [{ id: "ch1", label: "Chapter 1", subtitle: "Subtitle", num: "01" }], chapters: [{ id: "ch1", num: "01", title: "Chapter Title", paragraphs: [{ html: "<p>Paragraph text</p>" }] }], nextChapter: { title: "Next Chapter", subtitle: "Coming soon" }, publisher: "Publisher", issue: "Issue 01", shareUrl: "", shareTitle: "", shareDescription: "" } },
  { type: "next_chapter", label: "Next Chapter", description: "Coming-next teaser with email form", defaultKey: "next-chapter", defaultData: { title: "Next Chapter", subtitle: "Coming soon" } },
  { type: "page_footer", label: "Page Footer", description: "Minimal page footer with credits", defaultKey: "page-footer", defaultData: { publisher: "Publisher Name", issue: "Issue 01", section: "Section" } },
  { type: "artists_grid", label: "Artists Grid", description: "Grid of artist cards with images", defaultKey: "artists-grid", defaultData: { eyebrow: "ARTISTS", title: "Artists Title", artists: [{ name: "Artist Name", origin: "Origin", location: "Location", image: "" }] } },
];

export default function AddSectionDrawer({ isOpen, onClose, onAdd, existingCount }: AddSectionDrawerProps) {
  const [search, setSearch] = useState("");

  const filtered = SECTION_TEMPLATES.filter(
    (t) =>
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (template: typeof SECTION_TEMPLATES[0]) => {
    const newSection: GuideSection = {
      key: `${template.defaultKey}-${existingCount + 1}`,
      title: template.label,
      type: template.type,
      data: { ...template.defaultData },
    };
    onAdd(newSection);
    onClose();
    setSearch("");
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--wk-surface)] border-l border-[var(--wk-border)] shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--wk-divider)]">
          <div>
            <h3 className="text-[15px] font-bold text-[var(--wk-text)]">Add Section</h3>
            <p className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">
              Choose a section type to add to your guide
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--wk-bg-subtle)] text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
          >
            <WkIcon name="X" size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[var(--wk-divider)]">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2">
            <WkIcon name="Search" size={14} className="text-[var(--wk-text-faint)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter section types..."
              className="w-full bg-transparent text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] cursor-pointer">
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Section type list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-bg-subtle)] text-[var(--wk-text-faint)] mb-3">
                <WkIcon name="Search" size={20} />
              </div>
              <p className="text-[13px] text-[var(--wk-text-muted)]">No section types match your search.</p>
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {filtered.map((template) => (
                <button
                  key={template.type}
                  onClick={() => handleSelect(template)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-[var(--wk-bg-subtle)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--wk-info-soft)] text-[var(--wk-info)] shrink-0 mt-0.5">
                      <WkIcon name="Plus" size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--wk-text)]">{template.label}</div>
                      <div className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">{template.description}</div>
                    </div>
                    <div className="text-[var(--wk-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <WkIcon name="ArrowRight" size={14} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--wk-divider)]">
          <p className="text-[11px] text-[var(--wk-text-faint)]">
            {SECTION_TEMPLATES.length} section types available
          </p>
        </div>
      </div>
    </>
  );
}