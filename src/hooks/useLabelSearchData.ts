import { useState, useEffect } from "react";
import { listLabels } from "@/services/publicContent/client";
import { buildLabelSearchSnippet } from "@/services/cultureContext/searchAdapters";
import { normalizeCountry } from "@/services/cultureContext/formatters";

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
        const labels = await listLabels();

        if (!alive) return;

        const mapped: LabelSearchItem[] = labels.map((label) => {
          const item = {
            slug: label.slug,
            name: label.name,
            country: normalizeCountry(label.country) || "",
            artistCount: label.artistCount,
            releaseCount: label.releaseCount,
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
