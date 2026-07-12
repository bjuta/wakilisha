import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import "./index.css";
import "./design-system/wakilisha.tokens.css";
import "./design-system/wakilisha.elements.foundation.css";
import "./design-system/wakilisha.elements.product.css";
import "./design-system/wakilisha.elements.content.css";
import "./design-system/wakilisha.elements.mobile.css";
import "./design-system/wakilisha.elements.motion.css";
import "./pages/admin/design-system/adminDesignSystemLayout.css";
import { ThemeProvider } from "./components/design-system/theme/ThemeProvider";
import { AccentProvider } from "./components/design-system/theme/AccentProvider";
import { PlayerProvider } from "./context/PlayerContext";
import { RecoveryRedirectGuard } from "./components/auth/RecoveryRedirectGuard";
import { PageTitle } from "./components/seo/PageTitle";
import ScrollRestoration from "./components/base/ScrollRestoration";
import { PageViewTracker } from "./hooks/usePageViewTracking";
import GtagInjector from "./components/analytics/GtagInjector";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <ThemeProvider>
          <AccentProvider>
            <PlayerProvider>
              <RecoveryRedirectGuard />
              <PageTitle />
              <ScrollRestoration />
              <PageViewTracker />
              <GtagInjector />
              <div className="page-transition">
                <Suspense
                  fallback={
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-foreground-600"
                    >
                      Loading page.
                    </div>
                  }
                >
                  <AppRoutes />
                </Suspense>
              </div>
            </PlayerProvider>
          </AccentProvider>
        </ThemeProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
