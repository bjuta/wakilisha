begin;

do $preflight$
begin
  if to_regclass(
       'editorial.source_types'
     ) is null
     or to_regclass(
       'editorial.sources'
     ) is null then
    raise exception
      'STOP: Source identity foundation is incomplete';
  end if;

  if to_regprocedure(
       'public.current_user_is_administrator()'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null then
    raise exception
      'STOP: Source read authorization helpers are unavailable';
  end if;
end;
$preflight$;

create or replace function public.list_article_trust_sources(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_source_types jsonb;
  v_sources jsonb;
begin
  if p_limit is null
     or p_limit < 1
     or p_limit > 100 then
    raise exception
      'Source Library limit must be between 1 and 100';
  end if;

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
           'view_trust_records'
         ),
         false
       )
       or coalesce(
         public.current_user_has_capability(
           'manage_sources'
         ),
         false
       )
       or coalesce(
         public.current_user_has_capability(
           'review_sources'
         ),
         false
       )
       or coalesce(
         public.current_user_has_capability(
           'withdraw_sources'
         ),
         false
       )
     ) then
    raise exception
      'You do not have permission to read the Source Library';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source_type',
          source_type.source_type,
        'label',
          source_type.label,
        'description',
          source_type.description,
        'sort_order',
          source_type.sort_order
      )
      order by
        source_type.sort_order,
        source_type.source_type
    ),
    '[]'::jsonb
  )
  into v_source_types
  from editorial.source_types source_type
  where source_type.enabled;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          source_record.id,
        'source_type',
          source_record.source_type,
        'title',
          source_record.title,
        'creator_display',
          source_record.creator_display,
        'publisher_display',
          source_record.publisher_display,
        'source_url',
          source_record.source_url,
        'archive_identifier',
          source_record.archive_identifier,
        'publication_date',
          source_record.publication_date,
        'capture_date',
          source_record.capture_date,
        'retrieval_date',
          source_record.retrieval_date,
        'language_code',
          source_record.language_code,
        'country_code',
          source_record.country_code,
        'place_text',
          source_record.place_text,
        'rights_status',
          source_record.rights_status,
        'consent_status',
          source_record.consent_status,
        'sensitivity',
          source_record.sensitivity,
        'reliability_note',
          source_record.reliability_note,
        'credit_line',
          source_record.credit_line,
        'review_status',
          source_record.review_status,
        'exposure_class',
          source_record.exposure_class,
        'source_state',
          source_record.source_state,
        'current_working_version_id',
          source_record.current_working_version_id,
        'current_submitted_version_id',
          source_record.current_submitted_version_id,
        'current_approved_version_id',
          source_record.current_approved_version_id,
        'working_revision',
          source_record.working_revision,
        'updated_at',
          source_record.updated_at
      )
      order by
        source_record.updated_at desc,
        source_record.id
    ),
    '[]'::jsonb
  )
  into v_sources
  from (
    select
      source.id,
      source.source_type,
      source.title,
      source.creator_display,
      source.publisher_display,
      source.source_url,
      source.archive_identifier,
      source.publication_date,
      source.capture_date,
      source.retrieval_date,
      source.language_code,
      source.country_code,
      source.place_text,
      source.rights_status,
      source.consent_status,
      source.sensitivity,
      source.reliability_note,
      source.credit_line,
      source.review_status,
      source.exposure_class,
      source.source_state,
      source.current_working_version_id,
      source.current_submitted_version_id,
      source.current_approved_version_id,
      source.working_revision,
      source.updated_at
    from editorial.sources source
    order by
      source.updated_at desc,
      source.id
    limit p_limit
  ) source_record;

  return jsonb_build_object(
    'source_types',
      v_source_types,
    'sources',
      v_sources
  );
end;
$function$;

revoke all
on function public.list_article_trust_sources(integer)
from public, anon, authenticated;

grant execute
on function public.list_article_trust_sources(integer)
to authenticated, service_role;

comment on function
  public.list_article_trust_sources(integer)
is
  'Returns a bounded authorized Source Library and enabled Source vocabulary for Article trust workflows.';

commit;
