# Permissions Audit — June 17, 2026

## Root Cause: RLS Circular Dependency

### The Bug

The `wk_articles` INSERT policy checks `current_user_has_capability('edit_own_articles')`, which runs as:

```sql
SELECT 1
FROM user_role_assignments ura
JOIN role_capabilities rc ON rc.role_key = ura.role_key
WHERE ura.user_id = auth.uid()
  AND ura.status = 'active'
  AND rc.capability_key = 'edit_own_articles'
```

The `user_role_assignments` table has its own RLS policy that calls `current_user_is_administrator()` — which **also queries** `user_role_assignments`.

**Neither function was `SECURITY DEFINER`**, creating an infinite RLS recursion chain:

```
INSERT → wk_articles INSERT policy
  → current_user_has_capability()  [prosecdef: false]
    → SELECT user_role_assignments (RLS active)
      → user_role_assignments_self_or_admin_read policy
        → current_user_is_administrator()  [prosecdef: false]
          → SELECT user_role_assignments (RLS active)
            → ... LOOP → permission denied
```

Result: Even a correctly-assigned administrator hits permission denied on `wk_articles` INSERT.

---

## Verified User State

- **User ID**: `27937fb0-147f-4d0f-b735-3b9b9b82f38f`
- **Role assignment**: `role_key = 'administrator', status = 'active'` ✅
- **role_capabilities for administrator**: `edit_own_articles` present ✅
- **DB row is correct** — the bug was purely in RLS function execution context

---

## Fix Applied

### Edge Function Bypass (Immediate Fix)
Article creation (`POST /admin/content/articles/new`) now routes through **`admin-router` v6** edge function, which:
- Authenticates the user via JWT
- Checks capability via direct DB query using `service_role` key (bypasses RLS entirely)
- Inserts the article using `service_role` key (bypasses RLS)

This is the correct pattern for all write operations that are blocked by the RLS recursion issue.

### Root Fix (Requires Supabase Dashboard)
The correct long-term fix is to make both functions `SECURITY DEFINER` in the Supabase SQL editor:

```sql
CREATE OR REPLACE FUNCTION public.current_user_is_administrator()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- <-- this
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = auth.uid()
      AND role_key = 'administrator'
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_capability(required_capability text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- <-- this
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_capabilities rc ON rc.role_key = ura.role_key
    WHERE ura.user_id = auth.uid()
      AND ura.status = 'active'
      AND (ura.expires_at IS NULL OR ura.expires_at > now())
      AND rc.capability_key = required_capability
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_administrator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_capability(text) TO authenticated;
```

**Run this in Supabase Dashboard → SQL Editor.**

---

## RLS Policy Inventory

### `wk_articles`
| Policy | Cmd | Check |
|--------|-----|-------|
| Public can read runtime articles | SELECT | `wp_status IN ('publish','draft')` |
| wk_articles_admin_read | SELECT | `current_user_has_capability('view_dashboard') OR current_user_is_administrator()` |
| wk_articles_admin_insert | INSERT | `current_user_has_capability('edit_own_articles') OR current_user_is_administrator()` |
| wk_articles_admin_update | UPDATE | `current_user_has_capability('edit_own_articles') OR current_user_is_administrator()` |
| wk_articles_admin_delete | DELETE | `current_user_has_capability('delete_articles') OR current_user_is_administrator()` |

**Status**: Correct policies, but blocked by RLS recursion until SECURITY DEFINER fix applied.

### `user_role_assignments`
| Policy | Cmd | Check |
|--------|-----|-------|
| user_role_assignments_self_or_admin_read | SELECT | `user_id = auth.uid() OR current_user_is_administrator()` |
| user_role_assignments_admin_write | ALL | `current_user_is_administrator()` |

**Status**: The `current_user_is_administrator()` call here creates the recursion loop.

### `user_profiles`
| Policy | Cmd |
|--------|-----|
| user_profiles_self_read | SELECT (self or admin) |
| user_profiles_self_update | UPDATE (self or admin) |

**Status**: ✅ No issues.

### `user_access_scopes`
| Policy | Cmd |
|--------|-----|
| user_access_scopes_self_or_admin_read | SELECT |
| user_access_scopes_admin_write | ALL (admin only) |

**Status**: ✅ No issues.

### Admin tables (invites, recovery, audit, secrets)
All gated to `current_user_is_administrator()` or `service_role`. ✅

---

## Role–Capability Matrix (Verified Against DB)

| Role | Content | Charts | Registry | Media | Settings | Users |
|------|---------|--------|----------|-------|----------|-------|
| administrator | ALL | ALL | ALL | ALL | ALL | ALL |
| editor | edit/publish/delete articles, guides, pages | — | — | manage | — | — |
| chart_editor_global | — | view/manage/ingest/publish | — | — | — | — |
| chart_editor_regional | — | view/manage/publish | — | — | — | — |
| registry_editor | — | — | view/manage | manage | — | — |
| media_editor | — | — | — | ALL | — | — |
| reviewer | — | — | — | — | — | — |
| author | edit_own/publish | — | — | upload/manage | — | — |
| writer | edit_own only | — | — | upload/manage | — | — |
| viewer | read-only dashboard | — | — | — | — | — |
| subscriber | public only | — | — | — | — | — |

**DB verification**: All `role_capabilities` rows exist and match `CAPABILITY_MATRIX` in `src/services/userRoles.ts`. ✅

---

## Hero Gap Fix

All public-facing pages with full-bleed hero sections now use `-mt-16` to overlap behind the transparent sticky nav bar:

| Page | File |
|------|------|
| Home | `src/pages/home/components/HomeHero.tsx` |
| Magazine | `src/pages/magazine/page.tsx` |
| Guides | `src/pages/guides/page.tsx` |
| Charts Directory | `src/pages/charts/directory/page.tsx` |
| Categories | `src/pages/categories/page.tsx` |
| Categories Detail | `src/pages/categories/detail/page.tsx` |
| Tags | `src/pages/tags/page.tsx` |
| Tags Detail | `src/pages/tags/detail/page.tsx` |
| Mobile Magazine | `src/pages/mobile/magazine/page.tsx` |
| Mobile Guides | `src/pages/mobile/guides/page.tsx` |

The nav bar height is `py-4` = 16px × 2 + icon height ≈ 64px → Tailwind `h-16`.

---

## Action Items

| Priority | Item | Where |
|----------|------|-------|
| HIGH | Apply `SECURITY DEFINER` to both RLS functions | Supabase Dashboard → SQL Editor |
| DONE | Route article creation through edge function | `admin-router` v6 |
| DONE | Fix hero gap on all public pages | `-mt-16` on hero sections |
| LOW | Audit other direct-insert pages for same RLS pattern | `wk_articles`, `wk_article_revisions` |