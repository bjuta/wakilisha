import type { ReactNode } from 'react';

export type PageHeroVariant = 'default' | 'mag' | 'charts' | 'artist';

type HeroStat = { value: string | number; label: string };

type PageHeroProps = {
  variant?: PageHeroVariant;
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  stats?: HeroStat[];
  backgroundImage?: string | null;
};

export function PageHero({ variant = 'default', eyebrow, title, subtitle, actions, stats = [], backgroundImage }: PageHeroProps) {
  const style = backgroundImage
    ? { backgroundImage: `linear-gradient(180deg, transparent 0%, rgba(8,9,8,.94) 100%), url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  return (
    <section className="pg-hero">
      <div className={`pg-hero-bg ${variant}`} style={style}>
        <div className="pg-hero-inner">
          <div className="pg-hero-eyebrow"><span className="pg-hero-dot" />{eyebrow}</div>
          <h1 className="pg-hero-title">{title}</h1>
          {subtitle && <p className="pg-hero-sub">{subtitle}</p>}
          {actions && <div className="pg-hero-actions">{actions}</div>}
          {stats.length > 0 && (
            <div className="pg-hero-stat-row">
              {stats.map((stat) => (
                <div key={`${stat.label}-${stat.value}`} className="pg-hero-stat">
                  <div className="pg-hero-stat-val">{stat.value}</div>
                  <div className="pg-hero-stat-lbl">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
