import { Link } from "react-router-dom";
import type { MagazineArticle } from "@/services/magazineArticles";

interface IssueIndexProps {
  sections: string[];
  activeSection: string;
  onSectionChange: (section: string) => void;
  sectionCounts: Record<string, number>;
  sectionThumbnails: Record<string, string>;
}

export function IssueIndex({
  sections,
  activeSection,
  onSectionChange,
  sectionCounts,
  sectionThumbnails,
}: IssueIndexProps) {
  const allSections = sections.filter((s) => s !== "All");

  return (
    <section className="mag-issue-index">
      <div className="mag-issue-index-inner">
        <div className="mag-issue-index-header">
          <div className="mag-issue-index-label">In this issue</div>
          <div className="mag-issue-index-count">
            {Object.values(sectionCounts).reduce((a, b) => a + b, 0)} stories
          </div>
        </div>

        <div className="mag-issue-index-scroll">
          <button
            onClick={() => onSectionChange("All")}
            className={`mag-issue-index-card ${activeSection === "All" ? "active" : ""}`}
          >
            <div className="mag-issue-index-card-image">
              <div className="mag-issue-index-card-all-icon">
                <i className="ri-layout-grid-line" />
              </div>
            </div>
            <div className="mag-issue-index-card-text">
              <span className="mag-issue-index-card-name">All</span>
              <span className="mag-issue-index-card-count">
                {Object.values(sectionCounts).reduce((a, b) => a + b, 0)} stories
              </span>
            </div>
          </button>

          {allSections.map((section) => (
            <button
              key={section}
              onClick={() => onSectionChange(section)}
              className={`mag-issue-index-card ${activeSection === section ? "active" : ""}`}
            >
              <div className="mag-issue-index-card-image">
                {sectionThumbnails[section] ? (
                  <img src={sectionThumbnails[section]} alt="" />
                ) : (
                  <div className="mag-issue-index-card-placeholder">
                    <i className="ri-article-line" />
                  </div>
                )}
              </div>
              <div className="mag-issue-index-card-text">
                <span className="mag-issue-index-card-name">{section}</span>
                <span className="mag-issue-index-card-count">
                  {sectionCounts[section] || 0} stories
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// Also export a simple section thumbnail helper
export function buildSectionThumbnailMap(
  stories: MagazineArticle[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const story of stories) {
    const section = story.section || "Article";
    if (!map[section] && story.heroUrl) {
      map[section] = story.heroUrl;
    }
  }
  return map;
}