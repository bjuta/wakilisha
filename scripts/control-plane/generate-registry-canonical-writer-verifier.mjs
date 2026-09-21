import fs from "node:fs";

const manifestPath =
  "scripts/control-plane/registry-privileged-writer-manifest.json";
const verifierPath =
  "scripts/control-plane/verify-registry-canonical-writer-inventory.sql";

function sqlQuote(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function generate(manifest) {
  const signatures = manifest.writers
    .filter(
      (writer) =>
        writer.kind === "database_function" &&
        writer.canonicalMutation === true,
    )
    .map((writer) => writer.entrypoint)
    .sort();

  if (signatures.length === 0) {
    throw new Error("No canonical database-function writers are classified.");
  }

  for (const signature of signatures) {
    if (!/^public\.[a-z0-9_]+\(.+\)$/.test(signature)) {
      throw new Error(
        `Database-function writer entrypoint must be an exact public signature: ${signature}`,
      );
    }
  }

  const values = signatures
    .map((signature) => `      (${sqlQuote(signature)})`)
    .join(",\n");

  return `-- GENERATED FILE. DO NOT EDIT BY HAND.
-- Authority: scripts/control-plane/registry-privileged-writer-manifest.json
-- Generator: scripts/control-plane/generate-registry-canonical-writer-verifier.mjs
--
-- Discovers browser/API-callable public Registry mutation authority from the
-- live catalog, including direct canonical DML, private typed executor bridges,
-- and public wrappers that delegate to another discovered mutator.

do $verify$
declare
  v_unclassified text[];
  v_anonymous text[];
begin
  with recursive
  public_api as (
    select
      p.oid,
      p.proname,
      format('public.%s', p.oid::regprocedure::text) as signature,
      lower(pg_get_functiondef(p.oid)) as definition,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  direct_mutators as (
    select *
    from public_api
    where definition ~
      '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|track_provider_links|labels|genres))'
  ),
  private_executor_bridges as (
    select *
    from public_api
    where definition ~
      '(platform_private[.](execute_registry_[a-z0-9_]+|ensure_registry_[a-z0-9_]+)|mizizi_private[.]execute_[a-z0-9_]+)'
  ),
  dynamic_registry_candidates as (
    select *
    from public_api
    where definition ~ '(^|[^a-z0-9_])execute[[:space:]]'
      and definition ~
        'registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|track_provider_links|labels|genres)'
  ),
  mutation_graph(signature, proname, definition, anon_execute, authenticated_execute) as (
    select signature, proname, definition, anon_execute, authenticated_execute
    from direct_mutators
    union
    select signature, proname, definition, anon_execute, authenticated_execute
    from private_executor_bridges
    union
    select signature, proname, definition, anon_execute, authenticated_execute
    from dynamic_registry_candidates
    union
    select
      caller.signature,
      caller.proname,
      caller.definition,
      caller.anon_execute,
      caller.authenticated_execute
    from public_api caller
    join mutation_graph target
      on caller.signature <> target.signature
     and caller.definition ~ (
       '(^|[^a-z0-9_])'
       || target.proname
       || '[[:space:]]*[(]'
     )
  ),
  live_mutators as (
    select distinct
      signature,
      anon_execute,
      authenticated_execute
    from mutation_graph
  ),
  classified(signature) as (
    values
${values}
  )
  select array_agg(live.signature order by live.signature)
  into v_unclassified
  from live_mutators live
  left join classified accepted
    on accepted.signature = live.signature
  where accepted.signature is null;

  if coalesce(cardinality(v_unclassified), 0) > 0 then
    raise exception
      'STOP: unclassified live canonical Registry writer(s): %',
      array_to_string(v_unclassified, ', ');
  end if;

  with recursive
  public_api as (
    select
      p.oid,
      p.proname,
      format('public.%s', p.oid::regprocedure::text) as signature,
      lower(pg_get_functiondef(p.oid)) as definition,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  direct_mutators as (
    select *
    from public_api
    where definition ~
      '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|track_provider_links|labels|genres))'
  ),
  private_executor_bridges as (
    select *
    from public_api
    where definition ~
      '(platform_private[.](execute_registry_[a-z0-9_]+|ensure_registry_[a-z0-9_]+)|mizizi_private[.]execute_[a-z0-9_]+)'
  ),
  dynamic_registry_candidates as (
    select *
    from public_api
    where definition ~ '(^|[^a-z0-9_])execute[[:space:]]'
      and definition ~
        'registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|track_provider_links|labels|genres)'
  ),
  mutation_graph(signature, proname, definition, anon_execute, authenticated_execute) as (
    select signature, proname, definition, anon_execute, authenticated_execute
    from direct_mutators
    union
    select signature, proname, definition, anon_execute, authenticated_execute
    from private_executor_bridges
    union
    select signature, proname, definition, anon_execute, authenticated_execute
    from dynamic_registry_candidates
    union
    select
      caller.signature,
      caller.proname,
      caller.definition,
      caller.anon_execute,
      caller.authenticated_execute
    from public_api caller
    join mutation_graph target
      on caller.signature <> target.signature
     and caller.definition ~ (
       '(^|[^a-z0-9_])'
       || target.proname
       || '[[:space:]]*[(]'
     )
  )
  select array_agg(signature order by signature)
  into v_anonymous
  from (
    select distinct signature
    from mutation_graph
    where anon_execute
  ) anonymous_mutators;

  if coalesce(cardinality(v_anonymous), 0) > 0 then
    raise exception
      'STOP: anonymous canonical Registry writer(s) remain executable: %',
      array_to_string(v_anonymous, ', ');
  end if;
end
$verify$;


do $verify_closed_table_roads$
declare
  v_table text;
  v_role text;
  v_privilege text;
begin
  foreach v_table in array array[
    'public.registry_artist_aliases',
    'public.registry_track_provider_links',
    'public.registry_relationship_evidence'
  ]
  loop
    foreach v_role in array array[
      'anon',
      'authenticated',
      'service_role'
    ]
    loop
      foreach v_privilege in array array[
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      ]
      loop
        if has_table_privilege(v_role,v_table,v_privilege) then
          raise exception
            'STOP: stale direct Registry table privilege remains: role=% table=% privilege=%',
            v_role,v_table,v_privilege;
        end if;
      end loop;
    end loop;
  end loop;
end
$verify_closed_table_roads$;

select
  'REGISTRY_CANONICAL_WRITER_INVENTORY_PASS'::text as status;
`;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const generated = generate(manifest);

if (process.argv.includes("--check")) {
  if (!fs.existsSync(verifierPath)) {
    throw new Error(`${verifierPath} is missing.`);
  }
  const current = fs.readFileSync(verifierPath, "utf8");
  if (current !== generated) {
    throw new Error(
      `${verifierPath} drifted from ${manifestPath}. Regenerate it with this script.`,
    );
  }
  process.stdout.write("REGISTRY_CANONICAL_WRITER_VERIFIER_GENERATION=PASS\n");
} else {
  fs.writeFileSync(verifierPath, generated);
  process.stdout.write(
    `WROTE ${verifierPath} with ${manifest.writers.filter((writer) => writer.kind === "database_function" && writer.canonicalMutation === true).length} classified database-function writers.\n`,
  );
}
