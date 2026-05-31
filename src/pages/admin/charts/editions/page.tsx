import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export default function AdminChartsEditions() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="wk-eyebrow mb-2">Published Charts</div>
          <h1 className="wk-h-page">Chart Editions</h1>
        </div>
        <button className="wk-button wk-button-primary whitespace-nowrap">
          <i className="ri-add-line" />
          New Edition
        </button>
      </div>
      <WkSurface className="p-8">
        <div className="text-center">
          <i className="ri-stack-line mb-4 block text-4xl text-[var(--wk-text-faint)]" />
          <h2 className="text-[16px] font-bold text-[var(--wk-text)]">Chart Editions</h2>
          <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">
            Browse, edit, and manage published chart editions.
          </p>
          <p className="mt-1 text-[12px] text-[var(--wk-text-faint)]">
            This screen is coming in the next patch.
          </p>
          <button
            onClick={() => navigate("/admin/charts/dashboard")}
            className="mt-4 wk-button wk-button-ghost"
          >
            Back to Dashboard
          </button>
        </div>
      </WkSurface>
    </div>
  );
}