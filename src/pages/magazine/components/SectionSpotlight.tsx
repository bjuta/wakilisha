import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

interface SectionStory {
  slug: string;
  title: string;
  section: string;
  date: string;
  readingTime?: number;
  heroUrl?: string;
  author: string;
}

interface WkSectionSpotlightProps {
  stories: SectionStory[];
}

export function WkSectionSpotlight({ stories }: WkSectionSpotlightProps) {
  const sectionMap = stories.reduce((acc, story) => {
    if (!acc[story.section]) acc[story.section] = [];
    acc[story.section].push(story);
    return acc;
  }, {} as Record<string, SectionStory[]>);

  const sections = Object.keys(sectionMap).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="wk-eyebrow">Latest by section</div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const sectionStories = sectionMap[section].slice(0, 3);
          return (
            <div
              key={section}
              className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <WkTag variant="brand">{section}</WkTag>
                <span className="text-[11px] text-[var(--wk-text-faint)]">
                  {sectionMap[section].length} stories
                </span>
              </div>
              <div className="space-y-3">
                {sectionStories.map((story) => (
                  <Link
                    key={story.slug}
                    to={`/magazine/${story.slug}`}
                    className="group flex items-start gap-3"
                  >
                    {story.heroUrl && (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                        <img
                          src={story.heroUrl}
                          alt={story.title}
                          className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-fast)] group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="line-clamp-2 text-[12px] font-bold leading-snug text-[var(--wk-text)]">
                        {story.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                        <span>{story.author}</span>
                        <span>·</span>
                        <span>{story.date}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}