/**
 * Mock Track Catalog — Realistic African music tracks for provider fetch fallback
 * Deterministic seeded generation based on URL hash so the same URL always
 * returns the same tracks. Used when real API credentials are not available.
 */

import type { NormalizedChartRow } from "./ingestStudioTypes";

export interface MockTrack {
  title: string;
  artistNames: string[];
  providerTrackId: string;
  providerReleaseId: string;
  providerArtistIds: string[];
  artworkUrl: string;
  previewUrl: string | null;
  externalUrl: string;
  releaseTitle?: string;
  durationMs?: number;
  explicit?: boolean;
  popularity?: number;
}

const MOCK_TRACK_CATALOG: MockTrack[] = [
  // Kenya
  { title: "Suzanna", artistNames: ["Sauti Sol"], providerTrackId: "spotify:track:ken001", providerReleaseId: "spotify:album:ken001", providerArtistIds: ["spotify:artist:sautisol"], artworkUrl: "https://readdy.ai/api/search-image?query=Colorful%20African%20pop%20album%20cover%20artwork%20with%20vibrant%20patterns%20and%20modern%20typography%20on%20clean%20background&width=300&height=300&seq=mock-track-ken001&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken001", releaseTitle: "Midnight Train", durationMs: 214000, explicit: false, popularity: 85 },
  { title: "Nairobi", artistNames: ["Nviiri the Storyteller"], providerTrackId: "spotify:track:ken002", providerReleaseId: "spotify:album:ken002", providerArtistIds: ["spotify:artist:nviiri"], artworkUrl: "https://readdy.ai/api/search-image?query=Warm%20toned%20African%20R&width=300&height=300&seq=mock-track-ken002&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken002", releaseTitle: "Kitu Nono", durationMs: 198000, explicit: false, popularity: 78 },
  { title: "Kamata", artistNames: ["Femi One", "Mejja"], providerTrackId: "spotify:track:ken003", providerReleaseId: "spotify:album:ken003", providerArtistIds: ["spotify:artist:femi1", "spotify:artist:mejja"], artworkUrl: "https://readdy.ai/api/search-image?query=Bold%20Kenyan%20hip-hop%20album%20cover%20with%20street%20art%20style%20and%20graffiti%20elements&width=300&height=300&seq=mock-track-ken003&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken003", releaseTitle: "Kamata EP", durationMs: 185000, explicit: true, popularity: 82 },
  { title: "Dala Dala", artistNames: ["Ethic Entertainment"], providerTrackId: "spotify:track:ken004", providerReleaseId: "spotify:album:ken004", providerArtistIds: ["spotify:artist:ethic"], artworkUrl: "https://readdy.ai/api/search-image?query=Kenyan%20gengetone%20music%20cover%20art%20with%20energetic%20urban%20vibes%20and%20neon%20colors&width=300&height=300&seq=mock-track-ken004&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken004", releaseTitle: "Dala Dala", durationMs: 203000, explicit: true, popularity: 76 },
  { title: "Chaguo La Moyo", artistNames: ["Otile Brown", "Sanaipei Tande"], providerTrackId: "spotify:track:ken005", providerReleaseId: "spotify:album:ken005", providerArtistIds: ["spotify:artist:otile", "spotify:artist:sanaipei"], artworkUrl: "https://readdy.ai/api/search-image?query=Romantic%20African%20R&width=300&height=300&seq=mock-track-ken005&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken005", releaseTitle: "Just in Love", durationMs: 226000, explicit: false, popularity: 80 },
  { title: "Mtaachana Tu", artistNames: ["Bahati"], providerTrackId: "spotify:track:ken006", providerReleaseId: "spotify:album:ken006", providerArtistIds: ["spotify:artist:bahati"], artworkUrl: "https://readdy.ai/api/search-image?query=Kenyan%20gospel%20pop%20album%20cover%20with%20uplifting%20warm%20colors%20and%20modern%20design&width=300&height=300&seq=mock-track-ken006&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken006", releaseTitle: "Love Like This", durationMs: 192000, explicit: false, popularity: 74 },
  { title: "Liar", artistNames: ["Willy Paul"], providerTrackId: "spotify:track:ken007", providerReleaseId: "spotify:album:ken007", providerArtistIds: ["spotify:artist:willypaul"], artworkUrl: "https://readdy.ai/api/search-image?query=Dramatic%20African%20pop%20album%20cover%20with%20dark%20moody%20lighting%20and%20artistic%20shadows&width=300&height=300&seq=mock-track-ken007&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken007", releaseTitle: "The African Experience", durationMs: 210000, explicit: false, popularity: 72 },
  { title: "Wangu", artistNames: ["Nadia Mukami"], providerTrackId: "spotify:track:ken008", providerReleaseId: "spotify:album:ken008", providerArtistIds: ["spotify:artist:nadia"], artworkUrl: "https://readdy.ai/api/search-image?query=Elegant%20African%20female%20artist%20album%20cover%20with%20gold%20accents%20and%20sophisticated%20portrait%20style&width=300&height=300&seq=mock-track-ken008&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken008", releaseTitle: "African Popstar", durationMs: 205000, explicit: false, popularity: 79 },
  { title: "Dodo", artistNames: ["Arrow Bwoy"], providerTrackId: "spotify:track:ken009", providerReleaseId: "spotify:album:ken009", providerArtistIds: ["spotify:artist:arrowbwoy"], artworkUrl: "https://readdy.ai/api/search-image?query=Kenyan%20dancehall%20album%20cover%20with%20tropical%20colors%20and%20island%20vibes%20artwork&width=300&height=300&seq=mock-track-ken009&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken009", releaseTitle: "Hatua", durationMs: 198000, explicit: false, popularity: 81 },
  { title: "Tabia Za Wakenya", artistNames: ["Mejja"], providerTrackId: "spotify:track:ken010", providerReleaseId: "spotify:album:ken010", providerArtistIds: ["spotify:artist:mejja"], artworkUrl: "https://readdy.ai/api/search-image?query=Comedic%20Kenyan%20hip-hop%20album%20cover%20with%20cartoon%20style%20characters%20and%20bright%20colors&width=300&height=300&seq=mock-track-ken010&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ken010", releaseTitle: "Tabia Za Wakenya", durationMs: 189000, explicit: true, popularity: 83 },

  // Nigeria
  { title: "Essence", artistNames: ["WizKid", "Tems"], providerTrackId: "spotify:track:ng001", providerReleaseId: "spotify:album:ng001", providerArtistIds: ["spotify:artist:wizkid", "spotify:artist:tems"], artworkUrl: "https://readdy.ai/api/search-image?query=Smooth%20Afrobeats%20album%20cover%20with%20sunset%20gradient%20and%20minimalist%20silhouette%20design&width=300&height=300&seq=mock-track-ng001&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng001", releaseTitle: "Made in Lagos", durationMs: 242000, explicit: false, popularity: 95 },
  { title: "Last Last", artistNames: ["Burna Boy"], providerTrackId: "spotify:track:ng002", providerReleaseId: "spotify:album:ng002", providerArtistIds: ["spotify:artist:burna"], artworkUrl: "https://readdy.ai/api/search-image?query=Bold%20Afrobeats%20album%20cover%20with%20African%20mask%20motifs%20and%20rich%20earth%20tones&width=300&height=300&seq=mock-track-ng002&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng002", releaseTitle: "Love Damini", durationMs: 228000, explicit: false, popularity: 93 },
  { title: "Unavailable", artistNames: ["Davido", "Musa Keys"], providerTrackId: "spotify:track:ng003", providerReleaseId: "spotify:album:ng003", providerArtistIds: ["spotify:artist:davido", "spotify:artist:musa"], artworkUrl: "https://readdy.ai/api/search-image?query=High-energy%20Afrobeats%20album%20cover%20with%20diamond%20patterns%20and%20luxury%20gold%20accents&width=300&height=300&seq=mock-track-ng003&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng003", releaseTitle: "Timeless", durationMs: 210000, explicit: false, popularity: 91 },
  { title: "Rush", artistNames: ["Ayra Starr"], providerTrackId: "spotify:track:ng004", providerReleaseId: "spotify:album:ng004", providerArtistIds: ["spotify:artist:ayra"], artworkUrl: "https://readdy.ai/api/search-image?query=Youthful%20Afrobeats%20album%20cover%20with%20pink%20and%20purple%20gradient%20and%20playful%20modern%20design&width=300&height=300&seq=mock-track-ng004&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng004", releaseTitle: "19 & Dangerous", durationMs: 198000, explicit: false, popularity: 88 },
  { title: "Calm Down", artistNames: ["Rema"], providerTrackId: "spotify:track:ng005", providerReleaseId: "spotify:album:ng005", providerArtistIds: ["spotify:artist:rema"], artworkUrl: "https://readdy.ai/api/search-image?query=Sleek%20Afrobeats%20album%20cover%20with%20neon%20green%20accents%20and%20futuristic%20digital%20art&width=300&height=300&seq=mock-track-ng005&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng005", releaseTitle: "Rave & Roses", durationMs: 215000, explicit: false, popularity: 94 },
  { title: "Soso", artistNames: ["Omah Lay"], providerTrackId: "spotify:track:ng006", providerReleaseId: "spotify:album:ng006", providerArtistIds: ["spotify:artist:omah"], artworkUrl: "https://readdy.ai/api/search-image?query=Intimate%20Afrobeats%20album%20cover%20with%20soft%20blue%20tones%20and%20contemplative%20mood%20artwork&width=300&height=300&seq=mock-track-ng006&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng006", releaseTitle: "Boy Alone", durationMs: 205000, explicit: false, popularity: 86 },
  { title: "Peru", artistNames: ["Fireboy DML"], providerTrackId: "spotify:track:ng007", providerReleaseId: "spotify:album:ng007", providerArtistIds: ["spotify:artist:fireboy"], artworkUrl: "https://readdy.ai/api/search-image?query=Warm%20Afrobeats%20album%20cover%20with%20candlelight%20glow%20and%20cozy%20intimate%20atmosphere&width=300&height=300&seq=mock-track-ng007&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng007", releaseTitle: "Apollo", durationMs: 192000, explicit: false, popularity: 87 },
  { title: "Joha", artistNames: ["Asake"], providerTrackId: "spotify:track:ng008", providerReleaseId: "spotify:album:ng008", providerArtistIds: ["spotify:artist:asake"], artworkUrl: "https://readdy.ai/api/search-image?query=Street-style%20Afrobeats%20album%20cover%20with%20urban%20photography%20and%20gritty%20authentic%20aesthetic&width=300&height=300&seq=mock-track-ng008&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng008", releaseTitle: "Mr Money with the Vibe", durationMs: 200000, explicit: false, popularity: 89 },
  { title: "Buga", artistNames: ["Kizz Daniel", "Tekno"], providerTrackId: "spotify:track:ng009", providerReleaseId: "spotify:album:ng009", providerArtistIds: ["spotify:artist:kizz", "spotify:artist:tekno"], artworkUrl: "https://readdy.ai/api/search-image?query=Festive%20Afrobeats%20album%20cover%20with%20confetti%20and%20celebration%20colors%20party%20vibe&width=300&height=300&seq=mock-track-ng009&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng009", releaseTitle: "Buga", durationMs: 185000, explicit: false, popularity: 90 },
  { title: "Sability", artistNames: ["Yemi Alade"], providerTrackId: "spotify:track:ng010", providerReleaseId: "spotify:album:ng010", providerArtistIds: ["spotify:artist:yemi"], artworkUrl: "https://readdy.ai/api/search-image?query=Powerful%20African%20female%20artist%20album%20cover%20with%20bold%20patterns%20and%20confident%20stance&width=300&height=300&seq=mock-track-ng010&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ng010", releaseTitle: "African Baddie", durationMs: 210000, explicit: false, popularity: 77 },

  // South Africa
  { title: "Jerusalema", artistNames: ["Master KG", "Nomcebo Zikode"], providerTrackId: "spotify:track:za001", providerReleaseId: "spotify:album:za001", providerArtistIds: ["spotify:artist:masterkg", "spotify:artist:nomcebo"], artworkUrl: "https://readdy.ai/api/search-image?query=Uplifting%20South%20African%20gospel%20house%20album%20cover%20with%20golden%20light%20and%20spiritual%20atmosphere&width=300&height=300&seq=mock-track-za001&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/za001", releaseTitle: "Jerusalema", durationMs: 236000, explicit: false, popularity: 92 },
  { title: "Amanikiniki", artistNames: ["MFR Souls", "Major League DJz", "Kamo Mphela"], providerTrackId: "spotify:track:za002", providerReleaseId: "spotify:album:za002", providerArtistIds: ["spotify:artist:mfr", "spotify:artist:majorleague", "spotify:artist:kamo"], artworkUrl: "https://readdy.ai/api/search-image?query=South%20African%20amapiano%20album%20cover%20with%20deep%20house%20vibes%20and%20nightclub%20atmosphere&width=300&height=300&seq=mock-track-za002&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/za002", releaseTitle: "Amanikiniki", durationMs: 420000, explicit: false, popularity: 84 },
  { title: "Izolo", artistNames: ["DJ Maphorisa", "Kabza De Small"], providerTrackId: "spotify:track:za003", providerReleaseId: "spotify:album:za003", providerArtistIds: ["spotify:artist:maphorisa", "spotify:artist:kabza"], artworkUrl: "https://readdy.ai/api/search-image?query=South%20African%20amapiano%20album%20cover%20with%20log%20cabin%20vibes%20and%20warm%20wood%20tones&width=300&height=300&seq=mock-track-za003&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/za003", releaseTitle: "Izolo", durationMs: 380000, explicit: false, popularity: 86 },
  { title: "Water", artistNames: ["Tyla"], providerTrackId: "spotify:track:za004", providerReleaseId: "spotify:album:za004", providerArtistIds: ["spotify:artist:tyla"], artworkUrl: "https://readdy.ai/api/search-image?query=Fresh%20South%20African%20pop%20album%20cover%20with%20water%20droplets%20and%20cool%20blue%20aesthetic&width=300&height=300&seq=mock-track-za004&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/za004", releaseTitle: "Tyla", durationMs: 198000, explicit: false, popularity: 91 },
  { title: "Good For That", artistNames: ["Cassper Nyovest"], providerTrackId: "spotify:track:za005", providerReleaseId: "spotify:album:za005", providerArtistIds: ["spotify:artist:cassper"], artworkUrl: "https://readdy.ai/api/search-image?query=South%20African%20hip-hop%20album%20cover%20with%20luxury%20cars%20and%20city%20skyline%20backdrop&width=300&height=300&seq=mock-track-za005&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/za005", releaseTitle: "Good For That", durationMs: 205000, explicit: true, popularity: 79 },
  { title: "SMA", artistNames: ["Nasty C", "Rowlene"], providerTrackId: "spotify:track:za006", providerReleaseId: "spotify:album:za006", providerArtistIds: ["spotify:artist:nastyc", "spotify:artist:rowlene"], artworkUrl: "https://readdy.ai/api/search-image?query=South%20African%20R&width=300&height=300&seq=mock-track-za006&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/za006", releaseTitle: "ZMWSP", durationMs: 215000, explicit: true, popularity: 80 },

  // Ghana
  { title: "Adonai", artistNames: ["Sarkodie", "Castro"], providerTrackId: "spotify:track:gh001", providerReleaseId: "spotify:album:gh001", providerArtistIds: ["spotify:artist:sarkodie", "spotify:artist:castro"], artworkUrl: "https://readdy.ai/api/search-image?query=Ghanaian%20hip-life%20album%20cover%20with%20traditional%20kente%20cloth%20patterns%20and%20modern%20twist&width=300&height=300&seq=mock-track-gh001&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/gh001", releaseTitle: "Sarkology", durationMs: 220000, explicit: false, popularity: 87 },
  { title: "Activate", artistNames: ["Stonebwoy", "David Guetta"], providerTrackId: "spotify:track:gh002", providerReleaseId: "spotify:album:gh002", providerArtistIds: ["spotify:artist:stonebwoy", "spotify:artist:guetta"], artworkUrl: "https://readdy.ai/api/search-image?query=Global%20dancehall%20EDM%20collaboration%20album%20cover%20with%20electric%20energy%20and%20neon%20lights&width=300&height=300&seq=mock-track-gh002&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/gh002", releaseTitle: "Activate", durationMs: 195000, explicit: false, popularity: 83 },
  { title: "My Level", artistNames: ["Shatta Wale"], providerTrackId: "spotify:track:gh003", providerReleaseId: "spotify:album:gh003", providerArtistIds: ["spotify:artist:shatta"], artworkUrl: "https://readdy.ai/api/search-image?query=Bold%20Ghanaian%20dancehall%20album%20cover%20with%20crown%20motif%20and%20royal%20gold%20colors&width=300&height=300&seq=mock-track-gh003&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/gh003", releaseTitle: "Reign", durationMs: 200000, explicit: true, popularity: 81 },
  { title: "Touch It", artistNames: ["KiDi"], providerTrackId: "spotify:track:gh004", providerReleaseId: "spotify:album:gh004", providerArtistIds: ["spotify:artist:kidi"], artworkUrl: "https://readdy.ai/api/search-image?query=Smooth%20Ghanaian%20highlife%20R&width=300&height=300&seq=mock-track-gh004&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/gh004", releaseTitle: "Golden Boy", durationMs: 190000, explicit: false, popularity: 85 },
  { title: "Angela", artistNames: ["Kuami Eugene"], providerTrackId: "spotify:track:gh005", providerReleaseId: "spotify:album:gh005", providerArtistIds: ["spotify:artist:kuami"], artworkUrl: "https://readdy.ai/api/search-image?query=Colorful%20Ghanaian%20highlife%20pop%20album%20cover%20with%20tropical%20flowers%20and%20joyful%20energy&width=300&height=300&seq=mock-track-gh005&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/gh005", releaseTitle: "Rockstar", durationMs: 205000, explicit: false, popularity: 82 },
  { title: "Forever", artistNames: ["Gyakie"], providerTrackId: "spotify:track:gh006", providerReleaseId: "spotify:album:gh006", providerArtistIds: ["spotify:artist:gyakie"], artworkUrl: "https://readdy.ai/api/search-image?query=Dreamy%20Ghanaian%20R&width=300&height=300&seq=mock-track-gh006&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/gh006", releaseTitle: "Seed", durationMs: 198000, explicit: false, popularity: 84 },
  { title: "Sugarcane", artistNames: ["Camidoh"], providerTrackId: "spotify:track:gh007", providerReleaseId: "spotify:album:gh007", providerArtistIds: ["spotify:artist:camidoh"], artworkUrl: "https://readdy.ai/api/search-image?query=Sweet%20Ghanaian%20afro-fusion%20album%20cover%20with%20tropical%20sugar%20cane%20field%20and%20warm%20sunlight&width=300&height=300&seq=mock-track-gh007&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/gh007", releaseTitle: "Sugarcane", durationMs: 192000, explicit: false, popularity: 78 },

  // Uganda
  { title: "Tweyagale", artistNames: ["Eddy Kenzo"], providerTrackId: "spotify:track:ug001", providerReleaseId: "spotify:album:ug001", providerArtistIds: ["spotify:artist:eddy"], artworkUrl: "https://readdy.ai/api/search-image?query=Ugandan%20afrobeat%20album%20cover%20with%20vibrant%20East%20African%20colors%20and%20traditional%20drum%20motifs&width=300&height=300&seq=mock-track-ug001&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ug001", releaseTitle: "Tweyagale", durationMs: 210000, explicit: false, popularity: 75 },
  { title: "Love You Everyday", artistNames: ["Bebe Cool"], providerTrackId: "spotify:track:ug002", providerReleaseId: "spotify:album:ug002", providerArtistIds: ["spotify:artist:bebe"], artworkUrl: "https://readdy.ai/api/search-image?query=Romantic%20Ugandan%20pop%20album%20cover%20with%20heart%20motifs%20and%20soft%20red%20pink%20gradient&width=300&height=300&seq=mock-track-ug002&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ug002", releaseTitle: "Love You Everyday", durationMs: 205000, explicit: false, popularity: 73 },
  { title: "Tubonge", artistNames: ["Jose Chameleone"], providerTrackId: "spotify:track:ug003", providerReleaseId: "spotify:album:ug003", providerArtistIds: ["spotify:artist:chameleone"], artworkUrl: "https://readdy.ai/api/search-image?query=Legendary%20Ugandan%20music%20album%20cover%20with%20bold%20African%20print%20and%20veteran%20artist%20vibe&width=300&height=300&seq=mock-track-ug003&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ug003", releaseTitle: "Tubonge", durationMs: 215000, explicit: false, popularity: 74 },
  { title: "Ndi Mu Love", artistNames: ["Spice Diana"], providerTrackId: "spotify:track:ug004", providerReleaseId: "spotify:album:ug004", providerArtistIds: ["spotify:artist:spice"], artworkUrl: "https://readdy.ai/api/search-image?query=Ugandan%20female%20pop%20album%20cover%20with%20sparkle%20effects%20and%20youthful%20chic%20aesthetic&width=300&height=300&seq=mock-track-ug004&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ug004", releaseTitle: "Ndi Mu Love", durationMs: 198000, explicit: false, popularity: 76 },
  { title: "Nakyuka", artistNames: ["Sheebah"], providerTrackId: "spotify:track:ug005", providerReleaseId: "spotify:album:ug005", providerArtistIds: ["spotify:artist:sheebah"], artworkUrl: "https://readdy.ai/api/search-image?query=Confident%20Ugandan%20dance%20album%20cover%20with%20bold%20fashion%20and%20fierce%20feminine%20energy&width=300&height=300&seq=mock-track-ug005&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/ug005", releaseTitle: "Nakyuka", durationMs: 200000, explicit: false, popularity: 77 },

  // Tanzania
  { title: "Yatapita", artistNames: ["Diamond Platnumz"], providerTrackId: "spotify:track:tz001", providerReleaseId: "spotify:album:tz001", providerArtistIds: ["spotify:artist:diamond"], artworkUrl: "https://readdy.ai/api/search-image?query=Tanzanian%20bongo%20flava%20album%20cover%20with%20luxury%20aesthetic%20and%20diamond%20motifs&width=300&height=300&seq=mock-track-tz001&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/tz001", releaseTitle: "Yatapita", durationMs: 210000, explicit: false, popularity: 88 },
  { title: "Mwana", artistNames: ["Ali Kiba"], providerTrackId: "spotify:track:tz002", providerReleaseId: "spotify:album:tz002", providerArtistIds: ["spotify:artist:kiba"], artworkUrl: "https://readdy.ai/api/search-image?query=Tanzanian%20R&width=300&height=300&seq=mock-track-tz002&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/tz002", releaseTitle: "Mwana", durationMs: 205000, explicit: false, popularity: 80 },
  { title: "Kainama", artistNames: ["Harmonize"], providerTrackId: "spotify:track:tz003", providerReleaseId: "spotify:album:tz003", providerArtistIds: ["spotify:artist:harmonize"], artworkUrl: "https://readdy.ai/api/search-image?query=Tanzanian%20afro-bongo%20album%20cover%20with%20vibrant%20patterns%20and%20celebration%20energy&width=300&height=300&seq=mock-track-tz003&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/tz003", releaseTitle: "Kainama", durationMs: 200000, explicit: false, popularity: 82 },
  { title: "Sukari", artistNames: ["Zuchu"], providerTrackId: "spotify:track:tz004", providerReleaseId: "spotify:album:tz004", providerArtistIds: ["spotify:artist:zuchu"], artworkUrl: "https://readdy.ai/api/search-image?query=Tanzanian%20female%20pop%20album%20cover%20with%20sugar%20candy%20colors%20and%20playful%20sweet%20aesthetic&width=300&height=300&seq=mock-track-tz004&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/tz004", releaseTitle: "Sukari", durationMs: 195000, explicit: false, popularity: 85 },
  { title: "Ninogeshe", artistNames: ["Nandy"], providerTrackId: "spotify:track:tz005", providerReleaseId: "spotify:album:tz005", providerArtistIds: ["spotify:artist:nandy"], artworkUrl: "https://readdy.ai/api/search-image?query=Tanzanian%20R&width=300&height=300&seq=mock-track-tz005&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/tz005", releaseTitle: "Ninogeshe", durationMs: 205000, explicit: false, popularity: 81 },

  // Cross-market / Pan-African
  { title: "Pana", artistNames: ["Tekno"], providerTrackId: "spotify:track:pan001", providerReleaseId: "spotify:album:pan001", providerArtistIds: ["spotify:artist:tekno"], artworkUrl: "https://readdy.ai/api/search-image?query=Pan-African%20afrobeats%20album%20cover%20with%20continental%20map%20and%20unity%20colors&width=300&height=300&seq=mock-track-pan001&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan001", releaseTitle: "Pana", durationMs: 198000, explicit: false, popularity: 86 },
  { title: "Johnny", artistNames: ["Yemi Alade"], providerTrackId: "spotify:track:pan002", providerReleaseId: "spotify:album:pan002", providerArtistIds: ["spotify:artist:yemi"], artworkUrl: "https://readdy.ai/api/search-image?query=Powerful%20African%20pop%20album%20cover%20with%20red%20cape%20and%20dramatic%20pose%20superhero%20vibe&width=300&height=300&seq=mock-track-pan002&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan002", releaseTitle: "King of Queens", durationMs: 210000, explicit: false, popularity: 84 },
  { title: "African Beauty", artistNames: ["Diamond Platnumz", "Omarion"], providerTrackId: "spotify:track:pan003", providerReleaseId: "spotify:album:pan003", providerArtistIds: ["spotify:artist:diamond", "spotify:artist:omarion"], artworkUrl: "https://readdy.ai/api/search-image?query=East-West%20African%20collaboration%20album%20cover%20with%20global%20fusion%20aesthetic%20and%20sophisticated%20design&width=300&height=300&seq=mock-track-pan003&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan003", releaseTitle: "A Boy from Tandale", durationMs: 215000, explicit: false, popularity: 83 },
  { title: "Soweto", artistNames: ["Victony", "Tempoe"], providerTrackId: "spotify:track:pan004", providerReleaseId: "spotify:album:pan004", providerArtistIds: ["spotify:artist:victony", "spotify:artist:tempoe"], artworkUrl: "https://readdy.ai/api/search-image?query=Nigerian%20street%20pop%20album%20cover%20with%20urban%20gritty%20aesthetic%20and%20night%20city%20lights&width=300&height=300&seq=mock-track-pan004&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan004", releaseTitle: "Outlaw", durationMs: 200000, explicit: true, popularity: 85 },
  { title: "Gwagwalada", artistNames: ["Bnxn", "Kizz Daniel", "Seyi Vibez"], providerTrackId: "spotify:track:pan005", providerReleaseId: "spotify:album:pan005", providerArtistIds: ["spotify:artist:bnxn", "spotify:artist:kizz", "spotify:artist:seyi"], artworkUrl: "https://readdy.ai/api/search-image?query=Nigerian%20collaboration%20album%20cover%20with%20three%20artists%20and%20dynamic%20energy%20composition&width=300&height=300&seq=mock-track-pan005&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan005", releaseTitle: "Gwagwalada", durationMs: 205000, explicit: false, popularity: 87 },
  { title: "Terminator", artistNames: ["King Promise"], providerTrackId: "spotify:track:pan006", providerReleaseId: "spotify:album:pan006", providerArtistIds: ["spotify:artist:kingpromise"], artworkUrl: "https://readdy.ai/api/search-image?query=Ghanaian%20highlife%20pop%20album%20cover%20with%20retro%20sunglasses%20and%20cool%20vintage%20vibe&width=300&height=300&seq=mock-track-pan006&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan006", releaseTitle: "5 Star", durationMs: 198000, explicit: false, popularity: 82 },
  { title: "Ameno Amapiano", artistNames: ["Goya Menor", "Nektunez"], providerTrackId: "spotify:track:pan007", providerReleaseId: "spotify:album:pan007", providerArtistIds: ["spotify:artist:goya", "spotify:artist:nektunez"], artworkUrl: "https://readdy.ai/api/search-image?query=Amapiano%20remix%20album%20cover%20with%20mystical%20chant%20vibes%20and%20deep%20house%20aesthetic&width=300&height=300&seq=mock-track-pan007&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan007", releaseTitle: "Ameno Amapiano", durationMs: 420000, explicit: false, popularity: 88 },
  { title: "Bloody Samaritan", artistNames: ["Ayra Starr"], providerTrackId: "spotify:track:pan008", providerReleaseId: "spotify:album:pan008", providerArtistIds: ["spotify:artist:ayra"], artworkUrl: "https://readdy.ai/api/search-image?query=Bold%20Gen%20Z%20Afrobeats%20album%20cover%20with%20fierce%20attitude%20and%20streetwear%20fashion%20vibe&width=300&height=300&seq=mock-track-pan008&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan008", releaseTitle: "19 & Dangerous", durationMs: 205000, explicit: false, popularity: 86 },
  { title: "Finesse", artistNames: ["Pheelz", "Bnxn"], providerTrackId: "spotify:track:pan009", providerReleaseId: "spotify:album:pan009", providerArtistIds: ["spotify:artist:pheelz", "spotify:artist:bnxn"], artworkUrl: "https://readdy.ai/api/search-image?query=Smooth%20Nigerian%20R&width=300&height=300&seq=mock-track-pan009&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan009", releaseTitle: "Finesse", durationMs: 190000, explicit: false, popularity: 85 },
  { title: "Rush", artistNames: ["Ayra Starr"], providerTrackId: "spotify:track:pan010", providerReleaseId: "spotify:album:pan010", providerArtistIds: ["spotify:artist:ayra"], artworkUrl: "https://readdy.ai/api/search-image?query=Dynamic%20Afrobeats%20album%20cover%20with%20motion%20blur%20and%20speed%20energy%20visual%20effect&width=300&height=300&seq=mock-track-pan010&orientation=squarish", previewUrl: null, externalUrl: "https://open.spotify.com/track/pan010", releaseTitle: "Rush", durationMs: 198000, explicit: false, popularity: 89 },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function pickMarketForUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("ke") || lower.includes("kenya") || lower.includes("nairobi")) return "KE";
  if (lower.includes("ng") || lower.includes("nigeria") || lower.includes("lagos")) return "NG";
  if (lower.includes("za") || lower.includes("south.africa") || lower.includes("sa")) return "ZA";
  if (lower.includes("gh") || lower.includes("ghana") || lower.includes("accra")) return "GH";
  if (lower.includes("ug") || lower.includes("uganda") || lower.includes("kampala")) return "UG";
  if (lower.includes("tz") || lower.includes("tanzania") || lower.includes("dar")) return "TZ";
  return "KE";
}

function filterTracksByMarket(tracks: MockTrack[], market: string): MockTrack[] {
  const marketPrefix = market.toLowerCase();
  const marketMatches = tracks.filter((t) => {
    const id = t.providerTrackId.toLowerCase();
    return id.startsWith(`${marketPrefix}`) || id.startsWith("pan");
  });
  if (marketMatches.length >= 10) return marketMatches;
  // Fallback: mix market-specific with pan-african
  const specific = tracks.filter((t) => t.providerTrackId.toLowerCase().startsWith(`${marketPrefix}`));
  const pan = tracks.filter((t) => t.providerTrackId.toLowerCase().startsWith("pan"));
  return [...specific, ...pan];
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateMockProviderRows(
  sourceUrl: string,
  market: string,
  count: number,
  provider: "spotify" | "apple_music"
): NormalizedChartRow[] {
  const seed = `${sourceUrl}-${market}-${count}`;
  const rand = createSeededRandom(seed);
  const urlMarket = pickMarketForUrl(sourceUrl);
  const effectiveMarket = market || urlMarket;

  const pool = filterTracksByMarket(MOCK_TRACK_CATALOG, effectiveMarket);
  const shuffled = shuffleArray(pool, rand);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  // If we don't have enough unique tracks, loop with slight variation
  const rows: NormalizedChartRow[] = [];
  for (let i = 0; i < count; i++) {
    const track = selected[i % selected.length];
    const rank = i + 1;
    const previousRank = rand() > 0.3 ? Math.max(1, rank + Math.floor((rand() - 0.5) * 10)) : null;
    let movement: NormalizedChartRow["movement"] = "same";
    if (previousRank === null) movement = "new";
    else if (previousRank > rank) movement = "up";
    else if (previousRank < rank) movement = "down";
    else if (previousRank === rank) movement = "same";

    const row: NormalizedChartRow = {
      sourceProvider: provider,
      sourceUrl,
      sourceRowId: `${provider}-track-${track.providerTrackId}-${i}`,
      rank,
      previousRank,
      movement,
      trackTitle: track.title,
      releaseTitle: track.releaseTitle,
      artistNames: track.artistNames,
      providerTrackId: track.providerTrackId,
      providerReleaseId: track.providerReleaseId,
      providerArtistIds: track.providerArtistIds,
      artworkUrl: track.artworkUrl,
      previewUrl: track.previewUrl,
      externalUrl: track.externalUrl,
      raw: {
        track,
        provider,
        fetchedAt: new Date().toISOString(),
        durationMs: track.durationMs,
        explicit: track.explicit,
        popularity: track.popularity,
      },
    };
    rows.push(row);
  }

  return rows;
}

export function getMockProviderError(sourceUrl: string, provider: "spotify" | "apple_music"): string | null {
  // Simulate occasional failures for testing partial failure handling
  const hash = hashString(sourceUrl);
  if (hash % 7 === 0) {
    return `${provider === "spotify" ? "Spotify" : "Apple Music"} API rate limit exceeded for ${sourceUrl}`;
  }
  if (hash % 11 === 0) {
    return `${provider === "spotify" ? "Spotify" : "Apple Music"} playlist not found or not publicly accessible: ${sourceUrl}`;
  }
  return null;
}