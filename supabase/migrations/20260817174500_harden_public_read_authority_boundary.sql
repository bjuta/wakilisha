-- WAKILISHA public-read authority hardening.
--
-- Invariant:
--   1. Anonymous traffic never evaluates privileged capability helpers.
--   2. Privileged RLS policies are scoped to authenticated only.
--   3. Public content policies are explicit about anon/authenticated access.
--   4. Future CREATE/ALTER POLICY statements cannot reintroduce the hazard.
--
-- The capability helpers intentionally remain unavailable to anon. Granting anon
-- EXECUTE would hide the policy-design bug instead of fixing the authority boundary.

DO $policy_hardening$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY (roles)
      AND (
        coalesce(qual, '') ~ 'current_user_(has_capability|is_administrator)'
        OR coalesce(with_check, '') ~ 'current_user_(has_capability|is_administrator)'
      )
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      p.policyname,
      p.schemaname,
      p.tablename
    );
  END LOOP;
END
$policy_hardening$;

-- `published` is the canonical publication value in guide_pages. The previous
-- policy used `publish`, which made every current Guide invisible to anon.
ALTER POLICY guide_pages_public_read
  ON public.guide_pages
  TO anon, authenticated
  USING (status = 'published');

-- Keep this high-volume public relationship path explicit. Its predicate is a
-- simple indexed release lookup and contains no identity/capability work.
ALTER POLICY "Public users can read tracks for active releases"
  ON public.registry_release_tracks
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.registry_releases AS r
      WHERE r.id = registry_release_tracks.release_id
        AND r.status = 'active'
    )
  );

-- A reusable assertion for CI, migrations and operational verification.
CREATE OR REPLACE FUNCTION private.assert_rls_privileged_policy_role_boundary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  bad_count bigint;
  bad_examples text;
BEGIN
  SELECT count(*),
         string_agg(
           format('%I.%I:%I', schemaname, tablename, policyname),
           ', ' ORDER BY schemaname, tablename, policyname
         )
  INTO bad_count, bad_examples
  FROM (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY (roles)
      AND (
        coalesce(qual, '') ~ 'current_user_(has_capability|is_administrator)'
        OR coalesce(with_check, '') ~ 'current_user_(has_capability|is_administrator)'
      )
    ORDER BY schemaname, tablename, policyname
    LIMIT 10
  ) AS hazardous;

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'WAKILISHA RLS authority boundary violation: privileged helper policy assigned to PUBLIC (%). Examples: %',
      bad_count,
      coalesce(bad_examples, '<none>')
      USING ERRCODE = '42501',
            HINT = 'Scope privileged policies TO authenticated. Public-read policies must not call current_user_has_capability/current_user_is_administrator.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_rls_privileged_policy_role_boundary() FROM PUBLIC;

-- Database-level regression guard. This runs only when a policy is created or
-- altered, so it adds no request-path overhead at 1M or 10M users.
CREATE OR REPLACE FUNCTION private.enforce_rls_privileged_policy_role_boundary()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM private.assert_rls_privileged_policy_role_boundary();
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_rls_privileged_policy_role_boundary() FROM PUBLIC;

DROP EVENT TRIGGER IF EXISTS wakilisha_rls_privileged_policy_role_boundary;
CREATE EVENT TRIGGER wakilisha_rls_privileged_policy_role_boundary
  ON ddl_command_end
  WHEN TAG IN ('CREATE POLICY', 'ALTER POLICY')
  EXECUTE FUNCTION private.enforce_rls_privileged_policy_role_boundary();

-- Migration postcondition.
SELECT private.assert_rls_privileged_policy_role_boundary();
