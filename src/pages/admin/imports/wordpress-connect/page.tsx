import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

type Step = "choose" | "details" | "review" | "run";
type Source = "rest" | "database" | "zip";

export default function AdminWordPressConnectWizardPage() {
  const [step, setStep] = useState<Step>("choose");
  const [source, setSource] = useState<Source>("rest");
  const [siteUrl, setSiteUrl] = useState("");
  const [dbHost, setDbHost] = useState("");
  const [dbName, setDbName] = useState("");
  const [dbPrefix, setDbPrefix] = useState("wp_");
  const normalizedSite = useMemo(() => siteUrl.trim().replace(/\/$/, ""), [siteUrl]);

  const command = source === "rest"
    ? `DATABASE_URL="$DATABASE_URL" \\
WP_SITE_URL="${normalizedSite || "https://example.com"}" \\
WP_REST_USER="wordpress-user" \\
WP_REST_APP_PASSWORD="application-password" \\
npm run imports:connect-wordpress-rest`
    : source === "database"
      ? `DATABASE_URL="$DATABASE_URL" \\
WP_DB_HOST="${dbHost || "your-db-host"}" \\
WP_DB_USER="your-db-user" \\
WP_DB_PASSWORD="your-db-password" \\
WP_DB_NAME="${dbName || "wordpress"}" \\
WP_DB_PREFIX="${dbPrefix || "wp_"}" \\
npm run imports:connect-wordpress-database`
      : `Go to /admin/imports/upload and upload a WordPress export ZIP.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports / WordPress</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">WordPress Migration Connector</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">A browser-side guide for choosing a migration source and generating the safe server command. Secrets are never submitted from this page.</p>
        </div>
        <Link to="/admin/imports/jobs" className="wk-button wk-button-ghost wk-button-sm"><WkIcon name="List" size={14} /> Jobs</Link>
      </div>

      <WkSurface className="p-0 overflow-hidden">
        <div className="grid gap-px bg-wk-border lg:grid-cols-[280px_1fr]">
          <aside className="bg-wk-surface p-5 space-y-2">
            {[["choose", "1", "Choose source"], ["details", "2", "Enter details"], ["review", "3", "Review contract"], ["run", "4", "Run command"]].map(([id, number, label]) => <button key={id} onClick={() => setStep(id as Step)} className={`w-full rounded-xl border p-3 text-left ${step === id ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-bg-subtle"}`}><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-wk-surface text-[11px] font-black">{number}</span><span className="text-[13px] font-black text-wk-text">{label}</span></button>)}
          </aside>
          <section className="bg-wk-surface p-6">
            {step === "choose" && <div className="grid gap-4 md:grid-cols-3">{[["rest", "REST API", "Best first option. Works through WordPress HTTP APIs."], ["database", "Direct database", "Best for full migration when DB access is available."], ["zip", "ZIP upload", "Use exported files when server access is limited."]].map(([id, title, body]) => <button key={id} onClick={() => setSource(id as Source)} className={`rounded-2xl border p-5 text-left ${source === id ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-bg-subtle"}`}><h3 className="text-[15px] font-black text-wk-text">{title}</h3><p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{body}</p></button>)}</div>}
            {step === "details" && <div className="space-y-4 max-w-2xl">{source === "rest" && <label className="block"><span className="text-[12px] font-bold text-wk-text">Site URL</span><input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label>}{source === "database" && <><label className="block"><span className="text-[12px] font-bold text-wk-text">DB host</span><input value={dbHost} onChange={(e) => setDbHost(e.target.value)} className="mt-2 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label><label className="block"><span className="text-[12px] font-bold text-wk-text">DB name</span><input value={dbName} onChange={(e) => setDbName(e.target.value)} className="mt-2 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label><label className="block"><span className="text-[12px] font-bold text-wk-text">Table prefix</span><input value={dbPrefix} onChange={(e) => setDbPrefix(e.target.value)} className="mt-2 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label></>}{source === "zip" && <p className="text-[13px] leading-6 text-wk-text-muted">No credentials needed. Use the real ZIP upload route.</p>}</div>}
            {step === "review" && <div className="space-y-4"><h2 className="text-[18px] font-black text-wk-text">Review before running</h2><p className="text-[13px] leading-6 text-wk-text-muted">Source: <b>{source}</b>. Credentials must be supplied in the server shell or environment only. The app will create a scanned ingestion job, then staging/finalization scripts can take over.</p></div>}
            {step === "run" && <div><h2 className="text-[18px] font-black text-wk-text">Run this on the server</h2><pre className="mt-4 overflow-auto rounded-xl border border-wk-border bg-wk-bg-subtle p-4 text-[12px] leading-6 text-wk-text">{command}</pre></div>}
          </section>
        </div>
      </WkSurface>
    </div>
  );
}
