/* ─────────────── African country normalization + flag images ─────────────── */

const ISO2_TO_NAME: Record<string, string> = {
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
};

const ISO3_TO_NAME: Record<string, string> = {
  nga: "Nigeria", ken: "Kenya", gha: "Ghana", zaf: "South Africa", uga: "Uganda",
  tza: "Tanzania", cmr: "Cameroon", eth: "Ethiopia", rwa: "Rwanda", zmb: "Zambia",
  zwe: "Zimbabwe", sen: "Senegal", mli: "Mali", cod: "Congo (DRC)", cog: "Congo",
  ago: "Angola", bwa: "Botswana", nam: "Namibia", mar: "Morocco", dza: "Algeria",
  tun: "Tunisia", egy: "Egypt", sdn: "Sudan", sle: "Sierra Leone", lbr: "Liberia",
  bfa: "Burkina Faso", ner: "Niger", tcd: "Chad", gab: "Gabon", gin: "Guinea",
  gnb: "Guinea-Bissau", gmb: "The Gambia", tgo: "Togo", ben: "Benin", moz: "Mozambique",
  mwi: "Malawi", mdg: "Madagascar", mus: "Mauritius", syc: "Seychelles", dji: "Djibouti",
  som: "Somalia", eri: "Eritrea", ssd: "South Sudan", swz: "Eswatini", lso: "Lesotho",
  civ: "Côte d'Ivoire", cpv: "Cape Verde", stp: "São Tomé and Príncipe",
  gnq: "Equatorial Guinea", bdi: "Burundi", caf: "Central African Republic",
  com: "Comoros", mrt: "Mauritania", lby: "Libya", esh: "Western Sahara",
};

const NAME_TO_ISO2: Record<string, string> = {
  Nigeria: "ng", Kenya: "ke", Ghana: "gh", "South Africa": "za", Uganda: "ug",
  Tanzania: "tz", Cameroon: "cm", Ethiopia: "et", Rwanda: "rw", Zambia: "zm",
  Zimbabwe: "zw", Senegal: "sn", Mali: "ml", "Congo (DRC)": "cd", Congo: "cg",
  Angola: "ao", Botswana: "bw", Namibia: "na", Morocco: "ma", Algeria: "dz",
  Tunisia: "tn", Egypt: "eg", Sudan: "sd", "Sierra Leone": "sl", Liberia: "lr",
  "Burkina Faso": "bf", Niger: "ne", Chad: "td", Gabon: "ga", Guinea: "gn",
  "Guinea-Bissau": "gw", "The Gambia": "gm", Togo: "tg", Benin: "bj", Mozambique: "mz",
  Malawi: "mw", Madagascar: "mg", Mauritius: "mu", Seychelles: "sc", Djibouti: "dj",
  Somalia: "so", Eritrea: "er", "South Sudan": "ss", Eswatini: "sz", Lesotho: "ls",
  "Côte d'Ivoire": "ci", "Cape Verde": "cv", "São Tomé and Príncipe": "st",
  "Equatorial Guinea": "gq", Burundi: "bi", "Central African Republic": "cf",
  Comoros: "km", Mauritania: "mr", Libya: "ly", "Western Sahara": "eh",
};

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

  // Case-insensitive name lookup — handles "kenya" → "Kenya" etc.
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