-- WAKILISHA community saves
-- Make Save idempotent/conflict-safe so duplicate saves do not surface as 409 errors.

-- Remove any prior overloads so PostgREST has one unambiguous RPC signature.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'community_save_entity'
  loop
    execute 'drop function if exists ' || r.signature;
  end loop;
end;
$$;

create or replace function public.community_save_entity(
  p_entity_type text,
  p_entity_id text default null,
  p_entity_slug text default null,
  p_entity_url text default null,
  p_title text default null,
  p_subtitle text default null,
  p_image_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_entity_type text := nullif(trim(coalesce(p_entity_type, '')), '');
  v_entity_id text := nullif(trim(coalesce(p_entity_id, '')), '');
  v_entity_slug text := nullif(trim(coalesce(p_entity_slug, '')), '');
  v_entity_url text := nullif(trim(coalesce(p_entity_url, '')), '');
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_subtitle text := nullif(trim(coalesce(p_subtitle, '')), '');
  v_image_url text := nullif(trim(coalesce(p_image_url, '')), '');
  v_save public.community_saves%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if v_entity_type is null then
    raise exception 'Entity type is required' using errcode = '22023';
  end if;

  if v_title is null then
    raise exception 'Title is required' using errcode = '22023';
  end if;

  if v_entity_id is null and v_entity_slug is null and v_entity_url is null then
    raise exception 'At least one entity identifier is required' using errcode = '22023';
  end if;

  -- Idempotent save: if the user already saved this entity by any known
  -- identifier, refresh its metadata and return saved=true instead of throwing
  -- a duplicate-key 409.
  select *
  into v_save
  from public.community_saves
  where user_id = v_user_id
    and entity_type = v_entity_type
    and (
      (v_entity_id is not null and entity_id = v_entity_id)
      or (v_entity_slug is not null and entity_slug = v_entity_slug)
      or (v_entity_url is not null and entity_url = v_entity_url)
    )
  order by created_at desc
  limit 1;

  if found then
    update public.community_saves
    set
      entity_id = coalesce(v_entity_id, entity_id),
      entity_slug = coalesce(v_entity_slug, entity_slug),
      entity_url = coalesce(v_entity_url, entity_url),
      title = v_title,
      subtitle = v_subtitle,
      image_url = v_image_url
    where id = v_save.id
    returning * into v_save;

    return jsonb_build_object(
      'saved', true,
      'existing', true,
      'save', to_jsonb(v_save)
    );
  end if;

  begin
    insert into public.community_saves (
      user_id,
      entity_type,
      entity_id,
      entity_slug,
      entity_url,
      title,
      subtitle,
      image_url
    ) values (
      v_user_id,
      v_entity_type,
      v_entity_id,
      v_entity_slug,
      v_entity_url,
      v_title,
      v_subtitle,
      v_image_url
    )
    returning * into v_save;
  exception when unique_violation then
    -- In case a unique index catches a duplicate not found above, normalize it
    -- into saved=true instead of leaking a 409 to the browser.
    select *
    into v_save
    from public.community_saves
    where user_id = v_user_id
      and entity_type = v_entity_type
      and (
        (v_entity_id is not null and entity_id = v_entity_id)
        or (v_entity_slug is not null and entity_slug = v_entity_slug)
        or (v_entity_url is not null and entity_url = v_entity_url)
      )
    order by created_at desc
    limit 1;

    if found then
      update public.community_saves
      set
        entity_id = coalesce(v_entity_id, entity_id),
        entity_slug = coalesce(v_entity_slug, entity_slug),
        entity_url = coalesce(v_entity_url, entity_url),
        title = v_title,
        subtitle = v_subtitle,
        image_url = v_image_url
      where id = v_save.id
      returning * into v_save;

      return jsonb_build_object(
        'saved', true,
        'existing', true,
        'save', to_jsonb(v_save)
      );
    end if;

    raise;
  end;

  return jsonb_build_object(
    'saved', true,
    'existing', false,
    'save', to_jsonb(v_save)
  );
end;
$$;

grant execute on function public.community_save_entity(text, text, text, text, text, text, text) to authenticated;
