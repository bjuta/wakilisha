# Cultural Commerce Existing Primitive Audit

**Status:** Architecture input
**Date:** 4 September 2026
**Current numbered programme:** Phase 8A, Safe mobile intake
**Purpose:** Identify what Cultural Commerce can reuse, what may deserve promotion into shared authority, what must remain domain-specific, and what is genuinely missing.

## Decision

Cultural Commerce must extend the existing WAKILISHA platform rather than create a parallel platform.

Classify existing capability into four groups:

1. reuse unchanged;
2. promote only when repeated behaviour earns a shared primitive;
3. keep domain-specific;
4. build because the authority is genuinely missing.

This audit does not start Commerce implementation.

## Reuse Unchanged

### Global Resource Identity

Stable Resource identity already gives shared systems a durable target.

Commerce, Events, Venues, and future cultural objects should register with existing Resource identity where they need shared review, provenance, corrections, search, aliases, or other cross-domain capability.

Do not create a Commerce-owned universal identity layer.

### Commands, Idempotency, Jobs, and Outbox

The platform kernel already owns command receipts, idempotency, expected-version concurrency, transactional commands, audit context, outbox delivery, jobs, retries, leases, and dead-letter handling.

Money-moving commands, payment webhooks, ticket issuance, fulfillment, and settlement must reuse these operating laws.

### Trust, Sources, Citations, Corrections, and Provenance

WAKILISHA already has shared trust authority.

Future Events, Venues, Products, Artist assertions, historical commerce records, and cultural relationships should reuse these systems where factual or editorial evidence is required.

Do not create a second generic evidence table for Commerce or Artist Studio.

### Media Authority

Media already distinguishes logical assets, immutable files, variants, usage, rights, consent, sensitivity, embargo, and preservation state.

Phase 4B already established durable upload sessions, resumable transfer, retry, recovery, processing, and checksum authority.

Consequences:

- Phase 8A must not rebuild resumable file transfer.
- Product images must use Media.
- Event images must use Media.
- generated commerce artefacts must not become preservation masters unless a real cultural use requires it.

### Registry and MIZIZI

Registry remains canonical cultural identity authority.

MIZIZI remains a steward and reconciliation layer for cultural identity and consistency.

Commerce must not redefine Artist, Release, Track, Person, or Organisation identity.

A Storefront may be associated with an Artist. It must not become the Artist's canonical identity.

### Representation and Permissions

Existing Artist representation and team authority should be reused as the starting point for Artist-operated Commerce.

Commerce will require new capabilities, but not a second representation system.

Future capabilities may include catalogue, Orders, finance, Events, and ticket check-in.

Finance permissions must remain narrower than general Artist management.

### Community, Follows, Saves, Posts, and Notifications

Existing participation surfaces can become adopters of Events and Commerce.

Examples include following an Artist, saving an Event, sharing a Product, embedding an Event or Product in a Post, and notifying followers of eligible launches.

Do not rebuild separate social identity for Shop or Events.

### Public API, Search, SEO, and Route Infrastructure

WAKILISHA already has substantial public delivery infrastructure.

Phase 9 remains necessary because these systems are not yet fully converged or incremental at scale.

Commerce should wait for the Phase 9 public route law rather than create a second routing strategy.

## Promote Only When Earned

### Route-Backed Public Sections

Important public profile sections need stable URLs.

Artist Shop and Artist Events should reuse one route-backed section pattern rather than component-local tab state.

Promote this in Phase 9B after existing Artist and user routes are audited.

### Sharing

One share action should eventually support Artists, Events, Products, Releases, Posts, and other public objects.

Do not create Event-specific and Shop-specific share systems unless a channel truly requires domain-specific behaviour.

### Saving and Cultural Collection State

Saved, followed, ticketed, attended, purchased, and owned are different states.

A shared user-cultural-state primitive may emerge, but these meanings must not be collapsed prematurely.

### Money

Money will repeat across Offers, Orders, Payments, Refunds, Commissions, Settlements, and Payouts.

Establish one Money law before production Commerce using integer minor units plus currency authority.

### Commercial Permissions

Commerce capabilities should extend existing representation and platform permissions.

The exact shared capability set should be earned through WAKILISHA Store and the first Artist Storefront.

## Keep Domain-Specific

Shared infrastructure must not erase domain meaning.

Keep separate:

- Artist;
- Person;
- Organisation;
- Event;
- Event Occurrence;
- Venue;
- Product;
- Product Variant;
- Ticket Type;
- Issued Ticket;
- Order;
- Payment;
- Storefront;
- Merchant.

An Event is not a Product.

A Ticket Type is not a Product Variant.

An Artist is not a Merchant.

A Merchant is not a Storefront.

A Payment Method is not a Payment Connector.

## Genuinely Missing Authority

### Commerce

- Merchant;
- Storefront;
- Product;
- Product Variant;
- Offer;
- inventory and reservation;
- Cart;
- Checkout;
- Merchant Order;
- Order Line;
- Fulfillment;
- Refund;
- Commission.

### Payments and Finance

- Payment Method;
- Payment Rail;
- Payment Connector;
- Merchant Connector Account;
- Payment Route;
- Payment Intent;
- Payment Attempt;
- provider event inbox;
- Settlement;
- Payout;
- Merchant payable;
- double-entry financial Ledger;
- payment reconciliation.

### Events and Venues

- canonical Event;
- structured Event Occurrence;
- canonical Venue;
- Event participant roles;
- Event status and archival lifecycle;
- native ticket inventory;
- ticket issuance;
- admission and check-in.

### Cultural Collection

- private-by-default purchase memory;
- attendance state;
- ownership or collection state;
- explicit public projection controls.

## Phase 8 Consequence

Phase 8A should build only Field Capture authority that is genuinely missing.

Field-specific authority owns capture purpose, submission identity, contributor disclosure or anonymity policy, rights and consent declarations, sensitivity, embargo, protected location handling, submission receipt, and local weak-network durability.

The bytes use existing Media upload and immutable file authority.

Phase 8B triages a Field Submission that already points to governed Media.

Promotion creates or attaches to ordinary canonical targets such as Article, Audio, Video, Source, or reviewed Registry evidence.

Field Capture must not create a second Media, evidence, review, or publication authority.

## Phase 9 Consequence

Phase 9 should converge existing public delivery rather than rebuild it.

Required outcomes remain bounded domain contracts, deterministic cursor pagination, maintained search documents, cache validation and invalidation, canonical public route law, and sharded incremental SEO.

## Phase 10 Consequence

Phase 10 becomes Cultural Graph, Trust, and Evidence Convergence.

It reconciles proven relationship semantics across Registry, MIZIZI, People, Organisations, Artist claims, Artist representation, Trust, Field Capture, and other real systems.

Do not create a universal subject-predicate-object store.

Typed domain authority remains primary.

## Freeze Consequence

The old Phase 11 production freeze is too early.

Merchant, Storefront, Event, Venue, Order, Payment, Ledger, Ticket, settlement, and cultural collection authority would otherwise arrive after platform foundations were already declared frozen.

The production freeze therefore moves after Cultural Commerce has been proven under real use and recovery.

## Audit Outcome

Cultural Commerce is not an Artist Studio feature.

It is a site-wide capability that compounds Registry identity, Resource identity, Media, Trust, representation, public routing, search and SEO, commands and jobs, Community, and analytics.

The first Commerce implementation starts only after Phase 8, Phase 9, and Phase 10 are accepted.
