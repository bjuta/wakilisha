import { CHART_DATA } from './charts';

export const RELEASES = [
  { slug: "love-damini", title: "Love, Damini", artist: "Burna Boy", releaseType: "Album" as const, year: 2022, trackCount: 19, labelName: "Atlantic Records", artworkUrl: "https://readdy.ai/api/search-image?query=African%20music%20album%20cover%20art%2C%20minimalist%20design%2C%20warm%20earthy%20tones%2C%20artistic%20portrait%2C%20professional%20photography%20square%20format&width=400&height=400&seq=r1&orientation=squarish" },
  { slug: "dangerous-love", title: "Dangerous Love", artist: "Tems", releaseType: "EP" as const, year: 2020, trackCount: 5, labelName: "Interscope", artworkUrl: "https://readdy.ai/api/search-image?query=African%20female%20artist%20album%20art%2C%20atmospheric%20moody%20square%20photography%2C%20dark%20background%20spotlight&width=400&height=400&seq=r2&orientation=squarish" },
  { slug: "more-love-less-ego", title: "More Love, Less Ego", artist: "Wizkid", releaseType: "Album" as const, year: 2022, trackCount: 13, labelName: "RCA Records", artworkUrl: "https://readdy.ai/api/search-image?query=music%20album%20cover%20art%2C%20black%20and%20white%20portrait%20photography%2C%20urban%20style%2C%20square%20crop&width=400&height=400&seq=r3&orientation=squarish" },
  { slug: "19-and-dangerous", title: "19 & Dangerous", artist: "Ayra Starr", releaseType: "Album" as const, year: 2021, trackCount: 12, labelName: "Mavin Records", artworkUrl: "https://readdy.ai/api/search-image?query=African%20female%20pop%20artist%20album%20cover%2C%20vibrant%20colorful%20photography%2C%20young%20artist%20portrait%2C%20square%20format&width=400&height=400&seq=r4&orientation=squarish" },
  { slug: "ololade-asake", title: "Ololade Asake", artist: "Asake", releaseType: "EP" as const, year: 2022, trackCount: 6, labelName: "YBNL Nation", artworkUrl: "https://readdy.ai/api/search-image?query=amapiano%20album%20cover%20art%2C%20stylish%20urban%20photography%2C%20Nigerian%20music%20artist%2C%20square%20format&width=400&height=400&seq=r5&orientation=squarish" },
  { slug: "playboy", title: "Playboy", artist: "Fireboy DML", releaseType: "Album" as const, year: 2022, trackCount: 16, labelName: "YBNL Nation", artworkUrl: "https://readdy.ai/api/search-image?query=Afropop%20album%20cover%2C%20artistic%20photography%2C%20music%20artist%20portrait%2C%20warm%20tones%2C%20square%20format&width=400&height=400&seq=r6&orientation=squarish" },
  { slug: "kwaku-the-traveller-ep", title: "Kwaku The Traveller", artist: "Black Sherif", releaseType: "Single" as const, year: 2022, trackCount: 1, labelName: "Blacko Management", artworkUrl: "https://readdy.ai/api/search-image?query=Ghanaian%20music%20single%20artwork%2C%20dramatic%20artistic%20photography%2C%20square%20format%2C%20dark%20moody&width=400&height=400&seq=r7&orientation=squarish" },
  { slug: "alone", title: "Alone", artist: "Oxlade", releaseType: "Single" as const, year: 2023, trackCount: 1, labelName: "Epic Records", artworkUrl: "https://readdy.ai/api/search-image?query=romantic R&B music single artwork, atmospheric photography, warm gentle light, square format&width=400&height=400&seq=r8&orientation=squarish" },
  { slug: "rave-and-roses", title: "Rave & Roses", artist: "Rema", releaseType: "Album" as const, year: 2022, trackCount: 16, labelName: "Mavin Records", artworkUrl: "https://readdy.ai/api/search-image?query=Dynamic%20afrobeats%20album%20artwork%2C%20vibrant%20purple%20and%20red%20colors%2C%20futuristic%20African%20art%20style%2C%20square%20format%2C%20energetic%20abstract%20design&width=400&height=400&seq=r9&orientation=squarish" },
  { slug: "boy-alone", title: "Boy Alone", artist: "Omah Lay", releaseType: "Album" as const, year: 2022, trackCount: 14, labelName: "KeyQaad", artworkUrl: "https://readdy.ai/api/search-image?query=Contemplative%20afropop%20album%20artwork%2C%20soft%20muted%20colors%2C%20artistic%20portrait%20with%20texture%2C%20square%20format%2C%20editorial%20photography%20style&width=400&height=400&seq=r10&orientation=squarish" },
  { slug: "mavins-all-stars", title: "Mavins All Stars", artist: "Mavin Records", releaseType: "Compilation" as const, year: 2023, trackCount: 8, labelName: "Mavin Records", artworkUrl: "https://readdy.ai/api/search-image?query=Colorful%20music%20compilation%20artwork%2C%20multiple%20artist%20collage%2C%20vibrant%20African%20graphic%20design%2C%20square%20format%2C%20bold%20typography%20background&width=400&height=400&seq=r11&orientation=squarish" },
  { slug: "son-of-mercy", title: "Son of Mercy", artist: "Davido", releaseType: "EP" as const, year: 2023, trackCount: 5, labelName: "Sony Music", artworkUrl: "https://readdy.ai/api/search-image?query=Luxury%20afrobeats%20album%20artwork%2C%20gold%20and%20green%20tones%2C%20confident%20male%20portrait%2C%20square%20format%2C%20high-end%20editorial%20photography&width=400&height=400&seq=r12&orientation=squarish" },
];

export const RELEASE_FILTERS = ["All", "Album", "EP", "Single"];

export const RELEASE_GENRE_BREAKDOWN = [
  { genre: "Afrobeats", count: 320, percentage: 42, accentVar: "--wk-v-music" },
  { genre: "Afropop", count: 180, percentage: 24, accentVar: "--wk-v-music" },
  { genre: "Amapiano", count: 120, percentage: 16, accentVar: "--wk-v-dance" },
  { genre: "Highlife", count: 65, percentage: 8, accentVar: "--wk-v-intel" },
  { genre: "R&B", count: 45, percentage: 6, accentVar: "--wk-v-film" },
  { genre: "Rap", count: 32, percentage: 4, accentVar: "--wk-v-film" },
];

// ===== EDITORIAL DATA =====

export const FEATURED_RELEASE = {
  release: RELEASES[0],
  headline: "The album that redefined the summer",
  blurb: "Burna Boy's third studio album is a love letter to African sonic identity. 19 tracks spanning dancehall, Afrobeats, and pop, it cemented his status as the continent's most visible global artist. Love, Damini is not just a chart-topper — it is a cultural document.",
  tag: "Featured release",
  chartTrack: "Last Last",
  chartPosition: 5,
  readTime: "4 min",
};

export const NEW_THIS_WEEK = [
  { release: RELEASES[7], tag: "Just dropped", tagColor: "brand" as const },
  { release: RELEASES[11], tag: "This week", tagColor: "default" as const },
  { release: RELEASES[8], tag: "New album", tagColor: "brand" as const },
  { release: RELEASES[9], tag: "This week", tagColor: "default" as const },
];

export const EDITORIAL_PICKS = [
  {
    release: RELEASES[1],
    blurb: "Tems' breakthrough EP. Five tracks that proved Nigerian R&B could compete on the global stage.",
    pickType: "Essential" as const,
  },
  {
    release: RELEASES[4],
    blurb: "Asake's debut EP introduced the world to his amapiano-street fusion. The sound of Lagos nightlife in 2022.",
    pickType: "Cultural moment" as const,
  },
  {
    release: RELEASES[5],
    blurb: "Fireboy's most ambitious project. A record that wears its influences openly while remaining distinctly Nigerian.",
    pickType: "Deep cut" as const,
  },
  {
    release: RELEASES[9],
    blurb: "Omah Lay's debut album is a study in emotional vulnerability. Every track is a diary entry set to Afropop.",
    pickType: "Worth your time" as const,
  },
];

export const CHART_CONNECTED_RELEASES = [
  { release: RELEASES[0], chartTracks: ["Last Last"], positions: [5] },
  { release: RELEASES[2], chartTracks: ["Essence"], positions: [3] },
  { release: RELEASES[5], chartTracks: ["Peru"], positions: [6] },
  { release: RELEASES[7], chartTracks: ["Alone"], positions: [1] },
  { release: RELEASES[8], chartTracks: ["Calm Down"], positions: [8] },
  { release: RELEASES[4], chartTracks: ["Sungba", "Terminator"], positions: [9, 10] },
];

export const LABEL_SPOTLIGHTS = [
  {
    label: "Mavin Records",
    slug: "mavin-records",
    releases: [RELEASES[3], RELEASES[8], RELEASES[10]],
    totalReleases: 34,
    description: "The label that defined Afrobeats' second wave.",
  },
  {
    label: "YBNL Nation",
    slug: "ybnl-nation",
    releases: [RELEASES[4], RELEASES[5]],
    totalReleases: 28,
    description: "Olamide's incubator for Nigerian street pop.",
  },
  {
    label: "Atlantic Records",
    slug: "atlantic-records",
    releases: [RELEASES[0]],
    totalReleases: 12,
    description: "The bridge between African sound and global distribution.",
  },
];

export const RELEASE_TIMELINE = [
  { month: "May 2024", label: "This month", releases: [RELEASES[7], RELEASES[11], RELEASES[10]] },
  { month: "April 2024", label: "Last month", releases: [RELEASES[8], RELEASES[9]] },
  { month: "March 2024", label: "March", releases: [RELEASES[5], RELEASES[6]] },
  { month: "February 2024", label: "February", releases: [RELEASES[4], RELEASES[3]] },
  { month: "January 2024", label: "January", releases: [RELEASES[2], RELEASES[1]] },
  { month: "2023", label: "2023", releases: [RELEASES[0]] },
];

export const CATALOG_STATS = {
  total: RELEASES.length,
  thisMonth: 3,
  thisWeek: 1,
  chartConnected: CHART_CONNECTED_RELEASES.length,
  labelsRepresented: 7,
  countries: 3,
};