export const RELEASES = [
  { slug: "love-damini", title: "Love, Damini", artist: "Burna Boy", releaseType: "Album" as const, year: 2022, trackCount: 19, labelName: "Atlantic Records", artworkUrl: "https://readdy.ai/api/search-image?query=African%20music%20album%20cover%20art%2C%20minimalist%20design%2C%20warm%20earthy%20tones%2C%20artistic%20portrait%2C%20professional%20photography%20square%20format&width=400&height=400&seq=r1&orientation=squarish" },
  { slug: "dangerous-love", title: "Dangerous Love", artist: "Tems", releaseType: "EP" as const, year: 2020, trackCount: 5, labelName: "Interscope", artworkUrl: "https://readdy.ai/api/search-image?query=African%20female%20artist%20album%20art%2C%20atmospheric%20moody%20square%20photography%2C%20dark%20background%20spotlight&width=400&height=400&seq=r2&orientation=squarish" },
  { slug: "more-love-less-ego", title: "More Love, Less Ego", artist: "Wizkid", releaseType: "Album" as const, year: 2022, trackCount: 13, labelName: "RCA Records", artworkUrl: "https://readdy.ai/api/search-image?query=music%20album%20cover%20art%2C%20black%20and%20white%20portrait%20photography%2C%20urban%20style%2C%20square%20crop&width=400&height=400&seq=r3&orientation=squarish" },
  { slug: "19-and-dangerous", title: "19 & Dangerous", artist: "Ayra Starr", releaseType: "Album" as const, year: 2021, trackCount: 12, labelName: "Mavin Records", artworkUrl: "https://readdy.ai/api/search-image?query=African%20female%20pop%20artist%20album%20cover%2C%20vibrant%20colorful%20photography%2C%20young%20artist%20portrait%2C%20square%20format&width=400&height=400&seq=r4&orientation=squarish" },
  { slug: "ololade-asake", title: "Ololade Asake", artist: "Asake", releaseType: "EP" as const, year: 2022, trackCount: 6, labelName: "YBNL Nation", artworkUrl: "https://readdy.ai/api/search-image?query=amapiano%20album%20cover%20art%2C%20stylish%20urban%20photography%2C%20Nigerian%20music%20artist%2C%20square%20format&width=400&height=400&seq=r5&orientation=squarish" },
  { slug: "playboy", title: "Playboy", artist: "Fireboy DML", releaseType: "Album" as const, year: 2022, trackCount: 16, labelName: "YBNL Nation", artworkUrl: "https://readdy.ai/api/search-image?query=Afropop%20album%20cover%2C%20artistic%20photography%2C%20music%20artist%20portrait%2C%20warm%20tones%2C%20square%20format&width=400&height=400&seq=r6&orientation=squarish" },
  { slug: "kwaku-the-traveller-ep", title: "Kwaku The Traveller", artist: "Black Sherif", releaseType: "Single" as const, year: 2022, trackCount: 1, artworkUrl: "https://readdy.ai/api/search-image?query=Ghanaian%20music%20single%20artwork%2C%20dramatic%20artistic%20photography%2C%20square%20format%2C%20dark%20moody&width=400&height=400&seq=r7&orientation=squarish" },
  { slug: "alone", title: "Alone", artist: "Oxlade", releaseType: "Single" as const, year: 2023, trackCount: 1, artworkUrl: "https://readdy.ai/api/search-image?query=romantic R&B music single artwork, atmospheric photography, warm gentle light, square format&width=400&height=400&seq=r8&orientation=squarish" },
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