# Cloudflare / WAF Security Configuration Guide

This document outlines the Cloudflare security configuration for `wakilisha.africa`. These settings are applied at the DNS/CDN layer — they complement the Edge Function security headers and RLS policies already deployed at the application layer.

---

## 1. SSL/TLS Settings

```
SSL/TLS encryption mode: Full (strict)
```
- Ensures Cloudflare ↔ origin (Supabase/Netlify) traffic is encrypted with valid certificates.
- `Flexible` is NOT acceptable — it allows plaintext origin connections.

```
Always Use HTTPS: ON
Automatic HTTPS Rewrites: ON
Minimum TLS Version: 1.2
```

---

## 2. WAF Rules — Managed Rulesets

Enable the following Cloudflare Managed Rulesets:

### 2.1 OWASP Core Ruleset
- **Action:** Block
- **Sensitivity:** Medium
- **Paranoia Level:** PL1
- Covers: SQL injection (`942*`), XSS (`941*`), command injection, path traversal, protocol violations.

### 2.2 Cloudflare Managed Ruleset
- **Action:** Block
- Covers: Known CVEs, WordPress-specific attacks (if legacy WP endpoints still accessible), PHP injection, information disclosure.

### 2.3 Custom WAF Rules (Firewall Rules)

| Priority | Expression | Action | Description |
|----------|-----------|--------|-------------|
| 1 | `(http.request.uri.path contains "/wp-")` | Block | Block WordPress probing |
| 2 | `(http.request.uri.path contains "/.env")` | Block | Block env file scraping |
| 3 | `(http.request.uri.path contains "/.git")` | Block | Block git directory access |
| 4 | `(http.request.uri.path contains "/phpmyadmin") or (http.request.uri.path contains "/adminer")` | Block | Block DB admin tool probes |
| 5 | `(http.request.uri.query contains "<script")` | Block | Block reflected XSS in query params |
| 6 | `(cf.threat_score ge 10)` | Challenge | Bot challenge for moderate threats |
| 7 | `(cf.threat_score ge 30)` | Block | Block high-threat requests |

---

## 3. Rate Limiting

| Rule | Match | Period | Threshold | Action | Scope |
|------|-------|--------|-----------|--------|-------|
| API rate limit | `http.request.uri.path contains "/functions/v1/"` | 1 min | 120 | Block (1 min) | IP |
| Auth brute force | `http.request.uri.path contains "/auth/"` | 5 min | 20 | Block (15 min) | IP |
| Chart page rate | `http.request.uri.path contains "/charts/"` | 1 min | 60 | Block (1 min) | IP |
| Global rate limit | All requests | 1 min | 300 | Challenge | IP |

---

## 4. Bot Management

```
Bot Fight Mode: ON
```

Additional bot rules:

| Rule | Action |
|------|--------|
| Verified bots (Googlebot, Bingbot, etc.) | Allow |
| Known malicious bots (automated) | Block |
| Unverified + high request rate | Challenge (JS Challenge) |

---

## 5. Security Headers (Cloudflare-side reinforcement)

These should also be set via Cloudflare Transform Rules to ensure they're present even if the origin omits them:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
```

Create a **Transform Rule → Modify Response Header** with these headers.

### Content-Security-Policy (report-only initially)

Start with report-only to avoid breaking anything:

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pgzizndxdyhqmtyywjmt.supabase.co https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net;
  font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net;
  img-src 'self' data: https://readdy.ai https://*.supabase.co https://img.youtube.com https://*.scdn.co https://*.mzstatic.com;
  connect-src 'self' https://pgzizndxdyhqmtyywjmt.supabase.co https://api.music.apple.com https://api.spotify.com;
  frame-src 'self' https://www.youtube.com https://open.spotify.com https://music.apple.com https://www.google.com;
  media-src 'self';
  report-uri https://wakilisha.africa/csp-report;
```

After 1 week of monitoring with no violations, switch to `Content-Security-Policy` (enforce mode).

---

## 6. Cache Rules

| Path pattern | Cache TTL | Notes |
|---|---|---|
| `*.css`, `*.js`, `*.woff2`, `*.png`, `*.jpg`, `*.svg` | 30 days | Static assets with hashed filenames |
| `/functions/v1/wakilisha-public-api/*` | 5 min | API responses |
| `*.html` | Bypass | Dynamic SPA shell |

---

## 7. DDoS Protection

```
DDoS Protection: ON (Standard — included in all plans)
```

If under active attack:
- Enable "I'm Under Attack" mode (forces JS challenge for all visitors)
- Notify Cloudflare support for emergency mitigation

---

## 8. IP Access Rules (if needed)

| IP/CIDR | Action | Note |
|---------|--------|------|
| Supabase IP ranges | Allow | Ensure Supabase Edge Functions can reach origin |
| Netlify/Vercel build IPs | Allow | Allow deployment hooks |
| Your office/home IP | Allow | Prevent accidental lockout during testing |

---

## 9. Page Rules / Bulk Redirects

| Source | Target | Type |
|--------|--------|------|
| `wakilisha.africa/wp-*` | `https://wakilisha.africa` | 301 Redirect |
| `wakilisha.africa/*.php` | `https://wakilisha.africa` | 301 Redirect |
| `*.wakilisha.africa` | `https://wakilisha.africa` | 301 Redirect (canonical) |

---

## 10. Verification Checklist

After applying Cloudflare settings, verify:

- [ ] `curl -I https://wakilisha.africa` returns HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] `curl -X POST https://wakilisha.africa/functions/v1/wakilisha-public-api` (no auth) works for public endpoints
- [ ] Rapid requests to `/functions/v1/` trigger rate limiting (429 responses)
- [ ] WordPress paths (`/wp-admin`, `/wp-login.php`) return blocks or redirects
- [ ] `.env` and `.git` path probing returns 403 blocks
- [ ] SSL Labs grade is A+
- [ ] Security headers visible via https://securityheaders.com

---

## 11. Emergency Contacts

If you need changes to the Cloudflare config and can't access the dashboard:

1. Cloudflare Support: https://dash.cloudflare.com/support
2. For DDoS emergencies: Cloudflare dashboard → Under Attack Mode
3. For Supabase-specific issues: Supabase dashboard → Support