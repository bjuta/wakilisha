import { Link } from "react-router-dom";
import { PageShell } from "@/components/design-system/primitives/PageShell";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkTag } from "@/components/design-system/primitives/Tag";

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className="mb-6 text-7xl font-black tabular-nums"
          style={{ color: "var(--wk-brand)", fontFamily: "var(--wk-font-display)" }}
        >
          404
        </div>
        <h1 className="wk-h-section mb-3">This page does not exist.</h1>
        <p className="wk-copy mb-8 max-w-sm">
          The route you followed is not in the registry. Check the URL or navigate from the home page.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/">
            <WkButton variant="primary">Return home</WkButton>
          </Link>
          <Link to="/charts">
            <WkButton variant="ghost">
              <i className="ri-bar-chart-line" />
              View charts
            </WkButton>
          </Link>
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {["/artists", "/genres", "/labels", "/magazine"].map((route) => (
            <Link key={route} to={route}>
              <WkTag>{route}</WkTag>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}