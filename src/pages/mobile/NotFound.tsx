import { Link } from "react-router-dom";

export default function MobileNotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
      <i className="ri-error-warning-line mb-4 text-5xl text-[var(--wk-text-faint)]" />
      <h1 className="text-xl font-black text-[var(--wk-text)]">Not found</h1>
      <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">
        This page does not exist in the registry.
      </p>
      <Link
        to="/"
        className="mt-6 flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform"
      >
        <i className="ri-home-5-line" />
        Back to home
      </Link>
    </div>
  );
}