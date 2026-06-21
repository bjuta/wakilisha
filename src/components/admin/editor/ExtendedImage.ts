import Image from '@tiptap/extension-image';

/**
 * ExtendedImage — TipTap image node with alt, caption, title, and asset-id.
 *
 * Extends the standard Image extension with three additional attributes:
 *   - caption     (data-caption)   — shown as figcaption on the frontend
 *   - title       (title)          — HTML title attribute
 *   - data-asset-id                 — links the image to a registry_media_assets row
 *
 * Existing <img> tags without these attributes parse fine (backward compatible).
 * When a caption is present, the renderHTML outputs a <figure> wrapper with
 * <figcaption> so the magazine page can style it semantically.
 */

export const ExtendedImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),

      caption: {
        default: null,
        parseHTML: (element) => {
          // Try <figure><img><figcaption> structure first
          const parent = element.parentElement;
          if (parent?.tagName === 'FIGURE') {
            const figcaption = parent.querySelector('figcaption');
            return figcaption?.textContent?.trim() || null;
          }
          // Fall back to data-caption
          return element.getAttribute('data-caption') || null;
        },
        renderHTML: (attributes) => {
          if (!attributes.caption) return {};
          return { 'data-caption': attributes.caption };
        },
      },

      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title') || null,
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { title: attributes.title };
        },
      },

      'data-asset-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-asset-id') || null,
        renderHTML: (attributes) => {
          if (!attributes['data-asset-id']) return {};
          return { 'data-asset-id': attributes['data-asset-id'] };
        },
      },

      alignment: {
        default: null,
        parseHTML: (element) => {
          const parent = element.parentElement;
          if (parent?.tagName === 'FIGURE') {
            if (parent.classList.contains('align-left')) return 'left';
            if (parent.classList.contains('align-center')) return 'center';
            if (parent.classList.contains('align-right')) return 'right';
          }
          if (element.classList.contains('align-left')) return 'left';
          if (element.classList.contains('align-center')) return 'center';
          if (element.classList.contains('align-right')) return 'right';
          return null;
        },
        renderHTML: (attributes) => {
          if (!attributes.alignment) return {};
          return { 'data-alignment': attributes.alignment };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, alignment, ...imgAttrs } = HTMLAttributes;
    const alignClass = alignment ? `align-${alignment}` : '';

    if (caption) {
      return [
        'figure',
        { class: `wk-figure ${alignClass}`.trim() },
        ['img', imgAttrs],
        ['figcaption', { class: 'wk-figcaption' }, caption],
      ];
    }

    if (alignment) {
      return ['div', { class: alignClass, style: alignment === 'center' ? 'text-align:center' : alignment === 'right' ? 'text-align:right' : 'text-align:left' }, ['img', imgAttrs]];
    }

    return ['img', imgAttrs];
  },
});