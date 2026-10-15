import type { ComponentProps } from "react";

/** Full-height master/detail surface. Dividers establish hierarchy; no enclosing card.
 * Used by evidence, history, decisions and future delivery workspaces.
 */
export function WkSplitWorkspace({
  children, className = "", ...props
}: ComponentProps<"div">) {
  return (
    <div {...props} data-wk-split-workspace
      className={("grid min-w-0 border-y border-wk-border bg-wk-surface lg:grid-cols-[360px_minmax(0,1fr)] " + className).trim()}>
      {children}
    </div>
  );
}
