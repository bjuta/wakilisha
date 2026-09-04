# WAKILISHA Cultural Operating Layer Doctrine

**Status:** Strategic product and engineering authority
**Scope:** Registry, Artist Studio, People, Events, Venues, Commerce, Payments, Community, and future enterprise products
**Purpose:** Preserve the principles that should guide WAKILISHA as the product expands.

---

## 1. What We Are Building

WAKILISHA should not become a collection of unrelated features.

The long-term product should behave as one cultural operating layer where identity, knowledge, community, commerce, and history reinforce the same underlying record.

The visible products may include:

- Artist and Person profiles
- Registry and MIZIZI
- Artist Studio
- Music and credits
- Events and Venues
- Shops and merchandise
- Tickets
- Posts, follows, saves, and collections
- Payments, commissions, and settlements
- Editorial and research surfaces
- Future enterprise data products

These should not become independent product silos.

They should be different ways of reading from, acting on, and enriching the same governed cultural system.

---

## 2. The Moat

WAKILISHA's moat is not that it has Artist profiles, stores, tickets, payments, social features, or a music database.

Other companies can build those features.

The moat should be that WAKILISHA increasingly knows:

- who and what each cultural entity is;
- when two records refer to the same entity;
- how Artists, People, Organisations, Releases, Tracks, Events, Venues, Products, and Users relate;
- when those relationships were true;
- where each important fact came from;
- how confident we are in it;
- who had authority to assert or change it;
- what happened next.

The system should become more valuable because every meaningful interaction can improve the same cultural record.

---

## 3. One Governed Cultural Substrate

New features should first ask whether they belong on shared authority.

Shared primitives should emerge around recurring concepts such as:

- identity;
- provenance;
- evidence;
- permissions;
- representation;
- media;
- sharing;
- saving;
- money;
- offers;
- orders;
- payments;
- financial ledger;
- commissions;
- fulfillment;
- analytics;
- audit history.

Domain entities should remain distinct where their meaning differs.

An Event is not a Product.

A Ticket Type is not a T-shirt variant.

An Artist is not a Merchant.

A Storefront is not a Merchant account.

A Payment Method is not a Payment Processor.

Reuse behavior without erasing domain meaning.

---

## 4. No Feature Without a Value Loop

WAKILISHA should not ask people to enter information merely because the database can store it.

Every requested input should have a clear purpose.

It should do at least one of the following:

- improve identity accuracy;
- resolve uncertainty;
- strengthen a graph relationship;
- improve a public cultural record;
- improve a private operational workflow;
- enable discovery;
- enable commerce;
- enable attribution;
- improve rights, credit, or provenance;
- produce something useful for the Artist or user;
- create future enterprise value.

If we cannot explain what WAKILISHA will do with a field, we should not collect it.

---

## 5. Artist Participation Must Be Valuable

Artist onboarding is not the product.

Claiming an Artist is only the authority gate.

Once authority is established, Artist Studio should become the place where Artists and their teams can:

- understand what WAKILISHA currently knows;
- see what is uncertain or incomplete;
- confirm or dispute identity;
- reconcile music and credits;
- manage public presentation;
- manage authorised team access;
- contribute evidence;
- operate Events and Storefronts;
- understand audience and commercial activity;
- improve the historical record of their career.

The product should increasingly ask:

> What uncertainty can this Artist help resolve, and what useful capability can we return to them?

rather than:

> What additional fields can we collect?

---

## 6. Assertions Are Not Automatically Truth

First-party Artist information is highly valuable, but it should not bypass Registry authority.

A useful mental model is:

```text
Assertion
  -> Evidence
  -> Review / Reconciliation
  -> Canonical Fact
```

The system should preserve who asserted something, what supported it, when it was reviewed, and what became canonical.

This allows WAKILISHA to answer not only:

> What do we believe?

but also:

> Why do we believe it?

That provenance is part of the moat.

---

## 7. Actions Should Improve the System

WAKILISHA should be designed around a recurring loop:

```text
Observe
  -> Resolve
  -> Decide
  -> Act
  -> Write Back
  -> Observe Again
```

Examples include:

- an Artist correcting a credit;
- a reviewer resolving identity;
- an Event linking Artists to a Venue;
- a ticket sale confirming cultural activity;
- a user saving an Event;
- a Merchant fulfilling an Order;
- a completed Event becoming historical record;
- an archived Product remaining connected to an Artist era.

Operational actions should create useful new state instead of disappearing after the workflow completes.

---

## 8. Commerce Is Site-Wide Infrastructure

Commerce should not be implemented as a special Artist feature.

It should be a site-wide capability whose primitives can power:

- WAKILISHA's own Store;
- Artist Storefronts;
- Event ticketing;
- Event merchandise;
- Release merchandise;
- future Organisation or label Storefronts;
- future cultural products and experiences.

Artist Studio should be one management surface for this infrastructure.

Artist detail pages, Event pages, Release pages, Posts, and global Shop surfaces should be projections of the same commerce authority.

---

## 9. Commerce Expires, Culture Does Not

A commercial state can end without deleting the cultural object.

A Product can become sold out or archived.

An Event can become completed.

A ticketing window can close.

A Storefront Offer can expire.

The cultural record should remain where appropriate.

A completed Event can become more historically useful after it happens.

A sold-out piece of merchandise can still represent an Artist, Release, Event, tour, designer, era, or collaboration.

WAKILISHA should preserve cultural history instead of turning expired commerce into dead links.

---

## 10. Important Public Sections Need Real URLs

Anything important enough to share should have a canonical public route.

Public profile tabs should not rely only on local UI state.

Examples:

```text
/artists/:slug/music
/artists/:slug/events
/artists/:slug/shop
/artists/:slug/about
/artists/:slug/community

/u/:username/collection

/events/:slug
/venues/:slug
/shop
```

The tab can still look and behave like a tab.

The route is the authority.

This improves sharing, SEO, browser history, analytics, campaign links, social previews, and long-term stability.

---

## 11. Events Are Cultural Entities Before They Are Tickets

An Event should exist independently of whether WAKILISHA sells the ticket.

Events may be:

- free;
- externally ticketed;
- natively ticketed;
- historical;
- recurring;
- cancelled;
- completed.

The Event record should be able to connect:

- Artists;
- People;
- Venues;
- Organisations;
- promoters;
- dates and occurrences;
- media;
- Posts;
- Articles;
- Products;
- tickets;
- attendance.

Ticketing is a capability attached to an Event, not the definition of an Event.

---

## 12. Venues Are Part of the Cultural Graph

Venues should be first-class cultural entities.

Over time, a Venue record can accumulate:

- location and identity;
- current and historical names;
- Events;
- Artists who performed there;
- promoters;
- Articles and Posts;
- photos;
- scene and genre associations;
- historically meaningful activity.

This allows WAKILISHA to preserve where culture happened, not only who created it.

---

## 13. Users Should Accumulate Cultural History

Users already follow, save, and participate in WAKILISHA.

Commerce and Events can deepen that into a private-by-default cultural collection.

Potentially meaningful states include:

- followed;
- saved;
- purchased;
- ticketed;
- attended;
- owned;
- collected.

Commercial history should never become automatically public.

Users should explicitly choose what becomes part of their public cultural identity.

---

## 14. Payments Must Be a Fabric, Not a Gateway Integration

Commerce should never depend directly on one processor.

WAKILISHA should own its payment language and state model.

The system should distinguish:

- Payment Method;
- Payment Rail;
- Payment Processor or Connector;
- Merchant Connector Account;
- Payment Intent;
- Payment Attempt;
- Refund;
- Settlement;
- Commission;
- Payout;
- Ledger Entry;
- Reconciliation Event.

This should allow the same commerce system to support:

- M-PESA;
- Airtel Money;
- Visa;
- Mastercard;
- Paystack;
- direct mobile-money integrations;
- cash on delivery;
- bank transfer;
- future processors;
- future WAKILISHA financial infrastructure.

Provider integrations should be replaceable adapters, not commerce authority.

---

## 15. Financial Truth Must Stay Inside WAKILISHA

Even when third parties move the money, WAKILISHA should remain authoritative for:

- Orders;
- Merchant identity;
- Payment Intent identity;
- payment state;
- commission rules;
- merchant payable balances;
- refunds;
- settlements;
- reconciliation;
- financial audit history.

Financial records should be append-oriented and auditable.

Do not infer what WAKILISHA owes a Merchant by summing mutable Order rows later.

The ledger should know.

---

## 16. Merchant, Storefront, and Cultural Identity Are Different Things

Do not model an Artist as a bank account.

Keep separate:

```text
Cultural Identity
  -> Artist / Organisation / WAKILISHA

Merchant
  -> legal or commercial operator

Storefront
  -> public selling surface
```

A manager may operate an Artist Storefront.

A label may operate several Storefronts.

A promoter may sell tickets for an Event featuring many Artists.

WAKILISHA may operate its own Storefront.

This distinction should exist before production money flows.

---

## 17. Shared Primitives Should Be Earned

Do not build giant abstractions because several future features might need them.

Build real vertical slices.

When the same behavior has appeared repeatedly and its shared authority is clear, promote it into a primitive.

Good primitives should remove duplication without hiding important differences.

Prefer small reusable capabilities over universal components with dozens of modes.

---

## 18. Real Use Should Shape the Platform

The platform should grow through increasingly difficult real use.

A useful operating loop is:

```text
Deploy
  -> Learn
  -> Productize
  -> Deploy Harder
```

Examples:

- WAKILISHA becomes Merchant #1;
- WAKILISHA sells a real Product;
- WAKILISHA handles a real refund;
- one Artist activates a Storefront;
- one real Event uses the Event authority;
- one Event uses native ticketing;
- real payment failures harden reconciliation;
- real Artist corrections harden knowledge workflows.

Every hard deployment should leave behind reusable infrastructure.

Avoid building a huge speculative platform whose abstractions have never been tested by reality.

---

## 19. Dogfood Before Entrusting Artists

WAKILISHA should use its own commerce and operational infrastructure first wherever practical.

Before asking Artists to trust the system with their income, WAKILISHA should prove that it can:

- create and publish Products;
- price them correctly;
- take payment;
- handle failures;
- manage inventory;
- fulfill Orders;
- refund;
- reconcile;
- calculate commissions;
- settle correctly;
- preserve audit history;
- archive cultural objects properly.

We should discover operational problems with our own money first.

---

## 20. Business Model and Product Should Reinforce Each Other

Commissions are strategically attractive because WAKILISHA earns more when Artists succeed.

A strong loop can emerge:

```text
better identity
  -> better discovery
  -> stronger public Artist record
  -> more trust
  -> better Event and Storefront conversion
  -> more cultural and commercial activity
  -> more structured graph data
  -> better discovery and insight
```

The commercial model should help fund the cultural-data moat.

The cultural-data moat should improve commercial performance.

---

## 21. Public, Private, and Enterprise Value Must Be Deliberate

Not every fact belongs everywhere.

For each important datum, decide whether it is:

- public;
- private to the user;
- private to the Artist/team;
- private to reviewers;
- financial;
- enterprise-safe in aggregated form;
- evidence-only;
- never appropriate for public projection.

A contract may support a representation claim without ever becoming public.

A purchase may improve private recommendations without becoming visible on a user profile.

A verified relationship may become public while its underlying evidence remains private.

Visibility should be governed explicitly.

---

## 22. The Knowledge Graph Is Historical

Relationships should increasingly support time.

Not merely:

```text
Artist -> signed to -> Label
```

but conceptually:

```text
Artist
  -> signed to
  -> Label
  -> from date
  -> to date
  -> provenance
  -> review state
```

Careers, teams, labels, venues, scenes, and organisations change.

A graph without time eventually becomes confidently wrong.

---

## 23. Editorial Voice and Canonical Facts Are Different

WAKILISHA should preserve a meaningful editorial layer without confusing it with factual authority.

Examples:

- Event date and Venue are factual assertions;
- seller Event copy is promotional/operator content;
- a WAKILISHA curator note is editorial interpretation.

The system should know which is which.

This protects both data accuracy and editorial identity.

---

## 24. Build for Internal Ownership Without Reinventing Mature Infrastructure

WAKILISHA should prefer architecture that allows important infrastructure to be:

- self-hosted;
- forked;
- replaced;
- adapted;
- audited;
- integrated behind WAKILISHA-owned contracts.

Permissively licensed open-source infrastructure is valuable when it strengthens internal ownership.

But external components must sit behind WAKILISHA authority boundaries.

Do not let an external commerce engine, payment switch, or analytics system define our domain.

Use infrastructure.

Own the model.

---

## 25. The Standard for New Product Work

Before approving a major new surface, ask:

1. What cultural or commercial entity does this represent?
2. Which existing authority should it reuse?
3. What genuinely new authority is required?
4. What new relationship does it add to the graph?
5. What provenance must be preserved?
6. Who is allowed to act on it?
7. Which parts are public and private?
8. Does it need a canonical shareable route?
9. What action writes useful state back into the system?
10. What value does the participant receive immediately?
11. What can we learn from the first real deployment?
12. Which primitive, if any, has now been earned?
13. Does this improve the cultural record after the transaction or workflow ends?
14. Can the implementation be replaced without breaking WAKILISHA authority?

If those questions do not have clear answers, the feature is not ready.

---

## 26. North Star

WAKILISHA should help Artists, cultural participants, and audiences create, operate, discover, support, and preserve an accurate record of African culture.

The product should increasingly make this true:

> Every meaningful action strengthens the cultural record.

Artist corrections improve knowledge.

Events create history.

Venues preserve place.

Commerce creates economic activity and cultural artifacts.

Payments preserve financial truth.

Users build cultural memory.

Editorial work adds context.

The Registry preserves canonical identity.

MIZIZI resolves ambiguity.

Artist Studio lets trusted participants operate on that reality.

The public product makes the resulting record useful.

Future enterprise products can derive value from the same governed system.

That is the house we are building.
