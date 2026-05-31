import { CHART_DATA } from "./charts";
import { RELEASES } from "./releases";
import { TRACK_DETAILS } from "./trackDetails";

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

/* ─── PREVIOUS 6 ─── */

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
      { rank: 18, title: "For My Hand", artist: "Burna Boy ft. Ed Sheeran", movement: "down", movementAmount: 1, weeksOnChart: 15, peakPosition: 3, isPlayable: false },
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
      { rank: 19, title: "Bad To Me", artist: "Wizkid", movement: "down", movementAmount: 2, weeksOnChart: 20, peakPosition: 5, isPlayable: false },
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
      { rank: 17, title: "Sability", artist: "Ayra Starr", movement: "new", weeksOnChart: 1, peakPosition: 19, isPlayable: false },
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
      { rank: 20, title: "Feel", artist: "Davido", movement: "same", weeksOnChart: 8, peakPosition: 12, isPlayable: false },
    ],
    releases: [
      { slug: "timeless", title: "Timeless", artist: "Davido", releaseType: "Album", year: 2023, trackCount: 17, artworkUrl: "https://readdy.ai/api/search-image?query=music%20album%20cover%20art%2C%20African%20artist%2C%20modern%20design%2C%20warm%20tones%2C%20professional%20square%20artwork&width=400&height=400&seq=home-rel-1&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "wizkid", name: "Wizkid" },
      { slug: "burna-boy", name: "Burna Boy" },
    ],
  },

  /* ─── NEW: FIREBOY DML ─── */
  {
    slug: "fireboy-dml",
    name: "Fireboy DML",
    imageUrl: "https://readdy.ai/api/search-image?query=African male R&B singer portrait, moody studio lighting, contemporary music photography, professional portrait, warm ambient tones, artistic composition, head and shoulders shot, studio background with soft bokeh effect, high end fashion editorial style&width=900&height=480&seq=artist-detail-fireboy&orientation=landscape",
    genres: ["Afropop", "R&B"],
    trackCount: 72,
    releaseCount: 4,
    isChartArtist: true,
    bio: "Adedamola Adefolahan, known as Fireboy DML, is a Nigerian singer signed to YBNL Nation. His music is a blend of Afropop, R&B, and soul. His 2019 debut single Jealous was a massive hit and he has since released critically acclaimed albums that blend Afrobeats with introspective storytelling.",
    chartEntries: [
      { rank: 6, title: "Peru", artist: "Fireboy DML ft. Ed Sheeran", movement: "down", movementAmount: 2, weeksOnChart: 22, peakPosition: 2, isPlayable: false },
      { rank: 14, title: "Organize", artist: "Fireboy DML", movement: "down", movementAmount: 3, weeksOnChart: 11, peakPosition: 10, isPlayable: false },
      { rank: 16, title: "Yawa", artist: "Fireboy DML", movement: "new", weeksOnChart: 1, peakPosition: 16, isPlayable: false },
    ],
    releases: [
      { slug: "playboy", title: "Playboy", artist: "Fireboy DML", releaseType: "Album", year: 2022, trackCount: 16, artworkUrl: "https://readdy.ai/api/search-image?query=Afropop%20album%20cover%2C%20artistic%20photography%2C%20music%20artist%20portrait%2C%20warm%20tones%2C%20square%20format%2C%20stylized%20graphic%20design%20with%20warm%20orange%20and%20gold%20tones%2C%20professional%20studio%20photography%20aesthetic%2C%20square%20format%20album%20artwork&width=400&height=400&seq=artist-rel-fireboy&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "rema", name: "Rema" },
      { slug: "oxlade", name: "Oxlade" },
      { slug: "asake", name: "Asake" },
    ],
  },

  /* ─── NEW: BLACK SHERIF ─── */
  {
    slug: "black-sherif",
    name: "Black Sherif",
    imageUrl: "https://readdy.ai/api/search-image?query=Ghanaian%20male%20rap%20artist%20portrait%2C%20urban%20style%20photography%2C%20dramatic%20side%20lighting%2C%20dark%20moody%20background%2C%20dreadlocked%20artist%20with%20intense%20expression%2C%20streetwear%20fashion%2C%20hip%20hop%20aesthetic%2C%20cinematic%20editorial%20portrait%20photography%2C%20professional%20studio%20lighting%20with%20contrast&width=900&height=480&seq=artist-detail-sherif&orientation=landscape",
    genres: ["Afrobeats", "Rap"],
    trackCount: 31,
    releaseCount: 2,
    isChartArtist: true,
    bio: "Mohammed Ismail Sherif, professionally known as Black Sherif, is a Ghanaian singer and rapper. He burst onto the scene in 2021 with First Sermon and Second Sermon, blending highlife, Afrobeats, and drill. His global breakthrough came with Kwaku the Traveller, which topped charts across Africa and Europe.",
    chartEntries: [
      { rank: 11, title: "Kwaku the Traveller", artist: "Black Sherif", movement: "up", movementAmount: 2, weeksOnChart: 9, peakPosition: 7, isPlayable: false },
    ],
    releases: [
      { slug: "kwaku-the-traveller-ep", title: "Kwaku The Traveller", artist: "Black Sherif", releaseType: "Single", year: 2022, trackCount: 1, artworkUrl: "https://readdy.ai/api/search-image?query=Ghanaian%20music%20single%20artwork%2C%20dramatic%20artistic%20photography%2C%20square%20format%2C%20dark%20moody%2C%20African%20urban%20art%20style%2C%20street%20art%20inspired%20design%20with%20bold%20typography%2C%20black%20and%20gold%20color%20scheme%2C%20professional%20graphic%20design&width=400&height=400&seq=artist-rel-sherif&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "stonebwoy", name: "Stonebwoy" },
      { slug: "burna-boy", name: "Burna Boy" },
    ],
  },

  /* ─── NEW: OXLADE ─── */
  {
    slug: "oxlade",
    name: "Oxlade",
    imageUrl: "https://readdy.ai/api/search-image?query=African%20male%20singer%20songwriter%20portrait%2C%20acoustic%20music%20artist%2C%20warm%20studio%20light%2C%20professional%20portrait%20photography%2C%20soft%20focus%20background%2C%20soulful%20artist%20aesthetic%2C%20gentle%20expression%2C%20warm%20amber%20lighting%2C%20editorial%20portrait%20style%2C%20contemporary%20musician%20photography&width=900&height=480&seq=artist-detail-oxlade&orientation=landscape",
    genres: ["Afropop", "R&B"],
    trackCount: 44,
    releaseCount: 2,
    isChartArtist: true,
    bio: "Ikuforiji Olaitan Abdulrahman, known as Oxlade, is a Nigerian singer and songwriter. His soulful voice and blend of Afropop, R&B, and soul have earned him critical acclaim. His 2022 hit Ku Lo Sa propelled him to international recognition, and his debut EP Oxygene showcased his vocal versatility.",
    chartEntries: [
      { rank: 1, title: "Alone", artist: "Oxlade", movement: "up", movementAmount: 2, weeksOnChart: 8, peakPosition: 1, isPlayable: false },
    ],
    releases: [
      { slug: "alone", title: "Alone", artist: "Oxlade", releaseType: "Single", year: 2023, trackCount: 1, artworkUrl: "https://readdy.ai/api/search-image?query=romantic R&B music single artwork, atmospheric photography, warm gentle light, square format, minimalist African aesthetic with soft lighting, dreamy portrait style, warm gold tones, professional studio art direction&width=400&height=400&seq=artist-rel-oxlade&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "fireboy-dml", name: "Fireboy DML" },
      { slug: "asake", name: "Asake" },
      { slug: "tems", name: "Tems" },
    ],
  },

  /* ─── NEW: KIZZ DANIEL ─── */
  {
    slug: "kizz-daniel",
    name: "Kizz Daniel",
    imageUrl: "https://readdy.ai/api/search-image?query=Nigerian%20male%20afropop%20artist%20portrait%2C%20professional%20studio%20photography%2C%20confident%20pose%2C%20stylish%20urban%20outfit%2C%20warm%20background%20with%20soft%20lighting%2C%20contemporary%20African%20artist%2C%20headshot%20with%20dramatic%20lighting%2C%20clean%20background%2C%20editorial%20portrait%20style&width=900&height=480&seq=artist-detail-kizz&orientation=landscape",
    genres: ["Afropop", "Afrobeats"],
    trackCount: 88,
    releaseCount: 5,
    isChartArtist: true,
    bio: "Oluwatobiloba Daniel Anidugbe, known as Kizz Daniel, is a Nigerian singer and songwriter. Formerly signed to G-Worldwide Entertainment, he founded his own label Flyboy Inc. Known for hits like Woju, Mama, and Buga, he has consistently delivered Afropop anthems that dominate Nigerian radio and dancefloors.",
    chartEntries: [
      { rank: 7, title: "Buga", artist: "Kizz Daniel ft. Tekno", movement: "up", movementAmount: 1, weeksOnChart: 6, peakPosition: 6, isPlayable: false },
    ],
    releases: [
      { slug: "buga-single", title: "Buga", artist: "Kizz Daniel", releaseType: "Single", year: 2022, trackCount: 1, artworkUrl: "https://readdy.ai/api/search-image?query=vibrant%20green%20and%20gold%20music%20single%20artwork%2C%20African%20celebration%20theme%2C%20square%20format%2C%20bold%20graphic%20design%2C%20professional%20album%20art%20with%20geometric%20patterns%2C%20pop%20art%20style%2C%20energetic%20and%20colorful%20composition&width=400&height=400&seq=artist-rel-kizz&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "davido", name: "Davido" },
      { slug: "burna-boy", name: "Burna Boy" },
    ],
  },

  /* ─── NEW: BNXN ─── */
  {
    slug: "bnxn",
    name: "BNXN",
    imageUrl: "https://readdy.ai/api/search-image?query=African%20male%20contemporary%20music%20artist%20portrait%2C%20cool%20studio%20photography%2C%20minimalist%20background%2C%20modern%20fashion%2C%20clean%20aesthetic%2C%20young%20Nigerian%20artist%2C%20artistic%20portrait%20with%20subtle%20lighting%2C%20confident%20gaze%2C%20editorial%20photography%20style%2C%20professional%20studio%20composition&width=900&height=480&seq=artist-detail-bnxn&orientation=landscape",
    genres: ["Afropop", "R&B"],
    trackCount: 29,
    releaseCount: 2,
    isChartArtist: true,
    bio: "Daniel Benson, known professionally as BNXN (formerly Buju), is a Nigerian singer and songwriter. His emotive Afropop and R&B sound, combined with distinctive vocal control, has made him one of the most promising new voices in Nigerian music. He has collaborated with major artists including Wizkid, Burna Boy, and Zlatan.",
    chartEntries: [
      { rank: 13, title: "Overloading", artist: "BNXN ft. Wizkid", movement: "new", weeksOnChart: 1, peakPosition: 13, isPlayable: false },
    ],
    releases: [
      { slug: "sorry-im-late", title: "Sorry I'm Late", artist: "BNXN", releaseType: "EP", year: 2021, trackCount: 6, artworkUrl: "https://readdy.ai/api/search-image?query=futuristic%20neon%20aesthetic%20music%20EP%20artwork%2C%20blue%20and%20purple%20electric%20colors%2C%20square%20format%2C%20abstract%20digital%20art%2C%20modern%20graphic%20design%20with%20glowing%20elements%2C%20contemporary%20African%20music%20art%20style%2C%20professional%20studio%20design&width=400&height=400&seq=artist-rel-bnxn&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "wizkid", name: "Wizkid" },
      { slug: "burna-boy", name: "Burna Boy" },
      { slug: "omah-lay", name: "Omah Lay" },
    ],
  },

  /* ─── NEW: REMA ─── */
  {
    slug: "rema",
    name: "Rema",
    imageUrl: "https://readdy.ai/api/search-image?query=Nigerian%20young%20male%20afrobeats%20artist%20portrait%2C%20energetic%20music%20photography%2C%20vibrant%20youth%20culture%2C%20bold%20fashion%2C%20colorful%20studio%20background%2C%20dynamic%20pose%2C%20modern%20African%20pop%20star%20aesthetic%2C%20high%20energy%20portrait%20with%20artistic%20lighting%2C%20professional%20editorial%20photography%2C%20creative%20composition&width=900&height=480&seq=artist-detail-rema&orientation=landscape",
    genres: ["Afrobeats", "Afrorave"],
    trackCount: 52,
    releaseCount: 3,
    isChartArtist: true,
    bio: "Divine Ikubor, known as Rema, is a Nigerian singer and rapper signed to Mavin Records. He burst onto the scene in 2019 with Dumebi and his self-titled EP. His global breakthrough came with Calm Down featuring Selena Gomez, which became one of the biggest Afrobeats songs worldwide. He pioneered the Afrorave sound, blending Afrobeats with trap, Indian, and Arab influences.",
    chartEntries: [
      { rank: 8, title: "Calm Down", artist: "Rema ft. Selena Gomez", movement: "same", weeksOnChart: 31, peakPosition: 3, isPlayable: false },
    ],
    releases: [
      { slug: "rave-and-roses", title: "Rave & Roses", artist: "Rema", releaseType: "Album", year: 2022, trackCount: 16, artworkUrl: "https://readdy.ai/api/search-image?query=dynamic%20afrobeats%20album%20artwork%2C%20vibrant%20purple%20and%20red%20colors%2C%20futuristic%20African%20art%20style%2C%20square%20format%2C%20energetic%20abstract%20design%20with%20cosmic%20elements%2C%20digital%20art%20style%2C%20professional%20studio%20design%2C%20bold%20colors%20and%20shapes&width=400&height=400&seq=artist-rel-rema&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "ayra-starr", name: "Ayra Starr" },
      { slug: "burna-boy", name: "Burna Boy" },
      { slug: "wizkid", name: "Wizkid" },
    ],
  },

  /* ─── NEW: CRUEL SANTINO ─── */
  {
    slug: "cruel-santino",
    name: "Cruel Santino",
    imageUrl: "https://readdy.ai/api/search-image?query=Alternative%20African%20music%20artist%20portrait%2C%20artistic%20studio%20photography%2C%20moody%20lighting%2C%20creative%20expression%2C%20eclectic%20fashion%2C%20dark%20background%20with%20colored%20light%20accents%2C%20artistic%20composition%2C%20alternative%20afrobeats%20musician%2C%20professional%20editorial%20portrait%20with%20avant-garde%20style%2C%20dramatic%20shadows&width=900&height=480&seq=artist-detail-santino&orientation=landscape",
    genres: ["Alt-Afrobeats", "Afropop"],
    trackCount: 45,
    releaseCount: 3,
    isChartArtist: false,
    isRising: true,
    bio: "Osayaba Andrew Ize-Iyamu, known as Cruel Santino, is a Nigerian alternative Afrobeats artist. His music is cinematic, genre-defying, and often described as a soundtrack to his imagination. Albums like Mandy & The Jungle and Subaru Boys: FINAL HEAVEN have pushed Nigerian music into experimental territories, blending punk, indie, and Afrobeats.",
    chartEntries: [],
    releases: [
      { slug: "subaru-boys", title: "Subaru Boys: FINAL HEAVEN", artist: "Cruel Santino", releaseType: "Album", year: 2022, trackCount: 21, artworkUrl: "https://readdy.ai/api/search-image?query=alternative%20afrobeats%20album%20cover%20art%2C%20surrealist%20collage%20style%2C%20dreamy%20cosmic%20aesthetic%2C%20square%20format%2C%20abstract%20art%20with%20layered%20textures%2C%20experimental%20graphic%20design%2C%20professional%20studio%20art%20direction%2C%20dark%20and%20vibrant%20color%20palette&width=400&height=400&seq=artist-rel-santino&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "amaarae", name: "Amaarae" },
      { slug: "burna-boy", name: "Burna Boy" },
    ],
  },

  /* ─── NEW: AMAARAE ─── */
  {
    slug: "amaarae",
    name: "Amaarae",
    imageUrl: "https://readdy.ai/api/search-image?query=African%20female%20alternative%20music%20artist%20portrait%2C%20artistic%20creative%20studio%20lighting%2C%20colorful%20expression%2C%20bold%20fashion%2C%20vibrant%20makeup%2C%20dramatic%20lighting%20with%20pink%20and%20blue%20hues%2C%20avant-garde%20fashion%20photography%2C%20editorial%20style%20with%20artistic%20composition%2C%20professional%20studio%20portrait%20with%20colorful%20gel%20lighting&width=900&height=480&seq=artist-detail-amaarae&orientation=landscape",
    genres: ["Alt-Afrobeats", "Afropop"],
    trackCount: 28,
    releaseCount: 2,
    isChartArtist: false,
    isRising: true,
    bio: "Ama Serwah Genfi, known as Amaarae, is a Ghanaian-American singer, songwriter, and producer. Her fearless genre experimentation redefines Afrobeats, blending pop, punk, rock, and Afropop. Her 2020 album The Angel You Don't Know received critical acclaim, and her visual storytelling has made her a unique voice in the African music scene.",
    chartEntries: [],
    releases: [
      { slug: "angel-you-dont-know", title: "The Angel You Don't Know", artist: "Amaarae", releaseType: "Album", year: 2020, trackCount: 14, artworkUrl: "https://readdy.ai/api/search-image?query=alternative%20afrobeats%20album%20cover%20art%2C%20colorful%20artistic%20photography%2C%20experimental%20African%20aesthetic%2C%20square%20format%2C%20vibrant%20and%20surreal%20design%20with%20mixed%20media%20collage%2C%20bold%20graphic%20design%2C%20professional%20art%20direction%2C%20pink%20and%20purple%20color%20palette&width=400&height=400&seq=artist-rel-amaarae&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "cruel-santino", name: "Cruel Santino" },
      { slug: "tems", name: "Tems" },
    ],
  },

  /* ─── NEW: STONEBWOY ─── */
  {
    slug: "stonebwoy",
    name: "Stonebwoy",
    imageUrl: "https://readdy.ai/api/search-image?query=Ghanaian%20dancehall%20music%20artist%20portrait%2C%20dreadlocks%2C%20dramatic%20studio%20lighting%2C%20reggae%20artist%2C%20powerful%20presence%2C%20dark%20background%20with%20warm%20amber%20lighting%2C%20professional%20portrait%20photography%2C%20roots%20reggae%20aesthetic%2C%20confident%20expression%2C%20editorial%20style%20with%20theatrical%20lighting%2C%20high%20contrast&width=900&height=480&seq=artist-detail-stonebwoy&orientation=landscape",
    genres: ["Dancehall", "Afrobeats"],
    trackCount: 76,
    releaseCount: 5,
    isChartArtist: true,
    bio: "Livingstone Etse Satekla, known as Stonebwoy, is a Ghanaian Afropop, dancehall, and reggae musician. He is the CEO of Burniton Music Group. A BET Award winner and multiple VGMA Artist of the Year, Stonebwoy has shaped the sound of West African reggae-dancehall for over a decade, blending Ghanaian highlife with Jamaican dancehall.",
    chartEntries: [],
    releases: [
      { slug: "5th-dimension", title: "5th Dimension", artist: "Stonebwoy", releaseType: "Album", year: 2023, trackCount: 17, artworkUrl: "https://readdy.ai/api/search-image?query=Ghanaian%20dancehall%20reggae%20album%20cover%20art%2C%20roots%20and%20culture%20aesthetic%2C%20square%20format%2C%20warm%20earth%20tones%20with%20African%20symbols%2C%20professional%20graphic%20design%2C%20traditional%20meets%20modern%20style%2C%20bold%20typography%20with%20cultural%20motifs%2C%20high%20quality%20studio%20art%20direction&width=400&height=400&seq=artist-rel-stonebwoy&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "black-sherif", name: "Black Sherif" },
      { slug: "burna-boy", name: "Burna Boy" },
      { slug: "wizkid", name: "Wizkid" },
    ],
  },

  /* ─── NEW: OMAH LAY ─── */
  {
    slug: "omah-lay",
    name: "Omah Lay",
    imageUrl: "https://readdy.ai/api/search-image?query=Nigerian%20male%20afropop%20artist%20portrait%2C%20contemplative%20studio%20photography%2C%20warm%20lighting%2C%20introspective%20expression%2C%20soft%20background%20with%20gentle%20bokeh%2C%20emotional%20artist%20aesthetic%2C%20professional%20portrait%20photography%2C%20warm%20amber%20and%20brown%20tones%2C%20editorial%20style%20with%20artistic%20composition%2C%20clean%20modern%20studio%20background&width=900&height=480&seq=artist-detail-omah&orientation=landscape",
    genres: ["Afropop", "Afro-fusion"],
    trackCount: 35,
    releaseCount: 2,
    isChartArtist: true,
    isRising: true,
    bio: "Stanley Omah Didia, known as Omah Lay, is a Nigerian singer, songwriter, and record producer. His deeply personal songwriting and unique production style have captivated listeners worldwide. His 2020 EP Get Layd and debut album Boy Alone established him as one of the most emotionally resonant voices in contemporary Afropop.",
    chartEntries: [],
    releases: [
      { slug: "boy-alone", title: "Boy Alone", artist: "Omah Lay", releaseType: "Album", year: 2022, trackCount: 14, artworkUrl: "https://readdy.ai/api/search-image?query=contemplative%20afropop%20album%20artwork%2C%20soft%20muted%20colors%2C%20artistic%20portrait%20with%20texture%2C%20square%20format%2C%20editorial%20photography%20style%2C%20introspective%20and%20emotional%20design%2C%20warm%20earth%20tones%2C%20minimalist%20artistic%20composition%2C%20professional%20studio%20art%20direction%20with%20clean%20typography&width=400&height=400&seq=artist-rel-omah&orientation=squarish" },
    ],
    relatedArtists: [
      { slug: "oxlade", name: "Oxlade" },
      { slug: "fireboy-dml", name: "Fireboy DML" },
      { slug: "bnxn", name: "BNXN" },
    ],
  },
];

/* ─── HELPERS ─── */

export function getArtistDetail(slug: string): ArtistDetail | undefined {
  return ARTIST_DETAILS.find((a) => a.slug === slug);
}

export function generateArtistDetailFromBase(base: {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  isChartArtist?: boolean;
  isRising?: boolean;
  country?: string;
  debutYear?: number;
  monthlyStreams?: number;
  topChartPosition?: number;
  spotlightBio?: string;
}): ArtistDetail {
  // Find chart entries from CHART_DATA that match this artist
  const chartEntries = CHART_DATA
    .filter((entry) => entry.artist.toLowerCase().includes(base.name.toLowerCase()) ||
      entry.artist.split(" ft. ").some((a) => a.trim().toLowerCase().includes(base.name.toLowerCase())))
    .map((entry) => ({
      rank: entry.rank,
      title: entry.title,
      artist: entry.artist,
      movement: entry.movement,
      movementAmount: entry.movementAmount,
      weeksOnChart: entry.weeksOnChart,
      peakPosition: entry.peakPosition,
      isPlayable: entry.isPlayable,
    }));

  // Find releases from RELEASES that match this artist
  const releases = RELEASES
    .filter((rel) => rel.artist.toLowerCase().includes(base.name.toLowerCase()))
    .map((rel) => ({
      slug: rel.slug,
      title: rel.title,
      artist: rel.artist,
      artworkUrl: rel.artworkUrl,
      releaseType: rel.releaseType,
      year: rel.year,
      trackCount: rel.trackCount,
    }));

  // Find related artists from same genre
  const artistSlugs = ARTIST_DETAILS.map((a) => a.slug);
  const relatedArtists = ARTIST_DETAILS
    .filter((a) => a.slug !== base.slug && a.genres.some((g) => base.genres.includes(g)))
    .slice(0, 3)
    .map((a) => ({ slug: a.slug, name: a.name }));

  return {
    slug: base.slug,
    name: base.name,
    imageUrl: base.imageUrl,
    genres: base.genres,
    trackCount: base.trackCount,
    releaseCount: base.releaseCount,
    isChartArtist: base.isChartArtist,
    bio: base.spotlightBio || `${base.name} is a ${base.genres.join(" / ")} artist from ${base.country || "Africa"}.`,
    chartEntries: chartEntries.length > 0 ? chartEntries : undefined,
    releases: releases.length > 0 ? releases : undefined,
    relatedArtists: relatedArtists.length > 0 ? relatedArtists : undefined,
  };
}