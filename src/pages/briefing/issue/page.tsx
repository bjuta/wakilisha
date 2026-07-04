import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { briefingService } from "@/services/briefingService";
import { MetaTags } from "@/components/seo/MetaTags";

export default function BriefingIssuePage() {
  const { issueId } = useParams<{ issueId: string }>();
  const [issueHtml, setIssueHtml] = useState<string | null>(null);
  const [issueTitle, setIssueTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) { setError("We couldn't find this briefing."); setLoading(false); return; }
    let alive = true;
    setLoading(true);

    briefingService.admin.getIssue(issueId)
      .then((result: any) => {
        if (!alive) return;
        if (result?.issue?.html_body) {
          let html = result.issue.html_body as string;
          // Replace placeholder tokens with friendly text for web view
          html = html.replace(/\{\{unsubscribe_url\}\}/g, "#");
          html = html.replace(/\{\{preferences_url\}\}/g, "#");
          html = html.replace(/<a href="#"[^>]*>Unsubscribe<\/a>/gi, "<span>Unsubscribe</span>");
          html = html.replace(/<a href="#"[^>]*>Manage preferences<\/a>/gi, "<span>Manage preferences</span>");
          setIssueHtml(html);
          setIssueTitle(result.issue.title ?? "WAKILISHA Briefing");
        } else {
          setError("This briefing isn't available to view online yet.");
        }
      })
      .catch(() => {
        if (!alive) return;
        setError("We couldn't load this briefing.");
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [issueId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f6f4ef" }}>
        <div style={{ fontFamily: "Inter, Arial, sans-serif", color: "#5a5a5a", fontSize: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #85C441", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Loading briefing...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 px-4" style={{ background: "#f6f4ef" }}>
        <div style={{ fontFamily: "Inter, Arial, sans-serif", textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a", margin: "0 0 8px" }}>Briefing not found</h1>
          <p style={{ fontSize: 14, color: "#5a5a5a", margin: "0 0 20px" }}>{error}</p>
          <Link to="/" style={{ display: "inline-block", background: "#85C441", color: "#111", textDecoration: "none", fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "10px 20px" }}>
            Back to WAKILISHA
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <MetaTags
        title={`${issueTitle} — WAKILISHA`}
        description={`Read ${issueTitle} on the web`}
      />
      <div style={{ background: "#f6f4ef", minHeight: "100vh", padding: "32px 0" }}>
        {/* Top nav bar */}
        <div style={{
          maxWidth: 600,
          margin: "0 auto 24px",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <span style={{ fontFamily: "Inter, Arial, sans-serif", fontWeight: 900, fontSize: 16, color: "#1a1a1a", letterSpacing: "-0.04em" }}>WAKILISHA</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              to="/briefing/preferences"
              style={{ fontSize: 12, color: "#5a5a5a", textDecoration: "underline", fontFamily: "Inter, Arial, sans-serif" }}
            >
              Manage subscription
            </Link>
          </div>
        </div>

        {/* Render the briefing HTML in a sandboxed iframe */}
        {issueHtml && (
          <div style={{ maxWidth: 620, margin: "0 auto", padding: "0 8px" }}>
            <iframe
              srcDoc={issueHtml}
              title={issueTitle}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 12,
                background: "white",
                overflow: "hidden",
              }}
              sandbox="allow-same-origin allow-popups"
              onLoad={(e) => {
                // Auto-height the iframe based on content
                const iframe = e.currentTarget;
                try {
                  const h = iframe.contentDocument?.body?.scrollHeight;
                  if (h && h > 100) iframe.style.height = `${h + 32}px`;
                  else iframe.style.height = "600px";
                } catch {
                  iframe.style.height = "700px";
                }
              }}
            />
          </div>
        )}

        {/* Footer */}
        <div style={{ maxWidth: 600, margin: "24px auto 0", padding: "0 16px", textAlign: "center", fontFamily: "Inter, Arial, sans-serif", fontSize: 12, color: "#8a8a8a" }}>
          <p style={{ margin: 0 }}>
            <Link to="/" style={{ color: "#5a5a5a", textDecoration: "underline" }}>Back to wakilisha.africa</Link>
            {" · "}
            <Link to="/briefing/unsubscribe" style={{ color: "#5a5a5a", textDecoration: "underline" }}>Unsubscribe</Link>
          </p>
        </div>
      </div>
    </>
  );
}