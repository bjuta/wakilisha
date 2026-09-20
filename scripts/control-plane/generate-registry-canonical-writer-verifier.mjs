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
    .join(",\\n");

  return "-- GENERATED FILE. DO NOT EDIT BY HAND.\n-- Authority: scripts/control-plane/registry-privileged-writer-manifest.json\n-- Generator: scripts/control-plane/generate-registry-canonical-writer-verifier.mjs\n--\n-- Discovers browser/API-callable public Registry mutation authority from the\n-- live catalog, including direct canonical DML, private typed executor bridges,\n-- and public wrappers that delegate to another discovered mutator.\n\ndo $verify$\ndeclare\n  v_unclassified text[];\n  v_anonymous text[];\nbegin\n  with recursive\n  public_api as (\n    select\n      p.oid,\n      p.proname,\n      format('public.%s', p.oid::regprocedure::text) as signature,\n      lower(pg_get_functiondef(p.oid)) as definition,\n      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,\n      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute\n    from pg_proc p\n    join pg_namespace n on n.oid = p.pronamespace\n    where n.nspname = 'public'\n      and p.prokind = 'f'\n      and (\n        has_function_privilege('anon', p.oid, 'EXECUTE')\n        or has_function_privilege('authenticated', p.oid, 'EXECUTE')\n      )\n  ),\n  direct_mutators as (\n    select *\n    from public_api\n    where definition ~\n      '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|labels|genres))'\n  ),\n  private_executor_bridges as (\n    select *\n    from public_api\n    where definition ~\n      '(platform_private[.](execute_registry_[a-z0-9_]+|ensure_registry_[a-z0-9_]+)|mizizi_private[.]execute_[a-z0-9_]+)'\n  ),\n  dynamic_registry_candidates as (\n    select *\n    from public_api\n    where definition ~ '(^|[^a-z0-9_])execute[[:space:]]'\n      and definition ~\n        'registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|labels|genres)'\n  ),\n  mutation_graph(signature, proname, definition, anon_execute, authenticated_execute) as (\n    select signature, proname, definition, anon_execute, authenticated_execute\n    from direct_mutators\n    union\n    select signature, proname, definition, anon_execute, authenticated_execute\n    from private_executor_bridges\n    union\n    select signature, proname, definition, anon_execute, authenticated_execute\n    from dynamic_registry_candidates\n    union\n    select\n      caller.signature,\n      caller.proname,\n      caller.definition,\n      caller.anon_execute,\n      caller.authenticated_execute\n    from public_api caller\n    join mutation_graph target\n      on caller.signature <> target.signature\n     and caller.definition ~ (\n       '(^|[^a-z0-9_])'\n       || target.proname\n       || '[[:space:]]*[(]'\n     )\n  ),\n  live_mutators as (\n    select distinct\n      signature,\n      anon_execute,\n      authenticated_execute\n    from mutation_graph\n  ),\n  classified(signature) as (\n    values\n      ('public.accept_registry_missing_artist_intake(uuid,text)'),\n      ('public.admin_apply_artist_decouple_decision(uuid)'),\n      ('public.admin_apply_chart_artist_resolution_decision(uuid)'),\n      ('public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)'),\n      ('public.admin_archive_registry_music_entity_v1(text,uuid,timestamp with time zone)'),\n      ('public.admin_create_registry_artist_for_decouple(text,text,text,text)'),\n      ('public.admin_create_registry_artist_intake_shell_v1(uuid)'),\n      ('public.admin_create_registry_discography_artist_shell_v1(uuid,text)'),\n      ('public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'),\n      ('public.admin_decouple_registry_artist(uuid,jsonb,text,boolean,uuid)'),\n      ('public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)'),\n      ('public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamp with time zone)'),\n      ('public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)'),\n      ('public.admin_merge_registry_artists(uuid,uuid,text,boolean)'),\n      ('public.admin_patch_registry_release_detail_v1(uuid,text,text,text,date,text,uuid,text,text,text,timestamp with time zone)'),\n      ('public.admin_resolve_chart_artist_alias(text,uuid,text,boolean)'),\n      ('public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'),\n      ('public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)'),\n      ('public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)'),\n      ('public.chart_create_artist_origin_shell_v1(text,text,uuid,uuid)'),\n      ('public.chart_materialize_candidate_registry_v1(uuid,uuid)'),\n      ('public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)'),\n      ('public.community_admin_resolve_artist_claim_existing(uuid,uuid,text,boolean,boolean,boolean,boolean)'),\n      ('public.complete_registry_relationship_review(uuid,text,text,text,text,text,text,text,text,text,text,boolean)'),\n      ('public.create_registry_entity_relationship(text,uuid,text,uuid,text,text,text,date,date,uuid,text,text,jsonb)'),\n      ('public.merge_registry_relationship_duplicate(uuid,uuid,text)'),\n      ('public.normalize_registry_relationship_vocabulary(uuid,text,text,text)'),\n      ('public.resolve_registry_relationship_endpoint(uuid,text,text,uuid,text)'),\n      ('public.resolve_registry_relationship_endpoint_from_alias(uuid,text,text)'),\n      ('public.review_registry_relationship(uuid,text,boolean,text)')\n  )\n  select array_agg(live.signature order by live.signature)\n  into v_unclassified\n  from live_mutators live\n  left join classified accepted\n    on accepted.signature = live.signature\n  where accepted.signature is null;\n\n  if coalesce(cardinality(v_unclassified), 0) > 0 then\n    raise exception\n      'STOP: unclassified live canonical Registry writer(s): %',\n      array_to_string(v_unclassified, ', ');\n  end if;\n\n  with recursive\n  public_api as (\n    select\n      p.oid,\n      p.proname,\n      format('public.%s', p.oid::regprocedure::text) as signature,\n      lower(pg_get_functiondef(p.oid)) as definition,\n      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,\n      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute\n    from pg_proc p\n    join pg_namespace n on n.oid = p.pronamespace\n    where n.nspname = 'public'\n      and p.prokind = 'f'\n      and (\n        has_function_privilege('anon', p.oid, 'EXECUTE')\n        or has_function_privilege('authenticated', p.oid, 'EXECUTE')\n      )\n  ),\n  direct_mutators as (\n    select *\n    from public_api\n    where definition ~\n      '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|labels|genres))'\n  ),\n  private_executor_bridges as (\n    select *\n    from public_api\n    where definition ~\n      '(platform_private[.](execute_registry_[a-z0-9_]+|ensure_registry_[a-z0-9_]+)|mizizi_private[.]execute_[a-z0-9_]+)'\n  ),\n  dynamic_registry_candidates as (\n    select *\n    from public_api\n    where definition ~ '(^|[^a-z0-9_])execute[[:space:]]'\n      and definition ~\n        'registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|labels|genres)'\n  ),\n  mutation_graph(signature, proname, definition, anon_execute, authenticated_execute) as (\n    select signature, proname, definition, anon_execute, authenticated_execute\n    from direct_mutators\n    union\n    select signature, proname, definition, anon_execute, authenticated_execute\n    from private_executor_bridges\n    union\n    select signature, proname, definition, anon_execute, authenticated_execute\n    from dynamic_registry_candidates\n    union\n    select\n      caller.signature,\n      caller.proname,\n      caller.definition,\n      caller.anon_execute,\n      caller.authenticated_execute\n    from public_api caller\n    join mutation_graph target\n      on caller.signature <> target.signature\n     and caller.definition ~ (\n       '(^|[^a-z0-9_])'\n       || target.proname\n       || '[[:space:]]*[(]'\n     )\n  )\n  select array_agg(signature order by signature)\n  into v_anonymous\n  from (\n    select distinct signature\n    from mutation_graph\n    where anon_execute\n  ) anonymous_mutators;\n\n  if coalesce(cardinality(v_anonymous), 0) > 0 then\n    raise exception\n      'STOP: anonymous canonical Registry writer(s) remain executable: %',\n      array_to_string(v_anonymous, ', ');\n  end if;\nend\n$verify$;\n\nselect\n  'REGISTRY_CANONICAL_WRITER_INVENTORY_PASS'::text as status;\n";
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
  process.stdout.write("REGISTRY_CANONICAL_WRITER_VERIFIER_GENERATION=PASS\\n");
} else {
  fs.writeFileSync(verifierPath, generated);
  process.stdout.write(
    `WROTE ${verifierPath} with ${manifest.writers.filter((writer) => writer.kind === "database_function" && writer.canonicalMutation === true).length} classified database-function writers.\\n`,
  );
}
