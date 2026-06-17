import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildLabelSearchSnippet } from "@/services/cultureContext/searchAdapters";

export interface LabelSearchItem {
  slug: string;
  name: string;
  country: string;
  artistCount: number;
  releaseCount: number;
  contextText: string;
}

export function useLabelSearchData() {
  const [data, setData] = useState<LabelSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: labels, error: err } = await supabase
          .from("registry_labels")
          .select("slug, name, country_code")
          .eq("status", "active")
          .order("name");

        if (!alive) return;
        if (err) {
          console.error("Failed to fetch labels for search:", err.message);
          setError(err.message);
          return;
        }

        // Count releases per label from release metadata.record_label
        let releaseCountsByLabel: Record<string, number> = {};
        if (labels && labels.length > 0) {
          const labelNames = labels.map((l) => l.name.toLowerCase());
          const { data: releases } = await supabase
            .from("registry_releases")
            .select("metadata")
            .eq("status", "active");

          (releases || []).forEach((r) => {
            const meta = (r.metadata as Record<string, unknown>) || {};
            const recordLabel = typeof meta.record_label === "string" ? meta.record_label.toLowerCase() : "";
            if (recordLabel && labelNames.includes(recordLabel)) {
              releaseCountsByLabel[recordLabel] = (releaseCountsByLabel[recordLabel] || 0) + 1;
            }
          });
        }

        const mapped: LabelSearchItem[] = (labels || []).map((l) => {
          const item = {
            slug: l.slug,
            name: l.name,
            country: l.country_code || "",
            artistCount: 0,
            releaseCount: releaseCountsByLabel[l.name.toLowerCase()] || 0,
          };

          return {
            ...item,
            contextText: buildLabelSearchSnippet(item),
          };
        });

        setData(mapped);
      } catch (e) {
        console.error("Failed to fetch labels for search:", e);
        if (alive) setError("Failed to load labels");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    return () => { alive = false; };
  }, []);

  return { data, loading, error };
}
