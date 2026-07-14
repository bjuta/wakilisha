# Phase 0B Engineering Control Plane

Phase 0B establishes enforceable controls around the existing estate before platform-kernel work begins.

## Controls

- `supabase/migrations` is the sole migration authority.
- Legacy migration trees are archived outside the executable path.
- Live public-schema types are committed and verified against production.
- Critical RLS and lifecycle tests run in GitHub Actions.
- The legacy Institute is absent from normal navigation and frozen against new work.
- Client requests receive local correlation IDs and structured failure events.
- Deployment, rollback, and incident procedures are recorded in one production runbook.

## Required checks

The GitHub Actions workflow named `Critical Control Plane` runs:

- control-plane verification
- frozen-Institute enforcement
- live anonymous RLS tests
- critical lifecycle tests
- live schema drift verification
- application build

The status check must be required on `main` before Phase 0B is closed.

## Exit gates

- A migration cannot silently diverge from production.
- A critical RLS or lifecycle regression blocks merge.
- The legacy Institute can no longer attract new work.
