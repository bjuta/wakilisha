-- WK100 / PG239 — read-only application schema parity evidence.
-- This is NOT a clean 239-migration replay, migration ledger proof, or
-- authority to write into Production or a new Supabase Preview.
-- Execute independently on accepted source and an isolated restored target.
-- Compare catalogue item count AND MD5 fingerprint exactly.
-- PostgreSQL pg_catalog internal "char" columns need explicit ::text;
-- vendor event triggers may have NULL evttags, so coalesce them.
-- SQL was exercised read-only against live PostgreSQL on 2026-11-01.
--
-- This fingerprint includes application schema objects, routine definitions,
-- ACLs, RLS policy definitions and roles, constraints, triggers and indexes.
-- It is scoped to the 13 explicitly identified WAKILISHA schema namespaces.
-- Matching hashes alone do NOT prove migration provenance or runtime behavior.

WITH ns AS (
  SELECT oid, nspname, nspacl
  FROM pg_catalog.pg_namespace
  WHERE nspname IN (
    'account_identity_private', 'audio', 'editorial', 'media', 'messaging',
    'mizizi_private', 'platform_private', 'private', 'public', 'video',
    'wakilisha_bridge', 'wakilisha_raw', 'wakilisha_repaired'
  )
), items AS (
  SELECT 'S|'||n.nspname||'|'||md5(coalesce(n.nspacl::text,'')) AS sig
  FROM ns n
  UNION ALL
  SELECT 'C|'||n.nspname||'.'||c.relname||'|'||c.relkind::text||'|'||
    c.relrowsecurity::text||'|'||c.relforcerowsecurity::text||'|'||
    md5(coalesce(c.relacl::text,''))
  FROM pg_catalog.pg_class c JOIN ns n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p','v','m','S','f')
  UNION ALL
  SELECT 'F|'||n.nspname||'.'||p.proname||'('||
    pg_get_function_identity_arguments(p.oid)||')|'||
    md5(pg_get_functiondef(p.oid))||'|'||md5(coalesce(p.proacl::text,''))
  FROM pg_catalog.pg_proc p JOIN ns n ON n.oid=p.pronamespace
  WHERE p.prokind IN ('f','p')
  UNION ALL
  SELECT 'P|'||n.nspname||'.'||c.relname||'.'||p.polname||'|'||
    md5(p.polcmd::text||'|'||p.polpermissive::text||'|'||
      coalesce((SELECT string_agg(
          coalesce(r.rolname::text,
                   CASE WHEN roles.role_oid=0 THEN 'PUBLIC' END),
          ',' ORDER BY coalesce(
            r.rolname::text,
            CASE WHEN roles.role_oid=0 THEN 'PUBLIC' END))
        FROM unnest(p.polroles) roles(role_oid)
        LEFT JOIN pg_catalog.pg_roles r ON r.oid=roles.role_oid),'')||
      '|'||coalesce(pg_get_expr(p.polqual,p.polrelid),'')||
      '|'||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''))
  FROM pg_catalog.pg_policy p
  JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
  JOIN ns n ON n.oid=c.relnamespace
  UNION ALL
  SELECT 'K|'||n.nspname||'.'||c.relname||'.'||k.conname||'|'||
    md5(pg_get_constraintdef(k.oid,true))
  FROM pg_catalog.pg_constraint k
  JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
  JOIN ns n ON n.oid=c.relnamespace
  UNION ALL
  SELECT 'T|'||n.nspname||'.'||c.relname||'.'||t.tgname||'|'||
    md5(pg_get_triggerdef(t.oid,true))
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
  JOIN ns n ON n.oid=c.relnamespace
  WHERE NOT t.tgisinternal
  UNION ALL
  SELECT 'I|'||n.nspname||'.'||i.relname||'|'||
    md5(pg_get_indexdef(x.indexrelid))
  FROM pg_catalog.pg_index x
  JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
  JOIN ns n ON n.oid=i.relnamespace
  UNION ALL
  SELECT 'A|'||n.nspname||'|'||d.defaclobjtype::text||'|'||
    pg_get_userbyid(d.defaclrole)||'|'||
    md5(coalesce(d.defaclacl::text,''))
  FROM pg_catalog.pg_default_acl d
  JOIN ns n ON n.oid=d.defaclnamespace
)
SELECT count(*)::bigint AS application_catalog_items,
       md5(string_agg(sig,chr(10) ORDER BY sig)) AS application_catalog_md5
FROM items;

-- Security-critical global objects are separately reported; schema-scoped
-- pg_dump output cannot be assumed to restore these automatically.
SELECT evtname,
       evtevent,
       evtenabled::text AS enabled_code,
       coalesce(array_to_string(evttags,','),'') AS tags,
       evtfoid::regprocedure::text AS handler
FROM pg_catalog.pg_event_trigger
ORDER BY evtname;

SELECT granted.rolname AS granted_role,
       member.rolname AS member_role,
       m.admin_option,
       m.inherit_option,
       m.set_option
FROM pg_catalog.pg_auth_members m
JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
JOIN pg_catalog.pg_roles member ON member.oid=m.member
WHERE granted.rolname='mizizi_executor'
   OR member.rolname='mizizi_executor'
ORDER BY 1,2;
