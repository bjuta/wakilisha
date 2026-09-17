begin;

-- WAKILISHA Gate C replay-authority repair, Stage 1.
--
-- Replay-safe enduring authority extracted from the production-data-bound
-- migration:
--   20260916182000_registry_relationship_authority_convergence_v1.sql
--
-- This migration intentionally carries no Production content identities,
-- no historical row reconciliation, and no evidence backfill. It reproduces
-- only the permanent fail-closed boundary required by a fresh database.
--
-- Stage 2 retires the old data-bound migration from active replay authority
-- only after this replacement is applied and accepted in Production.

-- -------------------------------------------------------------------------
-- Fail-closed historical boundary for legacy core-music cultural entities.
-- Broader non-music Institute semantics remain available.
-- -------------------------------------------------------------------------

create or replace function public.reject_legacy_core_cultural_entity_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_core_types constant text[] :=
    array['artist','track','release','label','genre']::text[];
begin
  if tg_op = 'INSERT' then
    if new.entity_type = any(v_core_types) then
      raise exception
        'Core music identity must use typed Registry authority, not cultural_entities'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.entity_type = any(v_core_types) then
      raise exception
        'Historical core music cultural entities are immutable'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if old.entity_type = any(v_core_types) then
    raise exception
      'Historical core music cultural entities are immutable'
      using errcode = '42501';
  end if;

  if new.entity_type = any(v_core_types) then
    raise exception
      'Core music identity must use typed Registry authority, not cultural_entities'
      using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all on function
  public.reject_legacy_core_cultural_entity_mutation()
from public, anon, authenticated;

drop trigger if exists
  trg_reject_legacy_core_cultural_entity_mutation
on public.cultural_entities;

create trigger
  trg_reject_legacy_core_cultural_entity_mutation
before insert or update or delete
on public.cultural_entities
for each row
execute function
  public.reject_legacy_core_cultural_entity_mutation();

-- -------------------------------------------------------------------------
-- Freeze legacy relationships whenever either endpoint is core music.
-- Non-music Institute relationships retain their existing governance road.
-- -------------------------------------------------------------------------

create or replace function public.reject_legacy_core_relationship_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_is_core boolean := false;
  v_new_is_core boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select exists (
      select 1
      from public.entity_relationships er
      join public.cultural_entities source_entity
        on source_entity.id = er.source_entity_id
      join public.cultural_entities target_entity
        on target_entity.id = er.target_entity_id
      where er.id = old.id
        and (
          source_entity.entity_type in
            ('artist','track','release','label','genre')
          or target_entity.entity_type in
            ('artist','track','release','label','genre')
        )
    )
    into v_old_is_core;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select exists (
      select 1
      from public.cultural_entities source_entity
      join public.cultural_entities target_entity
        on target_entity.id = new.target_entity_id
      where source_entity.id = new.source_entity_id
        and (
          source_entity.entity_type in
            ('artist','track','release','label','genre')
          or target_entity.entity_type in
            ('artist','track','release','label','genre')
        )
    )
    into v_new_is_core;
  end if;

  if v_old_is_core or v_new_is_core then
    raise exception
      'Core music relationships must use typed Registry relationship authority'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$$;

revoke all on function
  public.reject_legacy_core_relationship_mutation()
from public, anon, authenticated;

drop trigger if exists
  trg_reject_legacy_core_relationship_mutation
on public.entity_relationships;

create trigger
  trg_reject_legacy_core_relationship_mutation
before insert or update or delete
on public.entity_relationships
for each row
execute function
  public.reject_legacy_core_relationship_mutation();

-- -------------------------------------------------------------------------
-- Freeze evidence links attached to historical legacy core relationships.
-- -------------------------------------------------------------------------

create or replace function public.reject_legacy_core_relationship_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_is_core boolean := false;
  v_new_is_core boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select exists (
      select 1
      from public.entity_relationships er
      join public.cultural_entities source_entity
        on source_entity.id = er.source_entity_id
      join public.cultural_entities target_entity
        on target_entity.id = er.target_entity_id
      where er.id = old.relationship_id
        and (
          source_entity.entity_type in
            ('artist','track','release','label','genre')
          or target_entity.entity_type in
            ('artist','track','release','label','genre')
        )
    )
    into v_old_is_core;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select exists (
      select 1
      from public.entity_relationships er
      join public.cultural_entities source_entity
        on source_entity.id = er.source_entity_id
      join public.cultural_entities target_entity
        on target_entity.id = er.target_entity_id
      where er.id = new.relationship_id
        and (
          source_entity.entity_type in
            ('artist','track','release','label','genre')
          or target_entity.entity_type in
            ('artist','track','release','label','genre')
        )
    )
    into v_new_is_core;
  end if;

  if v_old_is_core or v_new_is_core then
    raise exception
      'Historical core music legacy relationship evidence is immutable'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$$;

revoke all on function
  public.reject_legacy_core_relationship_evidence_mutation()
from public, anon, authenticated;

drop trigger if exists
  trg_reject_legacy_core_relationship_evidence_mutation
on public.relationship_evidence;

create trigger
  trg_reject_legacy_core_relationship_evidence_mutation
before insert or update or delete
on public.relationship_evidence
for each row
execute function
  public.reject_legacy_core_relationship_evidence_mutation();

commit;
