import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export default function AdminSettingsAudience() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-5 w-5 items-center justify-center">
            <WkIcon name="Users" size={20} className="text-[var(--wk-brand)]" />
          </span>
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Audience</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Subscriber management has moved to the Email &amp; Briefings hub.</p>
      </div>

      <WkSurface className="p-8 text-center space-y-4">
        <span className="flex h-12 w-12 items-center justify-center mx-auto rounded-full bg-[var(--wk-brand-soft)]">
          <WkIcon name="Mail" size={24} className="text-[var(--wk-brand)]" />
        </span>
        <div>
          <h2 className="text-[16px] font-bold text-[var(--wk-text)]">Audience settings are now in Email &amp; Briefings</h2>
          <p className="text-[13px] text-[var(--wk-text-muted)] mt-1 max-w-md mx-auto">
            Subscriber defaults, opt-in settings, follow notifications, and briefing management are all now part of the briefing infrastructure with real Supabase-backed data.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/settings/email-briefings")}
          className="wk-button wk-button-primary wk-button-sm inline-flex items-center gap-2"
        >
          <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name="ArrowRight" size={14} /></span>
          Go to Email &amp; Briefings
        </button>
      </WkSurface>
    </div>
  );
}