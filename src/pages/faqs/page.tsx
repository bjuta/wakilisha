import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("hp-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -24px 0px" },
    );
    const els = document.querySelectorAll(".hp-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_GROUPS: { title: string; icon: string; items: FaqItem[] }[] = [
  {
    title: "About WAKILISHA",
    icon: "ri-building-2-line",
    items: [
      {
        q: "What is WAKILISHA?",
        a: "WAKILISHA helps people follow African creative life. We publish charts, artist pages, stories, and guides that make the culture easier to find and understand.",
      },
      {
        q: "Who runs WAKILISHA?",
        a: "WAKILISHA is an independent team based in Nairobi, Kenya. We’re a small group of editors, engineers, and researchers who care deeply about African creative life.",
      },
      {
        q: "Is WAKILISHA free?",
        a: "Yes. Charts, artist profiles, magazine articles, and guides are free to access. We believe culture should be easy to reach.",
      },
      {
        q: "How is WAKILISHA funded?",
        a: "We’re currently self-funded and exploring sustainable models that protect our editorial independence. To support the work, reach out through the contact page.",
      },
    ],
  },
  {
    title: "Charts & Methodology",
    icon: "ri-bar-chart-grouped-line",
    items: [
      {
        q: "How are WAKILISHA charts compiled?",
        a: "Our charts are built from real music activity, including streaming, radio airplay, and sales data where available. Each edition includes a methodology note for that market and period.",
      },
      {
        q: "How often are charts updated?",
        a: "Most WAKILISHA charts are updated weekly. Some special editions and historical charts are published on different schedules. Check the specific chart family for its publication cadence.",
      },
      {
        q: "Can I suggest a chart or market to cover?",
        a: "Yes. Send us a message through the contact page. Include the market, genre, and any data sources you think would help.",
      },
      {
        q: "How do you handle artist name variations across platforms?",
        a: "We keep artist names, aliases, and credits connected across platforms, radio data, and editorial sources. It is careful work, and it helps keep charts accurate.",
      },
    ],
  },
  {
    title: "Artist Registry",
    icon: "ri-mic-line",
    items: [
      {
        q: "How do I get my artist profile on WAKILISHA?",
        a: "If your music is on major streaming platforms or has charted on an African music chart, you may already have a profile. Search for your name on the Artists page. If you are not there, contact us.",
      },
      {
        q: "How do I update my artist information?",
        a: "We pull artist data from streaming platforms, labels, public databases, and editorial research. If something is incorrect or outdated, email hello@wakilisha.africa with the correction.",
      },
      {
        q: "Can I remove my profile from WAKILISHA?",
        a: "We respect artists’ wishes. If you’d like your profile removed or specific information redacted, contact us and we’ll handle it promptly.",
      },
      {
        q: "What data do you store about artists?",
        a: "We store publicly available information: artist names, aliases, genre associations, discographies, chart history, and biographical data. We don’t collect private artist data. See our Privacy page for full details.",
      },
    ],
  },
  {
    title: "Magazine & Editorial",
    icon: "ri-newspaper-line",
    items: [
      {
        q: "How can I write for WAKILISHA Magazine?",
        a: "We’re always looking for sharp, original voices. Send a pitch to hello@wakilisha.africa with the subject line “Editorial pitch.” Include a brief outline, why it matters, and links to your previous work.",
      },
      {
        q: "What topics does the Magazine cover?",
        a: "African creative life in the broadest sense: music, visual art, film, fashion, food, literature, architecture, and the systems that connect them. We’re especially interested in stories mainstream outlets miss.",
      },
      {
        q: "Can I republish a WAKILISHA article?",
        a: "Contact us for republication permissions. We’re generally open to syndication and cross-publication. Just ask first.",
      },
    ],
  },
  {
    title: "Guides",
    icon: "ri-compass-3-line",
    items: [
      {
        q: "What are WAKILISHA Guides?",
        a: "Guides help readers move through cultural moments with context. They come as Field Guides, Advance Dossiers, and Literary Projects. Each one is built to be useful, not just beautiful.",
      },
      {
        q: "How do you choose what to build a guide about?",
        a: "We focus on cultural moments where a structured guide helps: major biennales, emerging art scenes, literary movements, and cultural stories that need careful coverage.",
      },
      {
        q: "Can I suggest a guide topic?",
        a: "Yes. Use the contact form and select “Guide suggestion” as your subject. Tell us what cultural moment or space deserves a guide, and why.",
      },
    ],
  },
  {
    title: "Technical & Account",
    icon: "ri-settings-3-line",
    items: [
      {
        q: "Do I need an account to use WAKILISHA?",
        a: "No. You can browse charts, artists, magazine articles, and guides without an account. Accounts are only needed for saves, lyric contributions, and registered-user features.",
      },
      {
        q: "I found a bug or broken link. What should I do?",
        a: "We appreciate bug reports. Send the details to hello@wakilisha.africa with “Technical issue” as the subject. Include the page URL and what went wrong.",
      },
      {
        q: "Is WAKILISHA accessible on mobile?",
        a: "Yes. The entire platform is responsive and works on phones, tablets, and desktops. We also have a dedicated mobile player experience.",
      },
      {
        q: "How can I stay updated on new features?",
        a: "Subscribe from the homepage or footer. We send occasional updates about new charts, guides, magazine issues, and platform features.",
      },
    ],
  },
];

function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const id = item.q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return (
    <div className="border-b border-[var(--wk-divider)] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left cursor-pointer group"
        aria-expanded={open}
      >
        <h3 className="text-[15px] font-bold text-[var(--wk-text)] group-hover:text-[var(--wk-text-soft)] transition-colors pr-4">
          {item.q}
        </h3>
        <span className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 ${open ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "border-[var(--wk-border)] text-[var(--wk-text-faint)]"}`}>
          <i className={`text-[14px] transition-transform duration-200 ${open ? "ri-subtract-line" : "ri-add-line"}`} />
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? "max-h-[400px] pb-4" : "max-h-0"}`}
      >
        <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] pl-0 pr-12">
          {item.a}
        </p>
      </div>
    </div>
  );
}

export default function FaqsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

  useScrollReveal();

  useEffect(() => {
    const hero = heroRef.current;
    const img = heroImgRef.current;
    if (!hero || !img) return;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const h = hero.offsetHeight;
      const p = Math.min(scrollY / h, 1);
      img.style.transform = `scale(${1 + p * 0.05})`;
      img.style.opacity = String(Math.max(0.85 - p * 0.3, 0.4));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainRecord": FAQ_GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.a,
        },
      }))
    ),
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      {/* Hero */}
      <div ref={heroRef} className="relative min-h-[50vh] flex items-end overflow-hidden bg-[#0a0a0a] -mt-16">
        <img
          ref={heroImgRef}
          src="https://wakilisha.africa/api/search-image?query=Abstract%20editorial%20composition%20with%20warm%20olive%20green%20and%20deep%20charcoal%20layered%20textures%2C%20soft%20atmospheric%20light%20diffusing%20through%20geometric%20and%20organic%20forms%2C%20contemporary%20art%20gallery%20aesthetic%2C%20cinematic%20depth%20with%20subtle%20film%20grain%2C%20thoughtful%20knowledge%20and%20inquiry%20mood%2C%20editorial%20photography%20style%20with%20warm%20amber%20and%20olive%20tonal%20palette%2C%20clean%20structured%20overlaps&width=1800&height=900&seq=faqs-hero-2026-wk&orientation=landscape"
          alt=""
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-8 pb-16 pt-28 text-white">
          <div className="max-w-[640px]">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-white/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Frequently asked questions</span>
            </div>
            <h1 className="text-[clamp(44px,6vw,80px)] font-black tracking-[-0.05em] leading-[0.90] mb-5">
              Everything you want to know
            </h1>
            <p className="text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/55 max-w-[480px]">
              About the platform, the charts, the registry, and how we’re building the discovery layer for African creative life.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-16 py-20">
        {/* FAQ groups */}
        <div className="hp-reveal grid grid-cols-1 lg:grid-cols-2 gap-8">
          {FAQ_GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
              <div className="flex items-center gap-3 px-6 pt-6 pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--wk-bg-subtle)]">
                  <i className={`${group.icon} text-[17px] text-[var(--wk-text-soft)]`} />
                </div>
                <h2 className="text-[14px] font-black uppercase tracking-[0.06em] text-[var(--wk-text)]">{group.title}</h2>
              </div>
              <div className="px-6 pb-2">
                {group.items.map((item) => (
                  <FaqAccordion key={item.q} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Still have questions CTA */}
        <div className="hp-reveal rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 lg:p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-4">
            <i className="ri-question-answer-line text-[22px] text-[var(--wk-text-soft)]" />
          </div>
          <h3 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Still have questions?</h3>
          <p className="text-[14px] text-[var(--wk-text-muted)] max-w-[420px] mx-auto leading-relaxed mb-6">
            Can’t find what you’re looking for? Send us a message and we’ll get back to you.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
          >
            <i className="ri-mail-send-line" /> Get in touch
          </Link>
        </div>

        {/* Footer */}
        <footer className="hp-reveal border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">WAKILISHA</span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[480px] mx-auto">
            Built for the curious.
          </p>
        </footer>
      </div>

      <style>{`
        .hp-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s var(--wk-ease-standard), transform 0.7s var(--wk-ease-standard); }
        .hp-reveal-visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </main>
  );
}