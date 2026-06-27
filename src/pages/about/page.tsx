import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { BRIEFING_SLUGS, isValidEmail, normalizeEmail, subscribeToBriefings } from "@/services/audienceSubscriptionService";
import { fetchAllAuthors, type AuthorRow } from "@/services/authorProfiles";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { getFrontendAppearanceSettings } from "@/services/adminSettings/settingsStore";

type PersonLink = {
  label: string;
  url: string;
  icon: string;
};

type PersonProfile = {
  slug: string;
  name: string;
  role: string;
  team: "Founder" | "Editorial" | "Contributor";
  bio: string;
  location: string;
  avatarUrl: string;
  profilePath?: string;
  links: PersonLink[];
  source: "founder" | "registry_authors";
};


const OPERATING_AREAS = [
  {
    title: "Magazine",
    desc: "Profiles, criticism, release reviews, essays, guides, and field notes for African creative life.",
    to: "/magazine",
    icon: "ri-newspaper-line",
  },
  {
    title: "Charts",
    desc: "Music chart products built around movement, context, methodology, and market-specific discovery.",
    to: "/charts",
    icon: "ri-bar-chart-grouped-line",
  },
  {
    title: "Artists",
    desc: "Artist pages, credits, releases, songs, profiles, and the public context that helps creative work travel.",
    to: "/artists",
    icon: "ri-mic-line",
  },
  {
    title: "Guides",
    desc: "Practical discovery layers for scenes, sounds, regions, stories, and cultural routes worth following.",
    to: "/guides",
    icon: "ri-compass-3-line",
  },
];

const DILIGENCE_LINKS = [
  { label: "Editorial and partnerships", value: "hello@wakilisha.africa", href: "mailto:hello@wakilisha.africa", icon: "ri-mail-line" },
  { label: "Contact page", value: "Contact WAKILISHA", href: "/contact", icon: "ri-customer-service-2-line" },
  { label: "Privacy", value: "How user data is handled", href: "/privacy", icon: "ri-lock-line" },
  { label: "Terms", value: "Platform terms of use", href: "/terms", icon: "ri-file-list-3-line" },
];

const SECTION_NAV_ITEMS = [
  { label: "Overview", href: "#overview" },
  { label: "Gang", href: "#meet-the-gang" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#diligence" },
];


function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("about-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );

    const els = document.querySelectorAll(".about-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function excerpt(value: string, max = 175) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/[\s,.;:!?-]+$/, "")}…`;
}

function isUsablePortraitUrl(url?: string | null) {
  const value = String(url || "").trim();
  if (!value) return false;

  const lower = value.toLowerCase();
  const blocked = [
    "placeholder",
    "default-avatar",
    "avatar-default",
    "avatar-placeholder",
    "profile-placeholder",
    "blank-profile",
    "missing-avatar",
    "missing-profile",
    "silhouette",
    "anonymous",
    "no-avatar",
    "no_profile",
    "user-icon",
  ];

  return !blocked.some((token) => lower.includes(token));
}

function isFounderProfile(name: string, role: string, slug: string) {
  const haystack = `${name} ${role} ${slug}`.toLowerCase();
  return (
    haystack.includes("founder") ||
    haystack.includes("editor-in-chief") ||
    haystack.includes("editor in chief") ||
    haystack.includes("muiruri beautah") ||
    haystack.includes("beautah muiruri")
  );
}

function authorToPerson(author: AuthorRow): PersonProfile {
  const name = (author.name || author.slug).trim();
  const role = author.role || "Contributor";
  const founder = isFounderProfile(name, role, author.slug);
  const links: PersonLink[] = [];

  if (author.url) {
    links.push({ label: "Website", url: author.url, icon: "ri-global-line" });
  }

  (author.social_links || []).forEach((link) => {
    if (!link?.url) return;
    links.push({
      label: link.label || "Profile",
      url: link.url,
      icon: link.icon || "ri-external-link-line",
    });
  });

  return {
    slug: author.slug,
    name,
    role,
    team: founder ? "Founder" : role.toLowerCase().includes("editor") ? "Editorial" : "Contributor",
    location: author.location || "",
    avatarUrl: isUsablePortraitUrl(author.avatar_url) ? author.avatar_url || "" : "",
    profilePath: `/authors/${author.slug}`,
    links,
    source: "registry_authors",
    bio: author.bio || `${name} contributes to WAKILISHA’s coverage of African music and creative life.`,
  };
}

function AboutNewsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailValue = normalizeEmail(email);
    if (!isValidEmail(emailValue)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");

    trackEvent("newsletter_signup", {
      pageType: "about",
      context: { sourceSection: "about_trust_footer", formId: "about-newsletter", briefing_slugs: BRIEFING_SLUGS.cultureDispatch },
    });

    try {
      await subscribeToBriefings(emailValue, BRIEFING_SLUGS.cultureDispatch, {
        sourceForm: "about_newsletter",
        pageType: "about",
        pageUrl: getCanonicalPageUrl(),
        sessionId: getAnalyticsSessionId(),
        sourceContext: { source_section: "about_trust_footer", form_id: "about-newsletter" },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <section className="about-reveal rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {done ? (
        <div className="py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-5">
            <i className="ri-check-line text-[28px] text-[var(--wk-brand-on)]" />
          </div>
          <h3 className="text-[24px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You’re in</h3>
          <p className="text-[14px] text-[var(--wk-text-muted)] max-w-[380px] mx-auto leading-relaxed">
            Culture Dispatch is now on its way to you.
          </p>
        </div>
      ) : (
        <div className="py-14 px-6 text-center max-w-[620px] mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-4">
            <i className="ri-mail-line text-[15px]" /> Stay close
          </span>
          <h2 className="text-[clamp(28px,3vw,42px)] font-black tracking-[-0.045em] text-[var(--wk-text)] leading-tight mb-3">
            Follow what we are building
          </h2>
          <p className="text-[14px] text-[var(--wk-text-muted)] leading-relaxed mb-8">
            New stories, chart updates, guides, contributor notes, and the cultural signals worth paying attention to.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-[500px] mx-auto sm:flex-row">
            <input type="hidden" name="wk_session_id" value={getAnalyticsSessionId()} />
            <input type="hidden" name="wk_page_url" value={getCanonicalPageUrl()} />
            <input type="hidden" name="wk_page_type" value="about" />
            <input type="hidden" name="wk_source_section" value="about_trust_footer" />
            <div className="relative flex-1">
              <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[17px] pointer-events-none" />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-11 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
              />
            </div>
            <button type="submit" className="h-12 px-7 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap shrink-0 cursor-pointer">
              Subscribe
            </button>
          </form>
          {error && <p className="mt-3 text-[12px] font-semibold text-[var(--wk-danger)]">{error}</p>}
          <p className="mt-4 text-[11px] font-semibold text-[var(--wk-text-faint)]">No spam. Unsubscribe anytime.</p>
        </div>
      )}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 h-px bg-[var(--wk-brand)]" />
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">{children}</span>
    </div>
  );
}

function PersonCard({ person, featured = false }: { person: PersonProfile; featured?: boolean }) {
  const portrait = isUsablePortraitUrl(person.avatarUrl) ? person.avatarUrl : "";
  const bioExcerpt = excerpt(person.bio, featured ? 260 : 155);
  const card = (
    <article className={`about-person-card group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--wk-brand)] ${featured ? "lg:grid lg:grid-cols-[0.9fr_1.1fr]" : ""}`}>
      <div className={`about-portrait-frame relative overflow-hidden bg-[#0c0d0a] ${featured ? "min-h-[300px]" : "aspect-[16/11]"}`}>
        {portrait ? (
          <img src={portrait} alt={person.name} className="about-portrait-img h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <Chapter19FallbackImage
            id={person.slug}
            slug={person.slug}
            name={person.name}
            className="about-portrait-img transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <div className="about-portrait-grid absolute inset-0" />
        <div className="about-portrait-sheen absolute inset-0" />
        <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
          {person.team}
        </div>

      </div>

      <div className={`${featured ? "p-5 lg:p-7" : "p-4"} relative flex flex-1 flex-col`}>
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">{person.role}</p>
          <h3 className={`${featured ? "text-[clamp(28px,3.5vw,46px)]" : "text-[18px]"} mt-1.5 font-black leading-[0.98] tracking-[-0.04em] text-[var(--wk-text)]`}>
            {person.name}
          </h3>
          {person.location && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--wk-text-muted)]">
              <i className="ri-map-pin-line text-[var(--wk-brand)]" /> {person.location}
            </p>
          )}
        </div>

        <p className={`${featured ? "text-[15px]" : "text-[13px]"} ${featured ? "" : "min-h-[76px]"} leading-relaxed text-[var(--wk-text-muted)]`}>
          {bioExcerpt}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          {person.profilePath && (
            <Link to={person.profilePath} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 text-[12px] font-black text-[var(--wk-brand-on)] transition-transform hover:-translate-y-0.5">
              View profile <i className="ri-arrow-right-line" />
            </Link>
          )}
          {person.links.slice(0, 3).map((link) => (
            <a
              key={`${person.slug}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-soft)] transition-colors hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
              aria-label={`${person.name} ${link.label}`}
            >
              <i className={link.icon} />
            </a>
          ))}
        </div>


      </div>
    </article>
  );

  return card;
}

export default function AboutPage() {
  const [authors, setAuthors] = useState<AuthorRow[]>([]);
  const [authorsStatus, setAuthorsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [appearance, setAppearance] = useState(() => getFrontendAppearanceSettings());
  const heroRef = useRef<HTMLDivElement>(null);

  useScrollReveal();

  useEffect(() => {
    const syncAppearance = () => setAppearance(getFrontendAppearanceSettings());
    window.addEventListener("wk_settings_changed", syncAppearance);
    return () => window.removeEventListener("wk_settings_changed", syncAppearance);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAllAuthors()
      .then((rows) => {
        if (!alive) return;
        setAuthors(rows.filter((row) => row.slug && row.name));
        setAuthorsStatus("ready");
      })
      .catch((err) => {
        console.warn("Could not load About page contributors:", err);
        if (!alive) return;
        setAuthorsStatus("error");
      });

    return () => {
      alive = false;
    };
  }, []);

  const contributorPeople = useMemo(() => {
    const seen = new Set<string>();
    return authors
      .map(authorToPerson)
      .filter((person) => {
        if (seen.has(person.slug)) return false;
        seen.add(person.slug);
        return true;
      })
      .sort((a, b) => {
        const aRank = a.team === "Founder" ? 0 : a.team === "Editorial" ? 1 : 2;
        const bRank = b.team === "Founder" ? 0 : b.team === "Editorial" ? 1 : 2;
        return aRank - bRank || a.name.localeCompare(b.name);
      });
  }, [authors]);

  const hasContributors = contributorPeople.length > 0;

  const aboutHeroBackgroundImage = appearance.aboutHeroBackgroundImage?.trim();

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <section
        ref={heroRef}
        className="about-hero relative -mt-16 overflow-hidden bg-[#070807] text-white"
        style={aboutHeroBackgroundImage ? { backgroundImage: `url(${aboutHeroBackgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className="absolute inset-0">
          {aboutHeroBackgroundImage && <div className="absolute inset-0 bg-black/68" />}
          <div className="absolute left-[-12%] top-[-35%] h-[460px] w-[460px] rounded-full bg-[var(--wk-brand)] opacity-18 blur-[120px]" />
          <div className="absolute right-[-20%] bottom-[-35%] h-[420px] w-[420px] rounded-full bg-white opacity-[0.06] blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.055]" style={{ backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)", backgroundSize: "84px 84px" }} />
        </div>

        <div className="relative mx-auto max-w-[1180px] px-5 pb-12 pt-32 sm:px-6 lg:px-8 lg:pb-16 lg:pt-36">
          <div className="max-w-[760px]">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-8 bg-white/35" />
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">About WAKILISHA</span>
            </div>

            <h1 className="text-[clamp(42px,7vw,86px)] font-black leading-[0.88] tracking-[-0.065em]">
              The people behind the platform.
            </h1>

            <p className="mt-6 max-w-[620px] text-[15px] leading-relaxed text-white/62 md:text-[18px]">
              WAKILISHA is an editorial and data company for African creative life. We publish stories, map artists, build charts, and make the culture easier to discover, credit, and understand.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#meet-the-gang" className="inline-flex h-11 items-center rounded-full bg-[var(--wk-brand)] px-5 text-[12px] font-black text-[var(--wk-brand-on)] transition-transform hover:-translate-y-0.5">
                Meet the Gang
              </a>
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-16 z-30 border-y border-[var(--wk-border)] bg-[var(--wk-bg)]/86 px-5 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto">
          {SECTION_NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.13em] text-[var(--wk-text-muted)] transition-all hover:-translate-y-0.5 hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto flex max-w-[1180px] flex-col gap-12 px-5 py-12 sm:px-6 lg:gap-16 lg:px-8 lg:py-16">
        <section id="overview" className="about-reveal scroll-mt-28 grid gap-7 border-y border-[var(--wk-border)] py-10 lg:grid-cols-[0.85fr_1.15fr] lg:py-14">
          <div>
            <SectionLabel>Why we exist</SectionLabel>
            <h2 className="mt-4 max-w-[460px] text-[clamp(30px,4vw,48px)] font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]">
              Trust is part of the product.
            </h2>
          </div>
          <div className="max-w-[760px]">
            <p className="text-[clamp(18px,2.4vw,28px)] font-black leading-[1.04] tracking-[-0.04em] text-[var(--wk-text)]">
              Your people are here. Your music is here. Your stories deserve infrastructure that understands them.
            </p>
            <p className="mt-6 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              WAKILISHA exists because African creativity needs more than attention. It needs visible authorship, reliable records, practical discovery, and an ecosystem that can stand up to scrutiny from readers, contributors, partners, and investors.
            </p>
          </div>
        </section>

        <section id="meet-the-gang" className="about-reveal scroll-mt-28">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <SectionLabel>Meet the Gang</SectionLabel>
              <h2 className="mt-4 text-[clamp(32px,5vw,58px)] font-black leading-[0.9] tracking-[-0.055em] text-[var(--wk-text)]">
                Real people. Real work.
              </h2>
            </div>
            <p className="max-w-[440px] text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              Meet the writers, editors, researchers, and cultural workers helping shape WAKILISHA’s voice.
            </p>
          </div>

          <div className="mt-5">
            {authorsStatus === "loading" && (
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                Loading the gang…
              </div>
            )}

            {authorsStatus === "error" && (
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                We could not load contributor profiles right now. Please refresh the page or check back shortly.
              </div>
            )}

            {authorsStatus === "ready" && !hasContributors && (
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                Contributor profiles are being prepared and will appear here soon.
              </div>
            )}

            {hasContributors && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {contributorPeople.map((person) => (
                  <PersonCard key={person.slug} person={person} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="work" className="about-reveal scroll-mt-28">
          <div className="mb-8">
            <SectionLabel>How WAKILISHA works</SectionLabel>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--wk-text)]">
              Stories, charts, artists, and guides in one place.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {OPERATING_AREAS.map((area) => (
              <Link key={area.title} to={area.to} className="group rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--wk-border-2)]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wk-bg-subtle)] text-[var(--wk-text-soft)] transition-colors group-hover:bg-[var(--wk-brand-soft)] group-hover:text-[var(--wk-brand)]">
                  <i className={`${area.icon} text-[22px]`} />
                </div>
                <h3 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)]">{area.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">{area.desc}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-[12px] font-black text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)]">
                  Explore <i className="ri-arrow-right-line" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="diligence" className="about-reveal scroll-mt-28 rounded-[26px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 lg:p-7">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <SectionLabel>Contact & policies</SectionLabel>
              <h2 className="mt-4 text-[clamp(28px,3.6vw,44px)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--wk-text)]">
                Everything important, easy to find.
              </h2>
              <p className="mt-5 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                Find the right contact path, read the basics, and understand how WAKILISHA presents itself to readers, contributors, partners, and funders.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DILIGENCE_LINKS.map((item) => {
                const external = item.href.startsWith("mailto:");
                const content = (
                  <div className="group flex min-h-[118px] flex-col justify-between rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 transition-colors hover:border-[var(--wk-brand)]">
                    <div className="flex items-center justify-between gap-4">
                      <i className={`${item.icon} text-[22px] text-[var(--wk-brand)]`} />
                      <i className="ri-arrow-right-up-line text-[16px] text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{item.label}</p>
                      <p className="mt-1 break-words text-[14px] font-bold text-[var(--wk-text)]">{item.value}</p>
                    </div>
                  </div>
                );

                if (external) {
                  return (
                    <a key={item.label} href={item.href}>
                      {content}
                    </a>
                  );
                }

                return (
                  <Link key={item.label} to={item.href}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <AboutNewsletter />
      </div>

      <style>{`
        .about-hero {
          isolation: isolate;
        }

        .about-hero::after {
          content: "";
          position: absolute;
          inset: auto 0 0;
          height: 32%;
          pointer-events: none;
          background: linear-gradient(to bottom, transparent, var(--wk-bg));
          opacity: 0.28;
        }

        .about-person-card {
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.06);
        }

        .dark .about-person-card {
          box-shadow: 0 22px 80px rgba(0, 0, 0, 0.28);
        }

        .about-portrait-frame {
          isolation: isolate;
        }

        .about-portrait-img {
          filter: saturate(1.18) contrast(1.08);
        }

        .about-portrait-grid {
          pointer-events: none;
          opacity: 0.12;
          background-image:
            linear-gradient(to right, rgba(255,255,255,.45) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,.45) 1px, transparent 1px);
          background-size: 26px 26px;
          mix-blend-mode: overlay;
        }

        .about-portrait-sheen {
          pointer-events: none;
          background:
            radial-gradient(circle at 18% 12%, rgba(255,255,255,.38), transparent 28%),
            linear-gradient(135deg, rgba(132,194,65,.22), transparent 42%, rgba(255,255,255,.10));
          opacity: 0.65;
          mix-blend-mode: screen;
        }

        .about-reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s var(--wk-ease-standard), transform 0.7s var(--wk-ease-standard);
        }

        .about-reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }

      `}</style>
    </main>
  );
}
