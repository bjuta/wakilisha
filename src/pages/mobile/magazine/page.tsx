import { useState } from "react";
import { Link } from "react-router-dom";
import { STORIES, TRENDING_STORIES, SECTIONS, EDITOR_PICKS, CONTRIBUTORS } from "@/mocks/magazine";

export default function MobileMagazine() {
  const [activeSection, setActiveSection] = useState("All");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const featured = STORIES[0];
  const sections = SECTIONS.map((s: { name: string }) => s.name);
  const filtered = STORIES.slice(1).filter(
    (story) => activeSection === "All" || story.section === activeSection
  );

  if (!featured) {
    return (
      <div className="wk-mobile-v5 px-5 py-16 text-[var(--wk-text-muted)]">
        No magazine stories available yet.
      </div>
    );
  }

  return (
    <div className="wk-mobile-v5">
      {/* Cover hero */}
      <section className="mag-hero-full">
        <img src={featured.heroUrl} alt="" />
        <div className="mag-hero-overlay">
          <div className="mag-hero-tag">{featured.section}</div>
          <Link to={`/magazine/${featured.slug}`} className="mag-hero-title">
            {featured.title}
          </Link>
          <div className="mag-hero-byline">
            {featured.author} · {featured.readingTime} min read
          </div>
        </div>
      </section>

      {/* Section filter */}
      <div className="charts-filter-row">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`charts-filter ${activeSection === section ? "on" : ""}`}
          >
            {section}
          </button>
        ))}
      </div>

      {/* Trending shelf */}
      <div className="spec-section-hd">Trending</div>
      <div className="home-shelf">
        {TRENDING_STORIES.map((story, i) => (
          <Link key={story.slug} to={`/magazine/${story.slug}`} className="hcard">
            <div className="hcard-art" style={{ position: "relative" }}>
              <img src={story.heroUrl} alt="" />
              <div
                className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                style={{ fontSize: 10, fontWeight: 700 }}
              >
                {i + 1}
              </div>
            </div>
            <div className="hcard-title">{story.title}</div>
            <div className="hcard-sub">{story.section}</div>
          </Link>
        ))}
      </div>

      {/* All stories — same as desktop */}
      <div className="spec-section-hd">
        {activeSection === "All" ? "Latest stories" : activeSection}
      </div>
      <div className="mag-cards">
        {filtered.map((story) => (
          <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card">
            <div className="mag-card-art">
              <img src={story.heroUrl} alt="" />
            </div>
            <div>
              <div className="mag-card-tag">{story.section}</div>
              <div className="mag-card-title">{story.title}</div>
              <div className="mag-card-meta">
                {story.author} · {story.date || "Undated"}
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-[var(--wk-text-muted)]">
            No stories in this section yet.
          </div>
        )}
      </div>

      {/* Editor's picks */}
      {EDITOR_PICKS.length > 0 && (
        <>
          <div className="spec-section-hd">Editor's picks</div>
          <div className="mag-cards">
            {EDITOR_PICKS.slice(0, 4).map((pick) => (
              <Link key={pick.slug} to={`/magazine/${pick.slug}`} className="mag-card">
                <div className="mag-card-art" style={{ position: "relative" }}>
                  <img src={pick.heroUrl} alt="" />
                  <span
                    className="absolute top-2 left-2 rounded-full bg-[var(--wk-brand)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider"
                  >
                    {'pickReason' in pick ? (pick as { pickReason?: string }).pickReason || "Pick" : "Pick"}
                  </span>
                </div>
                <div>
                  <div className="mag-card-tag">{pick.section}</div>
                  <div className="mag-card-title">{pick.title}</div>
                  <div className="mag-card-meta">
                    {pick.author} · {pick.readingTime} min
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Contributors */}
      {CONTRIBUTORS.length > 0 && (
        <>
          <div className="spec-section-hd">Contributors</div>
          <div className="px-5 pb-4 flex flex-col gap-3">
            {CONTRIBUTORS.slice(0, 6).map((contributor) => (
              <div
                key={contributor.name}
                className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3"
              >
                {contributor.photo ? (
                  <img
                    src={contributor.photo}
                    alt={contributor.name}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] font-bold text-lg">
                    {contributor.name[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-[var(--wk-text)]">
                    {contributor.name}
                  </div>
                  <div className="text-[11px] font-semibold text-[var(--wk-brand)]">
                    {contributor.role}
                  </div>
                  <div className="text-[11px] text-[var(--wk-text-muted)] truncate">
                    {contributor.bio}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Newsletter — same as desktop */}
      <section className="px-5 pb-8">
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-newspaper-line text-[var(--wk-brand)]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
                WAKILISHA Editorial
              </span>
            </div>
            <h3 className="text-[16px] font-bold leading-tight text-[var(--wk-text)] mb-1">
              Get the editorial digest
            </h3>
            <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
              Weekly analysis, chart commentary, and industry signals delivered to your inbox.
            </p>
          </div>
          <div className="border-t border-[var(--wk-divider)] px-5 py-4">
            {subscribed ? (
              <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--wk-brand)]">
                <i className="ri-check-line" /> Subscribed! Check your inbox.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] py-3 pl-10 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
                  />
                </div>
                <button
                  onClick={() => { if (email.trim()) setSubscribed(true); }}
                  className="w-full rounded-xl bg-[var(--wk-brand)] py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform"
                >
                  Subscribe
                </button>
                <p className="text-center text-[10px] text-[var(--wk-text-faint)]">
                  No spam. Unsubscribe anytime.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}