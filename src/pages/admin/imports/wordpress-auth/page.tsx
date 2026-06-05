import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

type AuthMode = "application_password" | "rest_public" | "database";

export default function AdminWordPressAuthPage() {
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<AuthMode>("application_password");
  const normalized = useMemo(() => siteUrl.trim().replace(/\/$/, ""), [siteUrl]);
  const restUrl = normalized ? `${normalized}/wp-json/wp/v2` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports / WordPress</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">Connect WordPress</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">Choose how WAKILISHA should read the old WordPress site. This screen does not store passwords in the browser or database; it prepares the connection contract and shows the exact server-side command to run.</p>
        </div>
        <Link to="/admin/imports/wizard" className="wk-button wk-button-ghost wk-button-sm"><WkIcon name="ArrowLeft" size={14} /> Back to wizard</Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <WkSurface className="p-6">
          <h2 className="text-[16px] font-black text-wk-text">Connection details</h2>
          <div className="mt-5 space-y-4">
            <label className="block"><span className="text-[12px] font-bold text-wk-text">WordPress site URL</span><input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label>
            <label className="block"><span className="text-[12px] font-bold text-wk-text">WordPress username</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin/editor username" className="mt-2 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label>
            <div><span className="text-[12px] font-bold text-wk-text">Connection mode</span><div className="mt-2 grid gap-3 md:grid-cols-3">{[
              ["application_password", "Admin auth", "Best for private content using a WordPress Application Password."],
              ["rest_public", "Public REST", "Reads public posts/pages only. No password needed."],
              ["database", "Database", "Use MySQL credentials on the server side only."],
            ].map(([key, title, body]) => <button key={key} onClick={() => setMode(key as AuthMode)} className={`rounded-2xl border p-4 text-left ${mode === key ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-bg-subtle"}`}><h3 className="text-[13px] font-black text-wk-text">{title}</h3><p className="mt-1 text-[11px] leading-5 text-wk-text-muted">{body}</p></button>)}</div></div>
          </div>
        </WkSurface>

        <WkSurface className="p-5">
          <h2 className="text-[15px] font-black text-wk-text">Connection contract</h2>
          <div className="mt-4 space-y-3 text-[12px] leading-5 text-wk-text-muted">
            <p><b className="text-wk-text">REST endpoint:</b><br />{restUrl || "Enter a site URL"}</p>
            <p><b className="text-wk-text">Credentials:</b><br />Never persisted. Use env vars or CLI args on the server.</p>
            <p><b className="text-wk-text">Next step:</b><br />Run the connector command from a trusted server shell.</p>
          </div>
        </WkSurface>
      </div>

      <WkSurface className="p-5">
        <h2 className="text-[15px] font-black text-wk-text">Server command</h2>
        {mode === "rest_public" || mode === "application_password" ? (
          <pre className="mt-3 overflow-auto rounded-xl border border-wk-border bg-wk-bg-subtle p-4 text-[12px] leading-6 text-wk-text">{`DATABASE_URL="$DATABASE_URL" \\
WP_SITE_URL="${normalized || "https://example.com"}" \\
${mode === "application_password" ? `WP_REST_USER="${username || "wordpress-user"}" \\
WP_REST_APP_PASSWORD="paste-application-password-here" \\
` : ""}npm run imports:connect-wordpress-rest`}</pre>
        ) : (
          <pre className="mt-3 overflow-auto rounded-xl border border-wk-border bg-wk-bg-subtle p-4 text-[12px] leading-6 text-wk-text">{`DATABASE_URL="$DATABASE_URL" \\
WP_DB_HOST="your-wordpress-db-host" \\
WP_DB_USER="your-wordpress-db-user" \\
WP_DB_PASSWORD="your-wordpress-db-password" \\
WP_DB_NAME="your-wordpress-db-name" \\
WP_DB_PREFIX="wp_" \\
npm run imports:connect-wordpress-database`}</pre>
        )}
      </WkSurface>
    </div>
  );
}
