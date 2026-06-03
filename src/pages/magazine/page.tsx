import { useEffect, useMemo, useState } from "react";
import { listMagazineStories, type RepairedStory } from "@/services/repairedContent/client";
import { MagazineHero } from "./components/MagazineHero";
import { MagazineSectionNav } from "./components/MagazineSectionNav";
import { TrendingShelf } from "./components/TrendingShelf";
import { LeadStories } from "./components/LeadStories";
import { EditorialPullquote } from "./components/EditorialPullquote";
import { EditorPicks } from "./components/EditorPicks";
import { LatestGrid } from "./components/LatestGrid";
import { SectionSpotlight } from "./components/SectionSpotlight";
import { MagazineNewsletter } from "./components/MagazineNewsletter";

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("mag-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    const elements = document.querySelectorAll(".mag-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

export default function Magazine() {
  const [activeSection, setActiveSection] = useState("All");
  const [stories, setStories] = useState<RepairedStory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    listMagazineStories()
      .then((items) => {
        if (!alive) return;
        setStories(items.filter((story) => story.title && story.slug));
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load magazine stories.");
        setStatus("error");
      });
    return () => { alive = false; };
  }, []);

  useScrollReveal();

  const sectionNames = useMemo(() => {
    const sections = Array.from(new Set(stories.map((story) => story.section || "Article"))).sort();
    return ["All", ...sections.filter((section) => section !== "All")];
  }, [stories]);

  const featured = stories[0];
  const filtered = stories.slice(1).filter((story) => activeSection === "All" || story.section === activeSection);
  const trending = stories.slice(1, 9);
  const leadStories = filtered.slice(0, 2);
  const editorPicks = stories.slice(9, 12);
  const latest = filtered.slice(2);
  const spotlightStories = filtered;

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">Loading magazine stories…</div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">Magazine data could not be loaded: {error}</div>
      </main>
    );
  }

  if (!featured) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">No magazine stories are available yet.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <MagazineHero story={featured} />

      <MagazineSectionNav
        sections={sectionNames.length ? sectionNames : ["All", "Article"]}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <div className="mag-page-body">
        <div className="mag-reveal">
          <TrendingShelf stories={trending} />
        </div>

        <div className="mag-reveal">
          <LeadStories stories={leadStories} />
        </div>

        <div className="mag-reveal">
          <EditorialPullquote />
        </div>

        <div className="mag-reveal">
          <EditorPicks stories={editorPicks} />
        </div>

        <div className="mag-reveal">
          <LatestGrid stories={latest} />
        </div>

        <div className="mag-reveal">
          <SectionSpotlight stories={spotlightStories} />
        </div>

        <div className="mag-reveal">
          <MagazineNewsletter />
        </div>

        <section className="mag-page-footer">
          <div className="mag-page-footer-inner">
            <div className="mag-page-footer-eyebrow">WAKILISHA Magazine</div>
            <p className="mag-page-footer-text">
              Stories that move East African culture forward.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}