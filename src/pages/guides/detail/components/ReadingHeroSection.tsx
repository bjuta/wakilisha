import { useState } from "react";
import { readingGuide } from "../readingData";

export default function ReadingHeroSection() {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section className="relative overflow-hidden" style={{ background: "var(--wk-bg)" }}>
      {/* Warm cream tint overlay */}
      <div className="absolute inset-0 bg-[#C4A35A]/[0.04] pointer-events-none" />

      <div className="relative max-w-[1200px] mx-auto px-6 md:px-8 pt-12 md:pt-20 pb-10 md:pb-16">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12 gap-8">
          {/* Left: Text */}
          <div className="flex-1 lg:pt-4">
            <a
              href="/guides"
              className="inline-flex items-center gap-2 text-[13px] font-medium tracking-wide uppercase"
              style={{ color: "var(--wk-text-muted)" }}
            >
              <i className="ri-arrow-left-line" />
              Guides
            </a>

            <div className="mt-6 mb-4">
              <span
                className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-widest uppercase"
                style={{ color: "var(--wk-text-muted)" }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C4A35A]" />
                {readingGuide.issue} · {readingGuide.status}
              </span>
            </div>

            <h1
              className="text-[36px] md:text-[52px] lg:text-[64px] font-black leading-[1.05] tracking-tight"
              style={{ color: "var(--wk-text)", fontFamily: "var(--wk-font-heading)" }}
            >
              The Day
              <br />
              Reading
              <br />
              Changed
            </h1>

            <p
              className="mt-6 text-[16px] md:text-[18px] leading-relaxed italic max-w-[520px]"
              style={{ color: "var(--wk-text-soft)" }}
              dangerouslySetInnerHTML={{ __html: readingGuide.lede }}
            />

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]" style={{ color: "var(--wk-text-muted)" }}>
              <span>
                By{" "}
                <a href={readingGuide.author.url} className="underline underline-offset-2 hover:no-underline" style={{ color: "var(--wk-text)" }}>
                  {readingGuide.author.name}
                </a>
              </span>
              <span className="hidden sm:inline">·</span>
              <span>{readingGuide.publisher}</span>
            </div>

            <div className="mt-8">
              <a
                href="#prologue"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-md text-[14px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: "#C4A35A" }}
              >
                Start reading
                <i className="ri-arrow-down-line" />
              </a>
            </div>
          </div>

          {/* Right: Book cover */}
          <div className="lg:w-[320px] xl:w-[360px] flex-shrink-0">
            <div className="relative mx-auto w-[220px] md:w-[280px] lg:w-full">
              {/* Book shadow */}
              <div
                className="absolute -bottom-3 left-[8%] right-[8%] h-6 rounded-[50%] blur-lg opacity-40"
                style={{ background: "#8B7355" }}
              />
              {/* Book cover */}
              <div
                className="relative aspect-[3/4] rounded-r-md overflow-hidden"
                style={{ background: "#2C2418" }}
              >
                {/* Spine */}
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-[#3D3224] z-10" />
                {/* Shine effect */}
                <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%)] z-10 pointer-events-none" />
                {/* Cover text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
                  <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C4A35A]/70 mb-3">
                    WAKILISHA Guides
                  </span>
                  <strong className="text-[22px] md:text-[26px] font-black leading-tight text-[#F5F0E8]">
                    The Day
                    <br />
                    Reading
                    <br />
                    Changed
                  </strong>
                  <em className="mt-3 text-[11px] text-[#C4A35A]/60 leading-relaxed max-w-[180px]">
                    How reading cultures form, survive, fracture and return.
                  </em>
                  <i className="mt-4 text-[12px] text-[#F5F0E8]/50">{readingGuide.author.name}</i>
                </div>
                {/* Cover image overlay */}
                <img
                  src={readingGuide.coverImage}
                  alt={`${readingGuide.title} cover`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
              {/* Book peek effect */}
              <div className="absolute -right-1 top-[10%] bottom-[10%] w-2 bg-[#1A150F] rounded-r-sm opacity-60" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}