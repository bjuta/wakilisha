begin;

do $authority$
begin
  if to_regprocedure(
    'public.create_taxonomy_term(text,text,text,text,text,text,text)'
  ) is null then
    raise exception
      'Canonical seven-argument create_taxonomy_term function is missing';
  end if;
end;
$authority$;

drop function if exists
  public.create_taxonomy_term(
    text,
    text,
    text,
    text
  );

alter function
  public.create_taxonomy_term(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
  set search_path = public, auth;

revoke all on function
  public.create_taxonomy_term(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
  from public, anon;

grant execute on function
  public.create_taxonomy_term(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
  to authenticated, service_role;

comment on function
  public.create_taxonomy_term(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
  is
  'Creates one governed category or post tag after capability validation. This canonical signature includes optional SEO metadata and is executable only by authenticated and service roles.';

notify pgrst, 'reload schema';

commit;
