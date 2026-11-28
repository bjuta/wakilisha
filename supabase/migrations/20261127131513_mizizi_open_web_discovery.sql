-- Issue #1441; pinned CLI 2.107.0 mint 46005466639 / 140527402301.
-- Extend only the existing provider/host constraint. No policy, credential,
-- allocation, source permission or hosted execution is seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres' or to_regprocedure('mizizi_private.desk_search_provider_host_valid_v1(text,text)') is null
 or mizizi_private.desk_search_provider_host_valid_v1('tavily_keyless','api.tavily.com')
 then raise exception 'STOP_MIZIZI_OPEN_WEB_PREIMAGE';end if;
end $guard$;
create or replace function mizizi_private.desk_search_provider_host_valid_v1(p_provider text,p_host text)
returns boolean language sql immutable set search_path=pg_catalog as $host$
 select coalesce(
  mizizi_private.desk_custody_url_host_v1('https://'||p_host||'/')=p_host and
  (p_provider='brave' and p_host='api.search.brave.com'
   or p_provider='wikimedia' and p_host ~ '^[a-z][a-z0-9-]{1,19}[.]wikipedia[.]org$'
   or p_provider='gdelt' and p_host='api.gdeltproject.org'
   or p_provider='tavily_keyless' and p_host='api.tavily.com'
   or p_provider='searxng' and p_host not in ('api.search.brave.com','api.gdeltproject.org','api.tavily.com')
      and p_host !~ '[.]wikipedia[.]org$'),false);
$host$;
revoke all on function mizizi_private.desk_search_provider_host_valid_v1(text,text)
 from public,anon,authenticated,service_role,mizizi_executor;
-- Revalidate the existing constraint against all retained policy history.
alter table mizizi_private.desk_search_policy_versions_v1 drop constraint mz_desk_search_provider_host;
alter table mizizi_private.desk_search_policy_versions_v1 add constraint mz_desk_search_provider_host
 check(mizizi_private.desk_search_provider_host_valid_v1(provider,provider_host));
do $verify$ begin
 if not mizizi_private.desk_search_provider_host_valid_v1('tavily_keyless','api.tavily.com')
 or mizizi_private.desk_search_provider_host_valid_v1('tavily_keyless','example.org')
 or mizizi_private.desk_search_provider_host_valid_v1('searxng','api.tavily.com')
 or not mizizi_private.desk_search_provider_host_valid_v1('gdelt','api.gdeltproject.org')
 then raise exception 'MIZIZI_OPEN_WEB_PROVIDER_BOUNDARY_DENIED';end if;
end $verify$;
commit;
