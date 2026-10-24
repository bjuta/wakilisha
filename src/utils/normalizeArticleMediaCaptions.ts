/**
 * Media captions belong to their image or video, never to a neighbouring
 * body paragraph. The editor receives media attributes; readers receive
 * semantic <figure>/<figcaption> markup. No database content is rewritten
 * merely by opening an Article.
 *
 * Legacy import compatibility is deliberately conservative: only an
 * immediately adjacent plain paragraph whose complete text equals the
 * media's own caption is treated as a duplicate.
 */
import type { MediaCaptionEntry } from "@/utils/injectMediaCaptions";

export type ArticleCaptionMode = "editor" | "display";

function text(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function removableDuplicate(element: Element | null, caption: string): element is HTMLParagraphElement {
  return !!element &&
    element.tagName === "P" &&
    text(element.textContent) === text(caption) &&
    !element.querySelector("a, button, img, iframe, video, figure, input, textarea");
}

function mediaContainer(element: Element): Element {
  const figure = element.closest("figure");
  if (figure) return figure;
  const parent = element.parentElement;
  if (parent?.tagName === "P" &&
      parent.querySelectorAll("img, iframe, video").length === 1 &&
      text(parent.textContent) === "") return parent;
  return element;
}

function canUnwrapImage(figure: Element, image: Element): boolean {
  return figure.children.length <= 2 &&
    figure.firstElementChild === image &&
    Array.from(figure.children).every((child) => child === image || child.tagName === "FIGCAPTION");
}

export function normalizeArticleMediaCaptions(
  html: string,
  mode: ArticleCaptionMode,
  assets: Map<string, MediaCaptionEntry> = new Map(),
): string {
  if (!html || !/<(?:img|iframe|video|figure)\b/i.test(html)) return html;
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const media of Array.from(doc.querySelectorAll("img, iframe, video"))) {
    const figure = media.closest("figure");
    const figcaption = figure?.querySelector("figcaption") ?? null;
    const assetId = media.tagName === "IMG" ? media.getAttribute("data-asset-id") : null;
    const asset = assetId ? assets.get(assetId) : null;

    // The author's image details have priority over a shared Media Library caption.
    const caption = text(media.getAttribute("data-caption")) ||
      text(figcaption?.textContent) ||
      text(asset?.caption);
    if (!caption) continue;

    media.setAttribute("data-caption", caption);
    const container = mediaContainer(media);
    if (removableDuplicate(container.nextElementSibling, caption)) {
      container.nextElementSibling!.remove();
    }

    if (mode === "editor") {
      // TipTap's image is an atom. A nested figcaption would otherwise be
      // parsed as an independent paragraph, which users could edit/delete.
      if (media.tagName === "IMG" && figure && canUnwrapImage(figure, media)) {
        figure.replaceWith(media);
      } else if (figcaption) {
        figcaption.setAttribute("contenteditable", "false");
      }
      continue;
    }

    let wrapper = figure;
    if (!wrapper) {
      wrapper = doc.createElement("figure");
      const original = mediaContainer(media);
      original.replaceWith(wrapper);
      wrapper.appendChild(media);
    }
    wrapper.classList.add("wk-figure");
    if (!figcaption) {
      const captionNode = doc.createElement("figcaption");
      captionNode.className = "wk-figcaption";
      captionNode.textContent = caption;
      captionNode.setAttribute("contenteditable", "false");
      wrapper.appendChild(captionNode);
    } else {
      figcaption.classList.add("wk-figcaption");
      figcaption.setAttribute("contenteditable", "false");
      // The media attribute is canonical if historical content disagrees.
      if (text(figcaption.textContent) !== caption) figcaption.textContent = caption;
    }
  }

  return doc.body.innerHTML;
}
