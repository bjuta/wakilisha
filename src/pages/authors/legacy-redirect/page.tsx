import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { resolvePublicRegistryAuthorPerson } from "@/services/people/authorCompatibilityService";

export default function LegacyAuthorPersonRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [target, setTarget] =
    useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;

    if (!slug) {
      setTarget(null);
      return () => {
        alive = false;
      };
    }

    resolvePublicRegistryAuthorPerson(slug)
      .then((resolved) => {
        if (!alive) return;
        setTarget(
          resolved?.canonicalPath ?? null,
        );
      })
      .catch(() => {
        if (!alive) return;
        setTarget(null);
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  if (target === undefined) {
    return (
      <main
        className="min-h-[40vh]"
        aria-busy="true"
        aria-label="Resolving contributor profile"
      />
    );
  }

  if (!target) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={target} replace />;
}
