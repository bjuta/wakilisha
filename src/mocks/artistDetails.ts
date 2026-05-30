export interface ArtistDetail {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  isChartArtist?: boolean;
  bio?: string;
  chartEntries?: {
    rank: number;
    title: string;
    artist: string;
    movement?: "up" | "down" | "new" | "same";
    movementAmount?: number;
    weeksOnChart?: number;
    peakPosition?: number;
    isPlayable?: boolean;
  }[];
  releases?: {
    slug: string;
    title: string;
    artist: string;
    artworkUrl?: string;
    releaseType?: "Album" | "EP" | "Single" | "Compilation";
    year?: string | number;
    trackCount?: number;
  }[];
  relatedArtists?: { slug: string; name: string }[];
}

export const ARTIST_DETAILS: ArtistDetail[] = [
  {
    slug: "burna-boy",
    name: "Burna Boy",
    imageUrl: "https://readdy.ai/api/search-image?query=African%20afrobeats%20male%20music%20artist%20portrait%2C%20studio%20photography%2C%20dark%20background%2C%20warm%20lighting%2C%20professional%20music%20artist%20photo%2C%20cinematic%20quality%2C%20detailed%20face&width=900&height=480&seq=artist-detail-1&orientation=landscape",
    genres: ["Afrobeats", "Afrofusion"],
    trackCount: 142,
    releaseCount: 8,
    isChartArtist: true,
    bio: "Burna Boy is a Nigerian singer, songwriter, and record producer who rose to prominence in 2012. His sound is a fusion of Afrobeats, dancehall, reggae, and American rap. He won the Grammy Award for Best Global Music Album in 2021.",
    chartEntries: [
      { rank: 4, title: "Running", artist: "Burna Boy", movement: "up", movementAmount: 3, weeksOnChart: 5, peakPosition: 4, isPlayable: false },
      { rank: 5, title: "Last Last", artist: "Burna Boy", movement: "same", weeksOnChart: 18, peakPosition: 2, isPlayable: false },
      { rank: 9, title: "Sungba", artist: "Asake ft. Burna Boy", movement: "new", weeksOnChart: 1, peakPosition: 9, isPlayable: false },
    ],
    releases: [
      { slug: "love-damini", title: "Love, Damini", artist: "Burna Boy", releaseType: "Album", year: 2022, trackCount: 19, artworkUrl: "https://readdy.ai/api/search-image?query=African%20music%20album%20cover%20art%2C%20minimalist%20design%2C%20warm%20earthy%20tones%2C%20artistic%20portrait%2C%20professional%20photography%20square%20format&width=400&height=400&seq=r1&orientation=squarish" },
      { slug: "twice-as-tall", title: "Twice as Tall", artist: "Burna Boy", releaseType: "Album", year: 2020, trackCount: 15, artworkUrl: "https://readdy.ai/api/search-image?query=African%20music%20album%20cover%20art%2C%20bold%20geometric%20design%2C%20warm%20gold%20tones%2C%20square%20format%20artwork&width=400&height=400&seq=artist-rel-1&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "wizkid", name: "Wizkid" },
      { slug: "davido", name: "Davido" },
      { slug: "asake", name: "Asake" },
    ],
  },
  {
    slug: "tems",
    name: "Tems",
    imageUrl: "https://readdy.ai/api/search-image?query=African%20female%20singer%20artist%20portrait%2C%20studio%20photography%2C%20warm%20golden%20lighting%2C%20contemporary%20music%20artist%2C%20cinematic%20quality&width=900&height=480&seq=artist-detail-2&orientation=landscape",
    genres: ["Afropop", "R&B"],
    trackCount: 38,
    releaseCount: 3,
    isChartArtist: true,
    bio: "Tems is a Nigerian singer, songwriter, and record producer. She rose to prominence after being featured on Wizkid's 2020 single Essence, which peaked at number 9 on the Billboard Hot 100 chart following the release of the remix version with Justin Bieber.",
    chartEntries: [
      { rank: 3, title: "Essence", artist: "Wizkid ft. Tems", movement: "down", movementAmount: 1, weeksOnChart: 24, peakPosition: 1, isPlayable: false },
    ],
    releases: [
      { slug: "dangerous-love", title: "Dangerous Love", artist: "Tems", releaseType: "EP", year: 2020, trackCount: 5, artworkUrl: "https://readdy.ai/api/search-image?query=African%20female%20artist%20album%20art%2C%20atmospheric%20moody%20square%20photography%2C%20dark%20background%20spotlight&width=400&height=400&seq=r2&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "wizkid", name: "Wizkid" },
      { slug: "ayra-starr", name: "Ayra Starr" },
    ],
  },
  {
    slug: "wizkid",
    name: "Wizkid",
    imageUrl: "https://readdy.ai/api/search-image?query=Nigerian%20male%20afrobeats%20music%20artist%20portrait%2C%20dark%20studio%20backdrop%2C%20professional%20lighting%2C%20contemporary%20musician&width=900&height=480&seq=artist-detail-3&orientation=landscape",
    genres: ["Afrobeats", "Dancehall"],
    trackCount: 198,
    releaseCount: 6,
    isChartArtist: true,
    bio: "Wizkid is a Nigerian singer and songwriter. He began recording music at age 11 and in 2009 signed a record deal with Banky W's Empire Mates Entertainment. He is one of the most commercially successful African artists globally.",
    chartEntries: [
      { rank: 3, title: "Essence", artist: "Wizkid ft. Tems", movement: "down", movementAmount: 1, weeksOnChart: 24, peakPosition: 1, isPlayable: false },
      { rank: 13, title: "Overloading", artist: "BNXN ft. Wizkid", movement: "new", weeksOnChart: 1, peakPosition: 13, isPlayable: false },
    ],
    releases: [
      { slug: "more-love-less-ego", title: "More Love, Less Ego", artist: "Wizkid", releaseType: "Album", year: 2022, trackCount: 13, artworkUrl: "https://readdy.ai/api/search-image?query=music%20album%20cover%20art%2C%20black%20and%20white%20portrait%20photography%2C%20urban%20style%2C%20square%20crop&width=400&height=400&seq=r3&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "burna-boy", name: "Burna Boy" },
      { slug: "tems", name: "Tems" },
      { slug: "davido", name: "Davido" },
    ],
  },
  {
    slug: "ayra-starr",
    name: "Ayra Starr",
    imageUrl: "https://readdy.ai/api/search-image?query=African%20female%20afropop%20artist%20portrait%2C%20warm%20studio%20lighting%2C%20stylish%20contemporary%20music%20artist%20photo&width=900&height=480&seq=artist-detail-4&orientation=landscape",
    genres: ["Afropop", "Soul"],
    trackCount: 24,
    releaseCount: 2,
    isChartArtist: true,
    bio: "Ayra Starr is a Beninese-Nigerian singer and songwriter signed to Mavin Records. She began as a fashion model before pursuing music, posting her first original songs on Instagram in December 2019 and signing to Mavin Records the following year.",
    chartEntries: [
      { rank: 12, title: "Rush", artist: "Ayra Starr", movement: "same", weeksOnChart: 7, peakPosition: 8, isPlayable: false },
    ],
    releases: [
      { slug: "19-and-dangerous", title: "19 & Dangerous", artist: "Ayra Starr", releaseType: "Album", year: 2021, trackCount: 12, artworkUrl: "https://readdy.ai/api/search-image?query=African%20female%20pop%20artist%20album%20cover%2C%20vibrant%20colorful%20photography%2C%20young%20artist%20portrait%2C%20square%20format&width=400&height=400&seq=r4&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "tems", name: "Tems" },
      { slug: "rema", name: "Rema" },
    ],
  },
  {
    slug: "asake",
    name: "Asake",
    imageUrl: "https://readdy.ai/api/search-image?query=Nigerian%20male%20music%20artist%20amapiano%20portrait%2C%20contemporary%20studio%20photography%2C%20warm%20tones&width=900&height=480&seq=artist-detail-5&orientation=landscape",
    genres: ["Amapiano", "Street Afrobeats"],
    trackCount: 56,
    releaseCount: 3,
    isChartArtist: true,
    bio: "Asake is a Nigerian singer and songwriter signed to YBNL Nation. His style blends Afrobeats with amapiano and street pop influences. He broke into the spotlight in 2022 with the release of Omo Ope featuring Olamide.",
    chartEntries: [
      { rank: 9, title: "Sungba", artist: "Asake ft. Burna Boy", movement: "new", weeksOnChart: 1, peakPosition: 9, isPlayable: false },
      { rank: 10, title: "Terminator", artist: "Asake", movement: "down", movementAmount: 4, weeksOnChart: 14, peakPosition: 5, isPlayable: false },
    ],
    releases: [
      { slug: "ololade-asake", title: "Ololade Asake", artist: "Asake", releaseType: "EP", year: 2022, trackCount: 6, artworkUrl: "https://readdy.ai/api/search-image?query=amapiano%20album%20cover%20art%2C%20stylish%20urban%20photography%2C%20Nigerian%20music%20artist%2C%20square%20format&width=400&height=400&seq=r5&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "burna-boy", name: "Burna Boy" },
      { slug: "oxlade", name: "Oxlade" },
    ],
  },
  {
    slug: "davido",
    name: "Davido",
    imageUrl: "https://readdy.ai/api/search-image?query=Nigerian%20celebrity%20male%20musician%20portrait%2C%20glamorous%20lighting%2C%20professional%20music%20photography&width=900&height=480&seq=artist-detail-6&orientation=landscape",
    genres: ["Afrobeats"],
    trackCount: 164,
    releaseCount: 7,
    isChartArtist: true,
    bio: "David Adedeji Adeleke, known professionally as Davido, is an American-born Nigerian singer, songwriter, and record producer. He is one of the most influential artists in Africa and has helped popularize Afrobeats globally.",
    chartEntries: [
      { rank: 15, title: "Unavailable", artist: "Davido ft. Musa Keys", movement: "up", movementAmount: 5, weeksOnChart: 3, peakPosition: 11, isPlayable: false },
    ],
    releases: [
      { slug: "timeless", title: "Timeless", artist: "Davido", releaseType: "Album", year: 2023, trackCount: 17, artworkUrl: "https://readdy.ai/api/search-image?query=music%20album%20cover%20art%2C%20African%20artist%2C%20modern%20design%2C%20warm%20tones%2C%20professional%20square%20artwork&width=400&height=400&seq=home-rel-1&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "wizkid", name: "Wizkid" },
      { slug: "burna-boy", name: "Burna Boy" },
    ],
  },
];