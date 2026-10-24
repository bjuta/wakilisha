# Unified Public Navigation Across Viewports

**Authority:** Owner direction, 24 October 2026. Mobile's WAKILISHA top bar and left-side hamburger drawer are now the reference public navigation treatment for phone, tablet and desktop.

## Product contract

- Every public screen using the standard WAKILISHA app shell displays one transparent, fixed Menu button at the top left and Search at the top right. The bundled WAKILISHA vector icon family remains mandatory.
- The desktop 256px persistent sidebar and 80px tablet icon rail do not render. The page retains its full width until the user opens navigation.
- The existing `MobileAccountDrawer` is the **single** public navigation and private You surface. Menu opens a start-edge modal sheet; the close control, Escape, outside dismiss and navigation links close it. Guest and authenticated destinations continue through existing navigation/access contracts.
- Hero routes may draw behind the transparent top bar. Text-first routes reserve the standard 56px plus safe-area height once. `shouldReserveWakilishaHeaderSpace` is shared by both responsive app layouts.
- The compact player and full Now Playing presentation no longer apply left offsets for a nonexistent persistent rail. Open drawers must not unmount the route or reset playback.
- This slice changes navigation presentation, not Registry, auth, messages permissions, editorial storage, playback engines, or route identity.
- Admin Studio retains its own capability-gated staff navigation, which is not part of this **public** shell migration. Its drawer convergence requires separate privileged acceptance, not automatic reuse of a public menu.

## Acceptance

Use existing critical tests and actual public browser route captures at 390, 768 and 1440 pixels. Verify top-bar menu and search are reachable, drawer opens and closes, guests cannot enter private routes, theme controls still work, page has no horizontal overflow, and hero or text-first pages honor their header offset. Check compact and full player presentation with no rail offset. Both themes and actual signed-in routes remain required before Production visual sign-off.

**Deployment:** Frontend only. No SQL migration, Supabase Edge Function or Registry write. Merge requires exact-head protected Core, Browser and aggregate gates; Production activation remains a separate merged-main action.
