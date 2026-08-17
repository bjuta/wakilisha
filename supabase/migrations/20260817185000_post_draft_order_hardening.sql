-- WAKILISHA M8C.3-M3: deterministic Thread draft ordering hardening.
-- Cap authored Thread drafts at 50 Posts and make position uniqueness deferrable
-- so a reorder never needs temporary out-of-range positions.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c3_order_preflight$
begin
  if to_regclass('private.community_post_drafts') is null
     or to_regprocedure('public.community_reorder_post_draft_group(uuid,uuid[])') is null then
    raise exception 'STOP: M8C.3 draft authority must exist before order hardening';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid=constraint_row.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='private'
      and relation.relname='community_post_drafts'
      and constraint_row.conname='community_post_drafts_owner_group_position_key'
  ) then
    raise exception 'STOP: expected Thread draft position authority is missing';
  end if;
end;
$m8c3_order_preflight$;

alter table private.community_post_drafts
  drop constraint community_post_drafts_position_check,
  drop constraint community_post_drafts_owner_group_position_key;

alter table private.community_post_drafts
  add constraint community_post_drafts_position_check
    check (position between 1 and 50),
  add constraint community_post_drafts_owner_group_position_key
    unique (author_user_id,draft_group_id,position)
    deferrable initially immediate;

create or replace function public.community_reorder_post_draft_group(
  p_draft_group_id uuid,
  p_draft_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,private
as $function$
declare
  v_user uuid:=auth.uid();
  v_count integer;
  v_requested integer;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_draft_group_id is null or p_draft_ids is null then
    raise exception 'invalid_thread_draft_order';
  end if;

  v_requested:=cardinality(p_draft_ids);
  if v_requested<1 or v_requested>50 then raise exception 'invalid_thread_draft_order'; end if;

  select count(*) into v_count
  from private.community_post_drafts draft
  where draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id;

  if v_count<>v_requested
     or (select count(distinct item_id) from unnest(p_draft_ids) item_id)<>v_requested
     or exists (
       select 1 from unnest(p_draft_ids) item_id
       where not exists (
         select 1 from private.community_post_drafts draft
         where draft.id=item_id
           and draft.author_user_id=v_user
           and draft.draft_group_id=p_draft_group_id
       )
     ) then
    raise exception 'invalid_thread_draft_order';
  end if;

  set constraints community_post_drafts_owner_group_position_key deferred;

  update private.community_post_drafts draft
  set position=ordered.ordinality,
      updated_at=now()
  from unnest(p_draft_ids) with ordinality ordered(item_id,ordinality)
  where draft.id=ordered.item_id
    and draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id;

  set constraints community_post_drafts_owner_group_position_key immediate;

  return jsonb_build_object(
    'draft_group_id',p_draft_group_id,
    'ordered_draft_ids',to_jsonb(p_draft_ids)
  );
end;
$function$;

revoke all on function public.community_reorder_post_draft_group(uuid,uuid[]) from public,anon;
grant execute on function public.community_reorder_post_draft_group(uuid,uuid[]) to authenticated;

update private.phase_0a_rpc_classification
set
  rationale='Reorders every item in one owner-scoped authored Thread draft with a complete deterministic order capped at 50 Posts.',
  reviewed_at=now()
where function_signature='community_reorder_post_draft_group(uuid,uuid[])';

commit;
