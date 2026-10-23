import { useEffect, useRef } from "react";
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
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    playTrack({
      id: "viewport-test-only",
      title: "Viewport test recording",
      artist: "WAKILISHA acceptance",
      duration: 100,
      isPlayable: false,
    });
  }, [playTrack]);

  return (
    <article data-wk-test-scrolled-article
      className="mx-auto min-h-[3400px] max-w-[900px] px-6 pt-24 text-[var(--wk-text)]">
      <h1 className="text-3xl font-bold">Persistent scrolled article</h1>
      <p>The route remains mounted beneath the viewport-level player.</p>
      <div className="h-[1020px]" />
      <label htmlFor="article-state" className="block">Retained article input</label>
      <input id="article-state" defaultValue="preserve-this" className="w-full rounded border p-4" />
      <div className="h-[1750px]" />
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
