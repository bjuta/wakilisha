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
