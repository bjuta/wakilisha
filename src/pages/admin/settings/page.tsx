import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { SETTINGS_DOMAINS } from "@/services/adminSettings/settingsTypes";
import type { WkIconName } from "@/components/design-system/Icon";

export default function AdminSettingsHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Settings" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Platform Settings</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)] max-w-[640px]">
          Settings belong to WAKILISHA Admin, not WAKILISHA Charts.
          Charts is one operating domain. The settings system is ready for music, audience, and future WAKILISHA domains.
        </p>
      </div>

      {/* Domain Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SETTINGS_DOMAINS.map((domain) => (
          <DomainCard
            key={domain.key}
            domain={domain}
            onClick={() => navigate(domain.route)}
          />
        ))}
      </div>

      {/* Context Note */}
      <WkSurface className="p-4 border-l-4 border-[var(--wk-brand)]">
        <div className="flex items-start gap-3">
          <WkIcon name="Info" size={18} className="text-[var(--wk-brand)] mt-0.5" />
          <div>
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Settings Architecture</h3>
            <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">
              Each settings domain controls a specific aspect of the platform. Changes are persisted locally in this session.
              In production, settings will be backed by the admin settings API.
            </p>
            <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">
              Provider credentials are masked and never exposed in full. Test connections before relying on a provider.
            </p>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}

function DomainCard({
  domain,
  onClick,
}: {
  domain: (typeof SETTINGS_DOMAINS)[number];
  onClick: () => void;
}) {
  const healthColor =
    domain.health === "healthy"
      ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
      : domain.health === "warning"
      ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"
      : domain.health === "critical"
      ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
      : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]";

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)] hover:shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
          <WkIcon name={domain.icon as WkIconName} size={20} />
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${healthColor}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${domain.health === "healthy" ? "bg-[var(--wk-success)]" : domain.health === "warning" ? "bg-[var(--wk-warning)]" : domain.health === "critical" ? "bg-[var(--wk-danger)]" : "bg-[var(--wk-text-muted)]"}`} />
          {domain.health || "unknown"}
        </span>
      </div>
      <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1">{domain.label}</h3>
      <p className="text-[12px] text-[var(--wk-text-muted)] leading-relaxed mb-3">{domain.description}</p>
      <div className="flex items-center justify-between">
        {domain.lastUpdated && (
          <span className="text-[10px] text-[var(--wk-text-faint)]">Updated {domain.lastUpdated}</span>
        )}
        <span className="text-[12px] font-semibold text-[var(--wk-brand)] group-hover:underline">
          {domain.primaryAction || "Configure"}
        </span>
      </div>
    </button>
  );
}