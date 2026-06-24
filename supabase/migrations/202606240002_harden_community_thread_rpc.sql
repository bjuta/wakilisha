-- Commercial-grade get-or-create thread RPC.
-- Prevents duplicate-key conflicts under concurrent traffic by serializing per entity key.

create index if not exists community_threads_entity_slug_lookup_idx
  on public.community_threads (entity_type, entity_slug)
  where entity_slug is not null;

create index if not exists community_threads_entity_url_lookup_idx
  on public.community_threads (entity_type, entity_url)
  where entity_url is not null;

create or replace function public.community_get_or_create_thread(
  p_entity_type text,
  p_entity_id text default null,
  p_entity_slug text default null,
  p_entity_url text default null,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.community_threads%rowtype;
  v_created boolean := false;
  v_entity_type text := nullif(trim(coalesce(p_entity_type, '')), '');
  v_entity_id text := nullif(trim(coalesce(p_entity_id, '')), '');
  v_entity_slug text := nullif(trim(coalesce(p_entity_slug, '')), '');
  v_entity_url text := nullif(trim(coalesce(p_entity_url, '')), '');
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_lock_key text;
begin
  if v_entity_type is null then
    raise exception 'Entity type is required' using errcode = '22023';
  end if;

  if v_entity_id is null and v_entity_slug is null and v_entity_url is null then
    raise exception 'Entity id, slug, or URL is required' using errcode = '22023';
  end if;

  v_lock_key := lower(v_entity_type)
    || ':'
    || coalesce(v_entity_id, '')
    || ':'
    || coalesce(v_entity_slug, '')
    || ':'
    || coalesce(v_entity_url, '');

  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 20260624));

  select *
  into v_thread
  from public.community_threads
  where entity_type::text = v_entity_type
    and (
      (v_entity_id is not null and entity_id::text = v_entity_id)
      or (v_entity_slug is not null and entity_slug = v_entity_slug)
      or (v_entity_url is not null and entity_url = v_entity_url)
    )
  order by created_at asc
  limit 1;

  if not found then
    begin
      insert into public.community_threads (
        entity_type,
        entity_id,
        entity_slug,
        entity_url,
        title,
        status
      )
      values (
        v_entity_type,
        v_entity_id,
        v_entity_slug,
        v_entity_url,
        coalesce(v_title, v_entity_slug, v_entity_id, v_entity_type),
        'open'
      )
      returning * into v_thread;

      v_created := true;
    exception
      when unique_violation then
        select *
        into v_thread
        from public.community_threads
        where entity_type::text = v_entity_type
          and (
            (v_entity_id is not null and entity_id::text = v_entity_id)
            or (v_entity_slug is not null and entity_slug = v_entity_slug)
            or (v_entity_url is not null and entity_url = v_entity_url)
          )
        order by created_at asc
        limit 1;

        v_created := false;
    end;
  end if;

  if v_thread.id is null then
    raise exception 'Could not resolve community thread' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'thread', to_jsonb(v_thread),
    'created', v_created
  );
end;
$$;

grant execute on function public.community_get_or_create_thread(text, text, text, text, text) to anon, authenticated;
