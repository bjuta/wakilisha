import React, { useState } from "react";
import { EvidenceWorkspaceProps } from "./workspaceTypes";

export default function ChartDataWorkspace({
  initialMetadata,
  onSave,
}: EvidenceWorkspaceProps<{
  chartFamily?: string;
  market?: string;
  chartWeek?: string;
  chartEdition?: string;
  listingEntity?: string;
  rank?: number;
  movement?: number;
  peak?: number;
  weeksOnChart?: number;
  platformContext?: string;
  previewDataNote?: string;
  indicates?: string;
  doesNotProve?: string;
}>) {
  const [chartFamily, setChartFamily] = useState(initialMetadata?.chartFamily || "");
  const [market, setMarket] = useState(initialMetadata?.market || "");
  const [chartWeek, setChartWeek] = useState(initialMetadata?.chartWeek || "");
  const [chartEdition, setChartEdition] = useState(initialMetadata?.chartEdition || "");
  const [listingEntity, setListingEntity] = useState(initialMetadata?.listingEntity || "");
  const [rank, setRank] = useState(initialMetadata?.rank || 0);
  const [movement, setMovement] = useState(initialMetadata?.movement || 0);
  const [peak, setPeak] = useState(initialMetadata?.peak || 0);
  const [weeksOnChart, setWeeksOnChart] = useState(initialMetadata?.weeksOnChart || 0);
  const [platformContext, setPlatformContext] = useState(initialMetadata?.platformContext || "");
  const [previewDataNote, setPreviewDataNote] = useState(initialMetadata?.previewDataNote || "");
  const [indicates, setIndicates] = useState(initialMetadata?.indicates || "");
  const [doesNotProve, setDoesNotProve] = useState(initialMetadata?.doesNotProve || "");

  const [producedWork, setProducedWork] = useState(
    `${chartFamily} ${market} ${chartWeek}`.trim()
  );

  async function handleSave() {
    await onSave(
      {
        chartFamily,
        market,
        chartWeek,
        chartEdition,
        listingEntity,
        rank,
        movement,
        peak,
        weeksOnChart,
        platformContext,
        previewDataNote,
        indicates,
        doesNotProve,
      },
      producedWork
    );
  }

  return (
    <div>
      <h2>Chart Data Workspace</h2>
      <p>Purpose: A chart intelligence workspace that understands WAKILISHA chart structure.</p>

      <section>
        <h3>Chart details</h3>
        <label>
          Chart family
          <input
            type="text"
            value={chartFamily}
            onChange={(e) => setChartFamily(e.target.value)}
          />
        </label>
        <label>
          Market
          <input type="text" value={market} onChange={(e) => setMarket(e.target.value)} />
        </label>
        <label>
          Chart week
          <input type="text" value={chartWeek} onChange={(e) => setChartWeek(e.target.value)} />
        </label>
        <label>
          Chart edition
          <input
            type="text"
            value={chartEdition}
            onChange={(e) => setChartEdition(e.target.value)}
          />
        </label>
      </section>

      <section>
        <h3>Listing and rank</h3>
        <label>
          Listing/entity
          <input
            type="text"
            value={listingEntity}
            onChange={(e) => setListingEntity(e.target.value)}
          />
        </label>
        <label>
          Rank
          <input
            type="number"
            value={rank}
            onChange={(e) => setRank(Number(e.target.value))}
          />
        </label>
        <label>
          Movement
          <input
            type="number"
            value={movement}
            onChange={(e) => setMovement(Number(e.target.value))}
          />
        </label>
        <label>
          Peak
          <input
            type="number"
            value={peak}
            onChange={(e) => setPeak(Number(e.target.value))}
          />
        </label>
        <label>
          Weeks on chart
          <input
            type="number"
            value={weeksOnChart}
            onChange={(e) => setWeeksOnChart(Number(e.target.value))}
          />
        </label>
      </section>

      <section>
        <h3>Context and notes</h3>
        <label>
          Platform/source context
          <textarea
            value={platformContext}
            onChange={(e) => setPlatformContext(e.target.value)}
          />
        </label>
        <label>
          Preview or media note
          <textarea
            value={previewDataNote}
            onChange={(e) => setPreviewDataNote(e.target.value)}
          />
        </label>
        <label>
          What this indicates
          <textarea value={indicates} onChange={(e) => setIndicates(e.target.value)} />
        </label>
        <label>
          What this does not prove
          <textarea value={doesNotProve} onChange={(e) => setDoesNotProve(e.target.value)} />
        </label>
      </section>

      <section>
        <h3>Assistant inspection (not wired yet)</h3>
        <p>The assistant will later inspect chart data and metadata.</p>
      </section>

      <section>
        <h3>Review</h3>
        <p>What this indicates and what this does not prove.</p>
      </section>

      <button onClick={handleSave}>Save evidence</button>
    </div>
  );
}
