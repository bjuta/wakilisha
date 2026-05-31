import { getLabels, hasImportedRegistryData, toLabelCard } from '@/data/registry/registry';

const FALLBACK_LABELS = [
  { slug: "mavin-records", name: "Mavin Records", country: "Nigeria", artistCount: 12, releaseCount: 48, isFeatured: true, description: "Don Jazzy's powerhouse that redefined Nigerian pop. Home to Rema, Ayra Starr, and the Mavins All Stars collective.", year: "2012" },
  { slug: "ybnl-nation", name: "YBNL Nation", country: "Nigeria", artistCount: 8, releaseCount: 35, description: "Olamide's incubator for street pop and Afrobeats. The label that launched Fireboy DML and Asake.", year: "2012" },
  { slug: "empire-distribution", name: "EMPIRE Distribution", country: "USA / Pan-African", artistCount: 24, releaseCount: 112, isFeatured: true, description: "The San Francisco-based distributor that bridges African sound with global reach. The most connected label in the ecosystem.", year: "2010" },
  { slug: "wande-coal-music", name: "Wande Coal Music", country: "Nigeria", artistCount: 2, releaseCount: 6, description: "The boutique imprint behind one of Nigeria's most distinctive voices.", year: "2017" },
  { slug: "rca-records", name: "RCA Records", country: "USA", artistCount: 6, releaseCount: 22, description: "One of the world's oldest labels, now home to some of Afrobeats' biggest global exports.", year: "1909" },
  { slug: "atlantic-records", name: "Atlantic Records", country: "USA", artistCount: 5, releaseCount: 18, isFeatured: true, description: "The Atlantic powerhouse that took Burna Boy from Nigerian star to global phenomenon.", year: "1947" },
  { slug: "interscope", name: "Interscope Records", country: "USA", artistCount: 4, releaseCount: 14, description: "The California major that has long partnered with African talent for the international market.", year: "1990" },
  { slug: "chocolate-city", name: "Chocolate City Music", country: "Nigeria", artistCount: 9, releaseCount: 40, description: "One of Nigeria's pioneering independent labels, consistently shaping the sound of Abuja and Lagos.", year: "2005" },
  { slug: "spaceship-collective", name: "Spaceship Collective", country: "Nigeria", artistCount: 3, releaseCount: 12, description: "Burna Boy's own imprint. A tight-knit roster with outsized global influence.", year: "2018" },
  { slug: "orente-media", name: "Orente Media", country: "Nigeria", artistCount: 4, releaseCount: 15, description: "A Lagos-based independent with a sharp ear for the next wave of Afrobeats.", year: "2016" },
  { slug: "platoon", name: "Platoon", country: "UK / Pan-African", artistCount: 18, releaseCount: 64, description: "Apple Music's former artist services platform turned independent label with deep roots in African music.", year: "2016" },
  { slug: "def-jam-africa", name: "Def Jam Africa", country: "South Africa", artistCount: 14, releaseCount: 55, isFeatured: true, description: "The African arm of the iconic hip-hop label, building bridges between South African and West African talent.", year: "2020" },
];

export const LABELS = hasImportedRegistryData() ? getLabels().map(toLabelCard) : FALLBACK_LABELS;

export const FEATURED_LABELS = LABELS
  .filter((label) => label.isFeatured)
  .slice(0, 6)
  .map((label) => ({
    ...label,
    featuredArtists: 'featuredArtists' in label && Array.isArray(label.featuredArtists) ? label.featuredArtists : [],
    description: 'description' in label && typeof label.description === 'string' ? label.description : undefined,
    year: 'year' in label && typeof label.year === 'string' ? label.year : undefined,
  }));