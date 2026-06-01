import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { listMagazineStories, type RepairedStory } from "@/services/repairedContent/client";

const fallbackSections = ["All", "Article"];

export default function Magazine() {
  const [activeSection, setActiveSection] = useState("All");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
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

  const sectionNames = useMemo(() => {
    const sections = Array.from(new Set(stories.map((story) => story.section || "Article"))).sort();
    return ["All", ...sections.filter((section) => section !== "All")];
  }, [stories]);

  const featured = stories[0];
  const filtered = stories.slice(1).filter((story) => activeSection === "All" || story.section === activeSection);
  const trending = stories.slice(1, 9);
  const editorPicks = stories.slice(9, 12);
  const leadPair = filtered.slice(0, 2);
  const trio = filtered.slice(2, 5);
  const remaining = filtered.slice(5);

  if (status === "loading") {
    return <div className="wk-container px-6 py-20 text-[var(--wk-text-muted)]">Loading imported WAKILISHA magazine stories…</div>;
  }

  if (status === "error") {
    return <div className="wk-container px-6 py-20 text-[var(--wk-text-muted)]">Magazine data could not be loaded: {error}</div>;
  }

  if (!featured) {
    return <div className="wk-container px-6 py-20 text-[var(--wk-text-muted)]">No imported magazine stories matched the current editorial surface yet.</div>;
  }

  return (
    <main className="min-h-screen">
      <section className="mag-cover">
        <img className="mag-cover-img" src={featured.heroUrl} alt="" />
        <div className="mag-cover-inner wk-container-wide">
          <div className="mag-cover-kicker"><WkIcon name="Newspaper" size={14} /> {featured.section}</div>
          <h1 className="mag-cover-title">{featured.title}</h1>
          {featured.dek && <p className="mag-cover-dek">{featured.dek}</p>}
          <div className="mag-cover-meta">
            <span>By {featured.author}</span>
            <span>{featured.date || "Undated"}</span>
            <span>{featured.readingTime} min read</span>
            <Link to={`/magazine/${featured.slug}`} className="wk-button wk-button-primary">Read cover story <WkIcon name="ArrowRight" size={15} /></Link>
            <ShareButton item={{ title: featured.title, subtitle: featured.author, description: featured.dek, imageUrl: featured.heroUrl, type: "article" }} />
          </div>
        </div>
      </section>

      <nav className="mag-toc">
        <div className="mag-toc-inner wk-container-wide">
          <span className="section-kicker m-0 shrink-0">In this issue</span>
          {(sectionNames.length ? sectionNames : fallbackSections).map((name) => (
            <button key={name} onClick={() => setActiveSection(name)} className={`directory-filter ${activeSection === name ? "on" : ""}`}>
              {name}
            </button>
          ))}
        </div>
      </nav>

      <div className="wk-container-wide px-4 py-10 md:px-6 md:py-14">
        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Trending shelf</div>
              <h2 className="section-title">What people are reading</h2>
            </div>
            <p className="section-copy">Imported stories from the WAKILISHA editorial content surface.</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {trending.map((story, index) => <StoryTile key={story.slug} story={story} rank={index + 1} compact />)}
          </div>
        </section>

        <section className="mag-grid asymm">
          {leadPair.map((story, index) => <StoryTile key={story.slug} story={story} large={index === 0} />)}
        </section>

        <section className="mag-pullblock">
          <p>Stories should feel edited, sequenced, and alive.</p>
        </section>

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Editor picks</div>
              <h2 className="section-title">Selected from the surface</h2>
            </div>
          </div>
          <div className="mag-grid trio">
            {editorPicks.map((story) => <StoryTile key={story.slug} story={story} />)}
          </div>
        </section>

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Latest</div>
              <h2 className="section-title">More from WAKILISHA Magazine</h2>
            </div>
          </div>
          <div className="mag-grid trio">
            {[...trio, ...remaining].map((story) => <StoryTile key={story.slug} story={story} />)}
          </div>
        </section>

        <section className="pg-layout cols-2">
          <div className="pg-block">
            <div className="pg-block-label">Imported content</div>
            <h3 className="pg-block-title">{stories.length} magazine stories loaded.</h3>
            <p className="pg-block-body">This page now uses imported editorial content surfaces instead of the old mock file.</p>
          </div>
          <form className="mag-newsletter m-0" onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }}>
            <div>
              <h3>{subscribed ? "You’re on the list." : "Read with us."}</h3>
              <p>Get WAKILISHA stories, charts, and cultural dispatches without the noise.</p>
            </div>
            <div className="mag-newsletter-form">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
              <button className="wk-button wk-button-primary" type="submit">Subscribe</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function StoryTile({ story, large = false, compact = false, rank }: { story: RepairedStory; large?: boolean; compact?: boolean; rank?: number }) {
  return (
    <Link to={`/magazine/${story.slug}`} className={`mag-story-card ${compact ? "w-[280px] shrink-0" : ""}`}>
      <div className="mag-story-art"><img src={story.heroUrl} alt="" /></div>
      <div className="mag-story-pad">
        <div className="mag-story-section">{rank ? `#${rank} · ` : ""}{story.section}</div>
        <h3 className="mag-story-title" style={large ? { fontSize: "clamp(28px,4vw,48px)" } : undefined}>{story.title}</h3>
        {story.dek && !compact && <p className="mag-story-dek">{story.dek}</p>}
        <div className="mag-story-meta">{story.author} · {story.readingTime} min · {story.date || "Undated"}</div>
      </div>
    </Link>
  );
}
