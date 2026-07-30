do $$
declare
  owner_column_count integer;
  article_owner_mismatch_count integer;
begin
  select count(*)
  into owner_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'wk_resource_index'
    and column_name = 'owner_id'
    and data_type = 'uuid';

  if owner_column_count <> 1 then
    raise exception
      'public.wk_resource_index must expose owner_id as uuid.';
  end if;

  select count(*)
  into article_owner_mismatch_count
  from public.wk_resource_index resource_index
  join editorial.resources resource
    on resource.id = resource_index.resource_id
  where resource_index.resource_kind = 'article'
    and resource_index.owner_id
      is distinct from resource.owner_id;

  if article_owner_mismatch_count <> 0 then
    raise exception
      'Article owner values in wk_resource_index do not match editorial.resources.';
  end if;
end
$$;
