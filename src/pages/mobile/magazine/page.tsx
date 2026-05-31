import { useState } from "react";
import { Link } from "react-router-dom";
import { STORIES, TRENDING_STORIES, SECTIONS } from "@/mocks/magazine";

export default function MobileMagazine() {
  const [activeSection, setActiveSection] = useState("All");
  const featured = STORIES[0];
  const filtered = STORIES.slice(1).filter((story) => activeSection === "All" || story.section === activeSection);
  const sections = SECTIONS.map((section: any) => (typeof section === "string" ? section : section.name));

  if (!featured) {
    return <div className="wk-mobile-v5 px-5 py-16 text-white/50">No magazine stories have been imported yet.</div>;
  }

  return (
    <div className="wk-mobile-v5">
      <section className="mag-hero-full">
        <img src={featured.heroUrl} alt="" />
        <div className="mag-hero-overlay">
          <div className="mag-hero-tag">{featured.section}</div>
          <Link to={`/magazine/${featured.slug}`} className="mag-hero-title">{featured.title}</Link>
          <div className="mag-hero-byline">{featured.author} · {featured.readingTime} min read</div>
        </div>
      </section>

      <div className="charts-filter-row">
        {sections.map((section) => (
          <button key={section} onClick={() => setActiveSection(section)} className={`charts-filter ${activeSection === section ? "on" : ""}`}>
            {section}
          </button>
        ))}
      </div>

      <div className="spec-section-hd">Trending</div>
      <div className="mag-cards">
        {TRENDING_STORIES.slice(0, 3).map((story) => (
          <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card">
            <div className="mag-card-art"><img src={story.heroUrl} alt="" /></div>
            <div>
              <div className="mag-card-tag">{story.section}</div>
              <div className="mag-card-title">{story.title}</div>
              <div className="mag-card-meta">{story.author ?? "WAKILISHA Editorial"} · {story.readingTime ?? 1} min</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">Latest stories</div>
      <div className="mag-cards">
        {filtered.map((story) => (
          <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card">
            <div className="mag-card-art"><img src={story.heroUrl} alt="" /></div>
            <div>
              <div className="mag-card-tag">{story.section}</div>
              <div className="mag-card-title">{story.title}</div>
              <div className="mag-card-meta">{story.author} · {story.date || "Undated"}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
