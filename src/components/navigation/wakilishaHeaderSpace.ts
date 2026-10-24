/**
 * Shared public shell header authority across phone, tablet and desktop.
 * Hero routes intentionally begin behind the transparent WAKILISHA top bar;
 * text-first routes reserve its 56px height exactly once.
 */
export function shouldReserveWakilishaHeaderSpace(pathname: string): boolean {
  const heroRoute = pathname === "/"
    || ["/magazine", "/music", "/video", "/audio", "/shows", "/charts", "/releases", "/genres", "/labels", "/guides", "/artists"].includes(pathname)
    || /^\/magazine\/[^/]+\/?$/.test(pathname)
    || /^\/artists\/[^/]+\/?$/.test(pathname)
    || /^\/video\/[^/]+\/?$/.test(pathname)
    || /^\/shows\/[^/]+(?:\/[^/]+)?\/?$/.test(pathname)
    || /^\/charts\/[^/]+/.test(pathname)
    || /^\/releases\/[^/]+\/[^/]+\/?$/.test(pathname)
    || /^\/genres\/[^/]+\/?$/.test(pathname)
    || /^\/labels\/[^/]+\/?$/.test(pathname)
    || /^\/guides\/[^/]+\/?$/.test(pathname)
    || /^\/tracks\/[^/]+\/[^/]+\/?$/.test(pathname)
    || /^\/playlists\/[^/]+\/?$/.test(pathname)
    || /^\/u\/[^/]+(?:\/playlists\/[^/]+)?\/?$/.test(pathname)
    || /^\/people\/[^/]+\/?$/.test(pathname)
    || /^\/organizations\/[^/]+\/?$/.test(pathname);
  const socialRoute = ["/following", "/messages", "/notifications"].includes(pathname);
  return !heroRoute && !socialRoute;
}
