# WAKILISHA Auth Email Templates

Public auth emails should use the same serious WAKILISHA email language as the briefing system: clean, light-only, branded, responsive, and CTA-first.

Install path:

Supabase Dashboard → Authentication → Email Templates

Templates to update:
- Confirm signup
- Magic link
- Reset password
- Change email address

Important product rule:
Unverified users may log in and browse, but they cannot Save, Follow, Comment, Reply, Vote, React, Report, or Contribute until their email is verified.

## Confirm signup

Subject:
Confirm your WAKILISHA account

Title:
Confirm your email

Intro:
One last step. Confirm this email address to unlock saves, follows, comments, replies, and your personal WAKILISHA culture shelf.

CTA:
Confirm email

## Magic link

Subject:
Your WAKILISHA sign-in link

Title:
Your sign-in link is ready

Intro:
Use this secure one-time link to continue to WAKILISHA. The link is time-limited and should only be used by you.

CTA:
Sign in to WAKILISHA

## Reset password

Subject:
Reset your WAKILISHA password

Title:
Reset your password

Intro:
Use this secure link to choose a new password and get back to your WAKILISHA account.

CTA:
Reset password

## Change email address

Subject:
Confirm your new WAKILISHA email

Title:
Confirm your new email

Intro:
Confirm this address so your WAKILISHA account, alerts, saved culture shelf, and community identity stay connected to the right inbox.

CTA:
Confirm new email

## HTML shell note

Use the WAKILISHA transactional email shell from `supabase/functions/admin-user-ops/index.ts` as the base shell, replacing the title, intro, CTA label, footer note, and CTA URL with Supabase Auth's `{{ .ConfirmationURL }}` variable.

## Workbook 23 HTML adoption, 22 October 2026

These source-controlled templates reflect the light-only email design. Each is ready to paste into its **corresponding existing** Supabase Authentication email template; a Git merge does **not** publish them in Supabase.

| Supabase Auth template | Approved HTML source |
| --- | --- |
| Confirm signup | `docs/email/templates/confirm-signup.html` |
| Magic link | `docs/email/templates/magic-link.html` |
| Reset password | `docs/email/templates/reset-password.html` |
| Change email address | `docs/email/templates/change-email.html` |

Each keeps `{{ .ConfirmationURL }}` unchanged as the existing Supabase link authority. Do not infer or set a new token expiry, sign-in session policy, or email-identity enumeration from the mockup.

**Separate live senders:** `supabase/functions/admin-user-ops/index.ts` now owns the same 600px table-based light shell for operator invitations/reset messages. `supabase/functions/briefing-handler/index.ts` keeps its 13 existing catalogue modules, recipient/consent logic, and send transport, but adopts the 600px light shell. Both Edge Functions require a separate, explicitly approved deployment. The React/source profile mirrors use canonical `#85C441` for their brand green; other catalogue-specific accents retain their existing semantics.

**Not created:** the workbook's Welcome and Password changed triggers. They require proof of sending authority, idempotency, recipient security and real event metadata. We also do not claim that link TTLs, device/location fingerprints, forced sign-out across devices, or old-email notification exist without backend proof. No marketing enrolment is automatic.

**Cross-client acceptance:** test real output in Gmail, Outlook, and iOS Mail; check full-width mobile wrapping, hidden images, alt text, contrast, dark-mode inversion, primary CTA, link fallback and unsubscribe preference tokens. The official canonical logo source is SVG, and not every email client displays remote SVG. Until a verified raster email variant is available, preserve the alt text and do not claim perfect Outlook logo rendering. Do not expose tokenized action links in logs or fixtures.

**Stored issues:** existing generated briefing issues may preserve old HTML until regenerated or updated through the accepted existing workflow. Do not silently rewrite sent or archived editions.
