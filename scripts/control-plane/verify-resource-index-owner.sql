do $$
declare
  public_owner_column_count integer;
  private_owner_column_count integer;
  article_owner_mismatch_count integer;
  anon_has_private_access boolean;
begin
  select count(*)
  into public_owner_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'wk_resource_index'
    and column_name = 'owner_id';

  if public_owner_column_count <> 0 then
    raise exception
      'public.wk_resource_index must not expose owner_id.';
  end if;

  select count(*)
  into private_owner_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'wk_resource_owner_index'
    and column_name = 'owner_id'
    and data_type = 'uuid';

  if private_owner_column_count <> 1 then
    raise exception
      'public.wk_resource_owner_index must expose owner_id as uuid.';
  end if;

  select has_table_privilege(
    'anon',
    'public.wk_resource_owner_index',
    'select'
  )
  into anon_has_private_access;

  if anon_has_private_access then
    raise exception
      'anon must not have access to public.wk_resource_owner_index.';
  end if;

  select count(*)
  into article_owner_mismatch_count
  from public.wk_resource_owner_index owner_index
  join editorial.resources resource
    on resource.id = owner_index.resource_id
  where owner_index.resource_kind = 'article'
    and owner_index.owner_id
      is distinct from resource.owner_id;

  if article_owner_mismatch_count <> 0 then
    raise exception
      'Article owner values do not match editorial.resources.';
  end if;
end
$$;
