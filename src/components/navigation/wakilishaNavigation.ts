import type { WkIconName } from "@/components/design-system/Icon";

/** Presentation map only. Routes, permissions and domain ownership remain
 * with their existing authorities. The primary menu contains places, not tools.
 */
export type WkNavDestination = Readonly<{
  label: string;
  to: string;
  icon: WkIconName;
  audience?: "public" | "signed-in" | "messages-access";
}>;
export type WkNavGroup = Readonly<{
  label: string;
  items: readonly WkNavDestination[];
}>;

export const WAKILISHA_NAVIGATION: readonly WkNavGroup[] = [{
  label: "Places",
  items: [
    { label: "Home", to: "/", icon: "House" },
    { label: "Following", to: "/following", icon: "Heart", audience: "signed-in" },
    { label: "Music", to: "/music", icon: "AudioLines" },
    { label: "Video", to: "/video", icon: "Video" },
    { label: "Audio", to: "/audio", icon: "Radio" },
    { label: "Magazine", to: "/magazine", icon: "NotebookText" },
    { label: "Artists", to: "/artists", icon: "Users" },
    { label: "Charts", to: "/charts", icon: "ChartNoAxesColumnIncreasing" },
    { label: "Credits", to: "/credits", icon: "FileText" },
  ],
}] as const;

/** Existing canonical destinations remain reachable while the owning pages
 * adopt their corresponding filters. They are no longer primary menu places.
 */
export const WAKILISHA_MORE_DESTINATIONS = [
  { label: "Podcasts", to: "/shows" },
  { label: "Playlists", to: "/playlists" },
  { label: "Releases", to: "/releases" },
  { label: "Genres", to: "/genres" },
  { label: "Labels", to: "/labels" },
  { label: "Guides", to: "/guides" },
  { label: "Field", to: "/field" },
] as const;

export const WAKILISHA_FOOT_LINKS = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "FAQs", to: "/faqs" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
] as const;

export function isWakilishaNavCurrent(pathname: string, to: string): boolean {
  return to === "/"
    ? pathname === "/"
    : pathname === to || pathname.startsWith(to + "/");
}

export function visibleWakilishaNavigation({
  signedIn,
  messagesVisible: _messagesVisible,
}: {
  signedIn: boolean;
  messagesVisible: boolean;
}): readonly WkNavGroup[] {
  return WAKILISHA_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.audience !== "signed-in" || signedIn),
  }));
}
