import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { getSiteIdentitySettings } from "@/services/adminSettings/settingsStore";

function syncSavedFavicon() {
  if (typeof document === "undefined") return;

  const faviconUrl = getSiteIdentitySettings().faviconUrl?.trim();
  if (!faviconUrl) return;

  const selectors = ['link[rel="icon"]', 'link[rel="apple-touch-icon"]'];
  selectors.forEach((selector) => {
    let link = document.querySelector<HTMLLinkElement>(selector);
    if (!link) {
      link = document.createElement("link");
      link.rel = selector.includes("apple-touch-icon") ? "apple-touch-icon" : "icon";
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  });
}

syncSavedFavicon();
window.addEventListener("wk_settings_changed", syncSavedFavicon);


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
