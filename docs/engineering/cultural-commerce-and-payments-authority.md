# Cultural Commerce and Payments Authority

**Status:** Architectural authority for future implementation
**Date:** 4 September 2026
**Implementation state:** Not started
**Current numbered programme:** Phase 8A, Safe mobile intake

## Purpose

This document defines the boundaries future Commerce and Payments work must preserve.

It does not select a production processor, payment provider, payment switch, Merchant of Record model, or regulatory operating model.

Those choices require real commercial, legal, security, and operational evidence.

## Core Law

WAKILISHA owns the commercial and financial meaning.

External processors and open-source infrastructure may execute parts of the system, but they remain replaceable behind WAKILISHA-owned contracts.

Application code must not make one provider the definition of payment.

Commerce requests payment through WAKILISHA payment authority.

Routing chooses the eligible Connector.

## Separate Concepts

### Payment Method

What the customer chooses, such as M-PESA, Airtel Money, Visa, Mastercard, cash on delivery, bank transfer, or a future wallet.

### Payment Rail

The movement category, such as mobile money, card network, bank, cash, or a future WAKILISHA rail.

### Payment Connector

The external or internal implementation WAKILISHA talks to.

A Connector may be a direct mobile-money API, Paystack, another PSP, a self-hosted switch, or a future WAKILISHA implementation.

### Merchant Connector Account

The commercial credentials and settlement relationship used for one Merchant on one Connector.

A Connector may serve many Merchant Connector Accounts.

### Merchant

The legal or commercial operator responsible for a sale.

### Storefront

The public selling surface.

### Cultural Subject

The Artist, Event, Release, Organisation, WAKILISHA identity, or other cultural object the commercial item relates to.

These concepts must not be collapsed.

## Commerce Boundary

Future Commerce authority should support:

```text
Cart
  -> Checkout
      -> Merchant Order
          -> Order Line
              -> Offer
                  -> domain sellable
```

A single Cart may eventually contain more than one Merchant.

Early product slices may restrict Checkout to one Merchant if that reduces operational risk.

The authority must not permanently assume every Cart or Checkout has one seller.

## Offer Is the Commercial Primitive

Product and Ticket identity remain domain-specific.

Commercial behaviour can converge through Offer.

An Offer may express Merchant, sellable reference, currency, price, availability window, purchase limits, commission policy, settlement policy, and inventory or capacity dependency.

Examples:

```text
Product Variant
  -> Offer

Ticket Type
  -> Offer
```

Do not store a Ticket Type as a Product because both can be purchased.

## Money Authority

Never use floating-point values for financial truth.

Money uses integer minor units, explicit currency, and currency metadata for display and exponent rules.

The same Money law applies to Offers, Orders, Payments, Refunds, Commissions, Settlements, Payouts, and Ledger postings.

## Payment State Is Asynchronous by Default

A successful HTTP response is not sufficient evidence that money moved.

The internal model must support:

```text
Payment Intent
  -> Payment Attempt
      -> requires_action
      -> processing
      -> succeeded
      -> failed
      -> expired
      -> cancelled
```

The state machine must be suitable for mobile money, cards with authentication, bank transfer, cash on delivery, and future rails.

An Order becomes financially paid only through authoritative payment state.

## Capability-Based Connectors

Connectors declare capabilities rather than pretending every rail behaves the same way.

Potential capabilities include authorize, capture, cancel, refund, partial refund, push authorization, redirect, tokenize, recurring payment, payout, transfer, split settlement, webhook, query status, and reconciliation.

Routing considers Merchant, market, currency, Payment Method, capability, policy, and availability.

Do not automatically retry an ambiguous payment through a second Connector.

An unknown outcome enters reconciliation.

## Provider Event Inbox

External callbacks first enter a durable provider-event inbox.

Preserve, at minimum:

- Connector;
- Merchant Connector Account;
- provider event identifier;
- provider transaction reference;
- receipt timestamp;
- signature verification result;
- payload hash or protected payload reference;
- processing status;
- processed timestamp;
- correlation identifier.

Processing is idempotent.

Duplicate callbacks must not duplicate payment state, fulfillment, ticket issuance, Commission, or Ledger postings.

## Idempotency Law

Any command that can move money or create an entitlement must be safely repeatable.

This includes Checkout creation, Payment Intent creation, Payment Attempt start, provider event processing, Refund, ticket issuance, fulfillment, and payout.

Reuse the existing platform command and audit model where appropriate.

## Cash on Delivery

Cash on delivery is a payment Connector with its own capability profile.

It is not a Checkout exception.

A possible lifecycle is:

```text
pending_collection
  -> collected
  -> failed
  -> cancelled
```

Collection confirmation creates authoritative financial state and Ledger postings.

Manual corrections remain auditable.

## Financial Ledger

WAKILISHA should establish double-entry financial authority before significant production Commerce.

The Ledger is append-oriented.

Do not edit historical postings to make balances look correct.

Corrections use reversing or adjusting transactions.

The Ledger must eventually explain what the customer paid, what a processor settled, what WAKILISHA earned, what WAKILISHA owes a Merchant, what was refunded, what was paid out, and what remains unreconciled.

Payment success, processor settlement, Merchant payable creation, and Merchant payout are different facts.

## Commission

Commission policy is data, not hardcoded product logic.

The system should support different commercial arrangements by Merchant, sale type, campaign, market, or future negotiated agreement.

Commission posts through financial authority.

Do not recalculate historical Commission from the current commercial rate.

## Settlement and Payout

Settlement and Payout are separate from Payment.

Represent processor settlement, clearing differences, Merchant payable, payout instruction, payout attempt, payout completion, payout failure, and payout reconciliation.

## Merchant of Record Boundary

WAKILISHA must not accidentally become a Merchant of Record or regulated payment provider merely because the schema can represent money.

Before production selling, explicitly decide who contracts with the buyer, who is Merchant of Record, who receives funds first, who bears refund and dispute responsibility, who performs required Merchant onboarding, what provider and regulatory obligations apply, and how tax responsibility is allocated.

The architecture may support change.

The operating model must be deliberate.

## Card Security Boundary

Raw card number and CVV data should not enter ordinary WAKILISHA application servers in the initial architecture.

Use appropriate provider-hosted, tokenized, or otherwise compliant card-entry methods.

A WAKILISHA card vault requires a separate security and compliance programme.

## Open-Source Infrastructure Boundary

WAKILISHA may integrate permissively licensed or otherwise acceptable open-source infrastructure where it increases internal ownership.

Possible categories include payment orchestration, connector frameworks, commerce modules, financial ledger infrastructure, banking infrastructure, and reconciliation tooling.

Evaluation asks:

1. Does it fit WAKILISHA domain boundaries?
2. Can we self-host or replace it?
3. Can we fork it if necessary?
4. Does its license fit commercial use?
5. Does it have a credible security and maintenance posture?
6. Does it reduce real work already proven by a vertical slice?
7. Can it remain behind WAKILISHA-owned contracts?

Do not install a large commerce or payment framework because future use is imaginable.

Adopt infrastructure only when a real implementation slice earns it.

## WAKILISHA-Owned Financial Truth

Even when a third party processes money, WAKILISHA remains authoritative for Order identity, Merchant identity, Offer identity, Payment Intent identity, internal payment state, provider event history, Commission, Refund, Merchant payable, Ledger, Settlement, Payout, reconciliation, and audit history.

A provider dashboard is evidence.

It is not WAKILISHA's only financial memory.

## Initial Real-Use Strategy

The first production Merchant should be WAKILISHA wherever practical.

The first real Commerce loop should prove:

1. publish a real Product;
2. expose a real Offer;
3. place a real Order;
4. take a real Payment;
5. handle a failure path;
6. fulfill;
7. refund;
8. reconcile;
9. prove Commission and Ledger state;
10. archive the cultural Product correctly.

Only after WAKILISHA proves its own operating loop should Artist income depend on the same rails.

## Deferred Decisions

This authority intentionally does not decide production payment provider, direct M-PESA versus aggregator routing, direct Airtel Money versus aggregator routing, card acquirer, payment-switch technology, marketplace split settlement, Merchant of Record structure, tax engine, wallet or stored-value capability, lending, or direct regulated financial infrastructure.

Those choices belong to the implementation milestone where real evidence exists.

## Implementation Gate

No Commerce payment schema or provider integration begins until:

- Phase 8 is closed;
- Phase 9 public route and delivery foundations are accepted;
- Phase 10 Trust and relationship convergence is accepted;
- the Commerce milestone names a real first Merchant and first transaction;
- the Merchant of Record and operational payment model are explicitly approved.
