import { dakarData } from "../dakarData";

export default function DakarTimelineSection() {
  const { timeline } = dakarData;

  return (
    <section id="calendar" className="w-full py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
      <div className="wk-container-wide px-6 md:px-10 lg:px-16">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">
          {timeline.label}
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--wk-text)] leading-tight mb-2">
          {timeline.title}{" "}
          <em className="not-italic italic">{timeline.titleItalic}</em>
        </h2>
        <p className="text-sm text-[var(--wk-text-muted)] mb-10">{timeline.note}</p>

        <ol className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[15px] md:left-[19px] top-2 bottom-2 w-px bg-[var(--wk-divider)]" />

          {timeline.events.map((evt, index) => (
            <li
              key={index}
              className="relative flex items-start gap-4 md:gap-6 pb-8 last:pb-0"
            >
              {/* Dot */}
              <span className="relative z-10 flex-shrink-0 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-[var(--wk-bg)] border-2 border-[var(--wk-divider)] rounded-full">
                <span className="w-2 h-2 bg-[var(--wk-v-fashion)] rounded-full" />
              </span>

              <div className="flex-1 min-w-0 pt-1">
                <time className="block text-xs font-bold uppercase tracking-wider text-[var(--wk-v-fashion)] mb-1">
                  {evt.date}
                </time>
                <p className="text-sm md:text-base text-[var(--wk-text-soft)] leading-relaxed">{evt.event}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}