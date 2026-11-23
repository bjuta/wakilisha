# Share-sheet Copy: verified clipboard action and persistent count

**Scope:** unified desktop popover and mobile bottom sheet, all public shareable objects.
**Status:** frontend-only repair candidate. Real iPhone copy and persisted-count acceptance remain open until after the canonical production release.

## Evidence (23 November 2026)

The owner reported that tapping **Copy** on the live Article share grid produced no visible result and did not increase its count. Read-only Production verification found **zero new Copy events in the preceding 24 hours**. Alusa Continua had no Copy counter row, while the corrected Instagram Story flow now had three genuine share-intent counter events and a durable count of three. The Copy button itself was wired to a handler on both hosts; the defect lies in the clipboard operation and absent feedback, not a missing grid destination.

Both handlers previously awaited `navigator.clipboard.writeText(trackedUrl)`, swallowed every failure, and failed to communicate clipboard status in the shared grid. Desktop set an unused `copied` state; mobile had no status at all. If the browser's Async Clipboard implementation was unavailable, blocked or stalled, the count request did not reliably execute. The old handler also counted a failed write if the promise rejected, because it swallowed the error and fell through.

## Repair contract

- Use **one shared Copy helper** across mobile/desktop; retain the existing canonical/UTM Article URL and existing `incrementShareCount` RPC. No new schema, platform identity, data migration or analytics pipeline.
- Attempt the synchronous textarea selection + `document.execCommand("copy")` while the click has transient user activation, to cover iOS wrappers where Async Clipboard is missing or suspended. Restore focus and remove the temporary textarea. When legacy copying is unavailable or rejected, attempt `navigator.clipboard.writeText` with a **3-second maximum wait**.
- A browser-reported successful clipboard write produces visible **Link copied** feedback, the existing Copy analytics event and one authoritative persistent counter call. The UI must never fabricate a count on RPC rejection; instead say **Link copied, but the share count could not be updated.**
- If the clipboard is blocked or times out, do **not** emit Copy analytics or increment the counter. Show a read-only, fully selectable tracked link with instructions to select and copy it manually. The site cannot verify a manual OS-level copy gesture.
- Show **Copying link…** while waiting; guard rapid double taps from duplicate counting. Reset transient copy feedback when the share host closes or its source URL changes. Preserve the grid and all other destinations, Story image generation, and cultural/visual copy guidelines.

## Acceptance

The protected interaction tests cover a successful iPhone-style synchronous copy and correct tracked URL, modern clipboard fallback, blocked clipboard, visible selectable manual link without a fake count, pending asynchronous clipboard, double-tap single count, RPC rejection after successful copy, desktop/mobile parity and current-server count after reopen. Protected Core/Browser CI and exact main source checks must pass before merge. Mocked clipboard tests and Chromium are **not** physical iOS clipboard acceptance.

After production deployment, verify on the physical iPhone that tapping Copy visibly confirms success, the copied text equals the intended Article URL with its expected source attribution, a single `copy` count persists after closing/reopening, and a corresponding `share_events` row is present in read-only Production SQL. If the browser refuses programmatic copy, the selectable fallback must be visible and no false count must appear. Do not modify Production data to simulate an acceptance event.

**Deployment:** frontend-only through the existing canonical v6 runner using independently checked *current* accepted Article SEO snapshot. Database migrations remain 275; no SQL promotion, Edge deployment, or unrelated Discography changes.
