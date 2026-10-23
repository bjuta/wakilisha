import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { WakilishaDialogProvider } from "@/components/design-system/primitives/DialogProvider";
import { ThemeProvider } from "@/components/design-system/theme/ThemeProvider";
import { AccentProvider } from "@/components/design-system/theme/AccentProvider";
import { PlayerProvider, usePlayer } from "@/context/PlayerContext";
import { ResponsiveAppLayout } from "@/components/mobile/ResponsiveAppLayout";
import i18n from "@/i18n";
import "@/index.css";
import "@/design-system/wakilisha.tokens.css";
import "@/design-system/wakilisha.elements.foundation.css";
import "@/design-system/wakilisha.elements.motion.css";
import "@/design-system/wakilisha.viewport-integrity.css";

/**
 * A real React/Router/PlayerProvider rendering, but no network-backed Article
 * or Registry fixture. Vite serves this file only to UI-browser acceptance;
 * neither this HTML nor this mount is included in the shipped application.
 */
function LongArticleFixture() {
  const { playTrack } = usePlayer();
  // Trigger after PlayerProvider mounts its audio element. No network read or
  // playback permission is needed for this presentation-only fixture.
  const preparePlayer = () => playTrack({
    id: "viewport-test-only",
    title: "Viewport test recording",
    artist: "WAKILISHA acceptance",
    duration: 100,
    isPlayable: false,
  });

  return (
    <article data-wk-test-scrolled-article
      style={{ minHeight: "3400px", maxWidth: "900px", margin: "0 auto", padding: "96px 24px 24px", color: "var(--wk-text)" }}>
      <h1 className="text-3xl font-bold">Persistent scrolled article</h1>
      <p>The route remains mounted beneath the viewport-level player.</p>
      <button type="button" onClick={preparePlayer} className="mt-4 min-h-11 rounded bg-[var(--wk-text)] px-4 text-[var(--wk-bg)]">Prepare player</button>
      <div style={{ height: "1020px" }} />
      <label htmlFor="article-state" className="block">Retained article input</label>
      <input id="article-state" defaultValue="preserve-this" className="w-full rounded border p-4" />
      <div style={{ height: "1750px" }} />
      <p>Article footer</p>
    </article>
  );
}

createRoot(document.getElementById("fixture-root")!).render(
  <WakilishaDialogProvider>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AccentProvider>
          <PlayerProvider>
            <MemoryRouter initialEntries={["/fixture"]}>
              <Routes>
                <Route element={<ResponsiveAppLayout />}>
                  <Route path="/fixture" element={<LongArticleFixture />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </PlayerProvider>
        </AccentProvider>
      </ThemeProvider>
    </I18nextProvider>
  </WakilishaDialogProvider>,
);
