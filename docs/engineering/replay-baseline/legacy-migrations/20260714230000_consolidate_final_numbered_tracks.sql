-- Complete the final numbered-track cleanup.
--
-- Classification SHA256:
--   59e6077cb4bc6f1278ff3a82e0edbd274a7fe1af00e0fed5f8b7d77c55b36444
-- Original survivor audit SHA256:
--   73b4f90fb54d7384295a29c0dcb3a255de172b9d1eefe4165d23500c722771b6
-- Original survivor plan SHA256:
--   a5bab3b244c5634a9aa392b11be637c8ba19ec226b18c3b1e6e330be7d261b2f
-- Final target audit SHA256:
--   3a44bcd3df5b5247298a34c6c750ba9031eb99654b1fd0760e30210d846029b2
-- Final target plan SHA256:
--   585a8e30d81de88572d95b4dd5bb79c34e041df3425447609c8c338f0586e290
--
-- Direct title-derived renames: 5
-- Valid numeric title slugs retained: 1
-- Exact duplicate groups: 15
-- Redundant tracks removed: 83
-- Unique legacy redirects: 85

begin;

select pg_advisory_xact_lock(
  hashtext(
    'wakilisha:consolidate-final-numbered-tracks'
  )
);

create temporary table wk_direct_track_renames (
  track_id uuid primary key,
  expected_title text not null,
  old_slug text not null,
  new_slug text not null,
  expected_status text not null,
  artist_slug text not null,
  expected_isrc text,
  apple_music_track_id text
) on commit drop;

insert into wk_direct_track_renames (
  track_id,
  expected_title,
  old_slug,
  new_slug,
  expected_status,
  artist_slug,
  expected_isrc,
  apple_music_track_id
)
values
  ('300e9bbe-cd77-4706-addc-31ed83bdc940'::uuid, 'Chocha', 'chocha-2', 'chocha', 'active', 'scooby-lincos', 'QZPYN2373595', '1700663235'),
  ('3c8ea376-5a7d-4d08-8c33-57a7150a23d1'::uuid, 'Dala', 'dala-2', 'dala', 'active', 'nina-ogot', 'USCGH1621288', '1076093968'),
  ('6842cec3-9a13-4647-8545-58f5a6fe82e0'::uuid, 'Njoo', 'njoo-4', 'njoo', 'active', 'binti', 'GBLFP1572882', '1089286848'),
  ('a0eafc8e-46d7-4f40-881e-e9b0991c7b8f'::uuid, 'Gynecologue', 'gynecologue-2', 'gynecologue', 'active', 'dr-chimano', 'FR0Z50084665', '1615996390'),
  ('ae6bed85-9e9f-4fec-a1e9-943f49118148'::uuid, 'Euphoria', 'euphoria-2', 'euphoria', 'active', 'toxic-lyrikali', 'QT3F72549425', '1844063569');

create temporary table wk_keep_valid_tracks (
  track_id uuid primary key,
  expected_title text not null,
  expected_slug text not null,
  expected_status text not null,
  artist_slug text not null,
  expected_isrc text,
  apple_music_track_id text
) on commit drop;

insert into wk_keep_valid_tracks (
  track_id,
  expected_title,
  expected_slug,
  expected_status,
  artist_slug,
  expected_isrc,
  apple_music_track_id
)
values
  ('ce7cc54b-4419-46ad-8c17-7051da01d2c9'::uuid, '1 Times 3', '1-times-3', 'needs_review', 'itsdeco', null, null);

create temporary table wk_duplicate_track_groups (
  group_key text primary key,
  artist_slug text not null,
  expected_title text not null,
  apple_music_track_id text,
  survivor_id uuid not null unique,
  survivor_old_slug text not null,
  survivor_status text not null,
  canonical_slug text not null,
  evidence_source text not null
) on commit drop;

insert into wk_duplicate_track_groups (
  group_key,
  artist_slug,
  expected_title,
  apple_music_track_id,
  survivor_id,
  survivor_old_slug,
  survivor_status,
  canonical_slug,
  evidence_source
)
values
  ('g01', 'afamefuna', 'better', '1797696763', '69ffab1c-c3e1-4f5d-b162-efd03a203b65'::uuid, 'better', 'needs_review', 'better', 'final_target_plan'),
  ('g02', 'bridget-blue', 'Ni Wewe', '1874914665', 'd7370b5c-1d64-4a98-85d0-f35d4f9dbd90'::uuid, 'ni-wewe', 'active', 'ni-wewe', 'original_survivor_plan'),
  ('g03', 'fena-gitu', 'Come My Way', '1855548300', '807345c4-daa5-41d4-941d-001a9dfca25b'::uuid, 'come-my-way', 'needs_review', 'come-my-way', 'original_survivor_plan'),
  ('g04', 'iyanii', 'Tamu', '1847292581', 'cf522b83-8634-4a47-819e-da784566263f'::uuid, 'tamu', 'active', 'tamu', 'original_survivor_plan'),
  ('g05', 'maandy', 'Baddies Need Love', '1792861380', 'b99137ed-bfa1-4256-995c-cca36ac6c3a1'::uuid, 'baddies-need-love', 'needs_review', 'baddies-need-love', 'final_target_plan'),
  ('g06', 'mastar-vk', '4:20', '1809911106', '1e740a0d-5a84-4b8a-b5a7-df33c2a8acee'::uuid, '4-20', 'needs_review', '4-20', 'final_target_plan'),
  ('g07', 'mutoriah', 'Day One', '1867471815', 'f7663b38-a95a-4d4c-b8b0-8e3f60ef07cd'::uuid, 'day-one', 'needs_review', 'day-one', 'original_survivor_plan'),
  ('g08', 'mwanaa', 'More', '1881108097', '6303a6ba-0c9a-415e-bb8f-f69a5eeae16b'::uuid, 'more-mwanaa', 'needs_review', 'more-mwanaa', 'original_survivor_plan'),
  ('g09', 'naiboi', '4mulla', '1821634384', '2ff5ac98-a38c-48ed-b33d-94f0e6f66b21'::uuid, '4mulla', 'needs_review', '4mulla', 'final_target_plan'),
  ('g10', 'njerae', 'Colors', '1846356753', 'aa2793e6-ed18-40a7-9654-dfd56769fcbe'::uuid, 'colors', 'needs_review', 'colors', 'original_survivor_plan'),
  ('g11', 'nyashinski', '1 of 1', '1832011216', '4cfb28a2-692a-4707-953b-100892d4726c'::uuid, '1-of-1', 'active', '1-of-1', 'final_target_plan'),
  ('g12', 'otile-brown', 'Ni Wewe', '6776239751', '71ffcf65-7369-4051-a667-f33333a301b7'::uuid, 'ni-wewe-otile-brown', 'needs_review', 'ni-wewe-otile-brown', 'original_survivor_plan'),
  ('g13', 'teslah', 'Brayo', '1876542282', '0fc8c8b3-ea9e-490c-83ec-fecc06e36119'::uuid, 'brayo', 'needs_review', 'brayo', 'original_survivor_plan'),
  ('g14', 'v-be', 'Better Love', '1878247424', '370ba0ce-6b7a-490b-af85-bf3844308f5b'::uuid, 'better-love', 'needs_review', 'better-love', 'original_survivor_plan'),
  ('g15', 'willy-paul', 'Keki', '1792819752', '3aa64aac-e704-4e7a-992b-ad94bc7b8f01'::uuid, 'keki', 'active', 'keki', 'original_survivor_plan');

create temporary table wk_duplicate_track_members (
  group_key text not null,
  track_id uuid primary key,
  expected_title text not null,
  expected_slug text not null,
  expected_status text not null,
  expected_isrc text,
  apple_music_track_id text
) on commit drop;

insert into wk_duplicate_track_members (
  group_key,
  track_id,
  expected_title,
  expected_slug,
  expected_status,
  expected_isrc,
  apple_music_track_id
)
values
  ('g01', '7b01cdcd-4a73-4608-9f06-c443cd6d5bc3'::uuid, 'better', 'better-afamefuna-2', 'archived', null, '1797696763'),
  ('g02', 'd6b8dd64-52ff-43f2-b02d-fe720d273fe4'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue', 'needs_review', null, '1874914665'),
  ('g02', 'a5dc12df-67e8-410c-8f5a-ab5e385b1d7f'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-2', 'archived', null, '1874914665'),
  ('g02', 'b33ade6c-d9c2-488e-9b23-4ac5fc635bdd'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-3', 'archived', null, '1874914665'),
  ('g02', '9b483868-79a4-4791-8da7-37df34f641f2'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-4', 'archived', null, '1874914665'),
  ('g02', 'c2f244f0-ae1e-4234-a30c-c7c7e415caa7'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-5', 'archived', null, '1874914665'),
  ('g02', '2dd6500d-cb31-4c29-b8ad-ce0c5f220c60'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-6', 'archived', null, '1874914665'),
  ('g02', 'e51916e8-02fc-4e81-bf80-0c7f0fc3cd68'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-7', 'archived', null, '1874914665'),
  ('g02', '35821b24-bdbb-4f84-b4a7-ecf070d4608a'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-8', 'archived', null, '1874914665'),
  ('g02', '23f5a276-4778-4113-ad71-5728d61f80d5'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-9', 'archived', null, '1874914665'),
  ('g03', '69b8785a-6497-4318-9b5e-96e7ee77d5e3'::uuid, 'Come My Way', 'come-my-way-fena-gitu-10', 'archived', null, '1855548300'),
  ('g03', '6ef7333d-89a7-4eaa-9d26-7c551c19669a'::uuid, 'Come My Way', 'come-my-way-fena-gitu-2', 'archived', null, '1855548300'),
  ('g03', '35c8d750-747d-4593-a75d-b8c01b041665'::uuid, 'Come My Way', 'come-my-way-fena-gitu-3', 'archived', null, '1855548300'),
  ('g03', '60d00f50-3727-4dce-9378-f03e48dd10fd'::uuid, 'Come My Way', 'come-my-way-fena-gitu-4', 'archived', null, '1855548300'),
  ('g03', '0648547e-f9a4-4531-884c-d99fcf0e553a'::uuid, 'Come My Way', 'come-my-way-fena-gitu-5', 'archived', null, '1855548300'),
  ('g03', '1f7309b9-f8de-4b1b-8009-aca813b85407'::uuid, 'Come My Way', 'come-my-way-fena-gitu-6', 'archived', null, '1855548300'),
  ('g03', 'cfa6d46a-bc88-4dd8-be8a-aa16701a91da'::uuid, 'Come My Way', 'come-my-way-fena-gitu-7', 'archived', null, '1855548300'),
  ('g03', '0493b964-80c3-4be7-8c7b-a3b79118755e'::uuid, 'Come My Way', 'come-my-way-fena-gitu-8', 'archived', null, '1855548300'),
  ('g03', '0d624126-59c2-4689-80d2-58ae6e2a8379'::uuid, 'Come My Way', 'come-my-way-fena-gitu-9', 'archived', null, '1855548300'),
  ('g04', 'ad05629c-e358-42e2-bdf2-df76fd9520a2'::uuid, 'Tamu', 'tamu-iyanii', 'needs_review', null, '1847292581'),
  ('g04', '3e3efbe0-1157-4e67-b752-329780165082'::uuid, 'Tamu', 'tamu-iyanii-10', 'archived', null, '1847292581'),
  ('g04', 'f708481e-c537-4059-bfa9-6aceee8cf891'::uuid, 'Tamu', 'tamu-iyanii-2', 'archived', null, '1847292581'),
  ('g04', '6c1c59bc-850e-4e44-9a51-c3200e15500d'::uuid, 'Tamu', 'tamu-iyanii-3', 'archived', null, '1847292581'),
  ('g04', 'de104c77-24a3-487f-8409-309d1928844a'::uuid, 'Tamu', 'tamu-iyanii-4', 'archived', null, '1847292581'),
  ('g04', '607b598b-6862-43bd-9d16-65bb7f891da2'::uuid, 'Tamu', 'tamu-iyanii-5', 'archived', null, '1847292581'),
  ('g04', '7934a3cd-4774-4e9f-bc98-12f669cb43ba'::uuid, 'Tamu', 'tamu-iyanii-6', 'archived', null, '1847292581'),
  ('g04', '45d07631-fbc5-44e0-84e5-5e90fb39a074'::uuid, 'Tamu', 'tamu-iyanii-7', 'archived', null, '1847292581'),
  ('g04', '10cd8863-7bbc-42b5-b33b-e8bcec070f41'::uuid, 'Tamu', 'tamu-iyanii-8', 'archived', null, '1847292581'),
  ('g04', 'ad316c60-d434-49f0-9754-c771a6dd66ac'::uuid, 'Tamu', 'tamu-iyanii-9', 'archived', null, '1847292581'),
  ('g05', 'e8716f1c-0aff-4484-8f15-d3649eb1de8d'::uuid, 'Baddies Need Love', 'baddies-need-love-maandy-2', 'archived', null, '1792861380'),
  ('g06', 'bfa569f7-c7f8-41fe-bfa5-1f234a72ddcb'::uuid, '4:20', '4-20', 'needs_review', null, '1809911106'),
  ('g07', 'e98f1618-ca69-43e1-8fd5-5e93ae47b16a'::uuid, 'Day One', 'day-one-mutoriah-2', 'archived', null, '1867471815'),
  ('g07', '94eb5acf-50d0-4a35-ab5e-e4e35e4bc68a'::uuid, 'Day One', 'day-one-mutoriah-3', 'archived', null, '1867471815'),
  ('g07', '9f6e031a-9674-4c6d-875c-0b4daaf2213d'::uuid, 'Day One', 'day-one-mutoriah-4', 'archived', null, '1867471815'),
  ('g07', '7969024d-b9ed-4c84-9f01-3fb16653c1e4'::uuid, 'Day One', 'day-one-mutoriah-5', 'archived', null, '1867471815'),
  ('g07', '6c9b80a9-9d22-4d05-9cbf-4e7c2542f970'::uuid, 'Day One', 'day-one-mutoriah-6', 'archived', null, '1867471815'),
  ('g07', 'bd9cd195-6994-4ca4-af1e-de6e9e6af343'::uuid, 'Day One', 'day-one-mutoriah-7', 'archived', null, '1867471815'),
  ('g07', 'ed26df14-77d6-4706-88e6-0347908a5bd0'::uuid, 'Day One', 'day-one-mutoriah-8', 'archived', null, '1867471815'),
  ('g07', '5dd62d1c-25e8-41a0-bb03-5dd331d6edb1'::uuid, 'Day One', 'day-one-mutoriah-9', 'archived', null, '1867471815'),
  ('g08', '428042ce-3084-40e4-a057-98edce57082b'::uuid, 'More', 'more-mwanaa-2', 'archived', null, '1881108097'),
  ('g08', 'd8a4743f-dec0-4f81-b077-40e9c0498d5f'::uuid, 'More', 'more-mwanaa-3', 'archived', null, '1881108097'),
  ('g08', '1f48b263-c1a8-4079-9d81-7d5f44f0964a'::uuid, 'More', 'more-mwanaa-4', 'archived', null, '1881108097'),
  ('g08', '2364b4b9-7968-4ef6-a993-c453544a4723'::uuid, 'More', 'more-mwanaa-5', 'archived', null, '1881108097'),
  ('g08', '4249250d-2e11-453b-93d6-7760e3d79b5f'::uuid, 'More', 'more-mwanaa-6', 'archived', null, '1881108097'),
  ('g08', '16710a72-c1ef-4498-a1d8-7ae018928ab7'::uuid, 'More', 'more-mwanaa-7', 'archived', null, '1881108097'),
  ('g08', '50f14f6c-5f34-4fc1-8596-532e70fe16ec'::uuid, 'More', 'more-mwanaa-8', 'archived', null, '1881108097'),
  ('g08', '0f1f8421-74b6-4ddf-a5ed-422f3521adfd'::uuid, 'More', 'more-mwanaa-9', 'archived', null, '1881108097'),
  ('g09', '997748c3-d125-40c3-b210-a41ff66ec36b'::uuid, '4mulla', '4mulla-naiboi-2', 'archived', null, '1821634384'),
  ('g10', '1deba214-d1ce-437d-9467-85dc59ebf1fa'::uuid, 'Colors', 'colors-njerae-10', 'archived', null, '1846356753'),
  ('g10', 'bfc47b7b-1ad9-4eb2-8648-1ab1ca83a129'::uuid, 'Colors', 'colors-njerae-2', 'archived', null, '1846356753'),
  ('g10', '56a64cb0-04ff-47cc-902f-2cae9c39e679'::uuid, 'Colors', 'colors-njerae-3', 'archived', null, '1846356753'),
  ('g10', '8630fa00-33ce-4dac-934b-9c3e86f3ce29'::uuid, 'Colors', 'colors-njerae-4', 'archived', null, '1846356753'),
  ('g10', 'e36310b0-f2c8-44a0-b4f4-3d1ea73b6ebd'::uuid, 'Colors', 'colors-njerae-5', 'archived', null, '1846356753'),
  ('g10', '673ad674-814b-4b16-8a61-e8ab05872174'::uuid, 'Colors', 'colors-njerae-6', 'archived', null, '1846356753'),
  ('g10', '9d51c0b5-8d39-44a0-b916-c5f8991133c7'::uuid, 'Colors', 'colors-njerae-7', 'archived', null, '1846356753'),
  ('g10', 'fe7a77e2-52ed-4fa9-ba50-f3bef822c112'::uuid, 'Colors', 'colors-njerae-8', 'archived', null, '1846356753'),
  ('g10', 'e90898af-1895-4b5d-a63f-826ec30a1256'::uuid, 'Colors', 'colors-njerae-9', 'archived', null, '1846356753'),
  ('g11', '9e86c109-0fb1-4715-bf1b-ce551156c930'::uuid, '1 of 1', '1-of-1', 'needs_review', null, '1832011216'),
  ('g11', 'd5845133-aae5-4bf3-9330-39389616470c'::uuid, '1 of 1', '1-of-1', 'needs_review', null, '1832011216'),
  ('g12', 'a0a309fd-8145-42da-ba75-9f1e7c7df85f'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-2', 'archived', null, '6776239751'),
  ('g12', '3c11f43d-1a66-407d-bc3e-28feb076eb6d'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-3', 'archived', null, '6776239751'),
  ('g12', '5a57358e-fb37-44b8-8db7-1192c420d5a1'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-4', 'archived', null, '6776239751'),
  ('g12', '54ce9f87-8e44-48c7-9877-832536f51239'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-5', 'archived', null, '6776239751'),
  ('g12', 'e66f2fb2-edd4-4864-94a6-a09c287566d4'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-6', 'archived', null, '6776239751'),
  ('g12', 'f60f207e-17df-4127-a7e4-35c34399ab65'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-7', 'archived', null, '6776239751'),
  ('g12', '53a0043e-2634-4ee4-8af2-f27118b93b80'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-8', 'archived', null, '6776239751'),
  ('g13', 'b6f2e8ea-ead8-4db0-b42b-1e712e369611'::uuid, 'Brayo', 'brayo-teslah-2', 'archived', null, '1876542282'),
  ('g13', '3fac4ce7-37b7-4a52-ab90-50a67622c59c'::uuid, 'Brayo', 'brayo-teslah-3', 'archived', null, '1876542282'),
  ('g13', '1ec7334b-7ba4-4556-89a0-a403a265b116'::uuid, 'Brayo', 'brayo-teslah-4', 'archived', null, '1876542282'),
  ('g13', '00017a6d-a062-45b6-865d-c929f74133d7'::uuid, 'Brayo', 'brayo-teslah-5', 'archived', null, '1876542282'),
  ('g13', 'f7cf445e-dbe6-4358-9086-9b2b1b1fe69e'::uuid, 'Brayo', 'brayo-teslah-6', 'archived', null, '1876542282'),
  ('g13', '4e5dc57a-ebb2-4cba-a4a2-ad2384105930'::uuid, 'Brayo', 'brayo-teslah-7', 'archived', null, '1876542282'),
  ('g13', 'cbfb9a08-0033-432b-ad46-f1c2d42f70c7'::uuid, 'Brayo', 'brayo-teslah-8', 'archived', null, '1876542282'),
  ('g13', '2c1f115a-963f-44a8-956c-9ce4683a6541'::uuid, 'Brayo', 'brayo-teslah-9', 'archived', null, '1876542282'),
  ('g14', 'fad3407f-0aff-48aa-af90-d4c3deaedf6a'::uuid, 'Better Love', 'better-love-v-be-2', 'archived', null, '1878247424'),
  ('g14', 'c139415a-9f0d-44c4-b5ea-123a8f66b97a'::uuid, 'Better Love', 'better-love-v-be-3', 'archived', null, '1878247424'),
  ('g14', '53a0b7dc-92a5-45a9-a767-5bffd63dcaf3'::uuid, 'Better Love', 'better-love-v-be-4', 'archived', null, '1878247424'),
  ('g14', '610f0d41-6593-49e3-9b0e-154e58b90607'::uuid, 'Better Love', 'better-love-v-be-5', 'archived', null, '1878247424'),
  ('g14', '6f77cee0-f838-4d3d-b9c5-540bcc48b6f1'::uuid, 'Better Love', 'better-love-v-be-6', 'archived', null, '1878247424'),
  ('g14', 'c65fa47c-df83-4957-bec4-543ffb9a6e2c'::uuid, 'Better Love', 'better-love-v-be-7', 'archived', null, '1878247424'),
  ('g14', '43b29d4a-3ae3-4a1e-9cab-9d9fc43a8e16'::uuid, 'Better Love', 'better-love-v-be-8', 'archived', null, '1878247424'),
  ('g15', '869af97b-9d3f-4e9d-8e09-e29e11c8dda8'::uuid, 'Keki', 'keki-willy-paul', 'needs_review', null, '1792819752'),
  ('g15', '255fb1af-8b3c-4565-8df1-b8b8b8b60d1f'::uuid, 'Keki', 'keki-willy-paul-2', 'archived', null, '1792819752');

create temporary table wk_track_cleanup_redirects (
  source_track_id uuid not null,
  redirect_kind text not null,
  artist_slug text not null,
  old_slug text not null,
  new_slug text not null,
  old_path text primary key,
  new_path text not null
) on commit drop;

insert into wk_track_cleanup_redirects (
  source_track_id,
  redirect_kind,
  artist_slug,
  old_slug,
  new_slug,
  old_path,
  new_path
)
values
  ('7b01cdcd-4a73-4608-9f06-c443cd6d5bc3'::uuid, 'duplicate_consolidation', 'afamefuna', 'better-afamefuna-2', 'better', '/tracks/afamefuna/better-afamefuna-2', '/tracks/afamefuna/better'),
  ('6842cec3-9a13-4647-8545-58f5a6fe82e0'::uuid, 'direct_rename', 'binti', 'njoo-4', 'njoo', '/tracks/binti/njoo-4', '/tracks/binti/njoo'),
  ('d6b8dd64-52ff-43f2-b02d-fe720d273fe4'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue', '/tracks/bridget-blue/ni-wewe'),
  ('a5dc12df-67e8-410c-8f5a-ab5e385b1d7f'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue-2', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue-2', '/tracks/bridget-blue/ni-wewe'),
  ('b33ade6c-d9c2-488e-9b23-4ac5fc635bdd'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue-3', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue-3', '/tracks/bridget-blue/ni-wewe'),
  ('9b483868-79a4-4791-8da7-37df34f641f2'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue-4', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue-4', '/tracks/bridget-blue/ni-wewe'),
  ('c2f244f0-ae1e-4234-a30c-c7c7e415caa7'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue-5', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue-5', '/tracks/bridget-blue/ni-wewe'),
  ('2dd6500d-cb31-4c29-b8ad-ce0c5f220c60'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue-6', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue-6', '/tracks/bridget-blue/ni-wewe'),
  ('e51916e8-02fc-4e81-bf80-0c7f0fc3cd68'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue-7', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue-7', '/tracks/bridget-blue/ni-wewe'),
  ('35821b24-bdbb-4f84-b4a7-ecf070d4608a'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue-8', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue-8', '/tracks/bridget-blue/ni-wewe'),
  ('23f5a276-4778-4113-ad71-5728d61f80d5'::uuid, 'duplicate_consolidation', 'bridget-blue', 'ni-wewe-bridget-blue-9', 'ni-wewe', '/tracks/bridget-blue/ni-wewe-bridget-blue-9', '/tracks/bridget-blue/ni-wewe'),
  ('a0eafc8e-46d7-4f40-881e-e9b0991c7b8f'::uuid, 'direct_rename', 'dr-chimano', 'gynecologue-2', 'gynecologue', '/tracks/dr-chimano/gynecologue-2', '/tracks/dr-chimano/gynecologue'),
  ('69b8785a-6497-4318-9b5e-96e7ee77d5e3'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-10', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-10', '/tracks/fena-gitu/come-my-way'),
  ('6ef7333d-89a7-4eaa-9d26-7c551c19669a'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-2', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-2', '/tracks/fena-gitu/come-my-way'),
  ('35c8d750-747d-4593-a75d-b8c01b041665'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-3', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-3', '/tracks/fena-gitu/come-my-way'),
  ('60d00f50-3727-4dce-9378-f03e48dd10fd'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-4', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-4', '/tracks/fena-gitu/come-my-way'),
  ('0648547e-f9a4-4531-884c-d99fcf0e553a'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-5', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-5', '/tracks/fena-gitu/come-my-way'),
  ('1f7309b9-f8de-4b1b-8009-aca813b85407'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-6', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-6', '/tracks/fena-gitu/come-my-way'),
  ('cfa6d46a-bc88-4dd8-be8a-aa16701a91da'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-7', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-7', '/tracks/fena-gitu/come-my-way'),
  ('0493b964-80c3-4be7-8c7b-a3b79118755e'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-8', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-8', '/tracks/fena-gitu/come-my-way'),
  ('0d624126-59c2-4689-80d2-58ae6e2a8379'::uuid, 'duplicate_consolidation', 'fena-gitu', 'come-my-way-fena-gitu-9', 'come-my-way', '/tracks/fena-gitu/come-my-way-fena-gitu-9', '/tracks/fena-gitu/come-my-way'),
  ('ad05629c-e358-42e2-bdf2-df76fd9520a2'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii', 'tamu', '/tracks/iyanii/tamu-iyanii', '/tracks/iyanii/tamu'),
  ('3e3efbe0-1157-4e67-b752-329780165082'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-10', 'tamu', '/tracks/iyanii/tamu-iyanii-10', '/tracks/iyanii/tamu'),
  ('f708481e-c537-4059-bfa9-6aceee8cf891'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-2', 'tamu', '/tracks/iyanii/tamu-iyanii-2', '/tracks/iyanii/tamu'),
  ('6c1c59bc-850e-4e44-9a51-c3200e15500d'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-3', 'tamu', '/tracks/iyanii/tamu-iyanii-3', '/tracks/iyanii/tamu'),
  ('de104c77-24a3-487f-8409-309d1928844a'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-4', 'tamu', '/tracks/iyanii/tamu-iyanii-4', '/tracks/iyanii/tamu'),
  ('607b598b-6862-43bd-9d16-65bb7f891da2'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-5', 'tamu', '/tracks/iyanii/tamu-iyanii-5', '/tracks/iyanii/tamu'),
  ('7934a3cd-4774-4e9f-bc98-12f669cb43ba'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-6', 'tamu', '/tracks/iyanii/tamu-iyanii-6', '/tracks/iyanii/tamu'),
  ('45d07631-fbc5-44e0-84e5-5e90fb39a074'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-7', 'tamu', '/tracks/iyanii/tamu-iyanii-7', '/tracks/iyanii/tamu'),
  ('10cd8863-7bbc-42b5-b33b-e8bcec070f41'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-8', 'tamu', '/tracks/iyanii/tamu-iyanii-8', '/tracks/iyanii/tamu'),
  ('ad316c60-d434-49f0-9754-c771a6dd66ac'::uuid, 'duplicate_consolidation', 'iyanii', 'tamu-iyanii-9', 'tamu', '/tracks/iyanii/tamu-iyanii-9', '/tracks/iyanii/tamu'),
  ('e8716f1c-0aff-4484-8f15-d3649eb1de8d'::uuid, 'duplicate_consolidation', 'maandy', 'baddies-need-love-maandy-2', 'baddies-need-love', '/tracks/maandy/baddies-need-love-maandy-2', '/tracks/maandy/baddies-need-love'),
  ('e98f1618-ca69-43e1-8fd5-5e93ae47b16a'::uuid, 'duplicate_consolidation', 'mutoriah', 'day-one-mutoriah-2', 'day-one', '/tracks/mutoriah/day-one-mutoriah-2', '/tracks/mutoriah/day-one'),
  ('94eb5acf-50d0-4a35-ab5e-e4e35e4bc68a'::uuid, 'duplicate_consolidation', 'mutoriah', 'day-one-mutoriah-3', 'day-one', '/tracks/mutoriah/day-one-mutoriah-3', '/tracks/mutoriah/day-one'),
  ('9f6e031a-9674-4c6d-875c-0b4daaf2213d'::uuid, 'duplicate_consolidation', 'mutoriah', 'day-one-mutoriah-4', 'day-one', '/tracks/mutoriah/day-one-mutoriah-4', '/tracks/mutoriah/day-one'),
  ('7969024d-b9ed-4c84-9f01-3fb16653c1e4'::uuid, 'duplicate_consolidation', 'mutoriah', 'day-one-mutoriah-5', 'day-one', '/tracks/mutoriah/day-one-mutoriah-5', '/tracks/mutoriah/day-one'),
  ('6c9b80a9-9d22-4d05-9cbf-4e7c2542f970'::uuid, 'duplicate_consolidation', 'mutoriah', 'day-one-mutoriah-6', 'day-one', '/tracks/mutoriah/day-one-mutoriah-6', '/tracks/mutoriah/day-one'),
  ('bd9cd195-6994-4ca4-af1e-de6e9e6af343'::uuid, 'duplicate_consolidation', 'mutoriah', 'day-one-mutoriah-7', 'day-one', '/tracks/mutoriah/day-one-mutoriah-7', '/tracks/mutoriah/day-one'),
  ('ed26df14-77d6-4706-88e6-0347908a5bd0'::uuid, 'duplicate_consolidation', 'mutoriah', 'day-one-mutoriah-8', 'day-one', '/tracks/mutoriah/day-one-mutoriah-8', '/tracks/mutoriah/day-one'),
  ('5dd62d1c-25e8-41a0-bb03-5dd331d6edb1'::uuid, 'duplicate_consolidation', 'mutoriah', 'day-one-mutoriah-9', 'day-one', '/tracks/mutoriah/day-one-mutoriah-9', '/tracks/mutoriah/day-one'),
  ('428042ce-3084-40e4-a057-98edce57082b'::uuid, 'duplicate_consolidation', 'mwanaa', 'more-mwanaa-2', 'more-mwanaa', '/tracks/mwanaa/more-mwanaa-2', '/tracks/mwanaa/more-mwanaa'),
  ('d8a4743f-dec0-4f81-b077-40e9c0498d5f'::uuid, 'duplicate_consolidation', 'mwanaa', 'more-mwanaa-3', 'more-mwanaa', '/tracks/mwanaa/more-mwanaa-3', '/tracks/mwanaa/more-mwanaa'),
  ('1f48b263-c1a8-4079-9d81-7d5f44f0964a'::uuid, 'duplicate_consolidation', 'mwanaa', 'more-mwanaa-4', 'more-mwanaa', '/tracks/mwanaa/more-mwanaa-4', '/tracks/mwanaa/more-mwanaa'),
  ('2364b4b9-7968-4ef6-a993-c453544a4723'::uuid, 'duplicate_consolidation', 'mwanaa', 'more-mwanaa-5', 'more-mwanaa', '/tracks/mwanaa/more-mwanaa-5', '/tracks/mwanaa/more-mwanaa'),
  ('4249250d-2e11-453b-93d6-7760e3d79b5f'::uuid, 'duplicate_consolidation', 'mwanaa', 'more-mwanaa-6', 'more-mwanaa', '/tracks/mwanaa/more-mwanaa-6', '/tracks/mwanaa/more-mwanaa'),
  ('16710a72-c1ef-4498-a1d8-7ae018928ab7'::uuid, 'duplicate_consolidation', 'mwanaa', 'more-mwanaa-7', 'more-mwanaa', '/tracks/mwanaa/more-mwanaa-7', '/tracks/mwanaa/more-mwanaa'),
  ('50f14f6c-5f34-4fc1-8596-532e70fe16ec'::uuid, 'duplicate_consolidation', 'mwanaa', 'more-mwanaa-8', 'more-mwanaa', '/tracks/mwanaa/more-mwanaa-8', '/tracks/mwanaa/more-mwanaa'),
  ('0f1f8421-74b6-4ddf-a5ed-422f3521adfd'::uuid, 'duplicate_consolidation', 'mwanaa', 'more-mwanaa-9', 'more-mwanaa', '/tracks/mwanaa/more-mwanaa-9', '/tracks/mwanaa/more-mwanaa'),
  ('997748c3-d125-40c3-b210-a41ff66ec36b'::uuid, 'duplicate_consolidation', 'naiboi', '4mulla-naiboi-2', '4mulla', '/tracks/naiboi/4mulla-naiboi-2', '/tracks/naiboi/4mulla'),
  ('3c8ea376-5a7d-4d08-8c33-57a7150a23d1'::uuid, 'direct_rename', 'nina-ogot', 'dala-2', 'dala', '/tracks/nina-ogot/dala-2', '/tracks/nina-ogot/dala'),
  ('1deba214-d1ce-437d-9467-85dc59ebf1fa'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-10', 'colors', '/tracks/njerae/colors-njerae-10', '/tracks/njerae/colors'),
  ('bfc47b7b-1ad9-4eb2-8648-1ab1ca83a129'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-2', 'colors', '/tracks/njerae/colors-njerae-2', '/tracks/njerae/colors'),
  ('56a64cb0-04ff-47cc-902f-2cae9c39e679'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-3', 'colors', '/tracks/njerae/colors-njerae-3', '/tracks/njerae/colors'),
  ('8630fa00-33ce-4dac-934b-9c3e86f3ce29'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-4', 'colors', '/tracks/njerae/colors-njerae-4', '/tracks/njerae/colors'),
  ('e36310b0-f2c8-44a0-b4f4-3d1ea73b6ebd'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-5', 'colors', '/tracks/njerae/colors-njerae-5', '/tracks/njerae/colors'),
  ('673ad674-814b-4b16-8a61-e8ab05872174'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-6', 'colors', '/tracks/njerae/colors-njerae-6', '/tracks/njerae/colors'),
  ('9d51c0b5-8d39-44a0-b916-c5f8991133c7'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-7', 'colors', '/tracks/njerae/colors-njerae-7', '/tracks/njerae/colors'),
  ('fe7a77e2-52ed-4fa9-ba50-f3bef822c112'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-8', 'colors', '/tracks/njerae/colors-njerae-8', '/tracks/njerae/colors'),
  ('e90898af-1895-4b5d-a63f-826ec30a1256'::uuid, 'duplicate_consolidation', 'njerae', 'colors-njerae-9', 'colors', '/tracks/njerae/colors-njerae-9', '/tracks/njerae/colors'),
  ('a0a309fd-8145-42da-ba75-9f1e7c7df85f'::uuid, 'duplicate_consolidation', 'otile-brown', 'ni-wewe-otile-brown-2', 'ni-wewe-otile-brown', '/tracks/otile-brown/ni-wewe-otile-brown-2', '/tracks/otile-brown/ni-wewe-otile-brown'),
  ('3c11f43d-1a66-407d-bc3e-28feb076eb6d'::uuid, 'duplicate_consolidation', 'otile-brown', 'ni-wewe-otile-brown-3', 'ni-wewe-otile-brown', '/tracks/otile-brown/ni-wewe-otile-brown-3', '/tracks/otile-brown/ni-wewe-otile-brown'),
  ('5a57358e-fb37-44b8-8db7-1192c420d5a1'::uuid, 'duplicate_consolidation', 'otile-brown', 'ni-wewe-otile-brown-4', 'ni-wewe-otile-brown', '/tracks/otile-brown/ni-wewe-otile-brown-4', '/tracks/otile-brown/ni-wewe-otile-brown'),
  ('54ce9f87-8e44-48c7-9877-832536f51239'::uuid, 'duplicate_consolidation', 'otile-brown', 'ni-wewe-otile-brown-5', 'ni-wewe-otile-brown', '/tracks/otile-brown/ni-wewe-otile-brown-5', '/tracks/otile-brown/ni-wewe-otile-brown'),
  ('e66f2fb2-edd4-4864-94a6-a09c287566d4'::uuid, 'duplicate_consolidation', 'otile-brown', 'ni-wewe-otile-brown-6', 'ni-wewe-otile-brown', '/tracks/otile-brown/ni-wewe-otile-brown-6', '/tracks/otile-brown/ni-wewe-otile-brown'),
  ('f60f207e-17df-4127-a7e4-35c34399ab65'::uuid, 'duplicate_consolidation', 'otile-brown', 'ni-wewe-otile-brown-7', 'ni-wewe-otile-brown', '/tracks/otile-brown/ni-wewe-otile-brown-7', '/tracks/otile-brown/ni-wewe-otile-brown'),
  ('53a0043e-2634-4ee4-8af2-f27118b93b80'::uuid, 'duplicate_consolidation', 'otile-brown', 'ni-wewe-otile-brown-8', 'ni-wewe-otile-brown', '/tracks/otile-brown/ni-wewe-otile-brown-8', '/tracks/otile-brown/ni-wewe-otile-brown'),
  ('300e9bbe-cd77-4706-addc-31ed83bdc940'::uuid, 'direct_rename', 'scooby-lincos', 'chocha-2', 'chocha', '/tracks/scooby-lincos/chocha-2', '/tracks/scooby-lincos/chocha'),
  ('b6f2e8ea-ead8-4db0-b42b-1e712e369611'::uuid, 'duplicate_consolidation', 'teslah', 'brayo-teslah-2', 'brayo', '/tracks/teslah/brayo-teslah-2', '/tracks/teslah/brayo'),
  ('3fac4ce7-37b7-4a52-ab90-50a67622c59c'::uuid, 'duplicate_consolidation', 'teslah', 'brayo-teslah-3', 'brayo', '/tracks/teslah/brayo-teslah-3', '/tracks/teslah/brayo'),
  ('1ec7334b-7ba4-4556-89a0-a403a265b116'::uuid, 'duplicate_consolidation', 'teslah', 'brayo-teslah-4', 'brayo', '/tracks/teslah/brayo-teslah-4', '/tracks/teslah/brayo'),
  ('00017a6d-a062-45b6-865d-c929f74133d7'::uuid, 'duplicate_consolidation', 'teslah', 'brayo-teslah-5', 'brayo', '/tracks/teslah/brayo-teslah-5', '/tracks/teslah/brayo'),
  ('f7cf445e-dbe6-4358-9086-9b2b1b1fe69e'::uuid, 'duplicate_consolidation', 'teslah', 'brayo-teslah-6', 'brayo', '/tracks/teslah/brayo-teslah-6', '/tracks/teslah/brayo'),
  ('4e5dc57a-ebb2-4cba-a4a2-ad2384105930'::uuid, 'duplicate_consolidation', 'teslah', 'brayo-teslah-7', 'brayo', '/tracks/teslah/brayo-teslah-7', '/tracks/teslah/brayo'),
  ('cbfb9a08-0033-432b-ad46-f1c2d42f70c7'::uuid, 'duplicate_consolidation', 'teslah', 'brayo-teslah-8', 'brayo', '/tracks/teslah/brayo-teslah-8', '/tracks/teslah/brayo'),
  ('2c1f115a-963f-44a8-956c-9ce4683a6541'::uuid, 'duplicate_consolidation', 'teslah', 'brayo-teslah-9', 'brayo', '/tracks/teslah/brayo-teslah-9', '/tracks/teslah/brayo'),
  ('ae6bed85-9e9f-4fec-a1e9-943f49118148'::uuid, 'direct_rename', 'toxic-lyrikali', 'euphoria-2', 'euphoria', '/tracks/toxic-lyrikali/euphoria-2', '/tracks/toxic-lyrikali/euphoria'),
  ('fad3407f-0aff-48aa-af90-d4c3deaedf6a'::uuid, 'duplicate_consolidation', 'v-be', 'better-love-v-be-2', 'better-love', '/tracks/v-be/better-love-v-be-2', '/tracks/v-be/better-love'),
  ('c139415a-9f0d-44c4-b5ea-123a8f66b97a'::uuid, 'duplicate_consolidation', 'v-be', 'better-love-v-be-3', 'better-love', '/tracks/v-be/better-love-v-be-3', '/tracks/v-be/better-love'),
  ('53a0b7dc-92a5-45a9-a767-5bffd63dcaf3'::uuid, 'duplicate_consolidation', 'v-be', 'better-love-v-be-4', 'better-love', '/tracks/v-be/better-love-v-be-4', '/tracks/v-be/better-love'),
  ('610f0d41-6593-49e3-9b0e-154e58b90607'::uuid, 'duplicate_consolidation', 'v-be', 'better-love-v-be-5', 'better-love', '/tracks/v-be/better-love-v-be-5', '/tracks/v-be/better-love'),
  ('6f77cee0-f838-4d3d-b9c5-540bcc48b6f1'::uuid, 'duplicate_consolidation', 'v-be', 'better-love-v-be-6', 'better-love', '/tracks/v-be/better-love-v-be-6', '/tracks/v-be/better-love'),
  ('c65fa47c-df83-4957-bec4-543ffb9a6e2c'::uuid, 'duplicate_consolidation', 'v-be', 'better-love-v-be-7', 'better-love', '/tracks/v-be/better-love-v-be-7', '/tracks/v-be/better-love'),
  ('43b29d4a-3ae3-4a1e-9cab-9d9fc43a8e16'::uuid, 'duplicate_consolidation', 'v-be', 'better-love-v-be-8', 'better-love', '/tracks/v-be/better-love-v-be-8', '/tracks/v-be/better-love'),
  ('869af97b-9d3f-4e9d-8e09-e29e11c8dda8'::uuid, 'duplicate_consolidation', 'willy-paul', 'keki-willy-paul', 'keki', '/tracks/willy-paul/keki-willy-paul', '/tracks/willy-paul/keki'),
  ('255fb1af-8b3c-4565-8df1-b8b8b8b60d1f'::uuid, 'duplicate_consolidation', 'willy-paul', 'keki-willy-paul-2', 'keki', '/tracks/willy-paul/keki-willy-paul-2', '/tracks/willy-paul/keki');

do $preconditions$
declare
  v_count integer;
begin
  if to_regclass(
    'public.wk_slug_redirects_scoped_path_unique'
  ) is null then
    raise exception
      'STOP: Path-aware scoped redirect index is missing';
  end if;

  if to_regclass(
    'public.wk_slug_redirects_scoped_entity_unique'
  ) is not null then
    raise exception
      'STOP: Legacy scoped redirect index still exists';
  end if;

  if (
    select count(*)
    from wk_direct_track_renames
  ) <> 5 then
    raise exception
      'STOP: Direct-rename manifest count changed';
  end if;

  if (
    select count(*)
    from wk_keep_valid_tracks
  ) <> 1 then
    raise exception
      'STOP: Keep-valid manifest count changed';
  end if;

  if (
    select count(*)
    from wk_duplicate_track_groups
  ) <> 15 then
    raise exception
      'STOP: Duplicate-group manifest count changed';
  end if;

  if (
    select count(*)
    from wk_duplicate_track_members
  ) <> 83 then
    raise exception
      'STOP: Duplicate-member manifest count changed';
  end if;

  if (
    select count(*)
    from wk_track_cleanup_redirects
  ) <> 85 then
    raise exception
      'STOP: Redirect manifest count changed';
  end if;

  if exists (
    select 1
    from wk_duplicate_track_members duplicate_member
    join wk_duplicate_track_groups duplicate_group
      on duplicate_group.survivor_id =
        duplicate_member.track_id
  ) then
    raise exception
      'STOP: A survivor is included among redundant tracks';
  end if;

  if exists (
    select 1
    from wk_direct_track_renames direct_track
    where exists (
      select 1
      from wk_keep_valid_tracks keep_track
      where keep_track.track_id =
        direct_track.track_id
    )
    or exists (
      select 1
      from wk_duplicate_track_groups duplicate_group
      where duplicate_group.survivor_id =
        direct_track.track_id
    )
    or exists (
      select 1
      from wk_duplicate_track_members duplicate_member
      where duplicate_member.track_id =
        direct_track.track_id
    )
  ) then
    raise exception
      'STOP: A direct rename overlaps another action';
  end if;

  if exists (
    select 1
    from wk_keep_valid_tracks keep_track
    where exists (
      select 1
      from wk_duplicate_track_groups duplicate_group
      where duplicate_group.survivor_id =
        keep_track.track_id
    )
    or exists (
      select 1
      from wk_duplicate_track_members duplicate_member
      where duplicate_member.track_id =
        keep_track.track_id
    )
  ) then
    raise exception
      'STOP: A keep-valid track overlaps a duplicate action';
  end if;

  if exists (
    select 1
    from wk_direct_track_renames expected
    left join public.registry_tracks live
      on live.id = expected.track_id
    where live.id is null
      or live.title is distinct from
        expected.expected_title
      or live.slug is distinct from
        expected.old_slug
      or live.status is distinct from
        expected.expected_status
      or nullif(btrim(live.isrc), '')
        is distinct from
        nullif(btrim(expected.expected_isrc), '')
      or coalesce(
        live.metadata ->> 'apple_music_track_id',
        live.metadata ->> 'apple_music_catalog_id'
      ) is distinct from
        expected.apple_music_track_id
  ) then
    raise exception
      'STOP: A direct-track state changed';
  end if;

  if exists (
    select 1
    from wk_keep_valid_tracks expected
    left join public.registry_tracks live
      on live.id = expected.track_id
    where live.id is null
      or live.title is distinct from
        expected.expected_title
      or live.slug is distinct from
        expected.expected_slug
      or live.status is distinct from
        expected.expected_status
      or nullif(btrim(live.isrc), '')
        is distinct from
        nullif(btrim(expected.expected_isrc), '')
      or coalesce(
        live.metadata ->> 'apple_music_track_id',
        live.metadata ->> 'apple_music_catalog_id'
      ) is distinct from
        expected.apple_music_track_id
  ) then
    raise exception
      'STOP: The valid numeric-title track changed';
  end if;

  if exists (
    select 1
    from wk_duplicate_track_groups expected
    left join public.registry_tracks live
      on live.id = expected.survivor_id
    where live.id is null
      or live.title is distinct from
        expected.expected_title
      or live.slug is distinct from
        expected.survivor_old_slug
      or live.status is distinct from
        expected.survivor_status
      or coalesce(
        live.metadata ->> 'apple_music_track_id',
        live.metadata ->> 'apple_music_catalog_id'
      ) is distinct from
        expected.apple_music_track_id
  ) then
    raise exception
      'STOP: A reviewed survivor state changed';
  end if;

  if exists (
    select 1
    from wk_duplicate_track_members expected
    left join public.registry_tracks live
      on live.id = expected.track_id
    where live.id is null
      or live.title is distinct from
        expected.expected_title
      or live.slug is distinct from
        expected.expected_slug
      or live.status is distinct from
        expected.expected_status
      or nullif(btrim(live.isrc), '')
        is distinct from
        nullif(btrim(expected.expected_isrc), '')
      or coalesce(
        live.metadata ->> 'apple_music_track_id',
        live.metadata ->> 'apple_music_catalog_id'
      ) is distinct from
        expected.apple_music_track_id
  ) then
    raise exception
      'STOP: A reviewed redundant-track state changed';
  end if;

  if exists (
    select 1
    from (
      select
        direct_track.track_id,
        direct_track.artist_slug
      from wk_direct_track_renames direct_track

      union all

      select
        keep_track.track_id,
        keep_track.artist_slug
      from wk_keep_valid_tracks keep_track

      union all

      select
        duplicate_group.survivor_id,
        duplicate_group.artist_slug
      from wk_duplicate_track_groups duplicate_group

      union all

      select
        duplicate_member.track_id,
        duplicate_group.artist_slug
      from wk_duplicate_track_members duplicate_member
      join wk_duplicate_track_groups duplicate_group
        on duplicate_group.group_key =
          duplicate_member.group_key
    ) expected
    where (
      select count(*)
      from public.registry_track_artists artist_link
      where artist_link.track_id =
        expected.track_id
        and artist_link.artist_slug =
          expected.artist_slug
        and artist_link.status in (
          'active',
          'needs_review',
          'draft'
        )
        and coalesce(
          artist_link.is_primary,
          false
        ) = true
    ) <> 1
  ) then
    raise exception
      'STOP: A reviewed primary-artist relationship changed';
  end if;

  if exists (
    select 1
    from wk_direct_track_renames expected
    join public.registry_tracks collision
      on collision.slug = expected.new_slug
     and collision.id <> expected.track_id
    join public.registry_track_artists collision_artist
      on collision_artist.track_id = collision.id
     and collision_artist.artist_slug =
       expected.artist_slug
     and collision_artist.status in (
       'active',
       'needs_review',
       'draft'
     )
     and coalesce(
       collision_artist.is_primary,
       false
     ) = true
  ) then
    raise exception
      'STOP: A direct canonical slug became occupied';
  end if;

  if exists (
    select 1
    from wk_duplicate_track_groups duplicate_group
    join public.registry_tracks collision
      on collision.slug =
        duplicate_group.canonical_slug
     and collision.id <>
       duplicate_group.survivor_id
    join public.registry_track_artists collision_artist
      on collision_artist.track_id = collision.id
     and collision_artist.artist_slug =
       duplicate_group.artist_slug
     and collision_artist.status in (
       'active',
       'needs_review',
       'draft'
     )
     and coalesce(
       collision_artist.is_primary,
       false
     ) = true
    where not exists (
      select 1
      from wk_duplicate_track_members duplicate_member
      where duplicate_member.group_key =
          duplicate_group.group_key
        and duplicate_member.track_id =
          collision.id
    )
  ) then
    raise exception
      'STOP: A survivor canonical slug became occupied';
  end if;

  if exists (
    select 1
    from wk_duplicate_track_groups duplicate_group
    where (
      select count(distinct track.id)
      from public.registry_tracks track
      join public.registry_track_artists artist_link
        on artist_link.track_id = track.id
       and artist_link.artist_slug =
         duplicate_group.artist_slug
       and artist_link.status in (
         'active',
         'needs_review',
         'draft'
       )
       and coalesce(
         artist_link.is_primary,
         false
       ) = true
      where (
        duplicate_group.apple_music_track_id is null
        or coalesce(
          track.metadata ->> 'apple_music_track_id',
          track.metadata ->> 'apple_music_catalog_id'
        ) = duplicate_group.apple_music_track_id
      )
        and (
          track.id = duplicate_group.survivor_id
          or exists (
            select 1
            from wk_duplicate_track_members duplicate_member
            where duplicate_member.group_key =
                duplicate_group.group_key
              and duplicate_member.track_id =
                track.id
          )
        )
    ) <> (
      1 + (
        select count(*)
        from wk_duplicate_track_members duplicate_member
        where duplicate_member.group_key =
          duplicate_group.group_key
      )
    )
  ) then
    raise exception
      'STOP: A reviewed provider peer set changed';
  end if;

  if exists (
    select 1
    from public.wk_slug_redirects existing_redirect
    join wk_track_cleanup_redirects planned_redirect
      on planned_redirect.old_path =
        existing_redirect.old_path
    where existing_redirect.entity_type
        is distinct from 'track'
      or existing_redirect.scope_slug
        is distinct from
        planned_redirect.artist_slug
      or existing_redirect.old_slug
        is distinct from
        planned_redirect.old_slug
      or existing_redirect.new_slug
        is distinct from
        planned_redirect.new_slug
      or existing_redirect.new_path
        is distinct from
        planned_redirect.new_path
      or existing_redirect.redirect_status
        is distinct from 308
  ) then
    raise exception
      'STOP: A legacy path has a conflicting redirect';
  end if;

  if exists (
    select 1
    from public.registry_entity_relationships relationship
    join wk_track_cleanup_redirects affected
      on (
        relationship.source_entity_type = 'track'
        and relationship.source_entity_id is null
        and relationship.source_slug =
          affected.old_slug
      )
      or (
        relationship.target_entity_type = 'track'
        and relationship.target_entity_id is null
        and relationship.target_slug =
          affected.old_slug
      )
  ) then
    raise exception
      'STOP: Slug-only entity relationships need manual scoping';
  end if;
end
$preconditions$;

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
  planned.old_slug,
  planned.new_slug,
  'track',
  planned.artist_slug,
  planned.old_path,
  planned.new_path,
  308,
  'final-numbered-track-cleanup-20260714',
  now()
from wk_track_cleanup_redirects planned
where not exists (
  select 1
  from public.wk_slug_redirects existing
  where existing.old_path = planned.old_path
);

do $redirect_gate$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.wk_slug_redirects redirect
  join wk_track_cleanup_redirects expected
    on expected.old_path = redirect.old_path
   and expected.old_slug = redirect.old_slug
   and expected.new_slug = redirect.new_slug
   and expected.artist_slug =
     redirect.scope_slug
   and expected.new_path = redirect.new_path
  where redirect.entity_type = 'track'
    and redirect.redirect_status = 308;

  if v_count <> 85 then
    raise exception
      'STOP: Expected 85 exact redirects, found %',
      v_count;
  end if;
end
$redirect_gate$;

update public.wk_chart_entries_v2 chart_entry
set
  canonical_track_id =
    duplicate_group.survivor_id::text,
  track_slug = duplicate_group.canonical_slug,
  updated_at = now()
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where chart_entry.canonical_track_id =
    duplicate_member.track_id::text
   or (
     chart_entry.track_slug =
       duplicate_member.expected_slug
     and chart_entry.artist_slug =
       duplicate_group.artist_slug
   );

update public.wk_chart_entries_v2 chart_entry
set
  track_slug = direct_track.new_slug,
  updated_at = now()
from wk_direct_track_renames direct_track
where chart_entry.canonical_track_id =
    direct_track.track_id::text
   or (
     chart_entry.track_slug =
       direct_track.old_slug
     and chart_entry.artist_slug =
       direct_track.artist_slug
   );

update public.chart_playback_provider_exceptions exception_row
set registry_track_id =
  duplicate_group.survivor_id
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where exception_row.registry_track_id =
  duplicate_member.track_id;

update public.wk_chart_playback_enrichment_items enrichment_row
set registry_track_id =
  duplicate_group.survivor_id
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where enrichment_row.registry_track_id =
  duplicate_member.track_id;

update public.wk_playlist_items playlist_item
set
  registry_track_id =
    duplicate_group.survivor_id,
  normalization_payload =
    coalesce(
      playlist_item.normalization_payload,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'moved_from_track_id',
        duplicate_member.track_id::text,
      'moved_to_track_id',
        duplicate_group.survivor_id::text,
      'track_duplicate_cleanup_at',
        now()
    ),
  updated_at = now()
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where playlist_item.registry_track_id =
  duplicate_member.track_id;

update public.registry_entity_relationships relationship
set
  source_entity_id =
    duplicate_group.survivor_id,
  source_slug =
    duplicate_group.canonical_slug,
  updated_at = now()
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where relationship.source_entity_type = 'track'
  and relationship.source_entity_id =
    duplicate_member.track_id;

update public.registry_entity_relationships relationship
set
  target_entity_id =
    duplicate_group.survivor_id,
  target_slug =
    duplicate_group.canonical_slug,
  updated_at = now()
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where relationship.target_entity_type = 'track'
  and relationship.target_entity_id =
    duplicate_member.track_id;

update public.registry_entity_relationships relationship
set
  source_slug = direct_track.new_slug,
  updated_at = now()
from wk_direct_track_renames direct_track
where relationship.source_entity_type = 'track'
  and relationship.source_entity_id =
    direct_track.track_id;

update public.registry_entity_relationships relationship
set
  target_slug = direct_track.new_slug,
  updated_at = now()
from wk_direct_track_renames direct_track
where relationship.target_entity_type = 'track'
  and relationship.target_entity_id =
    direct_track.track_id;

delete from public.registry_track_provider_links duplicate_link
using wk_duplicate_track_members duplicate_member,
      wk_duplicate_track_groups duplicate_group
where duplicate_group.group_key =
    duplicate_member.group_key
  and duplicate_link.track_id =
    duplicate_member.track_id
  and exists (
    select 1
    from public.registry_track_provider_links survivor_link
    where survivor_link.track_id =
      duplicate_group.survivor_id
      and survivor_link.provider_key =
        duplicate_link.provider_key
      and survivor_link.provider_track_id =
        duplicate_link.provider_track_id
  );

update public.registry_track_provider_links provider_link
set
  track_id = duplicate_group.survivor_id,
  raw_payload =
    coalesce(
      provider_link.raw_payload,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'moved_from_track_id',
        duplicate_member.track_id::text,
      'moved_to_track_id',
        duplicate_group.survivor_id::text,
      'track_duplicate_cleanup_at',
        now()
    ),
  updated_at = now()
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where provider_link.track_id =
  duplicate_member.track_id;

with ranked_artist_rows as (
  select
    artist_link.id,
    duplicate_group.survivor_id,
    row_number() over (
      partition by
        duplicate_group.survivor_id,
        coalesce(
          lower(nullif(
            artist_link.artist_slug,
            ''
          )),
          'artist:' ||
            coalesce(
              artist_link.artist_id::text,
              artist_link.id::text
            )
        ),
        artist_link.role,
        artist_link.credit_order
      order by
        coalesce(
          artist_link.is_primary,
          false
        ) desc,
        coalesce(
          artist_link.is_featured,
          false
        ) desc,
        artist_link.updated_at desc nulls last,
        artist_link.id
    ) as duplicate_rank,
    exists (
      select 1
      from public.registry_track_artists survivor_artist
      where survivor_artist.track_id =
        duplicate_group.survivor_id
        and survivor_artist.role =
          artist_link.role
        and survivor_artist.credit_order =
          artist_link.credit_order
        and (
          (
            nullif(
              artist_link.artist_slug,
              ''
            ) is not null
            and lower(
              coalesce(
                survivor_artist.artist_slug,
                ''
              )
            ) = lower(
              artist_link.artist_slug
            )
          )
          or (
            nullif(
              artist_link.artist_slug,
              ''
            ) is null
            and artist_link.artist_id
              is not null
            and survivor_artist.artist_id =
              artist_link.artist_id
          )
        )
    ) as survivor_has_credit
  from public.registry_track_artists artist_link
  join wk_duplicate_track_members duplicate_member
    on duplicate_member.track_id =
      artist_link.track_id
  join wk_duplicate_track_groups duplicate_group
    on duplicate_group.group_key =
      duplicate_member.group_key
),
artist_rows_to_delete as (
  select id
  from ranked_artist_rows
  where duplicate_rank > 1
     or survivor_has_credit
)
delete from public.registry_track_artists artist_link
using artist_rows_to_delete doomed
where artist_link.id = doomed.id;

update public.registry_track_artists artist_link
set
  track_id = duplicate_group.survivor_id,
  metadata =
    coalesce(
      artist_link.metadata,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'moved_from_track_id',
        duplicate_member.track_id::text,
      'moved_to_track_id',
        duplicate_group.survivor_id::text,
      'track_duplicate_cleanup_at',
        now()
    ),
  updated_at = now()
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where artist_link.track_id =
  duplicate_member.track_id;

with ranked_release_rows as (
  select
    release_link.id,
    duplicate_group.survivor_id,
    row_number() over (
      partition by
        duplicate_group.survivor_id,
        release_link.release_id
      order by
        case
          when coalesce(
            release_link.status,
            'active'
          ) = 'active'
          then 0
          else 1
        end,
        release_link.updated_at desc nulls last,
        release_link.id
    ) as duplicate_rank,
    exists (
      select 1
      from public.registry_release_tracks survivor_link
      where survivor_link.track_id =
        duplicate_group.survivor_id
        and survivor_link.release_id =
          release_link.release_id
    ) as survivor_has_release
  from public.registry_release_tracks release_link
  join wk_duplicate_track_members duplicate_member
    on duplicate_member.track_id =
      release_link.track_id
  join wk_duplicate_track_groups duplicate_group
    on duplicate_group.group_key =
      duplicate_member.group_key
),
release_rows_to_delete as (
  select id
  from ranked_release_rows
  where duplicate_rank > 1
     or survivor_has_release
)
delete from public.registry_release_tracks release_link
using release_rows_to_delete doomed
where release_link.id = doomed.id;

update public.registry_release_tracks release_link
set
  track_id = duplicate_group.survivor_id,
  metadata =
    coalesce(
      release_link.metadata,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'moved_from_track_id',
        duplicate_member.track_id::text,
      'moved_to_track_id',
        duplicate_group.survivor_id::text,
      'track_duplicate_cleanup_at',
        now()
    ),
  updated_at = now()
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where release_link.track_id =
  duplicate_member.track_id;

with ranked_genre_rows as (
  select
    genre_link.id,
    duplicate_group.survivor_id,
    row_number() over (
      partition by
        duplicate_group.survivor_id,
        genre_link.normalized_key,
        coalesce(genre_link.provider, ''),
        genre_link.source
      order by
        case
          when genre_link.classification_status =
            'editorially_verified'
          then 0
          when genre_link.classification_status =
            'provider_claimed'
          then 1
          else 2
        end,
        coalesce(
          genre_link.is_primary,
          false
        ) desc,
        genre_link.confidence desc nulls last,
        genre_link.updated_at desc nulls last,
        genre_link.id
    ) as duplicate_rank,
    exists (
      select 1
      from public.registry_track_genres survivor_genre
      where survivor_genre.track_id =
        duplicate_group.survivor_id
        and survivor_genre.normalized_key =
          genre_link.normalized_key
        and coalesce(
          survivor_genre.provider,
          ''
        ) = coalesce(
          genre_link.provider,
          ''
        )
        and survivor_genre.source =
          genre_link.source
        and survivor_genre.classification_status
          <> 'archived'
    ) as survivor_has_genre
  from public.registry_track_genres genre_link
  join wk_duplicate_track_members duplicate_member
    on duplicate_member.track_id =
      genre_link.track_id
  join wk_duplicate_track_groups duplicate_group
    on duplicate_group.group_key =
      duplicate_member.group_key
  where genre_link.classification_status
    <> 'archived'
),
genre_rows_to_delete as (
  select id
  from ranked_genre_rows
  where duplicate_rank > 1
     or survivor_has_genre
)
delete from public.registry_track_genres genre_link
using genre_rows_to_delete doomed
where genre_link.id = doomed.id;

update public.registry_track_genres genre_link
set
  track_id = duplicate_group.survivor_id,
  metadata =
    coalesce(
      genre_link.metadata,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'moved_from_track_id',
        duplicate_member.track_id::text,
      'moved_to_track_id',
        duplicate_group.survivor_id::text,
      'track_duplicate_cleanup_at',
        now()
    ),
  updated_at = now()
from wk_duplicate_track_members duplicate_member
join wk_duplicate_track_groups duplicate_group
  on duplicate_group.group_key =
    duplicate_member.group_key
where genre_link.track_id =
    duplicate_member.track_id
  and genre_link.classification_status
    <> 'archived';

delete from public.seo_sitemap_url_items sitemap_item
using (
  select track_id
  from wk_direct_track_renames

  union

  select survivor_id
  from wk_duplicate_track_groups

  union

  select track_id
  from wk_duplicate_track_members
) affected
where sitemap_item.source_id =
  affected.track_id::text;

update public.registry_tracks survivor
set
  slug = duplicate_group.canonical_slug,
  isrc = coalesce(
    nullif(survivor.isrc, ''),
    (
      select nullif(duplicate_track.isrc, '')
      from wk_duplicate_track_members duplicate_member
      join public.registry_tracks duplicate_track
        on duplicate_track.id =
          duplicate_member.track_id
      where duplicate_member.group_key =
        duplicate_group.group_key
        and nullif(
          duplicate_track.isrc,
          ''
        ) is not null
      order by
        duplicate_track.updated_at desc nulls last,
        duplicate_track.id
      limit 1
    )
  ),
  artwork_url = coalesce(
    nullif(survivor.artwork_url, ''),
    (
      select nullif(
        duplicate_track.artwork_url,
        ''
      )
      from wk_duplicate_track_members duplicate_member
      join public.registry_tracks duplicate_track
        on duplicate_track.id =
          duplicate_member.track_id
      where duplicate_member.group_key =
        duplicate_group.group_key
        and nullif(
          duplicate_track.artwork_url,
          ''
        ) is not null
      order by
        duplicate_track.updated_at desc nulls last,
        duplicate_track.id
      limit 1
    )
  ),
  preview_url = coalesce(
    nullif(survivor.preview_url, ''),
    (
      select nullif(
        duplicate_track.preview_url,
        ''
      )
      from wk_duplicate_track_members duplicate_member
      join public.registry_tracks duplicate_track
        on duplicate_track.id =
          duplicate_member.track_id
      where duplicate_member.group_key =
        duplicate_group.group_key
        and nullif(
          duplicate_track.preview_url,
          ''
        ) is not null
      order by
        duplicate_track.updated_at desc nulls last,
        duplicate_track.id
      limit 1
    )
  ),
  metadata =
    coalesce(
      survivor.metadata,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'numbered_track_duplicate_cleanup',
      jsonb_build_object(
        'operation',
          'consolidate_final_numbered_tracks_20260714',
        'consolidated_at',
          now(),
        'provider_track_id',
          duplicate_group.apple_music_track_id,
        'survivor_track_id',
          duplicate_group.survivor_id,
        'canonical_slug',
          duplicate_group.canonical_slug,
        'legacy_track_ids',
          (
            select jsonb_agg(
              duplicate_track.id::text
              order by duplicate_track.slug,
                duplicate_track.id
            )
            from wk_duplicate_track_members duplicate_member
            join public.registry_tracks duplicate_track
              on duplicate_track.id =
                duplicate_member.track_id
            where duplicate_member.group_key =
              duplicate_group.group_key
          ),
        'legacy_slugs',
          (
            select jsonb_agg(
              duplicate_track.slug
              order by duplicate_track.slug,
                duplicate_track.id
            )
            from wk_duplicate_track_members duplicate_member
            join public.registry_tracks duplicate_track
              on duplicate_track.id =
                duplicate_member.track_id
            where duplicate_member.group_key =
              duplicate_group.group_key
          ),
        'redundant_track_snapshots',
          (
            select jsonb_agg(
              to_jsonb(duplicate_track)
              order by duplicate_track.slug,
                duplicate_track.id
            )
            from wk_duplicate_track_members duplicate_member
            join public.registry_tracks duplicate_track
              on duplicate_track.id =
                duplicate_member.track_id
            where duplicate_member.group_key =
              duplicate_group.group_key
          )
      )
    ),
  updated_at = now()
from wk_duplicate_track_groups duplicate_group
where survivor.id =
  duplicate_group.survivor_id;

update public.registry_tracks direct_track
set
  slug = expected.new_slug,
  metadata =
    coalesce(
      direct_track.metadata,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'numbered_slug_canonicalization',
      jsonb_build_object(
        'operation',
          'consolidate_final_numbered_tracks_20260714',
        'canonicalized_at',
          now(),
        'legacy_slug',
          expected.old_slug,
        'canonical_slug',
          expected.new_slug,
        'artist_slug',
          expected.artist_slug
      )
    ),
  updated_at = now()
from wk_direct_track_renames expected
where direct_track.id =
  expected.track_id;

delete from public.registry_tracks duplicate_track
using wk_duplicate_track_members duplicate_member
where duplicate_track.id =
  duplicate_member.track_id;

insert into public.registry_track_resolution_events (
  action,
  status,
  canonical_track_id,
  canonical_track_slug,
  duplicate_track_ids,
  duplicate_track_slugs,
  confidence_bucket,
  preview,
  result,
  note
)
select
  'track_duplicate_repair',
  'success',
  duplicate_group.survivor_id,
  duplicate_group.canonical_slug,
  array_agg(
    duplicate_member.track_id
    order by duplicate_member.expected_slug,
      duplicate_member.track_id
  ),
  array_agg(
    duplicate_member.expected_slug
    order by duplicate_member.expected_slug,
      duplicate_member.track_id
  ),
  'high',
  jsonb_build_object(
    'providerTrackId',
      duplicate_group.apple_music_track_id,
    'artistSlug',
      duplicate_group.artist_slug,
    'expectedTitle',
      duplicate_group.expected_title,
    'evidenceSource',
      duplicate_group.evidence_source
  ),
  jsonb_build_object(
    'operation',
      'consolidate_final_numbered_tracks_20260714',
    'duplicatesDeleted',
      count(*)
  ),
  'Final numbered-track duplicate consolidation'
from wk_duplicate_track_groups duplicate_group
join wk_duplicate_track_members duplicate_member
  on duplicate_member.group_key =
    duplicate_group.group_key
group by
  duplicate_group.group_key,
  duplicate_group.survivor_id,
  duplicate_group.canonical_slug,
  duplicate_group.apple_music_track_id,
  duplicate_group.artist_slug,
  duplicate_group.expected_title,
  duplicate_group.evidence_source;

do $postconditions$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from wk_direct_track_renames expected
  join public.registry_tracks live
    on live.id = expected.track_id
   and live.title = expected.expected_title
   and live.slug = expected.new_slug
   and live.status = expected.expected_status;

  if v_count <> 5 then
    raise exception
      'STOP: Direct rename postcondition failed. Found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from wk_keep_valid_tracks expected
  join public.registry_tracks live
    on live.id = expected.track_id
   and live.title = expected.expected_title
   and live.slug = expected.expected_slug
   and live.status = expected.expected_status;

  if v_count <> 1 then
    raise exception
      'STOP: Keep-valid postcondition failed. Found %',
      v_count;
  end if;

  if exists (
    select 1
    from public.registry_tracks duplicate_track
    join wk_duplicate_track_members duplicate_member
      on duplicate_member.track_id =
        duplicate_track.id
  ) then
    raise exception
      'STOP: A redundant track still exists';
  end if;

  select count(*)
  into v_count
  from wk_duplicate_track_groups duplicate_group
  join public.registry_tracks survivor
    on survivor.id =
      duplicate_group.survivor_id
   and survivor.title =
      duplicate_group.expected_title
   and survivor.slug =
      duplicate_group.canonical_slug
   and survivor.status =
      duplicate_group.survivor_status
   and coalesce(
     survivor.metadata ->> 'apple_music_track_id',
     survivor.metadata ->> 'apple_music_catalog_id'
   ) is not distinct from
     duplicate_group.apple_music_track_id;

  if v_count <> 15 then
    raise exception
      'STOP: Survivor postcondition failed. Found %',
      v_count;
  end if;

  if exists (
    select 1
    from public.registry_track_artists artist_link
    join wk_duplicate_track_members duplicate_member
      on duplicate_member.track_id =
        artist_link.track_id
  )
  or exists (
    select 1
    from public.registry_release_tracks release_link
    join wk_duplicate_track_members duplicate_member
      on duplicate_member.track_id =
        release_link.track_id
  )
  or exists (
    select 1
    from public.registry_track_provider_links provider_link
    join wk_duplicate_track_members duplicate_member
      on duplicate_member.track_id =
        provider_link.track_id
  )
  or exists (
    select 1
    from public.registry_track_genres genre_link
    join wk_duplicate_track_members duplicate_member
      on duplicate_member.track_id =
        genre_link.track_id
  )
  or exists (
    select 1
    from public.wk_playlist_items playlist_item
    join wk_duplicate_track_members duplicate_member
      on duplicate_member.track_id =
        playlist_item.registry_track_id
  )
  or exists (
    select 1
    from public.chart_playback_provider_exceptions exception_row
    join wk_duplicate_track_members duplicate_member
      on duplicate_member.track_id =
        exception_row.registry_track_id
  )
  or exists (
    select 1
    from public.wk_chart_playback_enrichment_items enrichment_row
    join wk_duplicate_track_members duplicate_member
      on duplicate_member.track_id =
        enrichment_row.registry_track_id
  )
  or exists (
    select 1
    from public.registry_entity_relationships relationship
    join wk_duplicate_track_members duplicate_member
      on relationship.source_entity_id =
          duplicate_member.track_id
        or relationship.target_entity_id =
          duplicate_member.track_id
  ) then
    raise exception
      'STOP: A redundant track reference remains';
  end if;

  select count(*)
  into v_count
  from public.wk_slug_redirects redirect
  join wk_track_cleanup_redirects expected
    on expected.old_path = redirect.old_path
   and expected.new_path = redirect.new_path
   and expected.old_slug = redirect.old_slug
   and expected.new_slug = redirect.new_slug
   and expected.artist_slug =
     redirect.scope_slug
  where redirect.entity_type = 'track'
    and redirect.redirect_status = 308;

  if v_count <> 85 then
    raise exception
      'STOP: Redirect postcondition failed. Found %',
      v_count;
  end if;

  if (
    select count(*)
    from public.registry_track_resolution_events event
    join wk_duplicate_track_groups duplicate_group
      on duplicate_group.survivor_id =
        event.canonical_track_id
     and duplicate_group.canonical_slug =
        event.canonical_track_slug
    where event.action =
        'track_duplicate_repair'
      and event.note =
        'Final numbered-track duplicate consolidation'
  ) <> 15 then
    raise exception
      'STOP: Resolution-event postcondition failed';
  end if;
end
$postconditions$;

commit;
