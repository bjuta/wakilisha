-- People frontend M1 support:
-- reconcile the 24 explicitly reviewed Hafare Segelan legacy Article bylines
-- into governed Shared Credit authority on their exact current published versions.
--
-- This migration is deliberately narrow:
-- - exact audited Article, Resource, and current-version ids only;
-- - one Registry Author identity only;
-- - no Article content, byline, lifecycle, ownership, or publication mutation;
-- - no broad author-name matching outside the locked manifest.

begin;

create temporary table pg_temp.hafare_article_credit_manifest (
  article_id uuid primary key,
  resource_id uuid not null unique,
  article_version_id uuid not null unique,
  slug text not null unique
) on commit drop;

insert into pg_temp.hafare_article_credit_manifest (
  article_id,
  resource_id,
  article_version_id,
  slug
)
values
    ('bbf032d8-0cbf-42e6-a1b8-a83941a9b557'::uuid, '609ad152-7e41-4421-b77b-b0b82362a536'::uuid, 'd0dd6dce-30a5-493a-9912-f3a3cf890f53'::uuid, '5-kenyan-artists-to-look-out-for-in-2025'),
    ('6a667ae2-15b4-4095-870e-6d7dc7557bf8'::uuid, 'da3b6eb6-c869-4656-bdb2-52b22d941116'::uuid, '555c7550-4b28-40c0-93cf-1f0faa516c77'::uuid, 'njoki-karu-mwihoko-utheri-wa-ngoro-album-review'),
    ('91b6dadb-dd14-45db-b413-3977b073734f'::uuid, '2e1b96bd-0d81-4398-af6f-907fbac74ba2'::uuid, 'b76d0cd3-9c81-417b-aca8-3016ddb6ad76'::uuid, 'album-review-58-flava-by-buruklyn-boyz'),
    ('849d23a9-4b7d-4c46-95b9-942a4b5bd6ee'::uuid, 'f1ccadaf-c51d-4c0a-844b-d2d129172495'::uuid, '04739a25-1cff-4db0-88c9-1f9cbfbd9990'::uuid, 'album-review-dusk-to-dawn-by-serro'),
    ('b07a5acb-1b36-44fc-8767-8b665e37e4ab'::uuid, 'af31a7de-b48a-4d04-86e2-ac5f533c60b0'::uuid, 'e13263bd-ce93-4bd9-a357-99cb454b4f3a'::uuid, 'album-review-labor-of-love-zaituni-wambui'),
    ('6217d27f-f139-4c07-a240-e759eab52596'::uuid, '4d07494b-3667-4443-89ca-7553d8935b05'::uuid, '5c31b441-317d-46aa-a7db-cbc3e369635e'::uuid, 'likizo-dj-mura-big-nyagz-album-review'),
    ('87d25d9d-95ff-4502-a28b-62a7547f3275'::uuid, '52b58672-9e99-4a2a-b16e-45456bb7ff4e'::uuid, 'ebc81230-9b09-4382-baaf-c1ade74c1f4c'::uuid, 'album-review-love-letters-3-by-caleb-awiti'),
    ('f765d1f3-dc17-496c-b822-8651c97d6c41'::uuid, 'a6da3a9f-cbbc-411c-af88-5c977dc0eb31'::uuid, '5a83e075-8de8-4a13-8c08-715304142e9a'::uuid, 'album-review-maybe-ii-by-xenia-manasseh-and-ukweli'),
    ('0b83a8dd-6268-480e-b855-ecc6233deb54'::uuid, '96d12540-c9f2-4a69-8794-3b82f23b5a87'::uuid, '056935e8-f4e2-4eaa-9b04-1bcca7c76300'::uuid, 'album-review-now-its-experience-talking-blinky-bill-muthoni-drummer-queen'),
    ('ca425b33-884a-4139-9247-3d764bf7945d'::uuid, 'a33faf3e-c8d9-4ed1-9be8-091a524c845e'::uuid, '3a9ee788-328e-4921-be1c-f94189228aa9'::uuid, 'album-review-sumbua-by-lil-maina'),
    ('5312a27a-89a5-4aca-a6cc-2d4a2fce408e'::uuid, '05762e6d-2fce-4bcb-a644-9d71fa51d7de'::uuid, '0bf9e09d-cc46-44e6-9c6d-1622ed5320c6'::uuid, 'album-review-sweetest-time-by-maya-amolo'),
    ('222d9434-c7f2-43b4-9e40-5bf0b03a1dc8'::uuid, '75e70b85-d48f-46d1-969a-c35571f541bc'::uuid, '270c7f2c-e2a0-4079-94ff-4cc696ba02dc'::uuid, 'album-review-victims-of-madness-2-0'),
    ('1a0a018f-867f-4c9c-ac0b-109b444b7f05'::uuid, '2a3be50f-477d-4b50-bb54-94d67f4bd030'::uuid, '0ef15250-7b4c-4b2f-bf81-949c635011a5'::uuid, 'beef-the-rivalries-that-shaped-kenyan-music'),
    ('5a8d99cf-4376-4382-9c40-3c88f32e6eea'::uuid, '544923a9-92d6-4027-8d1d-c071d16aea5d'::uuid, '87fe434e-31e3-4660-828f-989ecdad1a6c'::uuid, 'ep-review-the-lick-back-by-nikita-kering'),
    ('4ff5254d-5f99-445a-a420-9f90b81b1497'::uuid, '3d2c8e20-0ebe-4d96-9462-186c0c1d9582'::uuid, '88fb7b38-39d3-4ca6-bf9c-38088056da2a'::uuid, 'ep-review-wameyo-by-elsy-wameyo'),
    ('9c39ab19-18a2-4a59-ab41-f8aa6959205e'::uuid, '70778389-e77b-48ad-9066-68eb1ec8c8fd'::uuid, '1cb97899-0cca-4b14-beab-a950b4a4f602'::uuid, 'found-in-translation-the-rise-of-kenyan-vernacular-pop-music'),
    ('6b0bda08-9720-4a93-ab97-25da63d78fbe'::uuid, 'e985fed7-14e9-4231-9cac-3b6fd3745847'::uuid, '19550b03-ad59-4da4-bb1d-ac46aa0e8a3a'::uuid, 'how-afrohouse-found-a-second-home-in-nairobi'),
    ('13a66fbd-c5fc-465b-b065-8a57b7f0372f'::uuid, 'f115396d-3369-462a-b6f2-cf5403717df4'::uuid, 'a54ad7a9-7592-4d1a-a230-f5122b23dfea'::uuid, 'kenyas-top-10-one-hit-wonder-songs'),
    ('1500aa98-1e2d-42d3-97bc-79acca09a96b'::uuid, '41255f8c-e301-4137-9fb6-87404f960ad0'::uuid, '4276f0e3-8873-4281-9c5c-be196a7bae59'::uuid, 'kenyas-top-female-artists-of-2025'),
    ('f3621aca-382d-4ae6-b02a-1978b18b6375'::uuid, 'a88bae3c-1bcd-4abb-bde0-d7ddb83d877c'::uuid, '4792b937-6de7-48f5-b7eb-66625eb1cf5b'::uuid, 'history-of-nairobi-street-art-movement'),
    ('58e908e0-2fc2-4097-b628-962100046223'::uuid, 'b8ca0c9b-405c-4dc6-9e25-37473ed40088'::uuid, '7852b0cc-2178-493d-83cc-d7fe45651084'::uuid, 'the-artists-who-defined-kenyan-music-in-2025'),
    ('57e7193d-b23d-42fe-8fcc-b8e41bd21f38'::uuid, 'c57bf016-9c5a-48ce-8a45-d179fc795ab8'::uuid, '68f7b01f-9975-49ad-8da0-70c9975717fa'::uuid, 'the-songs-that-marched-with-us'),
    ('93c5e4ad-54fc-43bc-809e-4085813bbf51'::uuid, '7295c263-bffb-4635-97ac-1688f4a29d5c'::uuid, '16448b28-c792-48e8-a234-59cb558ee009'::uuid, 'top-kenyan-songs-of-2025'),
    ('9420ac5c-0040-43bc-91bb-d5a559918525'::uuid, '59d09472-6a33-4fff-b670-3dab15bb59bd'::uuid, '92b7e6f5-25a5-4d6a-9923-e5fd17057cd9'::uuid, 'toxic-lyrikali-amplifying-the-voice-of-the-streets');

do $hafare_credit_reconciliation_preflight$
declare
  v_count bigint;
  v_existing_credit_count bigint;
begin
  if (select count(*) from pg_temp.hafare_article_credit_manifest) <> 24 then
    raise exception
      'STOP: Hafare Article Credit manifest is not exactly 24 rows';
  end if;

  if not exists (
    select 1
    from public.registry_authors author_record
    where author_record.id =
          'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
      and author_record.slug = 'hafare-segelan'
      and author_record.name = 'Hafare Segelan'
  ) then
    raise exception
      'STOP: Hafare Registry Author identity moved';
  end if;

  if not exists (
    select 1
    from editorial.person_identity_links link
    where link.person_resource_id =
          'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid
      and link.registry_author_id =
          'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
      and link.link_state = 'active'
  ) then
    raise exception
      'STOP: Hafare Registry Author is not actively linked to the accepted Person';
  end if;

  select count(*)
  into v_count
  from pg_temp.hafare_article_credit_manifest manifest
  join public.wk_articles article
    on article.id = manifest.article_id
   and article.slug = manifest.slug
   and btrim(coalesce(to_jsonb(article)->>'author', '')) =
       'Hafare Segelan'
  join editorial.article_resources binding
    on binding.article_id = manifest.article_id
   and binding.resource_id = manifest.resource_id
  join editorial.resources resource
    on resource.id = manifest.resource_id
   and resource.resource_kind = 'article'
   and resource.current_published_version_id =
       manifest.article_version_id
   and resource.visibility = 'public'
   and resource.lifecycle_state = 'published'
  join editorial.article_versions version
    on version.id = manifest.article_version_id
   and version.resource_id = manifest.resource_id
   and version.published_at is not null;

  if v_count <> 24 then
    raise exception
      'STOP: Only % of 24 locked Hafare Article/version rows still match the audited public boundary',
      v_count;
  end if;

  if exists (
    select 1
    from editorial.resource_credits attachment
    join pg_temp.hafare_article_credit_manifest manifest
      on manifest.article_version_id =
         attachment.target_version_id
  ) then
    raise exception
      'STOP: One or more locked Hafare current Article versions acquired Credits after audit';
  end if;

  select count(*)
  into v_existing_credit_count
  from editorial.credits credit
  join editorial.credit_governance governance
    on governance.credit_id = credit.id
  where credit.credit_role = 'author'
    and credit.registry_author_id =
        'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
    and credit.display_name_snapshot = 'Hafare Segelan'
    and credit.registry_author_slug_snapshot = 'hafare-segelan'
    and governance.credit_state = 'active'
    and governance.public_safe;

  if v_existing_credit_count > 1 then
    raise exception
      'STOP: More than one active public Hafare author Credit already exists';
  end if;

  if (
    select count(*)
    from public.list_public_person_work(
      'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid,
      50,
      null,
      null
    )
    where resource_kind = 'article'
  ) <> 0 then
    raise exception
      'STOP: Hafare already has governed public Article work before reconciliation';
  end if;

  if (
    select count(*)
    from public.list_public_person_work(
      'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid,
      50,
      null,
      null
    )
    where resource_kind = 'playlist'
  ) <> 1 then
    raise exception
      'STOP: Hafare accepted Playlist body-of-work boundary moved';
  end if;
end;
$hafare_credit_reconciliation_preflight$;

do $hafare_credit_reconciliation$
declare
  v_credit_id uuid;
  v_existing_credit_count bigint;
begin
  select count(*)
  into v_existing_credit_count
  from editorial.credits credit
  join editorial.credit_governance governance
    on governance.credit_id = credit.id
  where credit.credit_role = 'author'
    and credit.registry_author_id =
        'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
    and credit.display_name_snapshot = 'Hafare Segelan'
    and credit.registry_author_slug_snapshot = 'hafare-segelan'
    and governance.credit_state = 'active'
    and governance.public_safe;

  if v_existing_credit_count = 1 then
    select credit.id
    into v_credit_id
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    where credit.credit_role = 'author'
      and credit.registry_author_id =
          'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
      and credit.display_name_snapshot = 'Hafare Segelan'
      and credit.registry_author_slug_snapshot = 'hafare-segelan'
      and governance.credit_state = 'active'
      and governance.public_safe
    order by credit.created_at, credit.id
    limit 1;
  else
    insert into editorial.credits (
      credit_role,
      user_id,
      registry_author_id,
      external_contributor_id,
      display_name_snapshot,
      role_label_snapshot,
      registry_author_slug_snapshot,
      user_username_snapshot,
      credit_note,
      created_by
    )
    values (
      'author',
      null,
      'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid,
      null,
      'Hafare Segelan',
      'Author',
      'hafare-segelan',
      null,
      null,
      null
    )
    returning id
    into v_credit_id;

    insert into editorial.credit_governance (
      credit_id,
      public_safe,
      credit_state,
      governance_revision,
      reason,
      updated_by,
      updated_at
    )
    values (
      v_credit_id,
      true,
      'active',
      1,
      null,
      null,
      now()
    );
  end if;

  if editorial.resolve_credit_person(v_credit_id) is distinct from
       'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid
  then
    raise exception
      'STOP: Resolved Hafare author Credit does not map to the accepted Person';
  end if;

  insert into editorial.article_version_trust_revisions (
    article_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  select
    manifest.article_version_id,
    1,
    1,
    null,
    now()
  from pg_temp.hafare_article_credit_manifest manifest
  on conflict (article_version_id) do nothing;

  insert into editorial.resource_credits (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  select
    manifest.resource_id,
    'article',
    'article_version',
    manifest.article_version_id,
    v_credit_id,
    0,
    true,
    true,
    null
  from pg_temp.hafare_article_credit_manifest manifest
  order by manifest.slug;

  update editorial.article_version_trust_revisions revision
  set
    credit_revision = revision.credit_revision + 1,
    updated_by = null,
    updated_at = now()
  where revision.article_version_id in (
    select manifest.article_version_id
    from pg_temp.hafare_article_credit_manifest manifest
  );
end;
$hafare_credit_reconciliation$;

do $hafare_credit_reconciliation_postflight$
declare
  v_credit_id uuid;
begin
  select credit.id
  into v_credit_id
  from editorial.credits credit
  join editorial.credit_governance governance
    on governance.credit_id = credit.id
  where credit.credit_role = 'author'
    and credit.registry_author_id =
        'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
    and credit.display_name_snapshot = 'Hafare Segelan'
    and credit.registry_author_slug_snapshot = 'hafare-segelan'
    and governance.credit_state = 'active'
    and governance.public_safe
  order by credit.created_at, credit.id
  limit 1;

  if v_credit_id is null then
    raise exception
      'STOP: Hafare author Credit was not established';
  end if;

  if (
    select count(*)
    from editorial.resource_credits attachment
    join pg_temp.hafare_article_credit_manifest manifest
      on manifest.article_version_id =
         attachment.target_version_id
    where attachment.resource_id = manifest.resource_id
      and attachment.resource_kind = 'article'
      and attachment.target_version_type = 'article_version'
      and attachment.credit_id = v_credit_id
      and attachment.display_order = 0
      and attachment.is_primary
      and attachment.public_safe
  ) <> 24 then
    raise exception
      'STOP: Hafare author Credit was not attached to all 24 exact Article versions';
  end if;

  if exists (
    select 1
    from pg_temp.hafare_article_credit_manifest manifest
    where (
      select count(*)
      from editorial.resource_credits attachment
      where attachment.target_version_id =
            manifest.article_version_id
    ) <> 1
  ) then
    raise exception
      'STOP: One or more reconciled Hafare Article versions do not have exactly one Credit';
  end if;

  if (
    select count(*)
    from public.list_public_person_work(
      'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid,
      50,
      null,
      null
    )
    where resource_kind = 'article'
  ) <> 24 then
    raise exception
      'STOP: Hafare Person body of work does not expose all 24 reconciled Articles';
  end if;

  if (
    select count(*)
    from public.list_public_person_work(
      'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid,
      50,
      null,
      null
    )
    where resource_kind = 'playlist'
  ) <> 1 then
    raise exception
      'STOP: Hafare Playlist work changed during Article Credit reconciliation';
  end if;

  if (
    select count(*)
    from public.list_public_person_work(
      'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid,
      50,
      null,
      null
    )
  ) <> 25 then
    raise exception
      'STOP: Hafare Person body-of-work total is not exactly 25';
  end if;

  if exists (
    select 1
    from pg_temp.hafare_article_credit_manifest manifest
    join public.wk_articles article
      on article.id = manifest.article_id
    where btrim(coalesce(to_jsonb(article)->>'author', '')) <>
          'Hafare Segelan'
  ) then
    raise exception
      'STOP: Legacy Hafare Article byline changed during reconciliation';
  end if;
end;
$hafare_credit_reconciliation_postflight$;

commit;
