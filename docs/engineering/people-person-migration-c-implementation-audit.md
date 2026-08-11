# People Migration C implementation audit

Date: 12 August 2026

## Status

Implementation audit only.

No SQL migration is approved by this document.

No frontend implementation is approved by this document.

Migration C begins from merged Migration B main:

`971540104b9d33b8228929fd2b10bf2b1049219e`

Source branch:

`feat/people-person-follow-source-adoption`

Production migration drift is zero at audit time.

## Locked Migration C boundary

Migration C is:

validated Person Follow authority plus reviewed one-source Person adoption.

Migration C owns:

- Person validation inside `public.community_set_follow_state(...)`;
- Person-aware toggle semantics inside `public.community_follow_target(...)`;
- one-Person viewer Follow-state read;
- public Person follower-count read;
- runtime one-source Person provisioning;
- reviewed backfill of currently unlinked account and Registry Author identities.

Migration C does not own:

- Person reconciliation or merge, which closed in Migration B;
- Shared Credit body of work, which closed in Migration B;
- account privacy synchronization, which closed in Migration A;
- external-contributor consent/public-safety synchronization, which closed in Migration A;
- frontend Person pages;
- public follower identity lists;
- public Following lists;
- feed ranking;
- Guide body of work;
- automatic cross-source identity merge.

## Current production Follow state

Current production has:

- 3 total Follow rows;
- 1 Article Follow;
- 2 Artist Follows;
- 0 Person Follows;
- 3 active People;
- 3 public active People.

Migration C therefore starts before any Person Follow state exists.

Existing Article and Artist Follow rows are preservation authority.

## Existing Follow function authority

Current functions remain:

- `public.community_set_follow_state(text,text,text,boolean)`;
- `public.community_follow_target(text,text,text)`;
- `public.community_get_user_follows(uuid)`.

All three are `SECURITY DEFINER`.

The existing generic reader remains self-only and must not be weakened.

The current setter accepts arbitrary non-empty `target_type` and `target_id` text.

That is not sufficient Person authority.

The current toggle checks exact caller-supplied target identity before delegating to the setter.

That is also insufficient for merged Person targets because a merged source Person must be canonicalized to the survivor before current-state lookup.

## Direct table-write boundary

Authenticated and anon have no direct SELECT, INSERT, UPDATE, or DELETE privilege on `public.community_follows`. Migration C does not need a browser-role table-grant contraction. The verifier must pin that absence. Trusted `service_role` table DML remains existing backend authority.

Measured table privilege and integrity authority:

```json
{
  "anon_delete": false,
  "anon_insert": false,
  "anon_select": false,
  "anon_update": false,
  "authenticated_delete": false,
  "authenticated_insert": false,
  "authenticated_select": false,
  "authenticated_update": false,
  "columns": [
    {
      "column_default": "gen_random_uuid()",
      "column_name": "id",
      "data_type": "uuid",
      "is_nullable": "NO"
    },
    {
      "column_default": null,
      "column_name": "user_id",
      "data_type": "uuid",
      "is_nullable": "NO"
    },
    {
      "column_default": null,
      "column_name": "target_type",
      "data_type": "text",
      "is_nullable": "NO"
    },
    {
      "column_default": null,
      "column_name": "target_id",
      "data_type": "text",
      "is_nullable": "NO"
    },
    {
      "column_default": null,
      "column_name": "target_slug",
      "data_type": "text",
      "is_nullable": "YES"
    },
    {
      "column_default": "now()",
      "column_name": "created_at",
      "data_type": "timestamp with time zone",
      "is_nullable": "NO"
    }
  ],
  "constraints": [
    {
      "constraint_name": "community_follows_pkey",
      "constraint_type": "p",
      "definition": "PRIMARY KEY (id)"
    },
    {
      "constraint_name": "community_follows_user_id_fkey",
      "constraint_type": "f",
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    {
      "constraint_name": "community_follows_user_id_target_type_target_id_key",
      "constraint_type": "u",
      "definition": "UNIQUE (user_id, target_type, target_id)"
    }
  ],
  "indexes": [
    {
      "definition": "CREATE UNIQUE INDEX community_follows_pkey ON public.community_follows USING btree (id)",
      "index_name": "community_follows_pkey"
    },
    {
      "definition": "CREATE UNIQUE INDEX community_follows_user_id_target_type_target_id_key ON public.community_follows USING btree (user_id, target_type, target_id)",
      "index_name": "community_follows_user_id_target_type_target_id_key"
    },
    {
      "definition": "CREATE INDEX idx_follows_target ON public.community_follows USING btree (target_type, target_id)",
      "index_name": "idx_follows_target"
    },
    {
      "definition": "CREATE INDEX idx_follows_user ON public.community_follows USING btree (user_id)",
      "index_name": "idx_follows_user"
    }
  ],
  "service_role_delete": true,
  "service_role_insert": true,
  "service_role_select": true,
  "service_role_update": true,
  "table_grants": [
    {
      "grantee": "anon",
      "privilege_type": "REFERENCES"
    },
    {
      "grantee": "anon",
      "privilege_type": "TRIGGER"
    },
    {
      "grantee": "anon",
      "privilege_type": "TRUNCATE"
    },
    {
      "grantee": "authenticated",
      "privilege_type": "REFERENCES"
    },
    {
      "grantee": "authenticated",
      "privilege_type": "TRIGGER"
    },
    {
      "grantee": "authenticated",
      "privilege_type": "TRUNCATE"
    },
    {
      "grantee": "postgres",
      "privilege_type": "DELETE"
    },
    {
      "grantee": "postgres",
      "privilege_type": "INSERT"
    },
    {
      "grantee": "postgres",
      "privilege_type": "REFERENCES"
    },
    {
      "grantee": "postgres",
      "privilege_type": "SELECT"
    },
    {
      "grantee": "postgres",
      "privilege_type": "TRIGGER"
    },
    {
      "grantee": "postgres",
      "privilege_type": "TRUNCATE"
    },
    {
      "grantee": "postgres",
      "privilege_type": "UPDATE"
    },
    {
      "grantee": "service_role",
      "privilege_type": "DELETE"
    },
    {
      "grantee": "service_role",
      "privilege_type": "INSERT"
    },
    {
      "grantee": "service_role",
      "privilege_type": "REFERENCES"
    },
    {
      "grantee": "service_role",
      "privilege_type": "SELECT"
    },
    {
      "grantee": "service_role",
      "privilege_type": "TRIGGER"
    },
    {
      "grantee": "service_role",
      "privilege_type": "TRUNCATE"
    },
    {
      "grantee": "service_role",
      "privilege_type": "UPDATE"
    }
  ]
}
```

## Locked Person Follow normalization contract

For `target_type = 'person'`, Migration C must:

1. parse `target_id` as UUID;
2. resolve merged Person chains to the final active survivor;
3. enforce a strict merge-depth ceiling and reject cycles;
4. require the final Resource typed binding to remain `person`;
5. require final Person state `active`;
6. require final Resource visibility `public`;
7. require final Resource lifecycle `active`;
8. derive the canonical `/people/` path server-side;
9. reject self-follow creation when the viewer has an active account identity link to the final Person;
10. write only the final Person Resource UUID as `target_id`;
11. write only the server-derived canonical Person path/slug metadata.

Caller-supplied Person slug is not authority.

For non-Person target types, existing Follow semantics remain unchanged unless a separately proved defect requires correction.

## Toggle correction

`public.community_follow_target(...)` must not check current Person Follow state against the unresolved caller target.

For Person targets it must canonicalize first, then:

- lock on viewer plus canonical final Person identity;
- read current state against canonical final Person identity;
- call the validated setter using canonical Person identity.

This prevents a merged source Person from behaving like a second Follow target.

## Viewer Follow-state read

Create:

`public.community_get_person_follow_state(uuid)`

Authenticated only.

Input may be any valid Person Resource UUID, including a merged source.

The function resolves to the final active Person and returns only:

- `person_id`;
- `followed`.

It reads only the signed-in viewer's state.

It must not expose another user's Follow state.

## Public follower-count read

Create:

`public.get_public_person_social_summary(uuid)`

Public read.

Input may be a valid public Person Resource UUID.

Merged source identity resolves to the final survivor.

Output contains only:

- `person_id`;
- `follower_count`.

No follower identities are exposed.

No public Following list is exposed.

The self-only generic Follow reader remains unchanged.

## Person resolution authority available from A and B

Measured Person merge/presentation resolver authority:

```json
[
  {
    "acl": [
      "postgres=X/postgres",
      "service_role=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION editorial.assert_person_merge_cycle_integrity()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'editorial'\nAS $function$\ndeclare\n  v_next uuid;\n  v_seen uuid[];\n  v_depth integer;\nbegin\n  if new.person_state <> 'merged' then\n    return null;\n  end if;\n\n  v_next :=\n    new.merged_into_person_resource_id;\n  v_seen :=\n    array[new.resource_id];\n\n  for v_depth in 1..64\n  loop\n    if v_next is null then\n      return null;\n    end if;\n\n    if v_next = any(v_seen) then\n      raise exception\n        'Person merge cycle is not permitted.';\n    end if;\n\n    v_seen :=\n      array_append(\n        v_seen,\n        v_next\n      );\n\n    select\n      case\n        when person.person_state = 'merged'\n          then person.merged_into_person_resource_id\n        else null\n      end\n    into v_next\n    from editorial.people person\n    where person.resource_id =\n          v_next;\n\n    if not found then\n      return null;\n    end if;\n  end loop;\n\n  raise exception\n    'Person merge chain exceeds the supported safety depth.';\nend;\n$function$\n",
    "definition_md5": "3b86e9fb980e496155d2ac1472143a0f",
    "function": "assert_person_merge_cycle_integrity",
    "identity_arguments": "",
    "owner": "postgres",
    "schema": "editorial",
    "security_definer": false
  },
  {
    "acl": [
      "postgres=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION editorial.resolve_person_presentation(p_person_resource_id uuid)\n RETURNS jsonb\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public', 'editorial'\nAS $function$\n  with person as (\n    select\n      row.resource_id,\n      row.preferred_identity_link_id\n    from editorial.people row\n    where row.resource_id = p_person_resource_id\n      and row.person_state = 'active'\n  ),\n  candidates as (\n    select\n      link.id as identity_link_id,\n      case\n        when link.id = person.preferred_identity_link_id\n          then 0\n        else 10\n      end as presentation_order,\n      jsonb_strip_nulls(\n        jsonb_build_object(\n          'identity_kind', 'registry_author',\n          'display_name', author.name,\n          'bio', author.bio,\n          'avatar_url', author.avatar_url,\n          'cover_url', author.cover_url,\n          'location', author.location,\n          'registry_author_slug', author.slug\n        )\n      ) as presentation\n    from person\n    join editorial.person_identity_links link\n      on link.person_resource_id = person.resource_id\n     and link.link_state = 'active'\n     and link.registry_author_id is not null\n    join public.registry_authors author\n      on author.id = link.registry_author_id\n\n    union all\n\n    select\n      link.id,\n      case\n        when link.id = person.preferred_identity_link_id\n          then 0\n        else 20\n      end,\n      jsonb_strip_nulls(\n        jsonb_build_object(\n          'identity_kind', 'user',\n          'display_name',\n            coalesce(\n              nullif(\n                btrim(profile.display_name),\n                ''\n              ),\n              profile.username_normalized\n            ),\n          'bio', profile.bio,\n          'avatar_url', profile.avatar_url,\n          'cover_url', profile.cover_url,\n          'location',\n            nullif(\n              concat_ws(\n                ', ',\n                nullif(\n                  btrim(profile.city),\n                  ''\n                ),\n                nullif(\n                  btrim(profile.country),\n                  ''\n                )\n              ),\n              ''\n            ),\n          'username', profile.username_normalized\n        )\n      )\n    from person\n    join editorial.person_identity_links link\n      on link.person_resource_id = person.resource_id\n     and link.link_state = 'active'\n     and link.user_id is not null\n    join public.user_profiles profile\n      on profile.user_id = link.user_id\n     and profile.status = 'active'\n     and profile.is_public\n     and profile.username_normalized is not null\n\n    union all\n\n    select\n      link.id,\n      case\n        when link.id = person.preferred_identity_link_id\n          then 0\n        else 30\n      end,\n      jsonb_strip_nulls(\n        jsonb_build_object(\n          'identity_kind', 'external_contributor',\n          'display_name', contributor.display_name,\n          'location', contributor.location_text\n        )\n      )\n    from person\n    join editorial.person_identity_links link\n      on link.person_resource_id = person.resource_id\n     and link.link_state = 'active'\n     and link.external_contributor_id is not null\n    join editorial.external_contributors contributor\n      on contributor.id =\n         link.external_contributor_id\n     and contributor.contributor_state = 'active'\n     and contributor.public_safe\n     and contributor.consent_status in (\n       'granted',\n       'not_required'\n     )\n  )\n  select candidate.presentation\n  from candidates candidate\n  order by\n    candidate.presentation_order,\n    candidate.identity_link_id\n  limit 1;\n$function$\n",
    "definition_md5": "0e52a6d8c8f33b78253dca40e2a084f2",
    "function": "resolve_person_presentation",
    "identity_arguments": "p_person_resource_id uuid",
    "owner": "postgres",
    "schema": "editorial",
    "security_definer": true
  },
  {
    "acl": [
      "postgres=X/postgres",
      "anon=X/postgres",
      "authenticated=X/postgres",
      "service_role=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION public.get_public_person(p_slug text)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public', 'editorial'\nAS $function$\ndeclare\n  v_input text;\n  v_path text;\n  v_requested_person_id uuid;\n  v_person_id uuid;\n  v_person editorial.people%rowtype;\n  v_resource editorial.resources%rowtype;\n  v_presentation jsonb;\n  v_canonical_path text;\n  v_public_roles jsonb;\n  v_depth integer := 0;\nbegin\n  v_input :=\n    lower(\n      btrim(\n        coalesce(\n          p_slug,\n          ''\n        )\n      )\n    );\n\n  if v_input = '' then\n    return null;\n  end if;\n\n  if v_input like '/people/%' then\n    v_path :=\n      regexp_replace(\n        v_input,\n        '/+$',\n        ''\n      );\n  else\n    v_input :=\n      trim(\n        both '/'\n        from v_input\n      );\n\n    if v_input = '' then\n      return null;\n    end if;\n\n    v_path :=\n      '/people/' ||\n      v_input;\n  end if;\n\n  select alias.resource_id\n  into v_requested_person_id\n  from editorial.resource_aliases alias\n  join editorial.resources resource\n    on resource.id =\n       alias.resource_id\n   and resource.resource_kind =\n       'person'\n  where alias.path =\n        v_path\n    and alias.retired_at is null\n  order by\n    alias.is_canonical desc,\n    alias.created_at\n  limit 1;\n\n  if not found then\n    return null;\n  end if;\n\n  v_person_id :=\n    v_requested_person_id;\n\n  loop\n    v_depth :=\n      v_depth + 1;\n\n    if v_depth > 8 then\n      return null;\n    end if;\n\n    select person.*\n    into v_person\n    from editorial.people person\n    where person.resource_id =\n          v_person_id;\n\n    if not found then\n      return null;\n    end if;\n\n    exit when\n      v_person.person_state <>\n      'merged';\n\n    if v_person.merged_into_person_resource_id\n         is null\n    then\n      return null;\n    end if;\n\n    v_person_id :=\n      v_person.merged_into_person_resource_id;\n  end loop;\n\n  if v_person.person_state <> 'active' then\n    return null;\n  end if;\n\n  select resource.*\n  into v_resource\n  from editorial.resources resource\n  where resource.id =\n        v_person_id\n    and resource.resource_kind =\n        'person';\n\n  if not found\n     or v_resource.visibility <>\n        'public'\n     or v_resource.lifecycle_state <>\n        'active'\n  then\n    return null;\n  end if;\n\n  v_presentation :=\n    editorial.resolve_person_presentation(\n      v_person_id\n    );\n\n  if v_presentation is null then\n    return null;\n  end if;\n\n  select alias.path\n  into v_canonical_path\n  from editorial.resource_aliases alias\n  where alias.resource_id =\n        v_person_id\n    and alias.is_canonical\n    and alias.retired_at is null;\n\n  if v_canonical_path is null then\n    return null;\n  end if;\n\n  select coalesce(\n    jsonb_agg(\n      jsonb_build_object(\n        'role',\n          role_summary.role_key,\n        'label',\n          role_summary.role_label\n      )\n      order by\n        role_summary.first_display_order,\n        role_summary.role_key\n    ),\n    '[]'::jsonb\n  )\n  into v_public_roles\n  from (\n    select\n      role_item ->> 'role'\n        as role_key,\n      (\n        array_agg(\n          coalesce(\n            nullif(\n              btrim(\n                role_item\n                  ->> 'role_label'\n              ),\n              ''\n            ),\n            role_item ->> 'role'\n          )\n          order by\n            (\n              role_item\n                ->> 'display_order'\n            )::integer,\n            coalesce(\n              nullif(\n                btrim(\n                  role_item\n                    ->> 'role_label'\n                ),\n                ''\n              ),\n              role_item ->> 'role'\n            )\n        )\n      )[1] as role_label,\n      min(\n        (\n          role_item\n            ->> 'display_order'\n        )::integer\n      ) as first_display_order\n    from editorial.list_current_public_person_work(\n      v_person_id\n    ) work\n    cross join lateral\n      jsonb_array_elements(\n        work.roles\n      ) role_item\n    group by\n      role_item ->> 'role'\n  ) role_summary;\n\n  return jsonb_strip_nulls(\n    jsonb_build_object(\n      'person_id',\n        v_person_id,\n      'canonical_path',\n        v_canonical_path,\n      'display_name',\n        v_presentation\n          ->> 'display_name',\n      'bio',\n        v_presentation\n          ->> 'bio',\n      'avatar_url',\n        v_presentation\n          ->> 'avatar_url',\n      'cover_url',\n        v_presentation\n          ->> 'cover_url',\n      'location',\n        v_presentation\n          ->> 'location',\n      'username',\n        v_presentation\n          ->> 'username',\n      'registry_author_slug',\n        v_presentation\n          ->> 'registry_author_slug',\n      'public_roles',\n        v_public_roles,\n      'redirect_to',\n        case\n          when v_requested_person_id\n                 is distinct from\n               v_person_id\n            then v_canonical_path\n          else null\n        end\n    )\n  );\nend;\n$function$\n",
    "definition_md5": "2d1795dc3145ebe9059614f40a91da02",
    "function": "get_public_person",
    "identity_arguments": "p_slug text",
    "owner": "postgres",
    "schema": "public",
    "security_definer": true
  },
  {
    "acl": [
      "postgres=X/postgres",
      "authenticated=X/postgres",
      "service_role=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION public.merge_people(p_source_person_resource_id uuid, p_target_person_resource_id uuid, p_expected_source_identity_revision bigint, p_expected_target_identity_revision bigint, p_reason text, p_idempotency_key text, p_correlation_id uuid DEFAULT NULL::uuid)\n RETURNS TABLE(command_receipt_id uuid, receipt_status text, source_person_resource_id uuid, target_person_resource_id uuid, source_identity_revision bigint, target_identity_revision bigint, merge_event_id uuid, result_payload jsonb, idempotent_replay boolean)\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'\nAS $function$\ndeclare\n  v_actor_id uuid;\n  v_source editorial.people%rowtype;\n  v_target editorial.people%rowtype;\n  v_source_prior_revision bigint;\n  v_target_prior_revision bigint;\n  v_source_user_id uuid;\n  v_target_user_id uuid;\n  v_source_registry_author_id uuid;\n  v_target_registry_author_id uuid;\n  v_begin record;\n  v_read record;\n  v_request jsonb;\n  v_result jsonb;\n  v_correlation_id uuid;\n  v_source_merge_event_id uuid;\n  v_target_merge_event_id uuid;\n  v_target_path text;\n  v_target_slug text;\n  v_link editorial.person_identity_links%rowtype;\n  v_new_link_id uuid;\n  v_follow public.community_follows%rowtype;\n  v_existing_target_follow_id uuid;\n  v_moved_follow_count integer := 0;\n  v_deduplicated_follow_count integer := 0;\nbegin\n  if p_source_person_resource_id is null\n     or p_target_person_resource_id is null\n     or p_source_person_resource_id =\n        p_target_person_resource_id\n     or p_expected_source_identity_revision\n        is null\n     or p_expected_source_identity_revision < 1\n     or p_expected_target_identity_revision\n        is null\n     or p_expected_target_identity_revision < 1\n     or nullif(\n          btrim(\n            coalesce(\n              p_reason,\n              ''\n            )\n          ),\n          ''\n        ) is null\n  then\n    raise exception\n      using\n        errcode = '22023',\n        message =\n          'Distinct source and target People, expected revisions, and reason are required.';\n  end if;\n\n  if coalesce(\n       auth.role(),\n       ''\n     ) <> 'authenticated'\n     or auth.uid() is null\n     or not public.current_user_has_capability(\n       'merge_people_identity'\n     )\n  then\n    raise exception\n      using\n        errcode = '42501',\n        message =\n          'People merge permission is required.';\n  end if;\n\n  v_actor_id :=\n    auth.uid();\n\n  if not exists (\n    select 1\n    from editorial.resources resource\n    where resource.id =\n          p_source_person_resource_id\n  ) then\n    raise exception\n      using\n        errcode = 'P0002',\n        message =\n          'The source Person Resource does not exist.';\n  end if;\n\n  perform person.resource_id\n  from editorial.people person\n  where person.resource_id in (\n    p_source_person_resource_id,\n    p_target_person_resource_id\n  )\n  order by person.resource_id\n  for update;\n\n  select person.*\n  into v_source\n  from editorial.people person\n  where person.resource_id =\n        p_source_person_resource_id;\n\n  select person.*\n  into v_target\n  from editorial.people person\n  where person.resource_id =\n        p_target_person_resource_id;\n\n  v_request :=\n    jsonb_build_object(\n      'source_person_resource_id',\n        p_source_person_resource_id,\n      'target_person_resource_id',\n        p_target_person_resource_id,\n      'expected_source_identity_revision',\n        p_expected_source_identity_revision,\n      'expected_target_identity_revision',\n        p_expected_target_identity_revision,\n      'reason',\n        p_reason,\n      'correlation_id',\n        p_correlation_id\n    );\n\n  select *\n  into v_begin\n  from platform_private.begin_authenticated_resource_command(\n    'person.merge',\n    p_source_person_resource_id,\n    p_idempotency_key,\n    v_request\n  );\n\n  if v_begin.idempotent_replay then\n    select *\n    into v_read\n    from platform_private.read_authenticated_resource_command_result(\n      v_begin.command_receipt_id,\n      true\n    );\n\n    command_receipt_id :=\n      v_read.command_receipt_id;\n    receipt_status :=\n      v_read.receipt_status;\n    source_person_resource_id :=\n      p_source_person_resource_id;\n    target_person_resource_id :=\n      p_target_person_resource_id;\n    source_identity_revision :=\n      nullif(\n        v_read.result_payload\n          ->> 'source_identity_revision',\n        ''\n      )::bigint;\n    target_identity_revision :=\n      nullif(\n        v_read.result_payload\n          ->> 'target_identity_revision',\n        ''\n      )::bigint;\n    merge_event_id :=\n      nullif(\n        v_read.result_payload\n          ->> 'merge_event_id',\n        ''\n      )::uuid;\n    result_payload :=\n      v_read.result_payload;\n    idempotent_replay :=\n      true;\n    return next;\n    return;\n  end if;\n\n  v_correlation_id :=\n    coalesce(\n      p_correlation_id,\n      gen_random_uuid()\n    );\n\n  if v_source.resource_id is null then\n    perform platform_private.reject_resource_command(\n      v_begin.command_receipt_id,\n      'person_merge_source_not_found',\n      'The source Person does not exist.',\n      jsonb_build_object(\n        'source_person_resource_id',\n          p_source_person_resource_id,\n        'target_person_resource_id',\n          p_target_person_resource_id,\n        'source_identity_revision',\n          null,\n        'target_identity_revision',\n          case\n            when v_target.resource_id is null\n              then null\n            else v_target.identity_revision\n          end\n      )\n    );\n\n  elsif v_target.resource_id is null then\n    perform platform_private.reject_resource_command(\n      v_begin.command_receipt_id,\n      'person_merge_target_not_found',\n      'The target Person does not exist.',\n      jsonb_build_object(\n        'source_person_resource_id',\n          p_source_person_resource_id,\n        'target_person_resource_id',\n          p_target_person_resource_id,\n        'source_identity_revision',\n          v_source.identity_revision,\n        'target_identity_revision',\n          null\n      )\n    );\n\n  elsif v_source.person_state <> 'active'\n        or v_target.person_state <> 'active'\n  then\n    perform platform_private.reject_resource_command(\n      v_begin.command_receipt_id,\n      'person_merge_state_invalid',\n      'Both source and target People must be active.',\n      jsonb_build_object(\n        'source_person_resource_id',\n          p_source_person_resource_id,\n        'target_person_resource_id',\n          p_target_person_resource_id,\n        'source_identity_revision',\n          v_source.identity_revision,\n        'target_identity_revision',\n          v_target.identity_revision,\n        'source_person_state',\n          v_source.person_state,\n        'target_person_state',\n          v_target.person_state\n      )\n    );\n\n  elsif v_source.identity_revision <>\n        p_expected_source_identity_revision\n        or v_target.identity_revision <>\n           p_expected_target_identity_revision\n  then\n    perform platform_private.reject_resource_command(\n      v_begin.command_receipt_id,\n      'person_merge_revision_changed',\n      'The source or target Person identity changed before this merge could be applied.',\n      jsonb_build_object(\n        'source_person_resource_id',\n          p_source_person_resource_id,\n        'target_person_resource_id',\n          p_target_person_resource_id,\n        'source_identity_revision',\n          v_source.identity_revision,\n        'target_identity_revision',\n          v_target.identity_revision\n      )\n    );\n\n  else\n    select link.user_id\n    into v_source_user_id\n    from editorial.person_identity_links link\n    where link.person_resource_id =\n          p_source_person_resource_id\n      and link.link_state = 'active'\n      and link.user_id is not null\n    limit 1;\n\n    select link.user_id\n    into v_target_user_id\n    from editorial.person_identity_links link\n    where link.person_resource_id =\n          p_target_person_resource_id\n      and link.link_state = 'active'\n      and link.user_id is not null\n    limit 1;\n\n    select link.registry_author_id\n    into v_source_registry_author_id\n    from editorial.person_identity_links link\n    where link.person_resource_id =\n          p_source_person_resource_id\n      and link.link_state = 'active'\n      and link.registry_author_id is not null\n    limit 1;\n\n    select link.registry_author_id\n    into v_target_registry_author_id\n    from editorial.person_identity_links link\n    where link.person_resource_id =\n          p_target_person_resource_id\n      and link.link_state = 'active'\n      and link.registry_author_id is not null\n    limit 1;\n\n    select alias.path\n    into v_target_path\n    from editorial.resource_aliases alias\n    where alias.resource_id =\n          p_target_person_resource_id\n      and alias.is_canonical\n      and alias.retired_at is null;\n\n    if v_source_user_id is not null\n       and v_target_user_id is not null\n       and v_source_user_id <>\n           v_target_user_id\n    then\n      perform platform_private.reject_resource_command(\n        v_begin.command_receipt_id,\n        'person_merge_account_conflict',\n        'Source and target People have different active account identities.',\n        jsonb_build_object(\n          'source_person_resource_id',\n            p_source_person_resource_id,\n          'target_person_resource_id',\n            p_target_person_resource_id,\n          'source_identity_revision',\n            v_source.identity_revision,\n          'target_identity_revision',\n            v_target.identity_revision\n        )\n      );\n\n    elsif v_source_registry_author_id is not null\n          and v_target_registry_author_id is not null\n          and v_source_registry_author_id <>\n              v_target_registry_author_id\n    then\n      perform platform_private.reject_resource_command(\n        v_begin.command_receipt_id,\n        'person_merge_registry_author_conflict',\n        'Source and target People have different active Registry Author identities.',\n        jsonb_build_object(\n          'source_person_resource_id',\n            p_source_person_resource_id,\n          'target_person_resource_id',\n            p_target_person_resource_id,\n          'source_identity_revision',\n            v_source.identity_revision,\n          'target_identity_revision',\n            v_target.identity_revision\n        )\n      );\n\n    elsif v_target_path is null\n          or v_target_path !~ '^/people/[^/]+$'\n    then\n      perform platform_private.reject_resource_command(\n        v_begin.command_receipt_id,\n        'person_merge_target_route_invalid',\n        'The target Person does not have a valid canonical Person route.',\n        jsonb_build_object(\n          'source_person_resource_id',\n            p_source_person_resource_id,\n          'target_person_resource_id',\n            p_target_person_resource_id,\n          'source_identity_revision',\n            v_source.identity_revision,\n          'target_identity_revision',\n            v_target.identity_revision\n        )\n      );\n\n    else\n      v_target_slug :=\n        split_part(\n          v_target_path,\n          '/',\n          3\n        );\n\n      v_source_prior_revision :=\n        v_source.identity_revision;\n      v_target_prior_revision :=\n        v_target.identity_revision;\n\n      update editorial.people person\n      set\n        preferred_identity_link_id =\n          null,\n        identity_revision =\n          person.identity_revision + 1,\n        updated_by =\n          v_actor_id,\n        updated_at =\n          now()\n      where person.resource_id =\n            p_source_person_resource_id\n      returning person.*\n      into v_source;\n\n      for v_link in\n        select link.*\n        from editorial.person_identity_links link\n        where link.person_resource_id =\n              p_source_person_resource_id\n          and link.link_state = 'active'\n        order by link.id\n        for update\n      loop\n        v_new_link_id :=\n          gen_random_uuid();\n\n        update editorial.person_identity_links link\n        set\n          link_state =\n            'superseded',\n          superseded_by_link_id =\n            v_new_link_id,\n          retired_by =\n            v_actor_id,\n          retired_at =\n            now(),\n          retired_reason =\n            p_reason\n        where link.id =\n              v_link.id;\n\n        insert into editorial.person_identity_links (\n          id,\n          person_resource_id,\n          person_resource_kind,\n          user_id,\n          registry_author_id,\n          external_contributor_id,\n          link_state,\n          link_method,\n          link_reason,\n          supersedes_link_id,\n          created_by\n        )\n        values (\n          v_new_link_id,\n          p_target_person_resource_id,\n          'person',\n          v_link.user_id,\n          v_link.registry_author_id,\n          v_link.external_contributor_id,\n          'active',\n          'person_merge',\n          p_reason,\n          v_link.id,\n          v_actor_id\n        );\n      end loop;\n\n      update editorial.people person\n      set\n        identity_revision =\n          person.identity_revision + 1,\n        updated_by =\n          v_actor_id,\n        updated_at =\n          now()\n      where person.resource_id =\n            p_target_person_resource_id\n      returning person.*\n      into v_target;\n\n      v_source_merge_event_id :=\n        gen_random_uuid();\n      v_target_merge_event_id :=\n        gen_random_uuid();\n\n      insert into editorial.person_identity_events (\n        id,\n        person_resource_id,\n        actor_id,\n        event_type,\n        related_person_resource_id,\n        prior_identity_revision,\n        resulting_identity_revision,\n        reason,\n        correlation_id\n      )\n      values\n        (\n          v_source_merge_event_id,\n          p_source_person_resource_id,\n          v_actor_id,\n          'person_merged',\n          p_target_person_resource_id,\n          v_source_prior_revision,\n          v_source.identity_revision,\n          p_reason,\n          v_correlation_id\n        ),\n        (\n          v_target_merge_event_id,\n          p_target_person_resource_id,\n          v_actor_id,\n          'person_merged',\n          p_source_person_resource_id,\n          v_target_prior_revision,\n          v_target.identity_revision,\n          p_reason,\n          v_correlation_id\n        );\n\n      for v_follow in\n        select follow_row.*\n        from public.community_follows follow_row\n        where follow_row.target_type =\n              'person'\n          and follow_row.target_id =\n              p_source_person_resource_id::text\n        order by follow_row.id\n        for update\n      loop\n        v_existing_target_follow_id :=\n          null;\n\n        select target_follow.id\n        into v_existing_target_follow_id\n        from public.community_follows target_follow\n        where target_follow.user_id =\n              v_follow.user_id\n          and target_follow.target_type =\n              'person'\n          and target_follow.target_id =\n              p_target_person_resource_id::text\n        for update;\n\n        if v_existing_target_follow_id is not null then\n          insert into editorial.person_follow_merge_transfers (\n            merge_event_id,\n            user_id,\n            source_person_resource_id,\n            target_person_resource_id,\n            source_follow_id,\n            target_follow_id,\n            transfer_mode,\n            source_follow_created_at,\n            target_follow_preexisted\n          )\n          values (\n            v_source_merge_event_id,\n            v_follow.user_id,\n            p_source_person_resource_id,\n            p_target_person_resource_id,\n            v_follow.id,\n            v_existing_target_follow_id,\n            'deduplicated',\n            v_follow.created_at,\n            true\n          );\n\n          delete from public.community_follows follow_row\n          where follow_row.id =\n                v_follow.id;\n\n          v_deduplicated_follow_count :=\n            v_deduplicated_follow_count + 1;\n\n        else\n          begin\n            update public.community_follows follow_row\n            set\n              target_id =\n                p_target_person_resource_id::text,\n              target_slug =\n                v_target_slug\n            where follow_row.id =\n                  v_follow.id;\n\n            insert into editorial.person_follow_merge_transfers (\n              merge_event_id,\n              user_id,\n              source_person_resource_id,\n              target_person_resource_id,\n              source_follow_id,\n              target_follow_id,\n              transfer_mode,\n              source_follow_created_at,\n              target_follow_preexisted\n            )\n            values (\n              v_source_merge_event_id,\n              v_follow.user_id,\n              p_source_person_resource_id,\n              p_target_person_resource_id,\n              v_follow.id,\n              v_follow.id,\n              'moved',\n              v_follow.created_at,\n              false\n            );\n\n            v_moved_follow_count :=\n              v_moved_follow_count + 1;\n\n          exception\n            when unique_violation then\n              select target_follow.id\n              into v_existing_target_follow_id\n              from public.community_follows target_follow\n              where target_follow.user_id =\n                    v_follow.user_id\n                and target_follow.target_type =\n                    'person'\n                and target_follow.target_id =\n                    p_target_person_resource_id::text\n              for update;\n\n              if v_existing_target_follow_id is null then\n                raise;\n              end if;\n\n              insert into editorial.person_follow_merge_transfers (\n                merge_event_id,\n                user_id,\n                source_person_resource_id,\n                target_person_resource_id,\n                source_follow_id,\n                target_follow_id,\n                transfer_mode,\n                source_follow_created_at,\n                target_follow_preexisted\n              )\n              values (\n                v_source_merge_event_id,\n                v_follow.user_id,\n                p_source_person_resource_id,\n                p_target_person_resource_id,\n                v_follow.id,\n                v_existing_target_follow_id,\n                'deduplicated',\n                v_follow.created_at,\n                true\n              );\n\n              delete from public.community_follows follow_row\n              where follow_row.id =\n                    v_follow.id;\n\n              v_deduplicated_follow_count :=\n                v_deduplicated_follow_count + 1;\n          end;\n        end if;\n      end loop;\n\n      update editorial.people person\n      set\n        person_state =\n          'merged',\n        merged_into_person_resource_id =\n          p_target_person_resource_id,\n        updated_by =\n          v_actor_id,\n        updated_at =\n          now()\n      where person.resource_id =\n            p_source_person_resource_id\n      returning person.*\n      into v_source;\n\n      perform editorial.refresh_person_visibility(\n        p_source_person_resource_id\n      );\n\n      perform editorial.refresh_person_visibility(\n        p_target_person_resource_id\n      );\n\n      v_result :=\n        jsonb_build_object(\n          'source_person_resource_id',\n            p_source_person_resource_id,\n          'target_person_resource_id',\n            p_target_person_resource_id,\n          'source_identity_revision',\n            v_source.identity_revision,\n          'target_identity_revision',\n            v_target.identity_revision,\n          'merge_event_id',\n            v_source_merge_event_id,\n          'moved_follow_count',\n            v_moved_follow_count,\n          'deduplicated_follow_count',\n            v_deduplicated_follow_count,\n          'changed',\n            true,\n          'correlation_id',\n            v_correlation_id\n        );\n\n      perform platform_private.complete_resource_command(\n        v_begin.command_receipt_id,\n        v_result\n      );\n    end if;\n  end if;\n\n  select *\n  into v_read\n  from platform_private.read_authenticated_resource_command_result(\n    v_begin.command_receipt_id,\n    false\n  );\n\n  command_receipt_id :=\n    v_read.command_receipt_id;\n  receipt_status :=\n    v_read.receipt_status;\n  source_person_resource_id :=\n    p_source_person_resource_id;\n  target_person_resource_id :=\n    p_target_person_resource_id;\n  source_identity_revision :=\n    nullif(\n      v_read.result_payload\n        ->> 'source_identity_revision',\n      ''\n    )::bigint;\n  target_identity_revision :=\n    nullif(\n      v_read.result_payload\n        ->> 'target_identity_revision',\n      ''\n    )::bigint;\n  merge_event_id :=\n    nullif(\n      v_read.result_payload\n        ->> 'merge_event_id',\n      ''\n    )::uuid;\n  result_payload :=\n    v_read.result_payload;\n  idempotent_replay :=\n    false;\n  return next;\nend;\n$function$\n",
    "definition_md5": "d03c2c1149cef626b9211fd2bbd39893",
    "function": "merge_people",
    "identity_arguments": "p_source_person_resource_id uuid, p_target_person_resource_id uuid, p_expected_source_identity_revision bigint, p_expected_target_identity_revision bigint, p_reason text, p_idempotency_key text, p_correlation_id uuid",
    "owner": "postgres",
    "schema": "public",
    "security_definer": true
  }
]
```

Migration C should reuse existing Person state, merge pointer, Resource visibility, and canonical alias authority rather than inventing a second Person identity system.

## Existing Person provisioning authority

The three one-source helpers already exist:

- `editorial.ensure_person_for_user(uuid)`;
- `editorial.ensure_person_for_registry_author(uuid)`;
- `editorial.ensure_person_for_external_contributor(uuid)`.

They are exact-source idempotent provisioning helpers.

They do not perform email, name, social-link, or other cross-source auto-merge.

Measured helper authority:

```json
[
  {
    "acl": [
      "postgres=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION editorial.create_person_for_identity(p_user_id uuid, p_registry_author_id uuid, p_external_contributor_id uuid, p_link_method text, p_link_reason text)\n RETURNS uuid\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'auth', 'public', 'editorial'\nAS $function$\ndeclare\n  v_person_resource_id uuid;\n  v_existing_person_resource_id uuid;\n  v_identity_link_id uuid;\n  v_seed text;\n  v_owner_id uuid;\n  v_actor_id uuid := auth.uid();\n  v_path text;\nbegin\n  if num_nonnulls(\n       p_user_id,\n       p_registry_author_id,\n       p_external_contributor_id\n     ) <> 1\n  then\n    raise exception\n      'Exactly one Person source identity is required.';\n  end if;\n\n  if p_link_method not in (\n    'migration_seed',\n    'account_provisioning',\n    'registry_author_provisioning',\n    'external_contributor_provisioning',\n    'admin_reconciliation',\n    'claim_approved',\n    'person_merge',\n    'person_split'\n  ) then\n    raise exception\n      'Unsupported Person identity link method.';\n  end if;\n\n  if nullif(\n       btrim(\n         coalesce(\n           p_link_reason,\n           ''\n         )\n       ),\n       ''\n     ) is null\n  then\n    raise exception\n      'Person identity link reason is required.';\n  end if;\n\n  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(\n      case\n        when p_user_id is not null\n          then 'person-source|user|' || p_user_id::text\n        when p_registry_author_id is not null\n          then 'person-source|registry-author|' || p_registry_author_id::text\n        else 'person-source|external-contributor|' || p_external_contributor_id::text\n      end,\n      0\n    )\n  );\n\n  if p_user_id is not null then\n    select link.person_resource_id\n    into v_existing_person_resource_id\n    from editorial.person_identity_links link\n    where link.user_id = p_user_id\n      and link.link_state = 'active';\n\n    if found then\n      return v_existing_person_resource_id;\n    end if;\n\n    select\n      coalesce(\n        profile.username_normalized,\n        profile.display_name\n      ),\n      profile.user_id\n    into\n      v_seed,\n      v_owner_id\n    from public.user_profiles profile\n    where profile.user_id = p_user_id;\n\n    if not found then\n      raise exception\n        'WAKILISHA account profile does not exist.';\n    end if;\n\n  elsif p_registry_author_id is not null then\n    select link.person_resource_id\n    into v_existing_person_resource_id\n    from editorial.person_identity_links link\n    where link.registry_author_id =\n          p_registry_author_id\n      and link.link_state = 'active';\n\n    if found then\n      return v_existing_person_resource_id;\n    end if;\n\n    select author.slug\n    into v_seed\n    from public.registry_authors author\n    where author.id =\n          p_registry_author_id;\n\n    if not found then\n      raise exception\n        'Registry Author does not exist.';\n    end if;\n\n  else\n    select link.person_resource_id\n    into v_existing_person_resource_id\n    from editorial.person_identity_links link\n    where link.external_contributor_id =\n          p_external_contributor_id\n      and link.link_state = 'active';\n\n    if found then\n      return v_existing_person_resource_id;\n    end if;\n\n    select contributor.display_name\n    into v_seed\n    from editorial.external_contributors contributor\n    where contributor.id =\n          p_external_contributor_id;\n\n    if not found then\n      raise exception\n        'External contributor does not exist.';\n    end if;\n  end if;\n\n  perform pg_catalog.pg_advisory_xact_lock(\n    pg_catalog.hashtextextended(\n      'person-path|'\n      || coalesce(\n           editorial.normalize_person_slug(v_seed),\n           'person'\n         ),\n      0\n    )\n  );\n\n  v_person_resource_id := gen_random_uuid();\n\n  insert into editorial.resources (\n    id,\n    resource_kind,\n    owner_id,\n    visibility,\n    lifecycle_state,\n    created_by\n  )\n  values (\n    v_person_resource_id,\n    'person',\n    v_owner_id,\n    'internal',\n    'active',\n    v_actor_id\n  );\n\n  insert into editorial.people (\n    resource_id,\n    resource_kind,\n    person_state,\n    identity_revision,\n    created_by,\n    updated_by\n  )\n  values (\n    v_person_resource_id,\n    'person',\n    'active',\n    1,\n    v_actor_id,\n    v_actor_id\n  );\n\n  v_identity_link_id := gen_random_uuid();\n\n  insert into editorial.person_identity_links (\n    id,\n    person_resource_id,\n    person_resource_kind,\n    user_id,\n    registry_author_id,\n    external_contributor_id,\n    link_state,\n    link_method,\n    link_reason,\n    created_by\n  )\n  values (\n    v_identity_link_id,\n    v_person_resource_id,\n    'person',\n    p_user_id,\n    p_registry_author_id,\n    p_external_contributor_id,\n    'active',\n    p_link_method,\n    p_link_reason,\n    v_actor_id\n  );\n\n  update editorial.people\n  set\n    preferred_identity_link_id =\n      v_identity_link_id,\n    updated_by = v_actor_id,\n    updated_at = now()\n  where resource_id =\n        v_person_resource_id;\n\n  v_path :=\n    editorial.allocate_person_path(\n      v_seed,\n      v_person_resource_id\n    );\n\n  insert into editorial.resource_aliases (\n    resource_id,\n    path,\n    is_canonical,\n    created_by\n  )\n  values (\n    v_person_resource_id,\n    v_path,\n    true,\n    v_actor_id\n  );\n\n  insert into editorial.person_identity_events (\n    person_resource_id,\n    actor_id,\n    event_type,\n    identity_link_id,\n    prior_identity_revision,\n    resulting_identity_revision,\n    reason\n  )\n  values (\n    v_person_resource_id,\n    v_actor_id,\n    'person_created',\n    v_identity_link_id,\n    null,\n    1,\n    p_link_reason\n  );\n\n  perform editorial.refresh_person_visibility(\n    v_person_resource_id\n  );\n\n  return v_person_resource_id;\nend;\n$function$\n",
    "definition_md5": "bf6d5fb461acc2d72f21f7d5e73694e8",
    "function": "create_person_for_identity",
    "identity_arguments": "p_user_id uuid, p_registry_author_id uuid, p_external_contributor_id uuid, p_link_method text, p_link_reason text",
    "owner": "postgres",
    "schema": "editorial",
    "security_definer": true
  },
  {
    "acl": [
      "postgres=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION editorial.ensure_person_for_external_contributor(p_external_contributor_id uuid)\n RETURNS uuid\n LANGUAGE sql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'editorial'\nAS $function$\n  select editorial.create_person_for_identity(\n    null,\n    null,\n    p_external_contributor_id,\n    'external_contributor_provisioning',\n    'One-source Person provisioning for an existing external contributor.'\n  );\n$function$\n",
    "definition_md5": "fb5247fed7e7469e59128d5b5243b08c",
    "function": "ensure_person_for_external_contributor",
    "identity_arguments": "p_external_contributor_id uuid",
    "owner": "postgres",
    "schema": "editorial",
    "security_definer": true
  },
  {
    "acl": [
      "postgres=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION editorial.ensure_person_for_registry_author(p_registry_author_id uuid)\n RETURNS uuid\n LANGUAGE sql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'editorial'\nAS $function$\n  select editorial.create_person_for_identity(\n    null,\n    p_registry_author_id,\n    null,\n    'registry_author_provisioning',\n    'One-source Person provisioning for an existing Registry Author.'\n  );\n$function$\n",
    "definition_md5": "373ddf7e46ddc165937bb710881578f9",
    "function": "ensure_person_for_registry_author",
    "identity_arguments": "p_registry_author_id uuid",
    "owner": "postgres",
    "schema": "editorial",
    "security_definer": true
  },
  {
    "acl": [
      "postgres=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION editorial.ensure_person_for_user(p_user_id uuid)\n RETURNS uuid\n LANGUAGE sql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'editorial'\nAS $function$\n  select editorial.create_person_for_identity(\n    p_user_id,\n    null,\n    null,\n    'account_provisioning',\n    'One-source Person provisioning for an existing WAKILISHA account profile.'\n  );\n$function$\n",
    "definition_md5": "10d6cd20eec1b5a42e38f64fbdef3a87",
    "function": "ensure_person_for_user",
    "identity_arguments": "p_user_id uuid",
    "owner": "postgres",
    "schema": "editorial",
    "security_definer": true
  },
  {
    "acl": [
      "postgres=X/postgres"
    ],
    "definition": "CREATE OR REPLACE FUNCTION editorial.refresh_person_visibility(p_person_resource_id uuid)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public', 'editorial'\nAS $function$\ndeclare\n  v_person editorial.people%rowtype;\n  v_public_eligible boolean := false;\n  v_owner_id uuid;\n  v_visibility text;\n  v_lifecycle text;\nbegin\n  select person.*\n  into v_person\n  from editorial.people person\n  where person.resource_id =\n        p_person_resource_id;\n\n  if not found then\n    return;\n  end if;\n\n  select link.user_id\n  into v_owner_id\n  from editorial.person_identity_links link\n  where link.person_resource_id =\n        p_person_resource_id\n    and link.link_state = 'active'\n    and link.user_id is not null\n  limit 1;\n\n  if v_person.person_state = 'active' then\n    select exists (\n      select 1\n      from editorial.person_identity_links link\n      join public.user_profiles profile\n        on profile.user_id = link.user_id\n      where link.person_resource_id =\n            p_person_resource_id\n        and link.link_state = 'active'\n        and link.user_id is not null\n        and profile.status = 'active'\n        and profile.is_public\n\n      union all\n\n      select 1\n      from editorial.person_identity_links link\n      join public.registry_authors author\n        on author.id =\n           link.registry_author_id\n      where link.person_resource_id =\n            p_person_resource_id\n        and link.link_state = 'active'\n        and link.registry_author_id is not null\n\n      union all\n\n      select 1\n      from editorial.person_identity_links link\n      join editorial.external_contributors contributor\n        on contributor.id =\n           link.external_contributor_id\n      where link.person_resource_id =\n            p_person_resource_id\n        and link.link_state = 'active'\n        and link.external_contributor_id is not null\n        and contributor.contributor_state = 'active'\n        and contributor.public_safe\n        and contributor.consent_status in (\n          'granted',\n          'not_required'\n        )\n    )\n    into v_public_eligible;\n  end if;\n\n  if v_person.person_state = 'archived' then\n    v_visibility := 'internal';\n    v_lifecycle := 'archived';\n  elsif v_person.person_state = 'merged' then\n    v_visibility := 'internal';\n    v_lifecycle := 'active';\n  else\n    v_visibility :=\n      case\n        when v_public_eligible then 'public'\n        else 'internal'\n      end;\n    v_lifecycle := 'active';\n  end if;\n\n  update editorial.resources resource\n  set\n    owner_id = v_owner_id,\n    visibility = v_visibility,\n    lifecycle_state = v_lifecycle,\n    updated_at = now()\n  where resource.id =\n        p_person_resource_id\n    and resource.resource_kind = 'person'\n    and (\n      resource.owner_id\n        is distinct from v_owner_id\n      or resource.visibility\n        is distinct from v_visibility\n      or resource.lifecycle_state\n        is distinct from v_lifecycle\n    );\nend;\n$function$\n",
    "definition_md5": "d77a67601538ee01a5c081f70022e987",
    "function": "refresh_person_visibility",
    "identity_arguments": "p_person_resource_id uuid",
    "owner": "postgres",
    "schema": "editorial",
    "security_definer": true
  }
]
```

Migration C may expand runtime execution only to the narrow role/path required for reviewed source provisioning.

Authenticated browser callers must not receive arbitrary direct execution over private Person creation helpers.

## Existing visibility synchronization

Migration A already owns:

- account `status` and `is_public` visibility synchronization;
- external-contributor `contributor_state`, `public_safe`, and `consent_status` synchronization;
- identity-link state visibility synchronization.

Migration C must not replace or duplicate those triggers.

## Runtime account provisioning

`public.community_ensure_user_account(uuid)` is the accepted account creation/hydration entrypoint.

Migration C must integrate exact-source Person provisioning into that path after the canonical `public.user_profiles` row exists.

The operation must remain idempotent.

The existing caller authorization boundary must remain unchanged.

A backend/editor account and a subscriber account use the same Person identity rules.

## Registry Author and external-contributor runtime provisioning

Measured source INSERT triggers and database write routines:

```json
{
  "database_write_routines": [
    {
      "definition_md5": "00a33485c7ffa429bbf45bd1233950a3",
      "function": "assign_user_role_admin",
      "identity_arguments": "target_user_id uuid, target_role_key text, target_display_name text, target_bio text, assignment_notes text",
      "schema": "public"
    },
    {
      "definition_md5": "f1453e49ee07720c0df556e330274d5e",
      "function": "community_ensure_user_account",
      "identity_arguments": "p_user_id uuid",
      "schema": "public"
    },
    {
      "definition_md5": "1ab6e7df451feb17dfb069bdea0ed3eb",
      "function": "create_external_contributor",
      "identity_arguments": "p_display_name text, p_public_role text, p_public_url text, p_location_text text, p_contact_email text, p_contact_phone text, p_consent_status text, p_public_safe boolean, p_internal_notes text",
      "schema": "public"
    },
    {
      "definition_md5": "2169443d6f0be22d5604aed4c22387c8",
      "function": "handle_new_auth_user_profile",
      "identity_arguments": "",
      "schema": "public"
    }
  ],
  "insert_triggers": []
}
```

Migration C must use the narrowest database-level integration that guarantees a newly created Registry Author or external contributor can receive exactly one source-specific Person without cross-source reconciliation.

Any new automatic hook must call the existing idempotent `ensure_person_for_*` helper.

## Reviewed current source-adoption population

Measured backfill quality:

```json
{
  "accounts": {
    "blank_display_name_count": 0,
    "blank_username_count": 6,
    "blank_username_normalized_count": 6,
    "missing_effective_person_seed_count": 0,
    "non_public_or_inactive_count": 0,
    "unlinked_count": 10
  },
  "external_contributors": {
    "unlinked_count": 0,
    "unlinked_public_eligible_count": 0
  },
  "registry_authors": {
    "blank_name_count": 0,
    "blank_slug_count": 0,
    "unlinked_count": 12
  }
}
```

The reviewed current adoption set is therefore:

- 10 unlinked account profiles;
- 12 unlinked Registry Authors;
- 0 unlinked external contributors.

All 10 account profiles are currently active/public in the preceding production audit.

Some reviewed accounts may have a blank legacy `username`.

That is not a Person-provisioning blocker.

Migration A's existing creation helper seeds account Person paths from:

`coalesce(user_profiles.username_normalized, user_profiles.display_name)`

after trimming/normalization.

The reviewed adoption set must have zero rows with no effective seed under that
authority.

No reviewed account has a blank display name.

No reviewed Registry Author has a blank slug.

Migration C may provision one Person per exact currently unlinked source identity.

It must not infer that an account and Registry Author represent the same human merely because names, email, or other metadata appear related.

Any later cross-source reconciliation remains a governed Migration B command decision.

## Backfill semantics

Backfill must:

- call existing idempotent `ensure_person_for_*` helpers;
- create one Person for each exact unlinked source identity;
- preserve already linked source identities;
- create no Person Follow rows;
- preserve existing Article and Artist Follow rows;
- preserve all historical Credits;
- preserve current Person identity links;
- allow canonical path collision handling to use the existing deterministic Person alias authority.

The migration must verify the exact reviewed population before and after backfill.

If the live population changes before apply, stop and re-audit rather than silently adopting a different set.

## Grants and privacy

Migration C must keep:

- anonymous Person Follow writes closed;
- `community_get_person_follow_state` authenticated only;
- `community_get_user_follows` authenticated and self-only;
- Person creation helpers unavailable to arbitrary authenticated browser callers;
- public social summary limited to aggregate follower count.

Service-role authority may be widened only where required for exact-source runtime provisioning.

## Durable verification contract

The Migration C verifier must prove at minimum:

- valid public Person Follow succeeds;
- malformed Person UUID fails;
- arbitrary non-Person Resource UUID under `target_type = 'person'` fails;
- archived Person follow creation fails;
- internal/private Person follow creation fails;
- self-follow creation fails;
- merged Person target writes the survivor UUID;
- merged Person toggle reads survivor state before toggling;
- unfollow succeeds;
- viewer state returns only signed-in viewer state;
- public social summary returns count only;
- existing Artist Follow behavior remains intact;
- existing Article Follow state remains intact;
- generic self-only Follow reader still rejects another user's id;
- direct authenticated table writes cannot bypass Person validation;
- one-source provisioning is idempotent;
- account runtime provisioning creates/reuses exactly one Person;
- reviewed 10-account adoption completes;
- reviewed 12-Registry-Author adoption completes;
- external-contributor backfill remains zero for the current reviewed population;
- no automatic cross-source merge occurs;
- no historical Credit mutation occurs;
- no pre-existing Follow row is lost or retargeted except explicit Person merge history already handled by Migration B.

Verifier fixtures must be rollback-only.

## Production apply boundary

Before production apply:

- exact Migration C SQL hash is pinned;
- exact verifier hash is pinned;
- current production source-adoption counts must still match the reviewed population;
- current Follow counts and non-Person Follow rows are snapshotted;
- current generic Follow reader definition is snapshotted;
- production migration drift must show only Migration C pending.

After production apply:

- durable verifier must pass on production;
- live valid Person Follow/unfollow proof must be rollback-safe or use an explicitly governed proof account;
- existing Artist Follow behavior must remain accepted;
- existing generic reader must remain self-only;
- source-adoption counts and new Person/link counts must reconcile exactly;
- production migration drift must return to zero.

## Frontend boundary

No frontend source change is authorized in Migration C.

Frontend Person Follow UI begins only after database Migration C acceptance.

## Conclusion

The Migration C SQL may now be written only against this measured authority.

The permanent rule remains:

Follow a person, not a role.

Person Follow must target the final active public Person Resource.

Source adoption is exact-source provisioning, not automatic human reconciliation.
