import { createHash } from "node:crypto";

import {
  createRegistryPool,
  parseJsonObject,
} from "../../phase1-db";

type Mode = "audit" | "apply";

type Options = {
  mode: Mode;
  artistId: string;
  idempotencyKey: string;
};

type ArtistRow = {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  origin_iso2: string | null;
  origin_confidence: string | number | null;
  metadata: unknown;
};

const ACTOR_KEY = "mizizi";
const POLICY_RULESET =
  "registry-artist-origin-admission-v1";
const APPLY_CONFIRMATION =
  "MIZIZI_ARTIST_ORIGIN_APPLY";

const ISO2_TO_NAME: Record<string, string> = {
  ng: "Nigeria",
  ke: "Kenya",
  gh: "Ghana",
  za: "South Africa",
  ug: "Uganda",
  tz: "Tanzania",
  cm: "Cameroon",
  et: "Ethiopia",
  rw: "Rwanda",
  zm: "Zambia",
  zw: "Zimbabwe",
  sn: "Senegal",
  ml: "Mali",
  cd: "Congo (DRC)",
  cg: "Congo",
  ao: "Angola",
  bw: "Botswana",
  na: "Namibia",
  ma: "Morocco",
  dz: "Algeria",
  tn: "Tunisia",
  eg: "Egypt",
  sd: "Sudan",
  sl: "Sierra Leone",
  lr: "Liberia",
  bf: "Burkina Faso",
  ne: "Niger",
  td: "Chad",
  ga: "Gabon",
  gn: "Guinea",
  gw: "Guinea-Bissau",
  gm: "The Gambia",
  tg: "Togo",
  bj: "Benin",
  mz: "Mozambique",
  mw: "Malawi",
  mg: "Madagascar",
  mu: "Mauritius",
  sc: "Seychelles",
  dj: "Djibouti",
  so: "Somalia",
  er: "Eritrea",
  ss: "South Sudan",
  sz: "Eswatini",
  ls: "Lesotho",
  ci: "Côte d'Ivoire",
  cv: "Cape Verde",
  st: "São Tomé and Príncipe",
  gq: "Equatorial Guinea",
  bi: "Burundi",
  cf: "Central African Republic",
  km: "Comoros",
  mr: "Mauritania",
  ly: "Libya",
  gb: "United Kingdom",
  fr: "France",
  de: "Germany",
  it: "Italy",
  es: "Spain",
  pt: "Portugal",
  nl: "Netherlands",
  be: "Belgium",
  ch: "Switzerland",
  se: "Sweden",
  no: "Norway",
  dk: "Denmark",
  fi: "Finland",
  ie: "Ireland",
  pl: "Poland",
  cz: "Czech Republic",
  sk: "Slovakia",
  hu: "Hungary",
  ro: "Romania",
  bg: "Bulgaria",
  hr: "Croatia",
  si: "Slovenia",
  rs: "Serbia",
  al: "Albania",
  ua: "Ukraine",
  lt: "Lithuania",
  lv: "Latvia",
  ee: "Estonia",
  gr: "Greece",
  cy: "Cyprus",
  tr: "Turkey",
  us: "United States",
  ca: "Canada",
  mx: "Mexico",
  br: "Brazil",
  ar: "Argentina",
  co: "Colombia",
  cl: "Chile",
  pe: "Peru",
  ve: "Venezuela",
  ec: "Ecuador",
  do: "Dominican Republic",
  jm: "Jamaica",
  tt: "Trinidad and Tobago",
  bb: "Barbados",
  ht: "Haiti",
  cu: "Cuba",
  pr: "Puerto Rico",
  pa: "Panama",
  cr: "Costa Rica",
  gt: "Guatemala",
  cn: "China",
  jp: "Japan",
  kr: "South Korea",
  in: "India",
  pk: "Pakistan",
  bd: "Bangladesh",
  lk: "Sri Lanka",
  np: "Nepal",
  id: "Indonesia",
  my: "Malaysia",
  ph: "Philippines",
  sg: "Singapore",
  th: "Thailand",
  vn: "Vietnam",
  mm: "Myanmar",
  sa: "Saudi Arabia",
  ae: "United Arab Emirates",
  qa: "Qatar",
  kw: "Kuwait",
  jo: "Jordan",
  lb: "Lebanon",
  il: "Israel",
  ir: "Iran",
  iq: "Iraq",
  au: "Australia",
  nz: "New Zealand",
};

const NAME_TO_ISO2 = new Map<string, string>();

for (const [iso2, countryName] of Object.entries(
  ISO2_TO_NAME,
)) {
  NAME_TO_ISO2.set(
    countryName.toLowerCase(),
    iso2.toUpperCase(),
  );
}

for (const [alias, iso2] of Object.entries({
  usa: "US",
  "united states of america": "US",
  uk: "GB",
  uae: "AE",
  drc: "CD",
  "congo-kinshasa": "CD",
  "congo-brazzaville": "CG",
  "ivory coast": "CI",
  swaziland: "SZ",
  czechia: "CZ",
  gambia: "GM",
})) {
  NAME_TO_ISO2.set(alias, iso2);
}

function argValue(
  name: string,
  fallback = "",
): string {
  const prefix = `--${name}=`;
  const found = process.argv.find(
    (argument) =>
      argument.startsWith(prefix),
  );

  return found
    ? found.slice(prefix.length)
    : fallback;
}

function parseOptions(): Options {
  const mode =
    argValue("mode", "audit") as Mode;
  const artistId =
    argValue("artist-id").trim();
  const idempotencyKey =
    argValue(
      "idempotency-key",
      `artist-origin-${artistId}`,
    ).trim();

  if (!["audit", "apply"].includes(mode)) {
    throw new Error(
      "Unsupported --mode. Use audit or apply.",
    );
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(artistId)
  ) {
    throw new Error(
      "--artist-id must be a UUID.",
    );
  }

  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/
      .test(idempotencyKey)
  ) {
    throw new Error(
      "--idempotency-key must satisfy the exact-grant contract.",
    );
  }

  if (
    mode === "apply" &&
    argValue("confirm") !== APPLY_CONFIRMATION
  ) {
    throw new Error(
      `Apply mode requires --confirm=${APPLY_CONFIRMATION}.`,
    );
  }

  return {
    mode,
    artistId,
    idempotencyKey,
  };
}

function normalizeCountry(
  input: unknown,
): {
  iso2: string;
  countryName: string;
} | null {
  const raw = String(input ?? "").trim();

  if (!raw) {
    return null;
  }

  const lower = raw.toLowerCase();

  if (ISO2_TO_NAME[lower]) {
    return {
      iso2: lower.toUpperCase(),
      countryName: ISO2_TO_NAME[lower],
    };
  }

  const aliasIso2 =
    NAME_TO_ISO2.get(lower);

  if (!aliasIso2) {
    return null;
  }

  return {
    iso2: aliasIso2,
    countryName:
      ISO2_TO_NAME[
        aliasIso2.toLowerCase()
      ] ?? raw,
  };
}

function sourceFingerprint(
  artistId: string,
  rawCountry: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        artistId,
        path:
          "public.registry_artists.metadata.country",
        rawCountry,
      }),
    )
    .digest("hex");
}

async function loadArtist(
  pool: ReturnType<typeof createRegistryPool>,
  artistId: string,
): Promise<ArtistRow> {
  const result = await pool.query(
    `
    select
      id::text,
      slug,
      display_name,
      status,
      origin_iso2,
      origin_confidence,
      metadata
    from public.registry_artists
    where id = $1::uuid
    limit 1
    `,
    [artistId],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      "Artist not found.",
    );
  }

  return result.rows[0] as ArtistRow;
}

async function main(): Promise<void> {
  const options = parseOptions();
  const pool = createRegistryPool();

  try {
    const artist =
      await loadArtist(
        pool,
        options.artistId,
      );

    if (
      !["active", "draft"].includes(
        String(artist.status),
      )
    ) {
      throw new Error(
        "Artist Origin V1 only admits active or draft Artists.",
      );
    }

    if (
      String(
        artist.origin_iso2 ?? "",
      ).trim() ||
      artist.origin_confidence !== null
    ) {
      throw new Error(
        "Artist already has canonical origin state; V1 never overwrites it.",
      );
    }

    const metadata =
      parseJsonObject(artist.metadata);
    const rawCountry =
      String(
        metadata.country ?? "",
      ).trim();

    const normalized =
      normalizeCountry(rawCountry);

    if (!normalized) {
      throw new Error(
        "Artist metadata.country is missing or outside the deterministic V1 normalization vocabulary.",
      );
    }

    const confidence = 0.9;
    const observedAt =
      new Date().toISOString();
    const fingerprint =
      sourceFingerprint(
        artist.id,
        rawCountry,
      );
    const sourceRef =
      `registry_artist:${artist.id}:metadata.country`;

    const proposal = {
      actorKey: ACTOR_KEY,
      policyRuleset: POLICY_RULESET,
      artist: {
        id: artist.id,
        slug: artist.slug,
        displayName: artist.display_name,
        status: artist.status,
      },
      evidence: {
        sourceKind:
          "metadata_country_normalization",
        sourceRef,
        sourcePayloadFingerprint:
          fingerprint,
        observedAt,
        rawCountry,
        normalizedCountry:
          normalized.countryName,
      },
      proposedCanonicalState: {
        originIso2: normalized.iso2,
        originConfidence: confidence,
      },
      idempotencyKey:
        options.idempotencyKey,
    };

    if (options.mode === "audit") {
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: "audit",
            mutationAttempted: false,
            proposal,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    const evidenceResult =
      await pool.query(
        `
        select
          mizizi_private.record_artist_origin_evidence_v1(
            $1::text,
            $2::uuid,
            $3::text,
            $4::numeric,
            $5::text,
            $6::text,
            $7::text,
            $8::timestamptz
          )::text as evidence_assertion_id
        `,
        [
          ACTOR_KEY,
          artist.id,
          normalized.iso2,
          confidence,
          "metadata_country_normalization",
          sourceRef,
          fingerprint,
          observedAt,
        ],
      );

    const evidenceAssertionId =
      String(
        evidenceResult.rows[0]
          ?.evidence_assertion_id ?? "",
      );

    if (!evidenceAssertionId) {
      throw new Error(
        "Evidence assertion was not recorded.",
      );
    }

    const grantResult =
      await pool.query(
        `
        select *
        from mizizi_private
          .issue_artist_origin_execution_grant_v1(
            $1::text,
            $2::uuid,
            $3::text
          )
        `,
        [
          ACTOR_KEY,
          evidenceAssertionId,
          options.idempotencyKey,
        ],
      );

    if (grantResult.rowCount !== 1) {
      throw new Error(
        "Exact execution grant was not issued.",
      );
    }

    const executionGrantId =
      String(
        grantResult.rows[0]
          ?.execution_grant_id ?? "",
      );

    const executionResult =
      await pool.query(
        `
        select *
        from mizizi_private
          .execute_artist_origin_admission_v1(
            $1::text,
            $2::uuid
          )
        `,
        [
          ACTOR_KEY,
          executionGrantId,
        ],
      );

    if (executionResult.rowCount !== 1) {
      throw new Error(
        "Typed Artist-origin execution did not return one operation.",
      );
    }

    const operationId =
      String(
        executionResult.rows[0]
          ?.operation_id ?? "",
      );

    if (
      executionResult.rows[0]
        ?.operation_status !== "succeeded"
    ) {
      throw new Error(
        "Typed Artist-origin execution did not succeed.",
      );
    }

    // Deliberately separate query/transaction: canonical execution
    // does not self-certify.
    const verificationResult =
      await pool.query(
        `
        select *
        from mizizi_private
          .verify_artist_origin_admission_v1(
            $1::uuid
          )
        `,
        [operationId],
      );

    if (
      verificationResult.rowCount !== 1 ||
      verificationResult.rows[0]
        ?.verifier_status !== "passed"
    ) {
      throw new Error(
        "Independent Artist-origin verification did not pass.",
      );
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "apply",
          proposal,
          evidenceAssertionId,
          exactGrant: grantResult.rows[0],
          execution:
            executionResult.rows[0],
          verification:
            verificationResult.rows[0],
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exit(1);
});
