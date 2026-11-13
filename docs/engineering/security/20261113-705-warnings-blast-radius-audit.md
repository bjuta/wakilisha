# WAKILISHA: 705 security advisories, validity and product blast radius

**Audit:** 13 November 2026 | **Project:** pgzizndxdyhqmtyywjmt | **Method:** live read-only PostgreSQL catalog + selected full function bodies, Supabase Security Advisors, and connected GitHub application code.

**Full exact-signature inventory:** [618 distinct privileged function exposures](20261113-security-definer-exposure-inventory.csv). Every entry has caller roles, owner, PUBLIC grant inheritance, primary product area, static write/actor/delegation indicators, and a named review lane. Static classification is NOT a certification that the function is safe or unsafe. This audit **has made no Production mutations**.

## Verdict: 705 warnings, 623 distinct flagged objects

| Live warning type | Advisor entries | Actual object count and meaning |
| --- | ---: | --- |
| Authenticated executable SECURITY DEFINER functions | 618 | 618 callable privileged functions |
| Anonymous executable SECURITY DEFINER functions | 82 | The same 82 are included in the 618 |
| Mutable function search path | 1 | Service-role-only dynamic SQL executor: public.exec_sql(text) |
| Extensions installed in public | 4 | fuzzystrmatch, pg_net, pg_trgm, vector |
| **Total** | **705** | **623 distinct objects: 618 + 1 + 4** |

Of 755 total public-schema definer functions, 618 are executable by authenticated, 82 also by anon, and 137 neither. All 618 are owned by postgres, meaning their SQL runs with an owner that can bypass table RLS. 30 anonymous-executable functions inherit execution from PUBLIC; 52 have more specific grants. All 618 have an explicit function search path now. These facts establish the surface, **not** that all 618 can leak data or mutate privileged records.

## Confirmed work items: fix these before warning-count cosmetics

| Priority | Exact target | Verified source/code evidence | Actual possible blast radius | Preservation requirement |
| --- | --- | --- | --- | --- |
| P0 | Public Registry Releases SELECT policy | Public users can read releases is USING true; anon SELECT grant and RLS enabled. Two current release rows are draft, 847 active. | Draft Release rows and metadata visible via direct database read. This is independent of the 705 advisors. | Anon active-release reads, Admin draft review, publication withdrawal and Registry governance |
| P0 | get_releases_by_ids(uuid[]) + get_releases_by_ids_v2(uuid[]) | Both anonymously executable privileged lookup RPCs return status + metadata without publication status check or input-array cap. | Alternate unpublished metadata access by known IDs; misuse with large arrays. | Artist Admin DiscographyPanel and TopSongsPanel call v2 directly |
| P1 | get_tracks_by_ids(uuid[]) + get_release_tracks_by_ids(uuid[]) | Anon definer lookup by caller-controlled IDs, no Track status/array cap. There are 362 nonactive tracks: 6 draft, 48 archived, 308 needs_review. | Possible nonactive Track names/relationships if IDs are known, despite ordinary Track RLS. Currently no nonactive Track is linked to an active Release. | Registry admin editing and published music relationship reads |
| P1 | track_analytics_event(...) | Anonymous direct INSERT to analytics_events using supplied user_id, context, event and URL fields without actor-binding or input size budget. Physical table size ~181 MB. | Misattributed analytics, manipulated event metrics, arbitrary-write load and index/WAL amplification. | Legitimate guest metrics, signed-in identity integrity, privacy-safe provenance |
| P1 | increment_share_count(text,text,text,text) | Anonymous upsert to share_counts AND insert to share_events on every invocation, without SQL rate/input limits. Two-argument wrapper delegates to it. | Inflated popularity/share totals and extra writes. | Normal Share UX, daily trends, canonical URL aggregation |
| P1 | community_create_guest_follow_intent(uuid[]) | Anonymous writes an intent, deletes expired intents on each call, and expands unbounded raw array before checking 1–24 deduplicated artists. | Potential abuse through large payloads and high-frequency cleanup/write work. Current intent table is only ~48 KB with expiry index, so present loss is NOT demonstrated. | Guest-to-account Follow conversion and 1–24 artist contract |
| P1 | community_get_digest(integer), community_get_comment_replies(uuid,integer) | LIMIT follows jsonb_agg and therefore does not bound number of rows aggregated. Visibility filters are present. | Growing query cost, oversized public responses, unnecessary I/O. | Community feed/replies ordering, visibility and pagination |
| P1/P2 | community_get_user_stats(uuid) | Anonymous function counts any specified user's visible comments, saves and follows, without checking their privacy preference. | Disclosure of user activity COUNTS (not saved/followed objects). Whether counts are intended public data must be decided by product contract. | Valid visible-profile stats and privacy settings |

**Conclusion:** there are concrete, reviewable failures and weaknesses. The strongest demonstrated publication leak is the draft-release RLS policy, and the highest-confidence public write-integrity issue is the analytics/share RPC pair. The 705 Advisor count alone did NOT reveal these specific conditions. No exploit traffic was generated.

## Which remaining warnings are valid but do not justify immediate privilege revocation?

**Anonymous read-models with evidence of correct gating:**
- community_get_profile_by_username and community_get_profiles_batch require public profile visibility or ownership/admin before returning profile data.
- community_get_user_comments is anonymously CALLABLE but checks auth.uid() against the target user before reading private history. Thus its anonymous grant does not by itself imply anonymous data exposure.
- get_public_track_lyrics reads only current_published_version_id.
- get_public_playlist uses published version and approved/public-safe rights, credits, citations and correction state.
- resolve_media_asset_delivery checks Media lifecycle, safety, rights, consent, embargo and approved delivery rules, including restricted legacy compatibility. A static match on a write-like token is NOT evidence of actual writes.

**Signed-in privileged contract evidence:** 536 of the 618 functions are signed-in-only. Among 97 functions literally prefixed admin_, six short wrappers had no actor check locally. I traced them to private delegates. Their downstream gates check manage_registry/manage_people_identity, Registry Artist Intake administrators, provider-evidence admin/broker authority and current-admin requirements. This is **positive gate evidence**, not a complete vulnerability test for every argument or indirect call. Messaging and Legal bodies repeatedly use messaging.current_human_identity, messaging.require_messages_legal_capability and current_messages_super_admin, but every caller-scope and case-id branch still needs negative-actor tests.

## What is the product-wide blast radius if we blindly "clear" all 618 warnings?

| Product domain (one primary category per function) | All functions | Anonymous subset | Likely breakage if grants or definer privileges removed en masse |
| --- | ---: | ---: | --- |
| Registry and Identity | 136 | 37 | Artist claims, MIZIZI, Discography, Person and credits |
| Editorial and Publication | 116 | 14 | Magazine, published Audio/Video and playlists |
| Admin and Access | 99 | 0 | Administrator dashboards, governed role/capability commands |
| Community | 62 | 19 | Profiles, comments, follows, reports, notifications |
| Messaging, Trust and Legal | 55 | 0 | DMs, safety controls, legal preservation and disclosure |
| Charts and Evidence | 42 | 2 | Chart programme governance and scoring authority |
| Media and Rights | 41 | 4 | Rights, embargo, approved delivery and private Media |
| Analytics and Engagement | 4 | 3 | Event measurement and sharing |
| Other Product APIs | 63 | 3 | Cross-area support and helper commands |
| **Total** | **618** | **82** | **Platform-wide** |

Blanket SECURITY INVOKER conversion would force these deliberately privileged workflows through different RLS/grants. Blanket EXECUTE revocation would disable authorised frontends and machine workflows. Neither is an acceptable means of reducing warning counts.

## Remaining configuration warnings

**30 historic PUBLIC EXECUTE grants:** These are predominantly public-facing music and Community read models, with precise names in the CSV. The grant provenance is real, but not by itself a proof of unsafe output. Replace inherited PUBLIC execution with explicit intended grants only after mapping all legacy/internal role consumers. PostgreSQL's current default privileges are different for postgres versus supabase_admin, so future-function creation paths still deserve a separate default-ACL check.

**Four public-schema extensions:**
- fuzzystrmatch 1.2, pg_trgm 1.6, vector 0.8.0 are relocatable. Moving them without dependency and index/operator validation risks breaking search, similarity and data types.
- pg_net 0.20.3 is **not relocatable**. Its HTTP functions actually reside in net, not public. Anonymous/authenticated SQL roles have net schema USAGE and function EXECUTE. Whether net is in the live Data API exposed-schema list **was not verified**; therefore this is a potential SQL/SSRF-egress boundary, NOT proven unauthenticated external HTTP RPC access. Check API settings and webhook consumers before remediation.

**public.exec_sql(text):** postgres-owned privileged dynamic SQL runner, body essentially EXECUTE query. SQL grants are postgres + service_role only; anon and authenticated lack EXECUTE. A leaked service credential is already high privilege, and the function expands operational risk. No direct current application usage appeared in the GitHub search beyond historical ACL lockdown. Map all live callers, then retire if unnecessary; do not blindly pin a path that changes dynamic SQL name resolution.

## Correct remediation scope and acceptance: one governed batch, no 705 micro-PRs

1. **Publication boundary:** fix direct public Registry Releases RLS and anon by-ID functions together, with explicit admin-authorized draft access and bounded array sizes. Test anon draft denial, 847 active-release continuity, old/unapproved Track filtering, Admin Top Songs/Discography and MIZIZI role parity.
2. **Anonymous writes:** validate/attribute analytics identity server-side, cap event/context fields, protect share counters, enforce raw guest-intent array limits, and move expiry cleanup out of the anonymous hot path. Do not recreate per-request PostgreSQL limiter writes. Test guest analytics, share UX and Follow conversion on a disposable environment.
3. **Community bounds/privacy:** cap rows before aggregation, validate limits, preserve public visibility and add privacy-aware stats contracts. Include "many replies" and "private profile" negative cases.
4. **Sensitive signed-in operations:** validate anonymous, normal authenticated, unrelated user, wrong-capability user, authorised admin and service-role outcomes for Admin/Registry, Messaging/Legal and private Media commands. Test DM ownership, safety cases, attachments, role escalation, publication version and claim subject scope. Audit delegated gates, not just presence of auth.uid() text.
5. **Privilege/extension hygiene:** after parity, narrow the 30 inherited PUBLIC grants, inspect actual exposed schemas for net, and determine the exec_sql retirement plan. Do not drop/relocate extensions speculatively.

A meaningful closure metric is **zero unauthorized draft reads, zero spoofed actor attribution, bounded anonymous writes, bounded public aggregates, and negative-actor role tests that pass**, with intended product paths preserved. It is not "705 warnings gone."

## Audit limits, reproducibility, and references

This was a **catalog-level inventory of all 618 unique exposed functions plus selected full-body, delegated-gate, RLS and product-call-site inspection**. It is not 618 individually executed security proofs or a penetration test. The CSV's heuristic flags can miss delegated checks or label read-only code as writes. It intentionally labels static-only items as not yet security-verified. The absence of observed malicious use is NOT proof of safety.

Live authority: Supabase get_advisors; read-only pg_proc, aclexplode, pg_policies, pg_class, pg_default_acl, pg_extension, pg_depend, table/index metadata and approved role privileges. Repository evidence: src/services/analytics.ts, src/services/shareTracking.ts, src/services/community/service.ts, src/services/community/guestFollowIntent.ts, src/pages/admin/registry/artists/detail/components/TopSongsPanel.tsx and DiscographyPanel.tsx, and related MIZIZI/Media/Legal SQL gates. Docs: https://supabase.com/docs/guides/database/functions ; https://supabase.com/docs/guides/api/securing-your-api ; https://supabase.com/docs/guides/api/using-custom-schemas.

**Operational authority:** audit-only; no DDL, role revocation, compute change, Registry mutation, analytics purge, or modification of the owner's WK100 checkout. Existing consolidated remediation review PR #1373 is the repository path for this report.
