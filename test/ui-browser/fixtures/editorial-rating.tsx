
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import "@/design-system/wakilisha.tokens.css";
import "@/design-system/wakilisha.elements.foundation.css";
import "@/styles/wk-ratings.css";
import { RichTextEditor } from "@/components/design-system/editorial/RichTextEditor";

const MEDIA_CAPTION = "EP Artwork for Charisma’s Forever to Never. | Image: Charisma";
const MEDIA_ORIGINAL = '<p>Before the artwork.</p>' +
  '<img src="/wk-editorial-caption-artwork.svg" alt="Artwork" data-caption="' + MEDIA_CAPTION + '">' +
  '<p>' + MEDIA_CAPTION + '</p><p>The music review continues.</p>';
const ORIGINAL = new URLSearchParams(window.location.search).has("media")
  ? MEDIA_ORIGINAL : "<p>Album review begins here. The production holds its own.</p>";

function EditorialRatingFixture() {
  const [html, setHtml] = useState(ORIGINAL);
  const [saved, setSaved] = useState(ORIGINAL);
  const [revision, setRevision] = useState(0);
  return (
    <main className="min-h-screen bg-wk-bg px-4 py-6 text-wk-text" data-wk-editorial-rating-fixture>
      <header className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-black">Editorial rating browser acceptance</h1>
        <button type="button" onClick={() => setSaved(html)}
          className="min-h-11 rounded-full border border-wk-border px-4 font-bold">Save draft</button>
        <button type="button" onClick={() => { setHtml(saved); setRevision((n) => n + 1); }}
          className="min-h-11 rounded-full border border-wk-border px-4 font-bold">Reopen saved draft</button>
      </header>
      <div className="mx-auto max-w-4xl">
        <RichTextEditor key={revision} value={html} onChange={setHtml} profile="article" minHeight={220} />
        <h2 className="mt-6 text-sm font-bold">Saved article rendering</h2>
        <section data-wk-saved-article className="wk-prose rounded-xl border border-wk-border p-4"
          dangerouslySetInnerHTML={{ __html: saved }} />
        <output data-wk-saved-html className="sr-only">{saved}</output>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<EditorialRatingFixture />);
