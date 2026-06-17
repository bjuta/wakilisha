import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMagazineArticles } from '@/services/magazineArticles';
import { SkeletonMagazinePage } from '@/components/skeletons/Skeletons';
import {
  buildMagazineIssues,
  getAdjacentIssues,
  issueUrl,
  resolveIssueByKey,
} from '@/services/magazineIssues';
import { buildIssueEditorialSystem } from '@/services/magazineNlg';
import { IssueExperienceShell } from '@/components/magazine/issueExperience';
import { useArtDirector } from '@/magazine-art-director';
import { useTheme } from '@/components/design-system/theme/ThemeProvider';
import './magazineIssue.css';
import './magazineIssueVariants.css';
import './magazineImmersive.css';
import '@/magazine-art-director/schools.css';

const PUBLIC_API_BASE = String(import.meta.env.VITE_PUBLIC_API_BASE ?? '/api/v1').replace(/\/$/, '');

async function fetchPublishedIssue(slug: string): Promise<{ data: Record<string, unknown> } | null> {
  try {
    const response = await fetch(`${PUBLIC_API_BASE}/magazine/public/issues/${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function MagazineIssueError({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
      <div className="text-center px-6 max-w-lg">
        <p style={{ fontFamily: 'var(--mag-display)', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', color: 'var(--mag-text)' }}>
          Issue unavailable
        </p>
        <p className="mt-4 text-[15px] text-[var(--wk-text-muted)] leading-relaxed">{message}</p>
        <Link
          to="/magazine/issues"
          className="inline-flex items-center gap-2 mt-6 text-[13px] font-bold text-[var(--wk-brand)] hover:underline whitespace-nowrap"
        >
          Browse published issues
        </Link>
      </div>
    </main>
  );
}

function usePublishedIssueGate(issueKey?: string) {
  const [publishedIssueData, setPublishedIssueData] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [checkingPublished, setCheckingPublished] = useState(true);

  useEffect(() => {
    if (!issueKey) {
      setCheckingPublished(false);
      return;
    }

    let cancelled = false;
    fetchPublishedIssue(issueKey)
      .then((result) => {
        if (cancelled) return;
        setPublishedIssueData(result?.data ?? null);
        setCheckingPublished(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPublishedIssueData(null);
        setCheckingPublished(false);
      });

    return () => {
      cancelled = true;
    };
  }, [issueKey]);

  return { publishedIssueData, checkingPublished };
}

export default function MagazineIssuePage() {
  const { issueKey } = useParams<{ issueKey: string }>();
  const { articles, loading, error } = useMagazineArticles();
  const { theme } = useTheme();
  const { publishedIssueData, checkingPublished } = usePublishedIssueGate(issueKey);

  const issueNumber = useMemo(() => {
    const match = issueKey?.match(/issue-0*(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 1;
  }, [issueKey]);

  const { issueClass, cssVars } = useArtDirector(issueNumber, theme);

  if (loading || checkingPublished) return <SkeletonMagazinePage />;
  if (error) return <MagazineIssueError message={error} />;

  if (publishedIssueData === null) {
    return (
      <MagazineIssueError message="This issue has not been published yet. Once the editorial team opens it to readers, it will appear here." />
    );
  }

  const issues = buildMagazineIssues(articles);
  const issue = resolveIssueByKey(issues, issueKey);
  if (!issue) return <MagazineIssueError message="This issue has no stories yet." />;

  const experience = buildIssueEditorialSystem(issue);
  const { previousIssue, nextIssue } = getAdjacentIssues(issues, issue);

  return (
    <main className={issueClass} style={cssVars}>
      <IssueExperienceShell
        issue={issue}
        experience={experience}
        previousHref={previousIssue ? issueUrl(previousIssue) : undefined}
        previousLabel={previousIssue?.issueLabel}
        nextHref={nextIssue ? issueUrl(nextIssue) : undefined}
        nextLabel={nextIssue?.issueLabel}
      />
    </main>
  );
}
