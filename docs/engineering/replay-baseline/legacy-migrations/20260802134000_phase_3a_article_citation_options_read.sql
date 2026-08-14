begin;

do $preflight$
begin
  if to_regclass(
       'editorial.citation_locator_types'
     ) is null then
    raise exception
      'STOP: Citation locator vocabulary is unavailable';
  end if;

  if to_regprocedure(
       'public.current_user_is_administrator()'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null then
    raise exception
      'STOP: Citation option authorization helpers are unavailable';
  end if;
end;
$preflight$;

create or replace function
  public.get_article_trust_citation_intake_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_locator_types jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and auth.uid() is null then
    raise exception
      'Not authenticated';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and not (
       coalesce(
         public.current_user_is_administrator(),
         false
       )
       or coalesce(
         public.current_user_has_capability(
           'manage_citations'
         ),
         false
       )
       or coalesce(
         public.current_user_has_capability(
           'view_trust_records'
         ),
         false
       )
     ) then
    raise exception
      'You do not have permission to read Citation intake options';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'locator_type',
          locator_type.locator_type,
        'label',
          locator_type.label,
        'description',
          locator_type.description,
        'sort_order',
          locator_type.sort_order
      )
      order by
        locator_type.sort_order,
        locator_type.locator_type
    ),
    '[]'::jsonb
  )
  into v_locator_types
  from editorial.citation_locator_types
    locator_type
  where locator_type.enabled;

  return jsonb_build_object(
    'locator_types',
      v_locator_types,
    'citation_purposes',
      jsonb_build_array(
        jsonb_build_object(
          'value', 'supports',
          'label', 'Supports',
          'description',
            'The Citation supports an Article claim or passage.',
          'sort_order', 10
        ),
        jsonb_build_object(
          'value', 'challenges',
          'label', 'Challenges',
          'description',
            'The Citation challenges an Article claim or passage.',
          'sort_order', 20
        ),
        jsonb_build_object(
          'value', 'contextualizes',
          'label', 'Contextualizes',
          'description',
            'The Citation adds relevant context.',
          'sort_order', 30
        ),
        jsonb_build_object(
          'value', 'quotes',
          'label', 'Quotes',
          'description',
            'The Article directly quotes this Citation.',
          'sort_order', 40
        ),
        jsonb_build_object(
          'value', 'documents',
          'label', 'Documents',
          'description',
            'The Citation documents an event, record, or fact.',
          'sort_order', 50
        ),
        jsonb_build_object(
          'value', 'methodology',
          'label', 'Methodology',
          'description',
            'The Citation records a research or editorial method.',
          'sort_order', 60
        ),
        jsonb_build_object(
          'value', 'other',
          'label', 'Other',
          'description',
            'Another reviewed Citation purpose.',
          'sort_order', 1000
        )
      ),
    'target_anchor_types',
      jsonb_build_array(
        jsonb_build_object(
          'value', 'whole_version',
          'label', 'Whole Article version',
          'description',
            'The Citation applies to the complete Article version.',
          'sort_order', 10
        ),
        jsonb_build_object(
          'value', 'block_id',
          'label', 'Block',
          'description',
            'The Citation applies to one Article block identifier.',
          'sort_order', 20
        ),
        jsonb_build_object(
          'value', 'heading_id',
          'label', 'Heading',
          'description',
            'The Citation applies to one heading identifier.',
          'sort_order', 30
        ),
        jsonb_build_object(
          'value', 'paragraph_id',
          'label', 'Paragraph',
          'description',
            'The Citation applies to one paragraph identifier.',
          'sort_order', 40
        ),
        jsonb_build_object(
          'value', 'character_range',
          'label', 'Character range',
          'description',
            'The Citation applies to a bounded character range.',
          'sort_order', 50
        ),
        jsonb_build_object(
          'value', 'structured_node',
          'label', 'Structured node',
          'description',
            'The Citation applies to one structured content node.',
          'sort_order', 60
        )
      )
  );
end;
$function$;

revoke all
on function
  public.get_article_trust_citation_intake_options()
from public, anon, authenticated;

grant execute
on function
  public.get_article_trust_citation_intake_options()
to authenticated, service_role;

comment on function
  public.get_article_trust_citation_intake_options()
is
  'Returns authorized Citation locator, purpose, and Article anchor vocabularies for governed Article Citation intake.';

commit;
