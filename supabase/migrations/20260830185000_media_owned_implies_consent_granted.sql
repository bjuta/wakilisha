begin;

-- Canonical Media governance conditional:
-- owned rights imply granted consent for all new governance versions.
--
-- This applies forward only. Existing immutable governance history is not
-- rewritten. Legacy rows remain historical evidence until a new governance
-- version is explicitly appended.

create or replace function media.apply_owned_consent_rule()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'media'
as $function$
begin
  if new.rights_status = 'owned' then
    new.consent_status := 'granted';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_media_owned_consent_rule
  on media.asset_governance_versions;

create trigger trg_media_owned_consent_rule
before insert or update of rights_status, consent_status
on media.asset_governance_versions
for each row
execute function media.apply_owned_consent_rule();

revoke execute
  on function media.apply_owned_consent_rule()
  from public, anon, authenticated, service_role;

commit;
