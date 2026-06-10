import { Component, type ReactNode, type ErrorInfo } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import AdminDesignSystem from "@/pages/admin/design-system/page";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class DesignSystemErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("DesignSystem settings page crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]">
            <WkIcon name="AlertTriangle" size={28} />
          </div>
          <h2 className="text-[18px] font-bold text-[var(--wk-text)]">Could not load Design System settings</h2>
          <p className="text-[13px] text-[var(--wk-text-muted)] text-center max-w-md">
            {this.state.error?.message || "An unexpected error occurred while loading the design system."}
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => window.location.reload()}
              className="wk-button wk-button-primary wk-button-sm"
            >
              <WkIcon name="RefreshCw" size={14} />
              Retry
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("wk_design_system_state");
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
              className="wk-button wk-button-secondary wk-button-sm"
            >
              <WkIcon name="Eraser" size={14} />
              Reset to safe defaults
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AdminDesignSystemSettings() {
  return (
    <DesignSystemErrorBoundary>
      <AdminDesignSystem />
    </DesignSystemErrorBoundary>
  );
}