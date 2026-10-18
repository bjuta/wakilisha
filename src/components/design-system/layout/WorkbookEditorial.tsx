import type { ReactNode } from "react";

/**
 * Workbook v4 compositional primitives.
 * Use the same structural grammar in WAKILISHA and MIZIZI without forcing
 * editorial page layouts into case management or administrative screens.
 */
export function WkEditorialIntro({
  eyebrow, title, description, children,
}: {
  eyebrow: string;
  title: string;
  description?: string | null;
  children?: ReactNode;
}) {
  return (
    <header className="wk-editorial-intro">
      <p className="wk-editorial-eyebrow">{eyebrow}</p>
      <h1 className="wk-editorial-title">{title}</h1>
      {description ? <p className="wk-editorial-dek">{description}</p> : null}
      {children}
    </header>
  );
}

export function WkEditorialSection({
  eyebrow, title, children, action,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="wk-editorial-section">
      <div className="wk-editorial-section-head">
        <div>
          {eyebrow ? <p className="wk-editorial-eyebrow">{eyebrow}</p> : null}
          <h2 className="wk-editorial-section-title">{title}</h2>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

type WkEditorialFrameRatio = "cinema" | "video" | "square" | "portrait" | "photo" | "link";

export function WkEditorialArtworkFrame({
  src, alt = "", ratio = "video", children,
}: {
  src?: string | null;
  alt?: string;
  ratio?: WkEditorialFrameRatio;
  children?: ReactNode;
}) {
  return (
    <div className="wk-editorial-frame" data-wk-artwork-ratio={ratio} data-wk-artwork-state={src ? "recorded" : "unavailable"}>
      {src
        ? <img src={src} alt={alt} loading="lazy" decoding="async" className="wk-editorial-frame-image" />
        : <span className="wk-editorial-frame-unavailable" role="img" aria-label={alt || "Artwork unavailable"} />}
      {children}
    </div>
  );
}
