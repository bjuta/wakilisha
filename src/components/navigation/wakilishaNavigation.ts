import type { WkIconName } from "@/components/design-system/Icon";

/**
 * Single product navigation authority. Layouts may render these items as a
 * desktop rail or a mobile start-edge sheet but never duplicate their order.
 * WAKILISHA and MIZIZI share control primitives, not a forced route map.
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
export const WAKILISHA_NAVIGATION: readonly WkNavGroup[] = [
  {
    label: "Explore",
    items: [
      { label: "Home", to: "/", icon: "Home" },
      { label: "Music", to: "/music", icon: "AudioLines" },
      { label: "Video", to: "/video", icon: "Video" },
      { label: "Audio", to: "/audio", icon: "Radio" },
      { label: "Podcasts", to: "/shows", icon: "Mic2" },
      { label: "Magazine", to: "/magazine", icon: "NotebookText" },
      { label: "Artists", to: "/artists", icon: "Users" },
      { label: "Following", to: "/following", icon: "Heart" },
      { label: "Messages", to: "/messages", icon: "MessageSquare", audience: "messages-access" },
      { label: "Notifications", to: "/notifications", icon: "Bell", audience: "signed-in" },
    ],
  },
  {
    label: "More WAKILISHA",
    items: [
      { label: "Charts", to: "/charts", icon: "ChartNoAxesColumnIncreasing" },
      { label: "Playlists", to: "/playlists", icon: "ListMusic" },
      { label: "Releases", to: "/releases", icon: "Disc3" },
      { label: "Genres", to: "/genres", icon: "Compass" },
      { label: "Labels", to: "/labels", icon: "BadgeCheck" },
      { label: "Guides", to: "/guides", icon: "BookOpen" },
      { label: "Field", to: "/field", icon: "Map" },
      { label: "Credits", to: "/credits", icon: "FileText" },
      { label: "Artist Studio", to: "/artist-studio", icon: "UserRound" },
    ],
  },
  {
    label: "WAKILISHA",
    items: [
      { label: "About", to: "/about", icon: "Info" },
      { label: "Contact", to: "/contact", icon: "Mail" },
      { label: "FAQs", to: "/faqs", icon: "HelpCircle" },
      { label: "Privacy", to: "/privacy", icon: "ShieldCheck" },
      { label: "Terms", to: "/terms", icon: "FileText" },
    ],
  },
] as const;

export function isWakilishaNavCurrent(pathname: string, to: string): boolean {
  return to === "/"
    ? pathname === "/"
    : pathname === to || pathname.startsWith(to + "/");
}


// A route's presence in the universal product map does not make its
// destination appropriate for a signed-out visitor. This is presentation
// authority only. The Router and server-side access guards remain required.
export function visibleWakilishaNavigation({
  signedIn,
  messagesVisible,
}: {
  signedIn: boolean;
  messagesVisible: boolean;
}): readonly WkNavGroup[] {
  return WAKILISHA_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.audience === "signed-in") return signedIn;
      if (item.audience === "messages-access") return signedIn && messagesVisible;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
