/**
 * Normalization module smoke test (bible §3 verification).
 * Run: npx tsx --eval "import './src/services/chartsScoring/normalize.test.ts'"
 *
 * These tests verify that the normalize functions produce the expected
 * byte-for-byte output for canonical examples. All must pass before
 * the normalization module is considered contract-compliant.
 */

import {
  normalize_title,
  normalize_artist,
  lead_artist_key,
  build_normalized_key,
} from "./normalize";

let passed = 0;
let failed = 0;

function assert(description: string, actual: string, expected: string): void {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${description}`);
    console.error(`  expected: "${expected}"`);
    console.error(`  actual:   "${actual}"`);
  }
}

// ─── normalize_title ───
assert("basic title", normalize_title("Buga (Lo Lo Lo)"), "buga lo lo lo");
assert("feat removal in title", normalize_title("ON FIRE (feat. Mr Eazi)"), "on fire");
assert("ft removal in title", normalize_title("Woman ft. Harmonize"), "woman");
assert("featuring in title", normalize_title("Melody featuring Diamond"), "melody");
assert("remix stripping", normalize_title("Sip (Alcohol) - Remix"), "sip alcohol");
assert("radio edit", normalize_title("7 Days (Radio Edit)"), "7 days");
assert("acoustic version", normalize_title("Love Nwantiti [Acoustic]"), "love nwantiti");
assert("bonus track strip", normalize_title("Essence [Bonus Track]"), "essence");
assert("punctuation strip", normalize_title("ON FIRE!!!"), "on fire");
assert("multiple spaces", normalize_title("  Buga   (Lo Lo Lo)  "), "buga lo lo lo");
assert("ampersand removal", normalize_title("Love & Heartbreak"), "love heartbreak");
assert("x collab removal", normalize_title("Party x Fun"), "party fun");
assert("with removal", normalize_title("Dance with Me"), "dance me");

// ─── normalize_artist ───
assert("basic artist feat", normalize_artist("Diamond Platnumz feat. Rayvanny"), "diamond platnumz");
assert("ft artist", normalize_artist("Sauti Sol ft. Nyashinski"), "sauti sol");
assert("featuring artist", normalize_artist("Rema featuring Selena Gomez"), "rema selena gomez");
assert("mixed case artist", normalize_artist("BURNA BOY"), "burna boy");
assert("comma separated", normalize_artist("WizKid, Tems & Justin Bieber"), "wizkid tems justin bieber");
assert("ampersand separated", normalize_artist("Sauti Sol & Nyashinski"), "sauti sol nyashinski");
assert("x separated", normalize_artist("Navy Kenzo x Vanessa Mdee"), "navy kenzo vanessa mdee");

// ─── lead_artist_key ───
assert("lead feat", lead_artist_key("Diamond Platnumz feat. Rayvanny"), "diamond platnumz");
assert("lead ft", lead_artist_key("Rema ft. Selena Gomez"), "rema");
assert("lead featuring", lead_artist_key("Kizz Daniel featuring Tekno"), "kizz daniel");
assert("lead commas", lead_artist_key("WizKid, Tems & Justin Bieber"), "wizkid");
assert("lead ampersand", lead_artist_key("Sauti Sol & Nyashinski"), "sauti sol");
assert("lead x", lead_artist_key("Navy Kenzo x Vanessa Mdee"), "navy kenzo");
assert("lead single", lead_artist_key("BURNA BOY"), "burna boy");
assert("lead empty", lead_artist_key(""), "");
assert("lead whitespace", lead_artist_key("   "), "");

// ─── build_normalized_key ───
assert("composite key", build_normalized_key("Buga (Lo Lo Lo)", "Kizz Daniel feat. Tekno"), "buga lo lo lo::kizz daniel");
assert("composite key 2", build_normalized_key("Essence [Bonus Track]", "WizKid ft. Tems"), "essence::wizkid");
assert("composite key 3", build_normalized_key("Love Nwantiti", "CKay"), "love nwantiti::ckay");
assert("composite empty title", build_normalized_key("", "Artist"), "");
assert("composite empty artist", build_normalized_key("Title", ""), "");

// ─── Summary ───
console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests.`);

if (failed > 0) {
  console.error("Normalization module FAILED smoke test.");
  throw new Error(`Normalization smoke test: ${failed} assertions failed.`);
} else {
  console.log("Normalization module smoke test PASSED.");
}