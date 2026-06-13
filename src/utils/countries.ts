/* ─────────────── Country normalization + flag images (full ISO 3166-1) ─────────────── */

const ISO2_TO_NAME: Record<string, string> = {
  // Africa
  ng: "Nigeria", ke: "Kenya", gh: "Ghana", za: "South Africa", ug: "Uganda",
  tz: "Tanzania", cm: "Cameroon", et: "Ethiopia", rw: "Rwanda", zm: "Zambia",
  zw: "Zimbabwe", sn: "Senegal", ml: "Mali", cd: "Congo (DRC)", cg: "Congo",
  ao: "Angola", bw: "Botswana", na: "Namibia", ma: "Morocco", dz: "Algeria",
  tn: "Tunisia", eg: "Egypt", sd: "Sudan", sl: "Sierra Leone", lr: "Liberia",
  bf: "Burkina Faso", ne: "Niger", td: "Chad", ga: "Gabon", gn: "Guinea",
  gw: "Guinea-Bissau", gm: "The Gambia", tg: "Togo", bj: "Benin", mz: "Mozambique",
  mw: "Malawi", mg: "Madagascar", mu: "Mauritius", sc: "Seychelles", dj: "Djibouti",
  so: "Somalia", er: "Eritrea", ss: "South Sudan", sz: "Eswatini", ls: "Lesotho",
  ci: "Côte d'Ivoire", cv: "Cape Verde", st: "São Tomé and Príncipe",
  gq: "Equatorial Guinea", bi: "Burundi", cf: "Central African Republic",
  km: "Comoros", mr: "Mauritania", ly: "Libya", eh: "Western Sahara",
  // Europe
  gb: "United Kingdom", fr: "France", de: "Germany", it: "Italy", es: "Spain",
  pt: "Portugal", nl: "Netherlands", be: "Belgium", ch: "Switzerland", at: "Austria",
  se: "Sweden", no: "Norway", dk: "Denmark", fi: "Finland", ie: "Ireland",
  pl: "Poland", cz: "Czech Republic", sk: "Slovakia", hu: "Hungary", ro: "Romania",
  bg: "Bulgaria", hr: "Croatia", si: "Slovenia", rs: "Serbia", ba: "Bosnia and Herzegovina",
  al: "Albania", mk: "North Macedonia", me: "Montenegro", xk: "Kosovo",
  ua: "Ukraine", by: "Belarus", md: "Moldova", lt: "Lithuania", lv: "Latvia",
  ee: "Estonia", is: "Iceland", mt: "Malta", lu: "Luxembourg", mc: "Monaco",
  li: "Liechtenstein", ad: "Andorra", sm: "San Marino", va: "Vatican City",
  gr: "Greece", cy: "Cyprus", tr: "Turkey",
  // Americas
  us: "United States", ca: "Canada", mx: "Mexico",
  br: "Brazil", ar: "Argentina", co: "Colombia", cl: "Chile", pe: "Peru",
  ve: "Venezuela", ec: "Ecuador", bo: "Bolivia", py: "Paraguay", uy: "Uruguay",
  gy: "Guyana", sr: "Suriname", gf: "French Guiana",
  cu: "Cuba", do: "Dominican Republic", ht: "Haiti", jm: "Jamaica",
  tt: "Trinidad and Tobago", bb: "Barbados", bs: "The Bahamas", bz: "Belize",
  gt: "Guatemala", hn: "Honduras", sv: "El Salvador", ni: "Nicaragua",
  cr: "Costa Rica", pa: "Panama", pr: "Puerto Rico",
  // Asia
  cn: "China", jp: "Japan", kr: "South Korea", kp: "North Korea",
  in: "India", pk: "Pakistan", bd: "Bangladesh", lk: "Sri Lanka", np: "Nepal",
  bt: "Bhutan", mv: "Maldives",
  id: "Indonesia", my: "Malaysia", ph: "Philippines", sg: "Singapore",
  th: "Thailand", vn: "Vietnam", mm: "Myanmar", kh: "Cambodia", la: "Laos",
  bn: "Brunei", tl: "Timor-Leste",
  mn: "Mongolia", kz: "Kazakhstan", uz: "Uzbekistan", tm: "Turkmenistan",
  kg: "Kyrgyzstan", tj: "Tajikistan",
  af: "Afghanistan", ir: "Iran", iq: "Iraq", sa: "Saudi Arabia",
  ye: "Yemen", om: "Oman", ae: "United Arab Emirates", qa: "Qatar",
  bh: "Bahrain", kw: "Kuwait", jo: "Jordan", lb: "Lebanon", sy: "Syria",
  ps: "Palestine", il: "Israel",
  am: "Armenia", az: "Azerbaijan", ge: "Georgia",
  // Oceania
  au: "Australia", nz: "New Zealand", pg: "Papua New Guinea",
  fj: "Fiji", sb: "Solomon Islands", vu: "Vanuatu", ws: "Samoa",
  to: "Tonga", ki: "Kiribati", fm: "Micronesia", mh: "Marshall Islands",
  pw: "Palau", nr: "Nauru", tv: "Tuvalu", ck: "Cook Islands",
};

const ISO3_TO_NAME: Record<string, string> = {};
// Build ISO3 mapping from ISO2 (same names, just keyed by ISO3)
const ISO2_TO_ISO3: Record<string, string> = {
  ng: "nga", ke: "ken", gh: "gha", za: "zaf", ug: "uga", tz: "tza", cm: "cmr",
  et: "eth", rw: "rwa", zm: "zmb", zw: "zwe", sn: "sen", ml: "mli", cd: "cod",
  cg: "cog", ao: "ago", bw: "bwa", na: "nam", ma: "mar", dz: "dza", tn: "tun",
  eg: "egy", sd: "sdn", sl: "sle", lr: "lbr", bf: "bfa", ne: "ner", td: "tcd",
  ga: "gab", gn: "gin", gw: "gnb", gm: "gmb", tg: "tgo", bj: "ben", mz: "moz",
  mw: "mwi", mg: "mdg", mu: "mus", sc: "syc", dj: "dji", so: "som", er: "eri",
  ss: "ssd", sz: "swz", ls: "lso", ci: "civ", cv: "cpv", st: "stp", gq: "gnq",
  bi: "bdi", cf: "caf", km: "com", mr: "mrt", ly: "lby", eh: "esh",
  gb: "gbr", fr: "fra", de: "deu", it: "ita", es: "esp", pt: "prt", nl: "nld",
  be: "bel", ch: "che", at: "aut", se: "swe", no: "nor", dk: "dnk", fi: "fin",
  ie: "irl", pl: "pol", cz: "cze", sk: "svk", hu: "hun", ro: "rou", bg: "bgr",
  hr: "hrv", si: "svn", rs: "srb", ba: "bih", al: "alb", mk: "mkd", me: "mne",
  ua: "ukr", by: "blr", md: "mda", lt: "ltu", lv: "lva", ee: "est", is: "isl",
  mt: "mlt", lu: "lux", mc: "mco", li: "lie", ad: "and", sm: "smr", va: "vat",
  gr: "grc", cy: "cyp", tr: "tur",
  us: "usa", ca: "can", mx: "mex", br: "bra", ar: "arg", co: "col", cl: "chl",
  pe: "per", ve: "ven", ec: "ecu", bo: "bol", py: "pry", uy: "ury", gy: "guy",
  sr: "sur", cu: "cub", do: "dom", ht: "hti", jm: "jam", tt: "tto", bb: "brb",
  bs: "bhs", bz: "blz", gt: "gtm", hn: "hnd", sv: "slv", ni: "nic", cr: "cri",
  pa: "pan", pr: "pri",
  cn: "chn", jp: "jpn", kr: "kor", kp: "prk", in: "ind", pk: "pak", bd: "bgd",
  lk: "lka", np: "npl", bt: "btn", mv: "mdv", id: "idn", my: "mys", ph: "phl",
  sg: "sgp", th: "tha", vn: "vnm", mm: "mmr", kh: "khm", la: "lao", bn: "brn",
  tl: "tls", mn: "mng", kz: "kaz", uz: "uzb", tm: "tkm", kg: "kgz", tj: "tjk",
  af: "afg", ir: "irn", iq: "irq", sa: "sau", ye: "yem", om: "omn", ae: "are",
  qa: "qat", bh: "bhr", kw: "kwt", jo: "jor", lb: "lbn", sy: "syr", ps: "pse",
  il: "isr", am: "arm", az: "aze", ge: "geo",
  au: "aus", nz: "nzl", pg: "png", fj: "fji", sb: "slb", vu: "vut", ws: "wsm",
  to: "ton", ki: "kir", fm: "fsm", mh: "mhl", pw: "plw", nr: "nru", tv: "tuv",
};
for (const [iso2, iso3] of Object.entries(ISO2_TO_ISO3)) {
  const name = ISO2_TO_NAME[iso2];
  if (name) ISO3_TO_NAME[iso3] = name;
}

const NAME_TO_ISO2: Record<string, string> = {};
for (const [iso2, name] of Object.entries(ISO2_TO_NAME)) {
  NAME_TO_ISO2[name] = iso2;
}

export const COUNTRY_ACCENT: Record<string, string> = {
  Nigeria: "#1A8E4A", Ghana: "#CE1126", "South Africa": "#E03C31", Kenya: "#BB133E",
  Uganda: "#D4A017", Tanzania: "#1EB53A", Cameroon: "#CE1126", Ethiopia: "#078930",
  Rwanda: "#00A1DE", Zambia: "#EF7D00", Zimbabwe: "#D4A017", Senegal: "#00853F",
  Mali: "#F4B83B", "Congo (DRC)": "#009543", Congo: "#009543", Angola: "#CE1126",
  Botswana: "#75AADB", Namibia: "#003580", Morocco: "#C1272D", Algeria: "#006233",
  Tunisia: "#E70013", Egypt: "#CE1126", Sudan: "#D21034", "Sierra Leone": "#1EB53A",
  Liberia: "#BF0A30", "Burkina Faso": "#EF2B2D", Niger: "#E05206", Chad: "#002664",
  Gabon: "#009E60", Guinea: "#CE1126", "Guinea-Bissau": "#CE1126", "The Gambia": "#CE1126",
  Togo: "#006A4E", Benin: "#008751", Mozambique: "#007A5E", Malawi: "#CE1126",
  Madagascar: "#007E39", Mauritius: "#1A2B6D", Seychelles: "#003D88", Djibouti: "#6AB2E7",
  Somalia: "#4189DD", Eritrea: "#EA0437", "South Sudan": "#078930", Eswatini: "#3E5EB9",
  Lesotho: "#00209F", "Côte d'Ivoire": "#F77F00", "Cape Verde": "#003893",
  "São Tomé and Príncipe": "#12AD2B", "Equatorial Guinea": "#3E9BCD", Burundi: "#CE1126",
  "Central African Republic": "#003082", Comoros: "#3A75C4", Mauritania: "#006233",
  Libya: "#E70013", "Western Sahara": "#C1272D",
};

const NAME_TO_ACCENT: Record<string, string> = { ...COUNTRY_ACCENT };

export function normalizeCountry(input: string | null | undefined): string {
  if (!input) return "Unknown";
  const trimmed = input.trim();
  if (!trimmed) return "Unknown";

  const lower = trimmed.toLowerCase();

  if (ISO2_TO_NAME[lower]) return ISO2_TO_NAME[lower];
  if (ISO3_TO_NAME[lower]) return ISO3_TO_NAME[lower];

  if (NAME_TO_ISO2[trimmed]) return trimmed;

  // Case-insensitive name lookup
  const lowerName = trimmed.toLowerCase();
  for (const [name] of Object.entries(NAME_TO_ISO2)) {
    if (name.toLowerCase() === lowerName) return name;
  }

  for (const [iso2, name] of Object.entries(ISO2_TO_NAME)) {
    if (trimmed === iso2.toUpperCase()) return name;
  }
  for (const [iso3, name] of Object.entries(ISO3_TO_NAME)) {
    if (trimmed === iso3.toUpperCase()) return name;
  }

  return trimmed;
}

export function getCountryIso2(input: string | null | undefined): string | null {
  if (!input) return null;
  const canonical = normalizeCountry(input);
  if (canonical === "Unknown") return null;
  return NAME_TO_ISO2[canonical] || null;
}

export function getCountryFlagUrl(
  input: string | null | undefined,
  _width?: number,
): string | null {
  const iso2 = getCountryIso2(input);
  if (!iso2) return null;
  return `https://flagcdn.com/${iso2}.svg`;
}

export function getCountryAccent(input: string | null | undefined): string {
  if (!input) return "#D4A017";
  const canonical = normalizeCountry(input);
  return NAME_TO_ACCENT[canonical] || "#D4A017";
}

export function getCountryLabel(input: string | null | undefined): string {
  if (!input) return "Unknown origin";
  const canonical = normalizeCountry(input);
  if (canonical === "Unknown") return input.trim() || "Unknown origin";
  return canonical;
}

/** Convert an ISO2 code to a URL-safe country slug (e.g. "ZA" → "south-africa") */
export function iso2ToCountrySlug(iso2: string): string {
  const lower = iso2.toLowerCase();
  const name = ISO2_TO_NAME[lower];
  if (!name) return lower;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Given a country slug, find the ISO2 code (e.g. "south-africa" → "ZA"), or null */
export function countrySlugToIso2(slug: string): string | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase().replace(/-/g, " ");
  for (const [iso2, name] of Object.entries(ISO2_TO_NAME)) {
    if (name.toLowerCase() === normalized) return iso2.toUpperCase();
  }
  return null;
}

/** Return all ISO2 codes sorted by their display names */
export function getSortedCountryCodes(): string[] {
  return Object.keys(ISO2_TO_NAME).sort((a, b) =>
    ISO2_TO_NAME[a].localeCompare(ISO2_TO_NAME[b])
  ).map((code) => code.toUpperCase());
}

/** Look up the display name for a given ISO2 code */
export function getCountryNameForIso2(iso2: string): string {
  return ISO2_TO_NAME[iso2.toLowerCase()] ?? iso2.toUpperCase();
}