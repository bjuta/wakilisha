-- WAKILISHA M8C.3-M6: authored Thread item count presentation.
-- Extend the canonical Post read payload with a bounded published Thread count so
-- feed surfaces can reveal authored Thread depth without issuing per-Post reads.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c3_thread_count_preflight$
begin
  if to_regclass('public.community_post_threads') is null
     or to_regclass('public.community_posts') is null
     or to_regprocedure('public.community_get_post(uuid)') is null
     or to_regprocedure('public.community_get_post_legacy_m8c3(uuid)') is null then
    raise exception 'STOP: M8C.3 Thread presentation must exist before Thread item count';
  end if;
end;
$m8c3_thread_count_preflight$;

create or replace function public.community_get_post(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_payload jsonb;
  v_thread_id uuid;
  v_thread_position integer;
  v_thread_item_count integer;
begin
  v_payload:=public.community_get_post_legacy_m8c3(p_post_id);
  if v_payload is null then return null; end if;

  select post.thread_id,post.thread_position
  into v_thread_id,v_thread_position
  from public.community_posts post
  where post.id=p_post_id;

  if v_thread_id is not null then
    select count(*)::integer
    into v_thread_item_count
    from public.community_posts sibling
    where sibling.thread_id=v_thread_id
      and sibling.status='published';
  end if;

  return v_payload || jsonb_build_object(
    'thread_id',v_thread_id,
    'thread_position',v_thread_position,
    'thread_item_count',v_thread_item_count
  );
end;
$function$;

revoke all on function public.community_get_post(uuid) from public;
grant execute on function public.community_get_post(uuid) to anon,authenticated;

update private.phase_0a_rpc_classification
set
  rationale='Reads one published canonical Post and adds only its authored Thread identity, position, and published item count when present.',
  reviewed_at=now()
where function_signature='community_get_post(uuid)';

commit;
