begin;

do $preflight$
begin
  if to_regprocedure(
       'editorial.current_user_can_edit_article(uuid)'
     ) is null then
    raise exception
      'STOP: editorial.current_user_can_edit_article(uuid) does not exist';
  end if;

  if to_regclass('editorial.article_versions') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.article_resources') is null
     or to_regclass('editorial.article_version_trust_revisions') is null
     or to_regclass('editorial.resource_citations') is null
     or to_regclass('editorial.resource_credits') is null
     or to_regclass('editorial.citations') is null
     or to_regclass('editorial.sources') is null
     or to_regclass('editorial.source_versions') is null
     or to_regclass('editorial.credits') is null
     or to_regclass('editorial.credit_governance') is null
     or to_regclass('editorial.external_contributors') is null then
    raise exception
      'STOP: Phase 3A trust or Article identity foundation is incomplete';
  end if;
end;
$preflight$;

create or replace function public.get_article_version_trust_workspace(
  p_article_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_version editorial.article_versions%rowtype;
  v_citation_revision bigint;
  v_credit_revision bigint;
  v_citations jsonb;
  v_credits jsonb;
begin
  if p_article_version_id is null then
    raise exception
      'Article version id is required';
  end if;

  select version.*
  into v_version
  from editorial.article_versions version
  where version.id = p_article_version_id;

  if not found then
    raise exception
      'Article version not found';
  end if;

  if auth.role() <> 'service_role'
     and not editorial.current_user_can_edit_article(
       v_version.resource_id
     ) then
    raise exception
      'You do not have permission to read this Article trust workspace';
  end if;

  select
    coalesce(revision.citation_revision, 1),
    coalesce(revision.credit_revision, 1)
  into
    v_citation_revision,
    v_credit_revision
  from (
    select 1
  ) seed
  left join editorial.article_version_trust_revisions revision
    on revision.article_version_id = p_article_version_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attachment_id', attachment.id,
        'resource_id', attachment.resource_id,
        'article_version_id', attachment.target_version_id,
        'citation_id', citation.id,
        'citation_purpose', attachment.citation_purpose,
        'target_anchor_type', attachment.target_anchor_type,
        'target_anchor_data', attachment.target_anchor_data,
        'display_order', attachment.display_order,
        'attachment_public_safe', attachment.public_safe,
        'citation_state', citation.citation_state,
        'citation_public_safe', citation.public_safe,
        'locator_type', citation.locator_type,
        'locator_data', citation.locator_data,
        'quotation', citation.quotation,
        'editor_note', citation.editor_note,
        'public_label', citation.public_label,
        'source_id', source.id,
        'source_version_id', source_version.id,
        'source_version_number', source_version.version_number,
        'source_type', source_version.source_type,
        'source_title', source_version.title,
        'creator_display', source_version.creator_display,
        'publisher_display', source_version.publisher_display,
        'source_url', source_version.source_url,
        'archive_identifier', source_version.archive_identifier,
        'publication_date', source_version.publication_date,
        'capture_date', source_version.capture_date,
        'retrieval_date', source_version.retrieval_date,
        'language_code', source_version.language_code,
        'country_code', source_version.country_code,
        'place_text', source_version.place_text,
        'rights_status', source_version.rights_status,
        'consent_status', source_version.consent_status,
        'sensitivity', source_version.sensitivity,
        'reliability_note', source_version.reliability_note,
        'credit_line', source_version.credit_line,
        'internal_notes', source_version.internal_notes,
        'source_review_status', source.review_status,
        'source_exposure_class', source.exposure_class,
        'source_state', source.source_state,
        'source_current_approved_version_id',
          source.current_approved_version_id,
        'publicly_eligible',
          (
            attachment.public_safe
            and citation.public_safe
            and citation.citation_state = 'active'
            and source.source_state = 'active'
            and source.withdrawn_at is null
            and source.exposure_class in (
              'public',
              'public_redacted'
            )
            and source.current_approved_version_id =
              citation.source_version_id
          )
      )
      order by
        attachment.display_order,
        attachment.created_at,
        attachment.id
    ),
    '[]'::jsonb
  )
  into v_citations
  from editorial.resource_citations attachment
  join editorial.citations citation
    on citation.id = attachment.citation_id
  join editorial.sources source
    on source.id = citation.source_id
  join editorial.source_versions source_version
    on source_version.id = citation.source_version_id
  where attachment.resource_id = v_version.resource_id
    and attachment.resource_kind = 'article'
    and attachment.target_version_type = 'article_version'
    and attachment.target_version_id = p_article_version_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attachment_id', attachment.id,
        'resource_id', attachment.resource_id,
        'article_version_id', attachment.target_version_id,
        'credit_id', credit.id,
        'display_order', attachment.display_order,
        'is_primary', attachment.is_primary,
        'attachment_public_safe', attachment.public_safe,
        'credit_role', credit.credit_role,
        'display_name_snapshot',
          credit.display_name_snapshot,
        'role_label_snapshot',
          credit.role_label_snapshot,
        'registry_author_slug_snapshot',
          credit.registry_author_slug_snapshot,
        'user_username_snapshot',
          credit.user_username_snapshot,
        'credit_note', credit.credit_note,
        'contributor_kind',
          case
            when credit.user_id is not null then 'user'
            when credit.registry_author_id is not null
              then 'registry_author'
            else 'external_contributor'
          end,
        'user_id', credit.user_id,
        'registry_author_id',
          credit.registry_author_id,
        'external_contributor_id',
          credit.external_contributor_id,
        'governance_public_safe',
          governance.public_safe,
        'credit_state',
          governance.credit_state,
        'governance_revision',
          governance.governance_revision,
        'governance_reason',
          governance.reason,
        'external_contributor_state',
          contributor.contributor_state,
        'external_contributor_consent_status',
          contributor.consent_status,
        'external_contributor_public_safe',
          contributor.public_safe,
        'publicly_eligible',
          (
            attachment.public_safe
            and governance.public_safe
            and governance.credit_state = 'active'
            and (
              credit.external_contributor_id is null
              or (
                contributor.contributor_state = 'active'
                and contributor.public_safe
                and contributor.consent_status in (
                  'granted',
                  'not_required'
                )
              )
            )
          )
      )
      order by
        attachment.display_order,
        attachment.created_at,
        attachment.id
    ),
    '[]'::jsonb
  )
  into v_credits
  from editorial.resource_credits attachment
  join editorial.credits credit
    on credit.id = attachment.credit_id
  join editorial.credit_governance governance
    on governance.credit_id = credit.id
  left join editorial.external_contributors contributor
    on contributor.id = credit.external_contributor_id
  where attachment.resource_id = v_version.resource_id
    and attachment.resource_kind = 'article'
    and attachment.target_version_type = 'article_version'
    and attachment.target_version_id = p_article_version_id;

  return jsonb_build_object(
    'article_version_id',
      p_article_version_id,
    'resource_id',
      v_version.resource_id,
    'citation_revision',
      v_citation_revision,
    'credit_revision',
      v_credit_revision,
    'citations',
      v_citations,
    'credits',
      v_credits
  );
end;
$function$;

revoke all
on function public.get_article_version_trust_workspace(uuid)
from public, anon;

grant execute
on function public.get_article_version_trust_workspace(uuid)
to authenticated, service_role;

comment on function
  public.get_article_version_trust_workspace(uuid)
is
  'Returns the complete authorized trust bundle for one immutable Article version.';

create or replace function public.public_get_article_trust(
  p_article_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_slug text;
  v_article_id uuid;
  v_resource_id uuid;
  v_published_version_id uuid;
  v_sources jsonb;
  v_credits jsonb;
begin
  v_slug := nullif(btrim(p_article_slug), '');

  if v_slug is null then
    return jsonb_build_object(
      'sources',
        '[]'::jsonb,
      'credits',
        '[]'::jsonb
    );
  end if;

  select
    article.id,
    binding.resource_id,
    resource.current_published_version_id
  into
    v_article_id,
    v_resource_id,
    v_published_version_id
  from public.wk_articles article
  join editorial.article_resources binding
    on binding.article_id = article.id
  join editorial.resources resource
    on resource.id = binding.resource_id
   and resource.resource_kind = 'article'
  where article.slug = v_slug
    and resource.visibility = 'public'
    and resource.lifecycle_state = 'published';

  if not found
     or v_published_version_id is null then
    return jsonb_build_object(
      'sources',
        '[]'::jsonb,
      'credits',
        '[]'::jsonb
    );
  end if;

  if not exists (
    select 1
    from editorial.article_versions version
    where version.id = v_published_version_id
      and version.resource_id = v_resource_id
      and version.article_id = v_article_id
  ) then
    return jsonb_build_object(
      'sources',
        '[]'::jsonb,
      'credits',
        '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'label',
            coalesce(
              nullif(btrim(citation.public_label), ''),
              source_version.title
            ),
          'title',
            source_version.title,
          'creator',
            source_version.creator_display,
          'publisher',
            source_version.publisher_display,
          'url',
            case
              when source.exposure_class = 'public'
                then source_version.source_url
              else null
            end,
          'publication_date',
            source_version.publication_date,
          'retrieval_date',
            source_version.retrieval_date,
          'locator_type',
            citation.locator_type,
          'locator_data',
            case
              when citation.locator_type = 'quotation'
                then null
              else citation.locator_data
            end,
          'purpose',
            attachment.citation_purpose,
          'display_order',
            attachment.display_order
        )
      )
      order by
        attachment.display_order,
        attachment.created_at,
        attachment.id
    ),
    '[]'::jsonb
  )
  into v_sources
  from editorial.resource_citations attachment
  join editorial.citations citation
    on citation.id = attachment.citation_id
  join editorial.sources source
    on source.id = citation.source_id
  join editorial.source_versions source_version
    on source_version.id = citation.source_version_id
  where attachment.resource_id = v_resource_id
    and attachment.resource_kind = 'article'
    and attachment.target_version_type = 'article_version'
    and attachment.target_version_id = v_published_version_id
    and attachment.public_safe
    and citation.public_safe
    and citation.citation_state = 'active'
    and source.source_state = 'active'
    and source.withdrawn_at is null
    and source.exposure_class in (
      'public',
      'public_redacted'
    )
    and source.current_approved_version_id =
      citation.source_version_id;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'display_name',
            credit.display_name_snapshot,
          'role',
            coalesce(
              nullif(
                btrim(credit.role_label_snapshot),
                ''
              ),
              credit.credit_role
            ),
          'is_primary',
            attachment.is_primary,
          'registry_author_slug',
            credit.registry_author_slug_snapshot,
          'username',
            credit.user_username_snapshot,
          'display_order',
            attachment.display_order
        )
      )
      order by
        attachment.display_order,
        attachment.created_at,
        attachment.id
    ),
    '[]'::jsonb
  )
  into v_credits
  from editorial.resource_credits attachment
  join editorial.credits credit
    on credit.id = attachment.credit_id
  join editorial.credit_governance governance
    on governance.credit_id = credit.id
  left join editorial.external_contributors contributor
    on contributor.id = credit.external_contributor_id
  where attachment.resource_id = v_resource_id
    and attachment.resource_kind = 'article'
    and attachment.target_version_type = 'article_version'
    and attachment.target_version_id = v_published_version_id
    and attachment.public_safe
    and governance.public_safe
    and governance.credit_state = 'active'
    and (
      credit.external_contributor_id is null
      or (
        contributor.contributor_state = 'active'
        and contributor.public_safe
        and contributor.consent_status in (
          'granted',
          'not_required'
        )
      )
    );

  return jsonb_build_object(
    'sources',
      v_sources,
    'credits',
      v_credits
  );
end;
$function$;

revoke all
on function public.public_get_article_trust(text)
from public, anon, authenticated;

grant execute
on function public.public_get_article_trust(text)
to service_role;

comment on function
  public.public_get_article_trust(text)
is
  'Returns only currently eligible public Sources and Credits for the published version of one public Article.';

commit;
