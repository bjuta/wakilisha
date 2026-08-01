# Research publishing and knowledge licensing future contract

## Status

Architectural direction recorded during Phase 3A.

This does not authorize marketplace, payment, licence, metering, wallet, or payout implementation during Phase 3A.

## Product direction

WAKILISHA may later allow researchers and knowledge workers to publish durable, human-made research and make exact immutable versions available for licensed use by humans, institutions, AI agents, retrieval systems, evaluation systems, and other authorised machine consumers.

The initial domain is culture, but the architecture must not remain culture-specific.

## Permanent separation of authority

### Trust

Sources, Citations, Credits, contributors, review, corrections, provenance, withdrawal, and supersession.

### Publication

Stable research identity and immutable published versions.

### Rights and access

What a person, organisation, application, or agent may do with a particular version.

### Commercial

Offers, prices, purchases, usage charges, revenue allocation, balances, and payouts.

Citation does not grant permission.

Credit does not determine payout.

Public-safe means suitable for public presentation. It does not mean free to download, reproduce, embed, train on, redistribute, or commercialise.

## Permanent Phase 3A constraints

1. Sources, Citations, Credits, and contributor identities remain reusable across resource kinds.
2. Article-specific attachment commands are the first adoption path, not the final cross-resource API.
3. Citations identify provenance and use, not permission.
4. Credits identify contribution, not commercial allocation.
5. Citations should point to immutable versions and precise locators where supported.
6. Future licences must attach to stable resource and version identities without changing Citation or Credit records.
7. Trust records should support human-readable and machine-readable delivery.
8. Research works and datasets should eventually become first-class typed resources rather than oversized Articles.
9. Future machine use must be attributable to the exact authorised resource version.

## Future research domain

A future audited design may include typed equivalents of:

    research_works
    research_versions
    research_components
    research_publications
    research_supporting_materials
    research_datasets

It should support authors, contributors, methods, claims, findings, limitations, citations, evidence, datasets, appendices, review, corrections, withdrawals, superseding versions, and public or restricted components.

## Future rights vocabulary

Possible licence scopes include human reading, download, quotation, reproduction, translation, dataset access, API retrieval, embedding, retrieval-augmented generation, agent memory, evaluation, fine-tuning, foundation-model training, redistribution, and commercial output use.

This vocabulary is a future design input, not a Phase 3A schema instruction.

## Future commercial model

Commercial infrastructure must remain separate from trust infrastructure.

Possible future objects include:

    commercial_offers
    licences
    entitlements
    usage_receipts
    revenue_agreements
    revenue_allocations
    payout_accounts
    payout_ledger

No Phase 3A command should create balances, record payouts, calculate royalties, or imply licence permission.

## Immediate non-goals

Do not add checkout, subscriptions, wallets, payment-provider integration, payout accounts, royalty calculations, agent billing, model-training licences, dataset commerce, universal cross-resource attachment commands, or Research Editor screens to the current Article trust adoption package.

Phase 3A continues with Article trust adoption and safe public presentation.
