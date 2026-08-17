-- WAKILISHA public-read authority hardening.
--
-- Permanent invariants:
--   1. Anonymous traffic never evaluates privileged capability helpers.
--   2. Privileged RLS policies are scoped to authenticated only.
--   3. Public-content policies explicitly name anon/authenticated roles.
--   4. Anonymous callers can never EXECUTE privileged identity helpers.
--   5. Future CREATE/ALTER POLICY or GRANT statements cannot reintroduce this class of bug.
--
-- This is deliberately enforced at DDL time, not request time. The guard adds
-- no per-request work as traffic grows. The capability helpers remain private
-- to authenticated/server authority; granting them to anon would mask the
-- policy-design error instead of fixing the authority boundary.

-- First repair every existing privileged policy accidentally assigned to a
-- role that includes anonymous callers.
DO $policy_hardening$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ('public' = ANY (roles) OR 'anon' = ANY (roles))
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

-- `published` is the canonical persisted publication value currently used by
-- guide_pages. The previous policy used `publish`, so published Guides did not
-- match their public policy and anonymous evaluation fell through to an admin
-- policy that invoked a privileged helper.
ALTER POLICY guide_pages_public_read
  ON public.guide_pages
  TO anon, authenticated
  USING (status = 'published');

-- Keep this high-volume public relationship path explicit. Its predicate is a
-- primary-key lookup against registry_releases and contains no identity or
-- capability work on the anonymous request path.
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

-- Preserve the intended helper boundary explicitly. Authenticated has its
-- existing direct EXECUTE grant; anon/PUBLIC do not get one.
REVOKE EXECUTE ON FUNCTION public.current_user_has_capability(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_is_administrator() FROM anon, PUBLIC;

-- Reusable assertion for migrations, CI and live operational verification.
CREATE OR REPLACE FUNCTION private.assert_rls_privileged_policy_role_boundary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  bad_policy_count bigint;
  bad_policy_examples text;
  anon_helper_count bigint;
  anon_helper_examples text;
BEGIN
  SELECT count(*),
         string_agg(
           format('%I.%I:%I', schemaname, tablename, policyname),
           ', ' ORDER BY schemaname, tablename, policyname
         )
  INTO bad_policy_count, bad_policy_examples
  FROM (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ('public' = ANY (roles) OR 'anon' = ANY (roles))
      AND (
        coalesce(qual, '') ~ 'current_user_(has_capability|is_administrator)'
        OR coalesce(with_check, '') ~ 'current_user_(has_capability|is_administrator)'
      )
    ORDER BY schemaname, tablename, policyname
    LIMIT 10
  ) AS hazardous;

  IF bad_policy_count > 0 THEN
    RAISE EXCEPTION
      'WAKILISHA RLS authority boundary violation: privileged helper policy assigned to an anonymous-capable role (%). Examples: %',
      bad_policy_count,
      coalesce(bad_policy_examples, '<none>')
      USING ERRCODE = '42501',
            HINT = 'Scope privileged policies TO authenticated. Anonymous public-read policies must not call current_user_has_capability/current_user_is_administrator.';
  END IF;

  SELECT count(*),
         string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text)
  INTO anon_helper_count, anon_helper_examples
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('current_user_has_capability', 'current_user_is_administrator')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF anon_helper_count > 0 THEN
    RAISE EXCEPTION
      'WAKILISHA RLS authority boundary violation: anon can EXECUTE privileged helper function(s): %',
      coalesce(anon_helper_examples, '<unknown>')
      USING ERRCODE = '42501',
            HINT = 'REVOKE EXECUTE from anon/PUBLIC. Do not make privileged identity helpers callable by anonymous traffic.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_rls_privileged_policy_role_boundary() FROM PUBLIC;

-- Database-level regression guard. It runs only when policy/privilege DDL is
-- changed, so there is zero request-path overhead at 1M or 10M users.
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
  WHEN TAG IN ('CREATE POLICY', 'ALTER POLICY', 'GRANT', 'REVOKE')
  EXECUTE FUNCTION private.enforce_rls_privileged_policy_role_boundary();

COMMENT ON EVENT TRIGGER wakilisha_rls_privileged_policy_role_boundary IS
  'Rejects RLS/privilege DDL that makes privileged WAKILISHA identity helpers reachable from anonymous traffic.';

-- Migration postcondition: the repaired database must satisfy the invariant
-- before the migration is allowed to commit.
SELECT private.assert_rls_privileged_policy_role_boundary();
