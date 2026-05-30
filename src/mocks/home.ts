export const HOME_CHART_ENTRIES = [
  { rank: 1, title: "Alone", artist: "Oxlade", movement: "up" as const, movementAmount: 2, weeksOnChart: 8, peakPosition: 1, isPlayable: false },
  { rank: 2, title: "Monalisa", artist: "Lojay ft. Sarz", movement: "same" as const, weeksOnChart: 12, peakPosition: 1, isPlayable: false },
  { rank: 3, title: "Essence", artist: "Wizkid ft. Tems", movement: "down" as const, movementAmount: 1, weeksOnChart: 24, peakPosition: 1, isPlayable: false },
  { rank: 4, title: "Running", artist: "Burna Boy", movement: "up" as const, movementAmount: 3, weeksOnChart: 5, peakPosition: 4, isPlayable: false },
  { rank: 5, title: "Last Last", artist: "Burna Boy", movement: "same" as const, weeksOnChart: 18, peakPosition: 2, isPlayable: false },
];

export const HOME_FEATURED_ARTISTS = [
  { slug: "burna-boy", name: "Burna Boy", genres: ["Afrobeats", "Afrofusion"], trackCount: 142, releaseCount: 8, isChartArtist: true, imageUrl: "https://readdy.ai/api/search-image?query=African%20afrobeats%20male%20music%20artist%20portrait%2C%20studio%20photography%2C%20dark%20background%2C%20warm%20lighting%2C%20professional%20music%20artist%20photo%2C%20cinematic%20quality%2C%20detailed%20face&width=400&height=300&seq=artist-1&orientation=landscape" },
  { slug: "tems", name: "Tems", genres: ["Afropop", "R&B"], trackCount: 38, releaseCount: 3, isChartArtist: true, imageUrl: "https://readdy.ai/api/search-image?query=African%20female%20singer%20artist%20portrait%2C%20studio%20photography%2C%20warm%20golden%20lighting%2C%20contemporary%20music%20artist%2C%20cinematic%20quality&width=400&height=300&seq=artist-2&orientation=landscape" },
  { slug: "wizkid", name: "Wizkid", genres: ["Afrobeats", "Dancehall"], trackCount: 198, releaseCount: 6, isChartArtist: true, imageUrl: "https://readdy.ai/api/search-image?query=Nigerian%20male%20afrobeats%20music%20artist%20portrait%2C%20dark%20studio%20backdrop%2C%20professional%20lighting%2C%20contemporary%20musician&width=400&height=300&seq=artist-3&orientation=landscape" },
  { slug: "ayra-starr", name: "Ayra Starr", genres: ["Afropop", "Soul"], trackCount: 24, releaseCount: 2, isChartArtist: true, imageUrl: "https://readdy.ai/api/search-image?query=African%20female%20afropop%20artist%20portrait%2C%20warm%20studio%20lighting%2C%20stylish%20contemporary%20music%20artist%20photo&width=400&height=300&seq=artist-4&orientation=landscape" },
];

export const HOME_EDITORIAL_STORIES = [
  {
    slug: "state-of-afrobeats-2024",
    title: "The state of Afrobeats in 2024: global reach, local soul",
    section: "Analysis",
    date: "May 2024",
    readingTime: 8,
    heroUrl: "https://readdy.ai/api/search-image?query=African%20music%20concert%20stage%20performance%2C%20crowd%2C%20dramatic%20lighting%2C%20cultural%20celebration%2C%20editorial%20photography%20style&width=900&height=420&seq=story-1&orientation=landscape",
    dek: "How the genre's breakout year reshaped industry expectations and who is driving the next wave.",
    isFeatured: true,
  },
  {
    slug: "east-africa-music-scene",
    title: "East Africa's quiet surge: Tanzania and Kenya rewrite the map",
    section: "Focus",
    date: "Apr 2024",
    readingTime: 6,
    heroUrl: "https://readdy.ai/api/search-image?query=East%20African%20city%20skyline%20music%20culture%20documentary%20photography%2C%20urban%20landscape%20Nairobi&width=300&height=200&seq=story-2&orientation=landscape",
  },
  {
    slug: "streaming-economics",
    title: "Streaming economics and the African artist",
    section: "Industry",
    date: "Mar 2024",
    readingTime: 5,
    heroUrl: "https://readdy.ai/api/search-image?query=music%20streaming%20technology%2C%20headphones%2C%20digital%20music%20interface%2C%20studio%20recording%20equipment&width=300&height=200&seq=story-3&orientation=landscape",
  },
  {
    slug: "genre-crossover",
    title: "When genres cross: Afrobeats meets hip-hop in real time",
    section: "Culture",
    date: "Mar 2024",
    readingTime: 4,
    heroUrl: "https://readdy.ai/api/search-image?query=music%20studio%20recording%20session%2C%20African%20musicians%20collaboration%2C%20creative%20process%20documentary%20photography&width=300&height=200&seq=story-4&orientation=landscape",
  },
];

export const HOME_GENRE_VERTICALS = [
  { slug: "afrobeats", name: "Afrobeats", accentVar: "--wk-v-music", artistCount: 284, trackCount: 1820 },
  { slug: "afropop", name: "Afropop", accentVar: "--wk-v-music", artistCount: 156, trackCount: 940 },
  { slug: "amapiano", name: "Amapiano", accentVar: "--wk-v-dance", artistCount: 112, trackCount: 680 },
  { slug: "afrofusion", name: "Afrofusion", accentVar: "--wk-v-music", artistCount: 88, trackCount: 420 },
  { slug: "highlife", name: "Highlife", accentVar: "--wk-v-intel", artistCount: 64, trackCount: 310 },
  { slug: "bongo-flava", name: "Bongo Flava", accentVar: "--wk-v-places", artistCount: 47, trackCount: 240 },
];