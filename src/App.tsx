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
import { PlayerProvider } from "./context/PlayerContext";
import { RecoveryRedirectGuard } from "./components/auth/RecoveryRedirectGuard";
import { PageTitle } from "./components/seo/PageTitle";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <ThemeProvider>
          <PlayerProvider>
            <RecoveryRedirectGuard />
            <PageTitle />
            <AppRoutes />
          </PlayerProvider>
        </ThemeProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
