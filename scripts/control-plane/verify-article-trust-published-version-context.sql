select set_config(
  'request.jwt.claim.role',
  'service_role',
  true
);

do $verify$
declare
  v_function_oid oid;
  v_definition text;
  v_identity jsonb;
  v_working jsonb;
  v_published jsonb;
  v_public jsonb;
begin
  v_function_oid :=
    to_regprocedure(
      'public.get_article_working_version_identity(uuid)'
    );

  if v_function_oid is null then
    raise exception
      'STOP: Article version identity RPC is missing';
  end if;

  select pg_get_functiondef(v_function_oid)
  into v_definition;

  if position(
       '''published_version_id'''
       in v_definition
     ) = 0
     or position(
          '''published_version_number'''
          in v_definition
        ) = 0
     or position(
          '''published_version_kind'''
          in v_definition
        ) = 0 then
    raise exception
      'STOP: Published Article version context is incomplete';
  end if;

  v_identity :=
    public.get_article_working_version_identity(
      '6d392db7-8a3f-4343-bdf0-58c314eef227'::uuid
    );

  if v_identity ->> 'working_version_id'
       is distinct from
       '56f84a5b-309e-43bd-a676-883f39410a1b'
     or v_identity ->> 'published_version_id'
       is distinct from
       'b8a9b293-a54b-40d2-bd40-85115a8524ec' then
    raise exception
      'STOP: Acceptance Article version context is incorrect';
  end if;

  v_working :=
    public.get_article_version_trust_workspace(
      (v_identity ->> 'working_version_id')::uuid
    );

  v_published :=
    public.get_article_version_trust_workspace(
      (v_identity ->> 'published_version_id')::uuid
    );

  v_public :=
    public.public_get_article_trust(
      'why-i-keep-postponing-my-hair-appointment'
    );

  if jsonb_array_length(
       coalesce(v_working -> 'credits', '[]'::jsonb)
     ) <> 0
     or (v_working ->> 'credit_revision')::bigint <> 1 then
    raise exception
      'STOP: Working Credit context is not isolated';
  end if;

  if jsonb_array_length(
       coalesce(v_published -> 'credits', '[]'::jsonb)
     ) <> 2
     or (v_published ->> 'credit_revision')::bigint <> 3 then
    raise exception
      'STOP: Published Credit context is incorrect';
  end if;

  if jsonb_array_length(
       coalesce(v_public -> 'credits', '[]'::jsonb)
     ) <> 1 then
    raise exception
      'STOP: Public Credit baseline is incorrect';
  end if;
end;
$verify$;

select
  'PASS: Article trust identity exposes the distinct published version and its governed Credits without changing working trust.'
    as verification_result;
