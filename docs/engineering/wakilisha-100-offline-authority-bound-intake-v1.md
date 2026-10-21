# WK100 authority-bound private file intake: first executable boundary

**Status:** source-only, offline verifier; not deployed, not source admission, not an Admin UI or live provider collector. This extends [PR #1272](https://github.com/bjuta/wakilisha/pull/1272) without changing the prior nonpublishing preview. [Issue #1264](https://github.com/bjuta/wakilisha/issues/1264) remains open.

`scripts/charts/wk100-offline-intake-authority.mjs` accepts:
- A privately stored byte-exact approved authority manifest in the exact `wk100-offline-authority-v1` schema.
- Its SHA-256 digest supplied by a **different, trusted control plane** (not copied from, or generated alongside, the submitted provider file).
- A privately delivered provider observation file in the exact `wk100-delivered-ordinal-v1` schema.
- An explicit clock supplied by the caller.

The module fails closed on an absent or mismatched trusted authority digest, expired/future authority, wrong market/operator/source/behavior, malformed native period, duplicate recording, noncontiguous ranks, injected fields, or oversized files. It computes the exact observation bytes' SHA-256 and returns a candidate in the shape required by the existing offline preview, with explicit `provider_origin:false`, `legal_grant:false`, `registry_identity:false` markers in `independently_verified`. The returned `admission:'approved'` is only a **syntactic bridge to the previous prototype**, NOT real legal admission. Do not treat it as a substitute for checking contracts or for the current WK100 source manifest authorization.

**Confidentiality:** Source names, operator IDs, reviewer identities, exact weights, complete observations, and raw delivered files must never enter this public GitHub repository. Real authority digests must be pinned independently by an authorized trusted backend or offline operator. A caller who generates an authority manifest and its supposed trusted digest together can forge this proof; the library does not prove independence of the caller, provider origin, contract scope, real MIZIZI presence, geographic representativeness or source-native period truth. Do not claim that a raw file is from a provider merely because a JSON field says so.

**Boundary:** No network requests, database writes, auth session, cron, changes to SQL, Storage, source admission or public edition publication. No new runtime secret or authority has been installed. Negative synthetic tests run inside the protected Critical Control Plane with:

```bash
node --test test/charts/wk100-offline-intake-authority.test.mjs
```

**Next implementation:** server-held independently sealed permission records, byte provenance / provider delivery validation, MIZIZI identity verification, and an authenticated confidential Admin Charts surface. Admin roles must be checked server-side using the existing role-capability authority. A successful UI gate without backend auth is not acceptable. This step is deliberately not wired to an upload endpoint, since no safe private long-lived legal authority exists yet.
