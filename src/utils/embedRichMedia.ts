/**
 * Rich Media Embed Utility
 *
 * Post-processes article HTML to convert raw media URLs and old-domain
 * internal links into proper embeds and relative paths. Designed to run
 * after VC shortcode sanitization and before rendering via dangerouslySetInnerHTML.
 *
 * Handles:
 *  - YouTube / Vimeo / Spotify / SoundCloud / Apple Music → iframe embeds
 *  - Old WordPress domain links (wakilisha.africa) → relative paths
 *  - Bare URLs that survived WP migration as plain text
 */

/* ─── Embed builders ─── */

function buildYouTubeEmbed(videoId: string, startTime?: string): string {
  const startParam = startTime ? `?start=${startTime}` : '';
  return (
    `<figure class="wk-embed wk-embed--youtube" data-embed-kind="youtube">` +
    `<div class="wk-embed__ratio wk-embed__ratio--16x9">` +
    `<iframe src="https://www.youtube.com/embed/${videoId}${startParam}" ` +
    `frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
    `allowfullscreen loading="lazy" title="YouTube video player"></iframe>` +
    `</div></figure>`
  );
}

function buildVimeoEmbed(videoId: string): string {
  return (
    `<figure class="wk-embed wk-embed--vimeo" data-embed-kind="vimeo">` +
    `<div class="wk-embed__ratio wk-embed__ratio--16x9">` +
    `<iframe src="https://player.vimeo.com/video/${videoId}" ` +
    `frameborder="0" allow="autoplay; fullscreen; picture-in-picture" ` +
    `allowfullscreen loading="lazy" title="Vimeo video player"></iframe>` +
    `</div></figure>`
  );
}

function buildSpotifyEmbed(type: string, id: string): string {
  const height = type === 'track' ? '152' : type === 'episode' ? '152' : '380';
  return (
    `<figure class="wk-embed wk-embed--spotify" data-embed-kind="spotify">` +
    `<iframe src="https://open.spotify.com/embed/${type}/${id}" ` +
    `width="100%" height="${height}" frameborder="0" ` +
    `allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" ` +
    `allowfullscreen loading="lazy" title="Spotify player"></iframe>` +
    `</figure>`
  );
}

function buildSoundCloudEmbed(url: string): string {
  const encoded = encodeURIComponent(url);
  return (
    `<figure class="wk-embed wk-embed--soundcloud" data-embed-kind="soundcloud">` +
    `<iframe width="100%" height="166" scrolling="no" frameborder="no" ` +
    `src="https://w.soundcloud.com/player/?url=${encoded}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true" ` +
    `allow="autoplay" loading="lazy" title="SoundCloud player"></iframe>` +
    `</figure>`
  );
}

function buildAppleMusicEmbed(url: string): string {
  // Apple Music embed URLs use a different format: /embed/ path
  const embedUrl = url
    .replace('music.apple.com', 'embed.music.apple.com')
    .replace(/\?.*$/, '');
  return (
    `<figure class="wk-embed wk-embed--applemusic" data-embed-kind="apple-music">` +
    `<iframe src="${embedUrl}" ` +
    `width="100%" height="450" frameborder="0" ` +
    `allow="autoplay; encrypted-media" ` +
    `allowfullscreen sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" ` +
    `loading="lazy" title="Apple Music player"></iframe>` +
    `</figure>`
  );
}

/* ─── Old-domain path extraction ─── */

const OLD_DOMAINS = ['wakilisha.africa', 'www.wakilisha.africa'];

function extractRelativePath(url: string): string | null {
  for (const domain of OLD_DOMAINS) {
    const prefix = `https://${domain}`;
    const prefixAlt = `http://${domain}`;
    if (url.startsWith(prefix)) return url.slice(prefix.length);
    if (url.startsWith(prefixAlt)) return url.slice(prefixAlt.length);
  }
  return null;
}

/* ─── Internal entity link card ─── */

function isInternalEntityPath(path: string): { type: string; label: string } | null {
  const patterns: Array<{ regex: RegExp; type: string; label: string }> = [
    { regex: /^\/tracks\/([^/]+)\/([^/]+)/, type: 'track', label: 'Track' },
    { regex: /^\/artists\/([^/]+)/, type: 'artist', label: 'Artist' },
    { regex: /^\/releases\/([^/]+)/, type: 'release', label: 'Release' },
    { regex: /^\/genres\/([^/]+)/, type: 'genre', label: 'Genre' },
    { regex: /^\/labels\/([^/]+)/, type: 'label', label: 'Label' },
    { regex: /^\/charts\//, type: 'chart', label: 'Chart' },
    { regex: /^\/magazine\//, type: 'article', label: 'Article' },
  ];
  for (const p of patterns) {
    if (p.regex.test(path)) return { type: p.type, label: p.label };
  }
  return null;
}

/* ─── Main processor ─── */

export function embedRichMedia(html: string): string {
  if (!html || typeof html !== 'string') return html;

  let result = html;

  // ── Step 1: Convert old-domain <a> tags to relative paths ──
  // Match <a ... href="https://wakilisha.africa/PATH" ...>TEXT</a>
  result = result.replace(
    /<a\s+([^>]*?)href="(https?:\/\/(?:www\.)?wakilisha\.africa\/[^"]*?)"([^>]*?)>([\s\S]*?)<\/a>/gi,
    (match, beforeAttrs, href, afterAttrs, linkText) => {
      const relativePath = extractRelativePath(href) || href;
      const entityInfo = isInternalEntityPath(relativePath);

      if (entityInfo) {
        // Entity link → styled mini-card
        return (
          `<a href="${relativePath}" class="wk-entity-link wk-entity-link--${entityInfo.type}" data-entity-kind="${entityInfo.type}">` +
          `<span class="wk-entity-link__badge">${entityInfo.label}</span>` +
          `<span class="wk-entity-link__text">${linkText}</span>` +
          `<span class="wk-entity-link__arrow"><i class="ri-arrow-right-line"></i></span>` +
          `</a>`
        );
      }

      // Regular internal link → relative path
      return `<a ${beforeAttrs}href="${relativePath}"${afterAttrs}>${linkText}</a>`;
    }
  );

  // Also handle self-closing forms like <a ... href="https://wakilisha.africa/..." ... />
  // (WP sometimes uses these for embedded content anchors)

  // ── Step 2: Handle [embed]https://...[/embed] WP shortcodes ──
  result = result.replace(
    /\[embed\](https?:\/\/[^\s<>"'\]]+)\[\/embed\]/gi,
    (_, url) => processRawMediaUrl(url)
  );

  // ── Step 3: Process raw media URLs in text ──
  // Find standalone URLs that are not inside HTML tags or attributes.
  // Use negative lookbehind for " ' = > to avoid attribute values.
  // Match on URL boundaries — must be preceded by whitespace, start of string, or > (end of tag),
  // and followed by whitespace, end of string, or < (start of tag).

  // YouTube — various formats
  result = result.replace(
    /(?<=[\s>]|^)(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?#][^\s<>"']*)?)(?=[\s<]|$)/g,
    (match, fullUrl, videoId) => {
      // Also extract t= param for start time
      const timeMatch = fullUrl.match(/[?&]t=(\d+)/);
      return buildYouTubeEmbed(videoId, timeMatch ? timeMatch[1] : undefined);
    }
  );

  // Vimeo
  result = result.replace(
    /(?<=[\s>]|^)(https?:\/\/(?:www\.)?vimeo\.com\/(\d+)(?:[?#][^\s<>"']*)?)(?=[\s<]|$)/g,
    (_, _fullUrl, videoId) => buildVimeoEmbed(videoId)
  );

  // Spotify
  result = result.replace(
    /(?<=[\s>]|^)(https?:\/\/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)(?:[?#][^\s<>"']*)?)(?=[\s<]|$)/gi,
    (_, _fullUrl, type, id) => buildSpotifyEmbed(type.toLowerCase(), id)
  );

  // SoundCloud
  result = result.replace(
    /(?<=[\s>]|^)(https?:\/\/(?:www\.)?soundcloud\.com\/[^\s<>"']+)(?=[\s<]|$)/g,
    (_, url) => buildSoundCloudEmbed(url)
  );

  // Apple Music
  result = result.replace(
    /(?<=[\s>]|^)(https?:\/\/(?:www\.)?music\.apple\.com\/[^\s<>"']+)(?=[\s<]|$)/g,
    (_, url) => buildAppleMusicEmbed(url)
  );

  // Also handle URLs that are inside their own paragraph tags
  // e.g., <p>https://www.youtube.com/watch?v=xxx</p>
  // — the above patterns already handle these via the [\s>] lookbehind

  return result;
}

/**
 * Process a single raw media URL into its embed form.
 * Used by the [embed] shortcode handler.
 */
function processRawMediaUrl(url: string): string {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    const timeMatch = url.match(/[?&]t=(\d+)/);
    return buildYouTubeEmbed(ytMatch[1], timeMatch ? timeMatch[1] : undefined);
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return buildVimeoEmbed(vimeoMatch[1]);

  // Spotify
  const spotifyMatch = url.match(
    /open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/
  );
  if (spotifyMatch) return buildSpotifyEmbed(spotifyMatch[1], spotifyMatch[2]);

  // SoundCloud
  if (/soundcloud\.com\//.test(url)) return buildSoundCloudEmbed(url);

  // Apple Music
  if (/music\.apple\.com\//.test(url)) return buildAppleMusicEmbed(url);

  // Fallback: keep the URL as-is
  return url;
}