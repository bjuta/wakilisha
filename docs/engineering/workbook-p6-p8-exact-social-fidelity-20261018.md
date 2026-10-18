# Workbook P6-P8 exact social surface replication

**Authority:** `docs/design-source/20261017/MIZIZI WAKILISHA Brand Workbook.dc.html`, P6 Following, P7 Messages and P8 Notifications. Owner's 18 Oct 2026 correction: *replicate, not translate*.  
**Baseline:** Production on 18 Oct 2026 was successfully activated at `493bf7ebdc50473c9fe8849ee335f1ac1a3507de` with rollback snapshot `/opt/wakilisha-react-backups/workbook-v4-pr1257-guest-navigation-20261018T200415Z-493bf7eb`.

## Design correspondence

| Workbook element | Exact structure in product |
|---|---|
| P6 1280px desktop frame | Reuse existing 232px global sidebar; main workspace uses a 600px centre timeline and remaining right discovery rail. |
| P6 56px Following/Artists only switch | Full-width two-column tab bar with a 3px active brand underline. Existing `feedFilter` supplies behaviour. |
| P6 composer | 44px actual avatar, question prompt, four correctly shaped media icons, explicit Post action. On phone it becomes a floating brand button above the player and opens the accepted full post composer. |
| P6 feed posts | 44px avatar column with 12px gutter, author, handle/date, caption, proper native image/cover ratios, and quiet icon actions below. No fabricated post count. |
| P6 Out this week | A compact bordered discovery card populated **only** with real recent Release records returned by the current Following feed; no mocked release names, art or times. |
| P6 right people card | The same card and avatar grammar bound to contributors actually present in the viewer's feed. Unlike the workbook's fictional 'Who to follow' examples, this is truthfully labelled 'Your circle'. |
| P7 split | Global shell reused, 34% conversation list beside full-height thread. New-message pencil in 56px list header, search pill, visible selected row and actual unread-count badge. Existing Inbox/Requests/Spam/Archive access retained. |
| P7 conversation | Real participant portrait/name, menu for existing approval control, incoming muted bubbles, outgoing brand bubbles, read receipt, bottom composer. Existing resource cards, safety approval and attachment authority preserved. |
| P7 mobile | List/thread switch uses existing selected-conversation logic. In a thread, hide only the global dock chrome, preserve playback, and give composer bottom priority. |
| P8 1280px desktop frame | Global shell reused; 600px activity list plus right preference rail. 56px header, pill filters, New/Earlier divisions. |
| P8 activity row | Kind-specific semantic event glyph comes first, then the actor portrait if available, actor text, event copy, timestamp. No screenshot's fictional likes/follows. |
| P8 Tell me about | Bordered inset settings card with existing real scoped notification RPCs; labels correspond to the actual distinct saved preferences. No invented live-party or likes preference. |

### Theme and fidelity rules

- Light: `#FCFCFB` canvas, warm-white/white surfaces, `#4E7425` action accent. Dark: `#0B0B0B` canvas, charcoal surfaces, `#85C441` accent. Exact workbook parity relies on the active token contract.
- The structural CSS is scoped under `data-wk-workbook-screen`, imports after the earlier approximate styles and affects no Artist or editorial page.
- Real author identity, content, inbox, notifications, public permissions, messaging moderation, Preferences RPCs and playback remain canonical. No mock activity, no extra write path, no migration, no Edge Function.
- Workbook screenshot-only features without supporting backend authority (fictional recommendation people, faux release drops, fabricated notification buttons, fictional voice notes) are **not** silently introduced.

### CI, acceptance and release gates

- Protected Core/Browser/Aggregate must pass at exact PR head. Source checks enforce 600px panes, 44px avatar grammar, specific filter hierarchy, actor/event icon ordering and mobile dock coordination.
- Inspect at 390px / 768px / 1280px/1440px in **both light and dark**. Include a populated Following feed, a selected Message thread and actual Notifications, not just empty or logged-out shells. Check scroll, keyboard navigation, message requests, read receipts, unread counts, media player integrity and preference persistence.
- This branch is frontend/code/docs/tests only. No SQL, Edge, Registry data or Artist changes. Do not merge or deploy until the protected run passes; screenshots from unauthenticated CI cannot by themselves establish authenticated visual parity.
- Production activation uses the existing worktree-aware exact-merged-main Lightsail runner. No Git branch ownership changes, no previews in place of deployment, and no separate Finish Update.
