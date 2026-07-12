create or replace function public.create_registry_cultural_entity(p_entity_type text,p_name text,p_slug text default null,p_description text default null,p_source_table text default null,p_source_id text default null,p_canonical_source_table text default null,p_canonical_source_id uuid default null,p_metadata jsonb default '{}'::jsonb)
returns public.cultural_entities
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_created public.cultural_entities;
begin
  if not public.institute_can_manage() then raise exception 'You do not have permission to create Registry cultural entities.'; end if;
  if p_entity_type not in ('person','scene','place','event','institution','work','concept','language','movement','publication','organization','article','inquiry','memory','source') then raise exception 'This workflow only creates broader cultural entities. Use the authoritative music Registry tables for artists, tracks, releases, labels, and genres.'; end if;
  if nullif(btrim(p_name),'') is null then raise exception 'A cultural entity name is required.'; end if;
  if (p_source_table is null) <> (p_source_id is null) then raise exception 'Source table and source ID must be provided together.'; end if;
  if (p_canonical_source_table is null) <> (p_canonical_source_id is null) then raise exception 'Canonical source table and canonical source ID must be provided together.'; end if;
  insert into public.cultural_entities(entity_type,source_table,source_id,name,slug,description,status,canonical_source_table,canonical_source_id,review_status,public_safe,metadata)
  values(p_entity_type,nullif(btrim(p_source_table),''),nullif(btrim(p_source_id),''),btrim(p_name),nullif(btrim(p_slug),''),nullif(btrim(p_description),''),'draft',nullif(btrim(p_canonical_source_table),''),p_canonical_source_id,'unreviewed',false,coalesce(p_metadata,'{}'::jsonb))
  returning * into v_created;
  return v_created;
end;
$$;
revoke all on function public.create_registry_cultural_entity(text,text,text,text,text,text,text,uuid,jsonb) from public,anon;
grant execute on function public.create_registry_cultural_entity(text,text,text,text,text,text,text,uuid,jsonb) to authenticated,service_role;
comment on function public.create_registry_cultural_entity(text,text,text,text,text,text,text,uuid,jsonb) is 'Creates a draft broader cultural entity through the controlled Registry workflow.';;
