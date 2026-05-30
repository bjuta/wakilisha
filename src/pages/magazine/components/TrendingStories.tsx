import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

interface TrendingStory {
  slug: string;
  title: string;
  section: string;
  readCount: number;
}

interface WkTrendingStoriesProps {
  stories: TrendingStory[];
}

function formatReadCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export function WkTrendingStories({ stories }: WkTrendingStoriesProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="wk-eyebrow">Trending now</div>
      </div>
      <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
        {stories.map((story, index) => (
          <Link
            key={story.slug}
            to={`/magazine/${story.slug}`}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--wk-surface-raised)]"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <span className="text-[11px] font-bold">{index + 1}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate text-[13px] font-bold text-[var(--wk-text)]">
                  {story.title}
                </h4>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <WkTag>{story.section}</WkTag>
                <span className="text-[11px] text-[var(--wk-text-faint)]">
                  {formatReadCount(story.readCount)} reads
                </span>
              </div>
            </div>
            <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}