import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export default function AdminWordPressReactMigrationWizardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">WordPress → React Migration Wizard</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            Simulation has been removed. This wizard now points to the real ZIP upload and real import jobs until the backend processor exposes scan, mapping, media, run and verification APIs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/imports/upload" className="wk-button wk-button-primary wk-button-sm"><WkIcon name="FileUp" size={14} /> Upload real ZIP</Link>
          <Link to="/admin/imports/jobs" className="wk-button wk-button-ghost wk-button-sm"><WkIcon name="List" size={14} /> View real jobs</Link>
        </div>
      </div>

      <WkSurface className="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard icon="FileUp" title="1. Upload" body="Use the ZIP upload page to create a real wk_ingestion_runs record. No invented progress or counts should be shown." />
          <StatusCard icon="Database" title="2. Process" body="A backend worker must validate, stage and import the archive, then update the job row with real counts, warnings and errors." />
          <StatusCard icon="ClipboardCheck" title="3. Verify" body="The wizard will be re-enabled once real scan/mapping/verification endpoints exist." />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[16px] font-black text-wk-text">Required backend endpoints before the guided wizard returns</h2>
        <div className="mt-4 space-y-3 text-[13px] leading-6 text-wk-text-muted">
          <p><b className="text-wk-text">POST /imports/wordpress/zip</b> — upload/archive registration.</p>
          <p><b className="text-wk-text">POST /imports/:id/scan</b> — real source scan only.</p>
          <p><b className="text-wk-text">GET /imports/:id/mappings</b> — real detected field mappings.</p>
          <p><b className="text-wk-text">POST /imports/:id/run</b> — start backend migration job.</p>
          <p><b className="text-wk-text">GET /imports/:id/verification</b> — real post-migration checks.</p>
        </div>
      </WkSurface>
    </div>
  );
}

function StatusCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-wk-border bg-wk-bg-subtle p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-wk-brand-soft"><WkIcon name={icon as never} size={18} className="text-wk-brand" /></div>
      <h3 className="text-[14px] font-black text-wk-text">{title}</h3>
      <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{body}</p>
    </div>
  );
}
