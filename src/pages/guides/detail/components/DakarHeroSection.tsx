import { dakarData } from "../dakarData";

export default function DakarHeroSection() {
  const { hero } = dakarData;

  return (
    <header className="relative w-full min-h-[85vh] md:min-h-[90vh] flex flex-col justify-end overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src={hero.mastheadImage}
          alt="Dakar Biennale 2026"
          className="w-full h-full object-cover"
          width={1920}
          height={1072}
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-6 md:px-10 lg:px-16 pb-8 md:pb-12 pt-32">
        {/* Breadcrumb */}
        <nav className="mb-6 text-xs tracking-wide text-white/70" aria-label="Breadcrumb">
          <span className="text-white/50">wakilisha.africa</span>
          <span className="mx-2 text-white/40">/</span>
          <span className="text-white/50">guides</span>
          <span className="mx-2 text-white/40">/</span>
          <span className="text-white/90 font-medium">dakar-biennale-2026</span>
        </nav>

        {/* Badge */}
        <div className="inline-block mb-4 px-3 py-1 text-xs font-semibold tracking-wider uppercase bg-white/10 backdrop-blur-sm text-white rounded-full border border-white/20">
          {hero.badge}
        </div>

        {/* Kicker */}
        <div className="mb-3 text-sm md:text-base font-medium tracking-wider uppercase text-white/80">
          {hero.kicker}
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[0.95] mb-4">
          {hero.title}
          <em className="not-italic italic">{hero.titleItalic}</em>
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-white/70 font-medium mb-8">
          {hero.subtitle}
        </p>

        {/* Fact strip */}
        <div className="flex flex-wrap gap-4 md:gap-8 mb-8">
          {hero.facts.map((fact) => (
            <div key={fact.label} className="flex flex-col">
              <span className="text-[10px] md:text-xs uppercase tracking-wider text-white/50 font-semibold">
                {fact.label}
              </span>
              <span className="text-sm md:text-base text-white font-medium">
                {fact.value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          {hero.actions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              className={
                action.primary
                  ? "inline-flex items-center px-5 py-2.5 text-sm font-semibold bg-white text-black rounded-md hover:bg-white/90 transition-colors whitespace-nowrap"
                  : "inline-flex items-center px-5 py-2.5 text-sm font-semibold bg-transparent text-white border border-white/40 rounded-md hover:bg-white/10 transition-colors whitespace-nowrap"
              }
            >
              {action.label}
            </a>
          ))}
        </div>

        {/* Scroll hint */}
        <a
          href="#dossier"
          className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <span className="w-px h-6 bg-white/40 inline-block" />
          <span>Scroll</span>
        </a>
      </div>
    </header>
  );
}