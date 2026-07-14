begin;

revoke execute on function public.create_import_run(text, text, jsonb, text, jsonb, text[], text[])
  from public, anon, authenticated;
grant execute on function public.create_import_run(text, text, jsonb, text, jsonb, text[], text[])
  to service_role;

revoke execute on function public.update_import_run(uuid, text, text[], timestamptz, jsonb, text[])
  from public, anon, authenticated;
grant execute on function public.update_import_run(uuid, text, text[], timestamptz, jsonb, text[])
  to service_role;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
) values
  (
    'create_import_run(text,text,jsonb,text,jsonb,text[],text[])',
    'service_command',
    'Import-run mutation has no end-user actor contract and is restricted to trusted server execution.'
  ),
  (
    'update_import_run(uuid,text,text[],timestamp with time zone,jsonb,text[])',
    'service_command',
    'Import-run mutation has no end-user actor contract and is restricted to trusted server execution.'
  )
on conflict (function_signature) do update
  set access_class = excluded.access_class,
      rationale = excluded.rationale,
      reviewed_at = now();

commit;
