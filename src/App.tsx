import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import "./design-system/wakilisha.tokens.css";
import "./pages/admin/design-system/adminDesignSystemLayout.css";
import { ThemeProvider } from "./components/design-system/theme/ThemeProvider";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
