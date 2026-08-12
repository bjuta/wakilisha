-- Durable verification for the exact reviewed Hafare Article Credit reconciliation.

do $verify_hafare_article_credit_reconciliation$
declare
  v_credit_id uuid;
  v_article_ids uuid[] := array[
      'bbf032d8-0cbf-42e6-a1b8-a83941a9b557'::uuid,
      '6a667ae2-15b4-4095-870e-6d7dc7557bf8'::uuid,
      '91b6dadb-dd14-45db-b413-3977b073734f'::uuid,
      '849d23a9-4b7d-4c46-95b9-942a4b5bd6ee'::uuid,
      'b07a5acb-1b36-44fc-8767-8b665e37e4ab'::uuid,
      '6217d27f-f139-4c07-a240-e759eab52596'::uuid,
      '87d25d9d-95ff-4502-a28b-62a7547f3275'::uuid,
      'f765d1f3-dc17-496c-b822-8651c97d6c41'::uuid,
      '0b83a8dd-6268-480e-b855-ecc6233deb54'::uuid,
      'ca425b33-884a-4139-9247-3d764bf7945d'::uuid,
      '5312a27a-89a5-4aca-a6cc-2d4a2fce408e'::uuid,
      '222d9434-c7f2-43b4-9e40-5bf0b03a1dc8'::uuid,
      '1a0a018f-867f-4c9c-ac0b-109b444b7f05'::uuid,
      '5a8d99cf-4376-4382-9c40-3c88f32e6eea'::uuid,
      '4ff5254d-5f99-445a-a420-9f90b81b1497'::uuid,
      '9c39ab19-18a2-4a59-ab41-f8aa6959205e'::uuid,
      '6b0bda08-9720-4a93-ab97-25da63d78fbe'::uuid,
      '13a66fbd-c5fc-465b-b065-8a57b7f0372f'::uuid,
      '1500aa98-1e2d-42d3-97bc-79acca09a96b'::uuid,
      'f3621aca-382d-4ae6-b02a-1978b18b6375'::uuid,
      '58e908e0-2fc2-4097-b628-962100046223'::uuid,
      '57e7193d-b23d-42fe-8fcc-b8e41bd21f38'::uuid,
      '93c5e4ad-54fc-43bc-809e-4085813bbf51'::uuid,
      '9420ac5c-0040-43bc-91bb-d5a559918525'::uuid
  ];
  v_version_ids uuid[] := array[
      'd0dd6dce-30a5-493a-9912-f3a3cf890f53'::uuid,
      '555c7550-4b28-40c0-93cf-1f0faa516c77'::uuid,
      'b76d0cd3-9c81-417b-aca8-3016ddb6ad76'::uuid,
      '04739a25-1cff-4db0-88c9-1f9cbfbd9990'::uuid,
      'e13263bd-ce93-4bd9-a357-99cb454b4f3a'::uuid,
      '5c31b441-317d-46aa-a7db-cbc3e369635e'::uuid,
      'ebc81230-9b09-4382-baaf-c1ade74c1f4c'::uuid,
      '5a83e075-8de8-4a13-8c08-715304142e9a'::uuid,
      '056935e8-f4e2-4eaa-9b04-1bcca7c76300'::uuid,
      '3a9ee788-328e-4921-be1c-f94189228aa9'::uuid,
      '0bf9e09d-cc46-44e6-9c6d-1622ed5320c6'::uuid,
      '270c7f2c-e2a0-4079-94ff-4cc696ba02dc'::uuid,
      '0ef15250-7b4c-4b2f-bf81-949c635011a5'::uuid,
      '87fe434e-31e3-4660-828f-989ecdad1a6c'::uuid,
      '88fb7b38-39d3-4ca6-bf9c-38088056da2a'::uuid,
      '1cb97899-0cca-4b14-beab-a950b4a4f602'::uuid,
      '19550b03-ad59-4da4-bb1d-ac46aa0e8a3a'::uuid,
      'a54ad7a9-7592-4d1a-a230-f5122b23dfea'::uuid,
      '4276f0e3-8873-4281-9c5c-be196a7bae59'::uuid,
      '4792b937-6de7-48f5-b7eb-66625eb1cf5b'::uuid,
      '7852b0cc-2178-493d-83cc-d7fe45651084'::uuid,
      '68f7b01f-9975-49ad-8da0-70c9975717fa'::uuid,
      '16448b28-c792-48e8-a234-59cb558ee009'::uuid,
      '92b7e6f5-25a5-4d6a-9923-e5fd17057cd9'::uuid
  ];
begin
  if (
    select count(*)
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
  ) <> 1 then
    raise exception
      'STOP: Expected exactly one active public Hafare author Credit';
  end if;

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

  if editorial.resolve_credit_person(v_credit_id) is distinct from
       'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid
  then
    raise exception
      'STOP: Hafare author Credit no longer resolves to Hafare Person';
  end if;

  if (
    select count(*)
    from editorial.resource_credits attachment
    where attachment.target_version_id = any(v_version_ids)
      and attachment.resource_kind = 'article'
      and attachment.target_version_type = 'article_version'
      and attachment.credit_id = v_credit_id
      and attachment.display_order = 0
      and attachment.is_primary
      and attachment.public_safe
  ) <> 24 then
    raise exception
      'STOP: Not all 24 locked Article versions carry the Hafare author Credit';
  end if;

  if exists (
    select version_id
    from unnest(v_version_ids) version_id
    where (
      select count(*)
      from editorial.resource_credits attachment
      where attachment.target_version_id = version_id
    ) <> 1
  ) then
    raise exception
      'STOP: A locked Hafare Article version has an unexpected Credit set';
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
  ) < 24 then
    raise exception
      'STOP: Hafare public Person work exposes fewer than 24 reconciled Articles';
  end if;

  if not exists (
    select 1
    from public.list_public_person_work(
      'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid,
      50,
      null,
      null
    )
    where resource_kind = 'playlist'
      and canonical_path =
          '/playlists/top-50-kenyan-songs-of-2025'
  ) then
    raise exception
      'STOP: Hafare accepted Playlist work is missing';
  end if;

  if (
    select count(*)
    from public.wk_articles article
    where article.id = any(v_article_ids)
      and btrim(coalesce(to_jsonb(article)->>'author', '')) =
          'Hafare Segelan'
  ) <> 24 then
    raise exception
      'STOP: One or more locked legacy Hafare bylines changed';
  end if;
end;
$verify_hafare_article_credit_reconciliation$;

select jsonb_build_object(
  'verification', 'PASS',
  'hafare_person_id',
    'd87022ed-5e25-4301-bb89-b059ca39cf0f',
  'reconciled_articles', 24,
  'public_article_work',
    (
      select count(*)
      from public.list_public_person_work(
        'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid,
        50,
        null,
        null
      )
      where resource_kind = 'article'
    ),
  'public_playlist_work',
    (
      select count(*)
      from public.list_public_person_work(
        'd87022ed-5e25-4301-bb89-b059ca39cf0f'::uuid,
        50,
        null,
        null
      )
      where resource_kind = 'playlist'
    )
) as people_hafare_article_credit_reconciliation;
