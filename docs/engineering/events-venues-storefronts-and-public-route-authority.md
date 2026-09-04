# Events, Venues, Storefronts, and Public Route Authority

**Status:** Product and architecture authority for future implementation
**Date:** 4 September 2026
**Implementation state:** Not started
**Current numbered programme:** Phase 8A, Safe mobile intake

## Purpose

This document seals the site-wide public identity and product boundaries for future Events, Venues, Storefronts, Products, and tickets.

It borrows useful interaction lessons from the earlier TWIC Event implementation while rejecting its WordPress data shortcuts.

## Public Route Law

Anything important enough to share as a durable public identity must have a canonical route.

Important public profile sections must not depend only on component-local tab state.

A tab may remain the visual interaction.

The route is the public authority.

Examples for future implementation:

```text
/artists/:slug
/artists/:slug/music
/artists/:slug/events
/artists/:slug/shop
/artists/:slug/about
/artists/:slug/community

/u/:username
/u/:username/collection

/events
/events/:slug

/venues/:slug

/shop
```

Final route grammar is sealed during Phase 9B against existing aliases, redirects, SEO, and canonical public identity.

Do not use `?tab=shop` as the canonical public identity for an Artist Storefront section.

## Site-Wide Commerce

Commerce is a site-wide capability.

Artist Shop is one projection.

WAKILISHA Store is one projection.

Event commerce is one projection.

Release merchandise may become one projection.

Do not create separate Commerce databases or checkout engines for each surface.

## Merchant, Storefront, and Cultural Subject

Keep these concepts separate.

Merchant is the legal or commercial operator.

Storefront is the public selling surface.

Cultural Subject is the Artist, Event, Release, Organisation, WAKILISHA identity, or other cultural object related to what is sold.

Example:

```text
Artist
  -> associated with
Storefront
  -> operated by
Merchant
```

A manager or label may operate a Storefront without becoming the Artist.

A promoter may sell tickets to an Event featuring many Artists.

## Product and Cultural Artifact

A Product is the commercial domain object.

A Product may also have durable cultural relationships.

Examples include Product to Artist, Product to Release, Product to Event, Product to tour or era, and Product to credited designer or photographer.

Not every Product deserves permanent cultural prominence.

The model must allow historically meaningful Products to remain discoverable after sale.

## Commerce Expires. Culture Does Not.

Commercial availability may end.

The cultural object survives where historically meaningful.

A completed Event should remain part of cultural history.

A sold-out or retired Product may remain linked to the Artist, Event, Release, or collaboration that gave it meaning.

Do not turn expired Commerce into dead public URLs by default.

## Event Is a Cultural Entity Before Ticketing

An Event exists independently of native ticketing.

An Event may be free, externally ticketed, natively ticketed, recurring, cancelled, completed, or historical.

Ticketing is a capability attached to an Event.

It is not Event identity.

## Event Occurrence

Structured Event Occurrence represents each actual date and time.

Example:

```text
Event
  Nairobi Jazz Night

Occurrences
  7 October, 19:00
  14 October, 19:00
  21 October, 19:00
```

Friendly recurrence language may be derived from structured occurrences.

Ticket capacity, admission, cancellation, and rescheduling attach to the relevant occurrence when required.

Do not store authoritative recurring dates as display text.

## Venue

Venue is a first-class cultural entity.

A Venue can accumulate canonical identity, location, current and historical names, Events, Artists who performed there, promoters and Organisations, Media, Articles and Posts, and cultural scene relationships where evidence supports them.

Venue history becomes part of the cultural record.

## Event Participation

Event participation uses typed roles.

Potential roles include headline Artist, supporting Artist, host, DJ, speaker, promoter, organiser, Venue, and partner.

Do not represent meaningful Event relationships only as display strings.

## Ticket Type

Ticket Type is a domain object attached to an Event or Event Occurrence.

It may use shared Offer and payment authority.

It is not a Product Variant.

Native ticketing may later add capacity, purchase limits, issued ticket, transfer policy, cancellation, refund, admission state, and check-in.

## External Ticket Offers

WAKILISHA should represent an Event before it owns the transaction.

A future Event may expose a native WAKILISHA ticket Offer, a reviewed external official ticket URL, free attendance, or no current ticketing.

External ticket links must not prevent Event identity from becoming canonical cultural record.

## Prior TWIC UX Learnings to Preserve

Future WAKILISHA Event design should consider retaining these ideas in the current design language:

- strong Event hero;
- visible date, Venue, place, and price context;
- clear primary ticket action;
- compact Event Card;
- desktop sticky details;
- mobile sticky ticket, directions, and share actions;
- search plus horizontal filters;
- upcoming dates for recurring Events;
- descriptive "What to expect" context;
- WAKILISHA editorial or curator context distinct from factual Event authority;
- related Events and cultural work;
- separate Venue pages.

Reject these earlier shortcuts as permanent authority:

- free-text price as financial truth;
- arbitrary badge colour as taxonomy;
- newline recurrence text;
- duplicated Artist or Venue biography fields;
- Venue-name override as published canonical authority;
- Event identity defined by ticket URL;
- WordPress post-meta as relationship authority.

Borrow the good interaction.

Rebuild the authority.

## Editorial, Operator, and Canonical Fact Boundaries

An Event page may contain several information classes.

Canonical fact includes date, Venue, participant, and Event status.

Operator content includes arrival guidance, doors-open information, Event description, and seller instructions.

WAKILISHA editorial context includes curator notes, cultural significance, related history, and reporting.

Do not store all three as the same kind of truth.

## User Cultural State

Future user relationships should distinguish saved or interested, ticketed, attended, purchased, and owned or collected.

These are not synonyms.

Purchase and attendance history are private by default.

A user explicitly chooses what becomes public cultural identity.

## Artist Studio Relationship

Artist Studio is an operator surface, not Commerce authority.

Future Artist Studio may expose Products, inventory, Orders, Events, ticket sales, fulfillment, commercial insights, team permissions, and payout context.

The public Artist page projects eligible Storefront and Event information from site-wide authority.

## Implementation Order

The dependency order is:

1. Phase 8 Field Capture;
2. Phase 9 public route and delivery convergence;
3. Phase 10 Cultural Graph, Trust, and evidence convergence;
4. Phase 11 Commerce and WAKILISHA Store;
5. Phase 12 Events and native ticketing;
6. Phase 13 Artist Commerce;
7. Phase 14 User Cultural Collection;
8. Phase 15 scale, recovery, and freeze;
9. Phase 16 Inquiry Mode.

## Acceptance Law

A future Events, Venues, or Commerce milestone is not complete because a route loads, a Product table exists, a Checkout screen renders, a ticket button opens, or a Storefront looks polished.

Real acceptance proves the complete cultural or commercial outcome named by that milestone.
