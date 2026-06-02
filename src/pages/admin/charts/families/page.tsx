import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";

interface ChartFamily {
  id: string;
  familyKey: string;
  label: string;
  description: string;
  defaultChartSize: number;
  defaultRegion: string;
  editionFrequency: string;
  defaultRuleset: string;
  defaultScoringModel: string;
  createdAt: string;
  updatedAt: string;
}

const families: ChartFamily[] = [
  {
    id: "fam-001",
    familyKey: "wakilisha_top_40",
    label: "WAKILISHA Top 40",
    description: "The definitive weekly chart of the most streamed African tracks across all platforms.",
    defaultChartSize: 40,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "standard_weekly",
    defaultScoringModel: "weighted_multi_source_v1",
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2026-05-20T14:30:00Z",
  },
  {
    id: "fam-002",
    familyKey: "wakilisha_top_100",
    label: "WAKILISHA Top 100",
    description: "The extended weekly chart capturing the full breadth of African music consumption.",
    defaultChartSize: 100,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "standard_weekly",
    defaultScoringModel: "weighted_multi_source_v1",
    createdAt: "2025-02-01T10:00:00Z",
    updatedAt: "2026-05-20T14:30:00Z",
  },
  {
    id: "fam-003",
    familyKey: "wakilisha_afrobeats_20",
    label: "Afrobeats Top 20",
    description: "Weekly Afrobeats-specific chart focused on the genre's global reach.",
    defaultChartSize: 20,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "genre_specific",
    defaultScoringModel: "weighted_multi_source_v1",
    createdAt: "2025-03-10T10:00:00Z",
    updatedAt: "2026-05-20T14:30:00Z",
  },
  {
    id: "fam-004",
    familyKey: "wakilisha_gengetone_20",
    label: "Gengetone Top 20",
    description: "Kenyan Gengetone-specific chart tracking the most popular Gengetone tracks.",
    defaultChartSize: 20,
    defaultRegion: "Kenya",
    editionFrequency: "weekly",
    defaultRuleset: "genre_specific",
    defaultScoringModel: "weighted_multi_source_v1",
    createdAt: "2025-04-01T10:00:00Z",
    updatedAt: "2026-05-20T14:30:00Z",
  },
  {
    id: "fam-005",
    familyKey: "wakilisha_rnb_20",
    label: "R&B Top 20",
    description: "African R&B chart highlighting the best R&B tracks from the continent.",
    defaultChartSize: 20,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "genre_specific",
    defaultScoringModel: "weighted_multi_source_v1",
    createdAt: "2025-04-15T10:00:00Z",
    updatedAt: "2026-05-20T14:30:00Z",
  },
];

export default function AdminChartsFamilies() {
  const navigate = useNavigate();
  const [selectedFamily, setSelectedFamily] = useState<ChartFamily | null>(null);
  const [search, setSearch] = useState("");

  const filtered = families.filter(
    (f) =>
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.familyKey.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-foreground-500">
            Chart Configuration
          </div>
          <h1 className="text-[20px] font-bold text-foreground-950">Chart Families</h1>
          <p className="text-[13px] text-foreground-600">
            Manage chart family configurations, rulesets, and scoring models
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-4 py-2 text-[13px] font-semibold text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap">
          <i className="ri-add-line" />
          New Family
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search families..."
            className="w-full rounded-md border border-background-200 bg-background-50 py-2 pl-9 pr-3 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <span className="text-[12px] text-foreground-500">{filtered.length} families</span>
      </div>

      {/* Families Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((family) => (
          <FamilyCard
            key={family.id}
            family={family}
            selected={selectedFamily?.id === family.id}
            onClick={() => setSelectedFamily(family)}
            onIngest={() => navigate("/admin/charts/ingest")}
          />
        ))}
      </div>

      {/* Family Detail Panel */}
      {selectedFamily && (
        <WkSurface className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[16px] font-bold text-foreground-950">{selectedFamily.label}</h2>
              <p className="text-[12px] text-foreground-500 font-mono">{selectedFamily.familyKey}</p>
            </div>
            <button
              onClick={() => setSelectedFamily(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-400 hover:bg-background-100 hover:text-foreground-700"
            >
              <i className="ri-close-line" />
            </button>
          </div>
          <p className="mt-2 text-[13px] text-foreground-700">{selectedFamily.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DetailItem label="Chart Size" value={selectedFamily.defaultChartSize} />
            <DetailItem label="Frequency" value={selectedFamily.editionFrequency} />
            <DetailItem label="Region" value={selectedFamily.defaultRegion} />
            <DetailItem label="Ruleset" value={selectedFamily.defaultRuleset} />
            <DetailItem label="Scoring Model" value={selectedFamily.defaultScoringModel} />
            <DetailItem label="Created" value={new Date(selectedFamily.createdAt).toLocaleDateString()} />
            <DetailItem label="Updated" value={new Date(selectedFamily.updatedAt).toLocaleDateString()} />
          </div>
          <div className="mt-4 flex gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[12px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 whitespace-nowrap">
              <i className="ri-edit-line" /> Edit
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[12px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 whitespace-nowrap">
              <i className="ri-file-copy-line" /> Duplicate
            </button>
            <button
              onClick={() => navigate("/admin/charts/ingest")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-3 py-2 text-[12px] font-semibold text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap"
            >
              <i className="ri-add-line" /> New Ingest
            </button>
          </div>
        </WkSurface>
      )}
    </div>
  );
}

function FamilyCard({
  family,
  selected,
  onClick,
  onIngest,
}: {
  family: ChartFamily;
  selected: boolean;
  onClick: () => void;
  onIngest: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border p-4 transition-all ${
        selected
          ? "border-primary-400 bg-primary-50 ring-1 ring-primary-400"
          : "border-background-200 bg-background-50 hover:border-background-300 hover:bg-background-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-bar-chart-grouped-line text-lg" />
        </div>
        <span className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-semibold text-foreground-500">
          {family.editionFrequency}
        </span>
      </div>
      <h3 className="mt-3 text-[14px] font-bold text-foreground-950">{family.label}</h3>
      <p className="mt-1 text-[12px] text-foreground-600 line-clamp-2">{family.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded bg-background-100 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-500">
          {family.defaultChartSize} tracks
        </span>
        <span className="rounded bg-background-100 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-500">
          {family.defaultRegion}
        </span>
        <span className="rounded bg-background-100 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-500">
          {family.defaultRuleset}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onIngest(); }}
          className="inline-flex items-center gap-1 rounded-md bg-primary-500 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-add-line" /> Ingest
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-background-100 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-foreground-950">{value}</p>
    </div>
  );
}