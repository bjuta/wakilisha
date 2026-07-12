-- Correct the reviewed legacy numbered track slugs.
-- Frozen candidate rows: 78
-- Source CSV SHA256: 6bf174d9b17a63989c96a5e85a0997180a7c767b3f8373d465d4dbc201d4d82f
-- Generated from: scripts/audits/frozen-safe-numbered-track-renames-20260712.csv

begin;

create temporary table numbered_track_slug_fix (
  track_id uuid primary key,
  artist_slug text not null,
  old_slug text not null,
  new_slug text not null,
  old_path text not null unique,
  new_path text not null unique
) on commit drop;

insert into numbered_track_slug_fix (
  track_id,
  artist_slug,
  old_slug,
  new_slug,
  old_path,
  new_path
)
values
  ('c82d10bd-8b55-4e87-970d-d9e5bb40c553'::uuid, 'bensoul', 'plumber-2', 'plumber', '/tracks/bensoul/plumber-2', '/tracks/bensoul/plumber'),
  ('eeceac4c-76cc-4b31-a8dc-0230e15644a8'::uuid, 'bien', 'decide-2', 'decide', '/tracks/bien/decide-2', '/tracks/bien/decide'),
  ('00544b1c-351a-4abb-bdf0-3ffa349da8ff'::uuid, 'bien', 'lifestyle-2', 'lifestyle', '/tracks/bien/lifestyle-2', '/tracks/bien/lifestyle'),
  ('b48788e1-ca57-482c-acdd-7c8cb9e3c867'::uuid, 'bien', 'true-love-2', 'true-love', '/tracks/bien/true-love-2', '/tracks/bien/true-love'),
  ('ac642239-885d-4b53-92c1-418f36e2fa2d'::uuid, 'breeder-lw', 'dedi-dedilee-2', 'dedi-dedilee', '/tracks/breeder-lw/dedi-dedilee-2', '/tracks/breeder-lw/dedi-dedilee'),
  ('cb2587c4-6d96-4718-b049-38bb572dffc9'::uuid, 'bridget-blue', 'grateful-2', 'grateful', '/tracks/bridget-blue/grateful-2', '/tracks/bridget-blue/grateful'),
  ('d7370b5c-1d64-4a98-85d0-f35d4f9dbd90'::uuid, 'bridget-blue', 'ni-wewe-2', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-2', '/tracks/bridget-blue/ni-wewe'),
  ('42d01b1b-6d84-499b-86aa-be70bdf7d568'::uuid, 'bridget-blue', 'ningelijua-2', 'ningelijua', '/tracks/bridget-blue/ningelijua-2', '/tracks/bridget-blue/ningelijua'),
  ('75f6e64f-05cf-4169-bcc3-5431faa3c67f'::uuid, 'bridget-blue', 'set-me-free-2', 'set-me-free', '/tracks/bridget-blue/set-me-free-2', '/tracks/bridget-blue/set-me-free'),
  ('1a16ce1c-8d51-472b-b434-db838a8a286a'::uuid, 'bridget-blue', 'sober-3', 'sober', '/tracks/bridget-blue/sober-3', '/tracks/bridget-blue/sober'),
  ('5522db74-c9af-49eb-9529-6a462ed857a2'::uuid, 'bridget-blue', 'woman-2', 'woman', '/tracks/bridget-blue/woman-2', '/tracks/bridget-blue/woman'),
  ('448a9a51-877b-45ab-afa1-4d2746bc23ca'::uuid, 'buruklyn-boyz', 'ex-2', 'ex', '/tracks/buruklyn-boyz/ex-2', '/tracks/buruklyn-boyz/ex'),
  ('359d8832-8156-4480-8ae7-5f210ecac89d'::uuid, 'buruklyn-boyz', 'intro-8', 'intro', '/tracks/buruklyn-boyz/intro-8', '/tracks/buruklyn-boyz/intro'),
  ('5aabcf79-bfb1-4ecc-ac50-06e40304c8b4'::uuid, 'buruklyn-boyz', 'taliban-2', 'taliban', '/tracks/buruklyn-boyz/taliban-2', '/tracks/buruklyn-boyz/taliban'),
  ('d3e6fe47-ec63-4fa7-accf-be9133b7a0ec'::uuid, 'charisma', 'intro-4', 'intro', '/tracks/charisma/intro-4', '/tracks/charisma/intro'),
  ('246381a4-b39c-4021-8273-81d979ca8be7'::uuid, 'charisma', 'tonight-2', 'tonight', '/tracks/charisma/tonight-2', '/tracks/charisma/tonight'),
  ('c72a672a-e3cb-4219-8691-b44c9a6a3766'::uuid, 'chimano', 'stereo-2', 'stereo', '/tracks/chimano/stereo-2', '/tracks/chimano/stereo'),
  ('c1b6c6db-188c-40ad-8a4c-bf0f88da6751'::uuid, 'coster-ojwang', 'intro-3', 'intro', '/tracks/coster-ojwang/intro-3', '/tracks/coster-ojwang/intro'),
  ('89781c83-1a8c-4ee7-92e9-1fa07b53b0ba'::uuid, 'dyana-cods', 'atoti-2', 'atoti', '/tracks/dyana-cods/atoti-2', '/tracks/dyana-cods/atoti'),
  ('57a8dc94-ea97-40d3-8d63-a47d4eea3868'::uuid, 'dyana-cods', 'now-you-know-2', 'now-you-know', '/tracks/dyana-cods/now-you-know-2', '/tracks/dyana-cods/now-you-know'),
  ('ec777247-defe-491e-b091-2593caadaf1f'::uuid, 'fancy-fingers', 'dala-3', 'dala', '/tracks/fancy-fingers/dala-3', '/tracks/fancy-fingers/dala'),
  ('870fb959-a20c-4be7-9efa-2793582bfff2'::uuid, 'fancy-fingers', 'nitarudi-2', 'nitarudi', '/tracks/fancy-fingers/nitarudi-2', '/tracks/fancy-fingers/nitarudi'),
  ('42783c0d-e2ce-4814-ad4e-1fa6b2473beb'::uuid, 'fancy-fingers', 'pokunena-2', 'pokunena', '/tracks/fancy-fingers/pokunena-2', '/tracks/fancy-fingers/pokunena'),
  ('6fe23a09-28da-49da-8fc7-ed23d6d2e145'::uuid, 'femi-one', 'balance-2', 'balance', '/tracks/femi-one/balance-2', '/tracks/femi-one/balance'),
  ('ca62f90d-91f2-4150-8e3b-f7b12b84b1d7'::uuid, 'femi-one', 'pewa-2', 'pewa', '/tracks/femi-one/pewa-2', '/tracks/femi-one/pewa'),
  ('2bdbd42d-3e16-4713-831b-d8393513adb6'::uuid, 'fena-gitu', 'mali-safi-3', 'mali-safi', '/tracks/fena-gitu/mali-safi-3', '/tracks/fena-gitu/mali-safi'),
  ('160445fb-2c37-44bb-9bef-0cdc33e11939'::uuid, 'iyanii', 'december-2', 'december', '/tracks/iyanii/december-2', '/tracks/iyanii/december'),
  ('cf522b83-8634-4a47-819e-da784566263f'::uuid, 'iyanii', 'tamu-2', 'tamu', '/tracks/iyanii/tamu-2', '/tracks/iyanii/tamu'),
  ('eef361ee-e50c-4775-a5a0-b9761e37853b'::uuid, 'janet-otieno', 'asante-2', 'asante', '/tracks/janet-otieno/asante-2', '/tracks/janet-otieno/asante'),
  ('99ff0807-85c1-4ca2-8e14-48f476a06bc2'::uuid, 'janet-otieno', 'ni-wewe-3', 'ni-wewe', '/tracks/janet-otieno/ni-wewe-3', '/tracks/janet-otieno/ni-wewe'),
  ('5210ec07-47a9-46eb-bea1-39aec5a6e92f'::uuid, 'jua-cali', 'habibi-2', 'habibi', '/tracks/jua-cali/habibi-2', '/tracks/jua-cali/habibi'),
  ('f423551d-e056-40ce-be48-c5850735d2a6'::uuid, 'jua-cali', 'interlude-5', 'interlude', '/tracks/jua-cali/interlude-5', '/tracks/jua-cali/interlude'),
  ('7656974e-e099-4f15-8cc7-6bce215c3082'::uuid, 'jua-cali', 'interlude-3-2', 'interlude-3', '/tracks/jua-cali/interlude-3-2', '/tracks/jua-cali/interlude-3'),
  ('221b4ded-351f-4ae5-bae4-4b65781017b0'::uuid, 'jua-cali', 'intro-7', 'intro', '/tracks/jua-cali/intro-7', '/tracks/jua-cali/intro'),
  ('f3e92b9d-92f2-46d1-864c-87e099e25be3'::uuid, 'jua-cali', 'outro-3', 'outro', '/tracks/jua-cali/outro-3', '/tracks/jua-cali/outro'),
  ('bb349d90-3084-4d6b-bd0f-c9493f860047'::uuid, 'karun', 'i-know-2', 'i-know', '/tracks/karun/i-know-2', '/tracks/karun/i-know'),
  ('ac5305dc-d0db-48a5-bcff-5b9886f82ea2'::uuid, 'karun', 'one-in-a-million-2', 'one-in-a-million', '/tracks/karun/one-in-a-million-2', '/tracks/karun/one-in-a-million'),
  ('ef2a6d23-51f5-4796-bb0e-b679588e04cb'::uuid, 'king-kaka', 'fly-3', 'fly', '/tracks/king-kaka/fly-3', '/tracks/king-kaka/fly'),
  ('c33fa53f-e948-4e9b-9a5e-10eaf4cc0a1c'::uuid, 'king-kaka', 'poison-2', 'poison', '/tracks/king-kaka/poison-2', '/tracks/king-kaka/poison'),
  ('e1bfa286-e382-49ae-a6a3-f0f432c4d1ec'::uuid, 'kleptomaniax', 'furahia-2', 'furahia', '/tracks/kleptomaniax/furahia-2', '/tracks/kleptomaniax/furahia'),
  ('687fa82e-c4cf-4cad-abd8-dabe93d30aa7'::uuid, 'kleptomaniax', 'interlude-3', 'interlude', '/tracks/kleptomaniax/interlude-3', '/tracks/kleptomaniax/interlude'),
  ('a4d3b204-1d89-4a7a-aca6-7a60ac33d61c'::uuid, 'kleptomaniax', 'interlude-2-2', 'interlude-2', '/tracks/kleptomaniax/interlude-2-2', '/tracks/kleptomaniax/interlude-2'),
  ('8368f851-6d4f-46fe-8f31-b612bf3cab31'::uuid, 'kleptomaniax', 'intro-6', 'intro', '/tracks/kleptomaniax/intro-6', '/tracks/kleptomaniax/intro'),
  ('b24dfa3a-ab15-436f-8d73-f960cbb1f840'::uuid, 'kleptomaniax', 'magnetic-2', 'magnetic', '/tracks/kleptomaniax/magnetic-2', '/tracks/kleptomaniax/magnetic'),
  ('640a1df5-43a0-4f5b-a35a-a574a6030f3a'::uuid, 'kodongklan', 'tonight-3', 'tonight', '/tracks/kodongklan/tonight-3', '/tracks/kodongklan/tonight'),
  ('d7c41ebc-4347-4419-80b4-e73c66b818b5'::uuid, 'matata', 'amina-2', 'amina', '/tracks/matata/amina-2', '/tracks/matata/amina'),
  ('7afb5ed5-fa2e-4a82-b5e0-0d12b881a6ee'::uuid, 'matata', 'this-love-2', 'this-love', '/tracks/matata/this-love-2', '/tracks/matata/this-love'),
  ('2d45071a-2f92-46f7-aa9b-75fd39d680d6'::uuid, 'maya-amolo', 'asali-3', 'asali', '/tracks/maya-amolo/asali-3', '/tracks/maya-amolo/asali'),
  ('832d7793-968a-4aeb-a227-bb9d004a2cdb'::uuid, 'maya-amolo', 'i-know-3', 'i-know', '/tracks/maya-amolo/i-know-3', '/tracks/maya-amolo/i-know'),
  ('82c8f94d-6030-43b3-b092-a515499055ea'::uuid, 'mejja', 'weh-decide-2', 'weh-decide', '/tracks/mejja/weh-decide-2', '/tracks/mejja/weh-decide'),
  ('043de864-79d3-4c46-952d-6d4e39edd2c7'::uuid, 'nikita-kering', 'intro-2', 'intro', '/tracks/nikita-kering/intro-2', '/tracks/nikita-kering/intro'),
  ('b25018a7-2820-40f0-a959-02db0898f59d'::uuid, 'nyashinski', 'balance-3', 'balance', '/tracks/nyashinski/balance-3', '/tracks/nyashinski/balance'),
  ('a7eb6b97-344f-4912-b53f-e73443e12c1a'::uuid, 'nyashinski', 'time-2', 'time', '/tracks/nyashinski/time-2', '/tracks/nyashinski/time'),
  ('1aef7a80-de5e-4c4d-a0cb-7b647588457a'::uuid, 'onyach-pala', 'fly-2', 'fly', '/tracks/onyach-pala/fly-2', '/tracks/onyach-pala/fly'),
  ('a8ec78e9-133a-45a0-9e26-3aafe18ca923'::uuid, 'sauti-sol', 'coming-home-2', 'coming-home', '/tracks/sauti-sol/coming-home-2', '/tracks/sauti-sol/coming-home'),
  ('c69bf6c9-701f-4245-818b-ce309e9c3380'::uuid, 'sauti-sol', 'interlude-2', 'interlude', '/tracks/sauti-sol/interlude-2', '/tracks/sauti-sol/interlude'),
  ('c28935b0-8a30-452a-ab75-ff91bbeb5ec8'::uuid, 'sauti-sol', 'intro-5', 'intro', '/tracks/sauti-sol/intro-5', '/tracks/sauti-sol/intro'),
  ('9b44eb7a-0b91-40b3-a755-5e8a0041b504'::uuid, 'sauti-sol', 'sober-2', 'sober', '/tracks/sauti-sol/sober-2', '/tracks/sauti-sol/sober'),
  ('62a0944c-844e-4bb5-bd6d-30e56a6d6b3b'::uuid, 'sauti-sol', 'subira-2', 'subira', '/tracks/sauti-sol/subira-2', '/tracks/sauti-sol/subira'),
  ('9837a2d0-d0db-4e00-9e24-caa8aafbaff3'::uuid, 'tina-ardor', 'jahera-na-2', 'jahera-na', '/tracks/tina-ardor/jahera-na-2', '/tracks/tina-ardor/jahera-na'),
  ('286608af-a443-432d-a9d4-8283e1995a08'::uuid, 'tina-ardor', 'sumbua-2', 'sumbua', '/tracks/tina-ardor/sumbua-2', '/tracks/tina-ardor/sumbua'),
  ('26be3f2f-b7f8-4ae9-85df-5d52bae0987d'::uuid, 'toxic-lyrikali', 'thugnificent-2', 'thugnificent', '/tracks/toxic-lyrikali/thugnificent-2', '/tracks/toxic-lyrikali/thugnificent'),
  ('892f1f9b-fa65-4abe-86ec-3bf97bf061d2'::uuid, 'v-be', 'amen-2', 'amen', '/tracks/v-be/amen-2', '/tracks/v-be/amen'),
  ('92841f08-2d1c-483a-b0b4-418c26c2f254'::uuid, 'v-be', 'leave-me-alone-2', 'leave-me-alone', '/tracks/v-be/leave-me-alone-2', '/tracks/v-be/leave-me-alone'),
  ('ef5dc94f-f7bc-4cf3-91e4-fee1cd82bfbb'::uuid, 'wakadinali', 'chunga-2', 'chunga', '/tracks/wakadinali/chunga-2', '/tracks/wakadinali/chunga'),
  ('01dc9e03-0437-4f3a-a6ea-971d02dc0ff2'::uuid, 'wakadinali', 'eastlando-2', 'eastlando', '/tracks/wakadinali/eastlando-2', '/tracks/wakadinali/eastlando'),
  ('eb633d81-3f80-4298-954a-b5682ea6f47d'::uuid, 'wakadinali', 'extra-pressure-2', 'extra-pressure', '/tracks/wakadinali/extra-pressure-2', '/tracks/wakadinali/extra-pressure'),
  ('1d49cb8a-78d2-48ff-84dd-bb20bebcdd9b'::uuid, 'wakadinali', 'hallelujah-2', 'hallelujah', '/tracks/wakadinali/hallelujah-2', '/tracks/wakadinali/hallelujah'),
  ('60dec912-617d-4747-b5ee-56dd8f9d2407'::uuid, 'wanavokali', 'nitangoja-2', 'nitangoja', '/tracks/wanavokali/nitangoja-2', '/tracks/wanavokali/nitangoja'),
  ('20a6c5f2-0f4c-4bfb-91da-c9c5df660d8b'::uuid, 'watendawili', 'asali-2', 'asali', '/tracks/watendawili/asali-2', '/tracks/watendawili/asali'),
  ('e24a4db2-9f7d-4123-adf0-399618e7da77'::uuid, 'watendawili', 'safari-2', 'safari', '/tracks/watendawili/safari-2', '/tracks/watendawili/safari'),
  ('c2f3f574-7ffa-4bcd-b5d5-7ec3e5f77469'::uuid, 'watendawili', 'sianda-2', 'sianda', '/tracks/watendawili/sianda-2', '/tracks/watendawili/sianda'),
  ('3aa64aac-e704-4e7a-992b-ad94bc7b8f01'::uuid, 'willy-paul', 'keki-2', 'keki', '/tracks/willy-paul/keki-2', '/tracks/willy-paul/keki'),
  ('bf42fed8-be37-4c1f-a711-718654e9f3f6'::uuid, 'willy-paul', 'liar-2', 'liar', '/tracks/willy-paul/liar-2', '/tracks/willy-paul/liar'),
  ('c1f42c8e-40d7-4969-b2b2-23083a6c3418'::uuid, 'winyo', 'heaven-2', 'heaven', '/tracks/winyo/heaven-2', '/tracks/winyo/heaven'),
  ('476f5f38-6205-4cc9-b54b-dd44cebb67a3'::uuid, 'winyo', 'mimi-na-wewe-2', 'mimi-na-wewe', '/tracks/winyo/mimi-na-wewe-2', '/tracks/winyo/mimi-na-wewe'),
  ('3e774e1f-f78f-4f2a-b872-5cc41af5b83e'::uuid, 'winyo', 'salama-2', 'salama', '/tracks/winyo/salama-2', '/tracks/winyo/salama'),
  ('79c27d82-6abf-4630-914e-07187d5059dc'::uuid, 'xenia-manasseh', 'lowkey-2', 'lowkey', '/tracks/xenia-manasseh/lowkey-2', '/tracks/xenia-manasseh/lowkey');

do $numbered_slug_fix$
declare
  v_candidate_count integer;
begin
  select count(*)
  into v_candidate_count
  from numbered_track_slug_fix;

  if v_candidate_count <> 78 then
    raise exception
      'Expected 78 frozen numbered-track candidates, found %',
      v_candidate_count;
  end if;

  if exists (
    select 1
    from numbered_track_slug_fix
    where old_slug = new_slug
       or old_path = new_path
       or old_path <> '/tracks/' || artist_slug || '/' || old_slug
       or new_path <> '/tracks/' || artist_slug || '/' || new_slug
       or old_slug !~ ('^' || new_slug || '-[0-9]+$')
  ) then
    raise exception
      'Frozen numbered-track candidate structure is invalid';
  end if;
end
$numbered_slug_fix$;

do $numbered_slug_fix$
begin
  if exists (
    select 1
    from numbered_track_slug_fix f
    left join public.registry_tracks t
      on t.id = f.track_id
     and t.slug = f.old_slug
    where t.id is null
  ) then
    raise exception
      'One or more reviewed tracks no longer have the expected legacy slug';
  end if;

  if exists (
    select 1
    from numbered_track_slug_fix f
    where not exists (
      select 1
      from public.registry_track_artists ta
      where ta.track_id = f.track_id
        and ta.artist_slug = f.artist_slug
        and ta.status in ('active', 'needs_review', 'draft')
        and coalesce(ta.is_primary, false) = true
    )
  ) then
    raise exception
      'One or more reviewed tracks no longer have the expected primary artist';
  end if;

  if exists (
    select 1
    from numbered_track_slug_fix f
    join public.registry_track_artists ta
      on ta.track_id = f.track_id
     and ta.status in ('active', 'needs_review', 'draft')
     and coalesce(ta.is_primary, false) = true
    where ta.artist_slug is distinct from f.artist_slug
  ) then
    raise exception
      'One or more reviewed tracks now have an additional primary artist';
  end if;

  if exists (
    select 1
    from numbered_track_slug_fix f
    join public.registry_tracks conflicting_track
      on conflicting_track.slug = f.new_slug
     and conflicting_track.id <> f.track_id
    join public.registry_track_artists conflicting_artist
      on conflicting_artist.track_id = conflicting_track.id
     and conflicting_artist.artist_slug = f.artist_slug
     and conflicting_artist.status in ('active', 'needs_review', 'draft')
     and coalesce(conflicting_artist.is_primary, false) = true
  ) then
    raise exception
      'One or more canonical slugs now collide within the same artist scope';
  end if;
end
$numbered_slug_fix$;

do $numbered_slug_fix$
begin
  if exists (
    select 1
    from numbered_track_slug_fix f
    join public.wk_slug_redirects red
      on red.old_path = f.old_path
    where red.entity_type is distinct from 'track'
       or red.scope_slug is distinct from f.artist_slug
       or red.old_slug is distinct from f.old_slug
       or red.new_slug is distinct from f.new_slug
       or red.new_path is distinct from f.new_path
       or red.redirect_status is distinct from 308
  ) then
    raise exception
      'A conflicting redirect already exists for one or more legacy paths';
  end if;

  if exists (
    select 1
    from numbered_track_slug_fix f
    join public.wk_slug_redirects red
      on red.entity_type = 'track'
     and red.scope_slug = f.artist_slug
     and red.old_slug = f.old_slug
    where red.old_path is distinct from f.old_path
       or red.new_slug is distinct from f.new_slug
       or red.new_path is distinct from f.new_path
       or red.redirect_status is distinct from 308
  ) then
    raise exception
      'A conflicting scoped redirect already exists for one or more tracks';
  end if;
end
$numbered_slug_fix$;

insert into public.wk_slug_redirects (
  old_slug,
  new_slug,
  entity_type,
  scope_slug,
  old_path,
  new_path,
  redirect_status,
  created_by,
  updated_at
)
select
  f.old_slug,
  f.new_slug,
  'track',
  f.artist_slug,
  f.old_path,
  f.new_path,
  308,
  'legacy-numbered-slug-cleanup-20260712',
  now()
from numbered_track_slug_fix f
where not exists (
  select 1
  from public.wk_slug_redirects red
  where red.entity_type = 'track'
    and red.scope_slug = f.artist_slug
    and red.old_slug = f.old_slug
);

do $numbered_slug_fix$
declare
  v_redirect_count integer;
begin
  select count(*)
  into v_redirect_count
  from numbered_track_slug_fix f
  join public.wk_slug_redirects red
    on red.entity_type = 'track'
   and red.scope_slug = f.artist_slug
   and red.old_slug = f.old_slug
   and red.new_slug = f.new_slug
   and red.old_path = f.old_path
   and red.new_path = f.new_path
   and red.redirect_status = 308;

  if v_redirect_count <> 78 then
    raise exception
      'Expected 78 exact redirects before track updates, found %',
      v_redirect_count;
  end if;
end
$numbered_slug_fix$;

do $numbered_slug_fix$
declare
  v_updated_count integer;
begin
  with updated_tracks as (
    update public.registry_tracks t
    set
      slug = f.new_slug,
      updated_at = now()
    from numbered_track_slug_fix f
    where t.id = f.track_id
      and t.slug = f.old_slug
    returning t.id
  )
  select count(*)
  into v_updated_count
  from updated_tracks;

  if v_updated_count <> 78 then
    raise exception
      'Expected to update 78 tracks, updated %',
      v_updated_count;
  end if;
end
$numbered_slug_fix$;

do $numbered_slug_fix$
begin
  if exists (
    select 1
    from numbered_track_slug_fix f
    left join public.registry_tracks t
      on t.id = f.track_id
     and t.slug = f.new_slug
    where t.id is null
  ) then
    raise exception
      'Post-update verification failed for one or more tracks';
  end if;
end
$numbered_slug_fix$;

commit;
