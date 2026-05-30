import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div className={`wk-app-shell min-h-screen ${className}`}>
      {children}
    </div>
  );
}