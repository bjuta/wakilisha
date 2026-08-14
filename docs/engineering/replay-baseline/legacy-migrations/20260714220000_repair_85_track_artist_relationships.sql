-- Repair deterministic primary artist relationships
-- for the 85 frozen numbered-track candidates.
--
-- Provider primary artist slug: 77
-- Existing single artist row: 4
-- Release artist evidence: 1
-- Provider primary artist name: 3
-- Existing relationships promoted: 73
-- New relationships inserted: 12
-- Registry-backed artists: 82
-- Slug-only artist relationships: 3

begin;

select pg_advisory_xact_lock(
  hashtext(
    'wakilisha:repair-85-track-artist-relationships'
  )
);

create temporary table artist_repairs (
  track_id uuid primary key,
  expected_title text not null,
  expected_slug text not null,
  expected_status text not null,
  artist_id uuid,
  artist_slug text not null,
  artist_name text not null,
  evidence text not null,
  existing_relationship_id uuid
) on commit drop;

insert into artist_repairs (
  track_id,
  expected_title,
  expected_slug,
  expected_status,
  artist_id,
  artist_slug,
  artist_name,
  evidence,
  existing_relationship_id
)
values
  ('00017a6d-a062-45b6-865d-c929f74133d7'::uuid, 'Brayo', 'brayo-teslah-5', 'archived', '74ed92e5-2d13-4da8-92a7-41e9d28fe07f'::uuid, 'teslah', 'Teslah', 'provider_primary_artist_slug', 'b470bd51-48c6-4400-a0fc-5141c6493242'::uuid),
  ('0493b964-80c3-4be7-8c7b-a3b79118755e'::uuid, 'Come My Way', 'come-my-way-fena-gitu-8', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', 'd7179977-ea14-44b0-a713-cdf05bf32f5d'::uuid),
  ('0648547e-f9a4-4531-884c-d99fcf0e553a'::uuid, 'Come My Way', 'come-my-way-fena-gitu-5', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', 'be088ce5-0ff4-4fa5-9226-f7a26d3b3643'::uuid),
  ('0d624126-59c2-4689-80d2-58ae6e2a8379'::uuid, 'Come My Way', 'come-my-way-fena-gitu-9', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', '2f7cc41d-87b0-4cc5-8292-b077d89d585b'::uuid),
  ('0f1f8421-74b6-4ddf-a5ed-422f3521adfd'::uuid, 'More', 'more-mwanaa-9', 'archived', '41b1848e-e25b-4ca7-b5a0-18b0d390816d'::uuid, 'mwanaa', 'Mwanaa', 'provider_primary_artist_slug', '7006f325-d775-424d-853a-4fccced6b79a'::uuid),
  ('10cd8863-7bbc-42b5-b33b-e8bcec070f41'::uuid, 'Tamu', 'tamu-iyanii-8', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', '91e81752-eb27-4fc8-83d5-55036dadf934'::uuid),
  ('16710a72-c1ef-4498-a1d8-7ae018928ab7'::uuid, 'More', 'more-mwanaa-7', 'archived', '41b1848e-e25b-4ca7-b5a0-18b0d390816d'::uuid, 'mwanaa', 'Mwanaa', 'provider_primary_artist_slug', '0d36990b-962a-4918-a97e-95a73e142de2'::uuid),
  ('1deba214-d1ce-437d-9467-85dc59ebf1fa'::uuid, 'Colors', 'colors-njerae-10', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', null::uuid),
  ('1e740a0d-5a84-4b8a-b5a7-df33c2a8acee'::uuid, '4:20', '4-20', 'needs_review', 'ec9248c7-2881-4671-91d7-0fae98dc6a4c'::uuid, 'mastar-vk', 'MASTAR VK', 'provider_primary_artist_name', null::uuid),
  ('1ec7334b-7ba4-4556-89a0-a403a265b116'::uuid, 'Brayo', 'brayo-teslah-4', 'archived', '74ed92e5-2d13-4da8-92a7-41e9d28fe07f'::uuid, 'teslah', 'Teslah', 'provider_primary_artist_slug', 'f9385e11-0854-482d-915d-a4bb2fee7bd8'::uuid),
  ('1f48b263-c1a8-4079-9d81-7d5f44f0964a'::uuid, 'More', 'more-mwanaa-4', 'archived', '41b1848e-e25b-4ca7-b5a0-18b0d390816d'::uuid, 'mwanaa', 'Mwanaa', 'provider_primary_artist_slug', '3222593e-c9c4-4e93-a6f5-07c766839fbf'::uuid),
  ('1f7309b9-f8de-4b1b-8009-aca813b85407'::uuid, 'Come My Way', 'come-my-way-fena-gitu-6', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', 'abbf9466-1927-4dc3-824b-2a244db1fcb3'::uuid),
  ('2364b4b9-7968-4ef6-a993-c453544a4723'::uuid, 'More', 'more-mwanaa-5', 'archived', '41b1848e-e25b-4ca7-b5a0-18b0d390816d'::uuid, 'mwanaa', 'Mwanaa', 'provider_primary_artist_slug', '353a23b6-5368-4244-a6e9-bd4303703a93'::uuid),
  ('23f5a276-4778-4113-ad71-5728d61f80d5'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-9', 'archived', 'd9e19fd6-0cf5-44e5-8970-c75e17e8d7d2'::uuid, 'bridget-blue', 'Bridget Blue', 'provider_primary_artist_slug', '744aa637-d530-4227-aa9c-d6438aa013e9'::uuid),
  ('255fb1af-8b3c-4565-8df1-b8b8b8b60d1f'::uuid, 'Keki', 'keki-willy-paul-2', 'archived', 'daac835c-be3d-493e-8a4f-886b107f7b62'::uuid, 'willy-paul', 'Willy Paul', 'provider_primary_artist_slug', '2d4422c3-f1d3-4c02-8440-58da31782c41'::uuid),
  ('2c1f115a-963f-44a8-956c-9ce4683a6541'::uuid, 'Brayo', 'brayo-teslah-9', 'archived', '74ed92e5-2d13-4da8-92a7-41e9d28fe07f'::uuid, 'teslah', 'Teslah', 'provider_primary_artist_slug', null::uuid),
  ('2dd6500d-cb31-4c29-b8ad-ce0c5f220c60'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-6', 'archived', 'd9e19fd6-0cf5-44e5-8970-c75e17e8d7d2'::uuid, 'bridget-blue', 'Bridget Blue', 'provider_primary_artist_slug', 'afe30d92-bf37-45bd-8282-07f2190c370b'::uuid),
  ('300e9bbe-cd77-4706-addc-31ed83bdc940'::uuid, 'Chocha', 'chocha-2', 'active', null::uuid, 'scooby-lincos', 'Scooby Lincos', 'single_existing_artist', 'a4555e2d-ed3f-480c-afb1-cbf4acb1c65c'::uuid),
  ('35821b24-bdbb-4f84-b4a7-ecf070d4608a'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-8', 'archived', 'd9e19fd6-0cf5-44e5-8970-c75e17e8d7d2'::uuid, 'bridget-blue', 'Bridget Blue', 'provider_primary_artist_slug', '05e7a0a2-8aa7-4e53-becb-affb0847adc0'::uuid),
  ('35c8d750-747d-4593-a75d-b8c01b041665'::uuid, 'Come My Way', 'come-my-way-fena-gitu-3', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', '432cc4d2-1967-429e-bf05-bb013b1a884a'::uuid),
  ('3c11f43d-1a66-407d-bc3e-28feb076eb6d'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-3', 'archived', 'e7278c85-5a4c-4537-8bb2-55a7def214b0'::uuid, 'otile-brown', 'Otile Brown', 'provider_primary_artist_slug', 'd526ed77-6adc-4f4a-9331-888cf4b69f6e'::uuid),
  ('3c8ea376-5a7d-4d08-8c33-57a7150a23d1'::uuid, 'Dala', 'dala-2', 'active', '33126c10-a884-47f0-a53a-49c04c0ac7d2'::uuid, 'nina-ogot', 'Nina Ogot', 'single_existing_artist', '18d480e3-4f37-4255-a7c1-5192dca8b188'::uuid),
  ('3e3efbe0-1157-4e67-b752-329780165082'::uuid, 'Tamu', 'tamu-iyanii-10', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', '41a0dea7-7d69-4181-b46b-beea1fa5f52a'::uuid),
  ('3fac4ce7-37b7-4a52-ab90-50a67622c59c'::uuid, 'Brayo', 'brayo-teslah-3', 'archived', '74ed92e5-2d13-4da8-92a7-41e9d28fe07f'::uuid, 'teslah', 'Teslah', 'provider_primary_artist_slug', 'a2fbc1d2-27ca-4139-9d3f-1102f86196d8'::uuid),
  ('4249250d-2e11-453b-93d6-7760e3d79b5f'::uuid, 'More', 'more-mwanaa-6', 'archived', '41b1848e-e25b-4ca7-b5a0-18b0d390816d'::uuid, 'mwanaa', 'Mwanaa', 'provider_primary_artist_slug', '0274e9cf-74aa-467b-931f-886a252ee597'::uuid),
  ('428042ce-3084-40e4-a057-98edce57082b'::uuid, 'More', 'more-mwanaa-2', 'archived', '41b1848e-e25b-4ca7-b5a0-18b0d390816d'::uuid, 'mwanaa', 'Mwanaa', 'provider_primary_artist_slug', 'b2ed1aeb-658f-47bb-a778-4d8b68be551c'::uuid),
  ('43b29d4a-3ae3-4a1e-9cab-9d9fc43a8e16'::uuid, 'Better Love', 'better-love-v-be-8', 'archived', 'e0b31768-5f69-4edc-afa4-2fdc01da7307'::uuid, 'v-be', 'V-Be', 'provider_primary_artist_slug', null::uuid),
  ('45d07631-fbc5-44e0-84e5-5e90fb39a074'::uuid, 'Tamu', 'tamu-iyanii-7', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', '07e6cd6c-9fd4-4254-a47b-d40f5f8019b7'::uuid),
  ('4e5dc57a-ebb2-4cba-a4a2-ad2384105930'::uuid, 'Brayo', 'brayo-teslah-7', 'archived', '74ed92e5-2d13-4da8-92a7-41e9d28fe07f'::uuid, 'teslah', 'Teslah', 'provider_primary_artist_slug', '5662d70c-210f-4e59-8eed-e696c12f7dc2'::uuid),
  ('50f14f6c-5f34-4fc1-8596-532e70fe16ec'::uuid, 'More', 'more-mwanaa-8', 'archived', '41b1848e-e25b-4ca7-b5a0-18b0d390816d'::uuid, 'mwanaa', 'Mwanaa', 'provider_primary_artist_slug', '8c7377ec-1b08-46d2-ad2d-3c05c79043c3'::uuid),
  ('53a0043e-2634-4ee4-8af2-f27118b93b80'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-8', 'archived', 'e7278c85-5a4c-4537-8bb2-55a7def214b0'::uuid, 'otile-brown', 'Otile Brown', 'provider_primary_artist_slug', '00b39bb9-9ab6-432d-8133-18d05d97a756'::uuid),
  ('53a0b7dc-92a5-45a9-a767-5bffd63dcaf3'::uuid, 'Better Love', 'better-love-v-be-4', 'archived', 'e0b31768-5f69-4edc-afa4-2fdc01da7307'::uuid, 'v-be', 'V-Be', 'provider_primary_artist_slug', '04855400-a6e1-4cb6-b571-df5c4da22aa3'::uuid),
  ('54ce9f87-8e44-48c7-9877-832536f51239'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-5', 'archived', 'e7278c85-5a4c-4537-8bb2-55a7def214b0'::uuid, 'otile-brown', 'Otile Brown', 'provider_primary_artist_slug', 'ac144228-e1d1-427e-aa67-e56f8d09ba06'::uuid),
  ('56a64cb0-04ff-47cc-902f-2cae9c39e679'::uuid, 'Colors', 'colors-njerae-3', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', '18654c5c-5e64-4e1c-9dab-e378f7d6d419'::uuid),
  ('5a57358e-fb37-44b8-8db7-1192c420d5a1'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-4', 'archived', 'e7278c85-5a4c-4537-8bb2-55a7def214b0'::uuid, 'otile-brown', 'Otile Brown', 'provider_primary_artist_slug', '4eba0c32-8879-4561-8451-ae247aba9db1'::uuid),
  ('5dd62d1c-25e8-41a0-bb03-5dd331d6edb1'::uuid, 'Day One', 'day-one-mutoriah-9', 'archived', '2a70efd2-7638-403c-9f6c-5bf4b05751bd'::uuid, 'mutoriah', 'Mutoriah', 'provider_primary_artist_slug', null::uuid),
  ('607b598b-6862-43bd-9d16-65bb7f891da2'::uuid, 'Tamu', 'tamu-iyanii-5', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', '3fe3ca40-f976-4758-a80e-3278d6b524d2'::uuid),
  ('60d00f50-3727-4dce-9378-f03e48dd10fd'::uuid, 'Come My Way', 'come-my-way-fena-gitu-4', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', '8172f0a3-2697-4a4c-8004-4591dd490fee'::uuid),
  ('610f0d41-6593-49e3-9b0e-154e58b90607'::uuid, 'Better Love', 'better-love-v-be-5', 'archived', 'e0b31768-5f69-4edc-afa4-2fdc01da7307'::uuid, 'v-be', 'V-Be', 'provider_primary_artist_slug', 'bc2f4506-ee13-434e-acc6-be88c489d274'::uuid),
  ('673ad674-814b-4b16-8a61-e8ab05872174'::uuid, 'Colors', 'colors-njerae-6', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', '8db30552-0924-4d90-9289-3c9fae4c6f97'::uuid),
  ('6842cec3-9a13-4647-8545-58f5a6fe82e0'::uuid, 'Njoo', 'njoo-4', 'active', null::uuid, 'binti', 'Binti', 'single_existing_artist', '73209da8-2400-4e67-9d47-28fa7d27b674'::uuid),
  ('69b8785a-6497-4318-9b5e-96e7ee77d5e3'::uuid, 'Come My Way', 'come-my-way-fena-gitu-10', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', null::uuid),
  ('6c1c59bc-850e-4e44-9a51-c3200e15500d'::uuid, 'Tamu', 'tamu-iyanii-3', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', '8c57a31b-91d8-43b1-893d-8fc22bf75c88'::uuid),
  ('6c9b80a9-9d22-4d05-9cbf-4e7c2542f970'::uuid, 'Day One', 'day-one-mutoriah-6', 'archived', '2a70efd2-7638-403c-9f6c-5bf4b05751bd'::uuid, 'mutoriah', 'Mutoriah', 'provider_primary_artist_slug', '148373e3-2261-4949-8e84-352e12922517'::uuid),
  ('6ef7333d-89a7-4eaa-9d26-7c551c19669a'::uuid, 'Come My Way', 'come-my-way-fena-gitu-2', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', '0cdbd789-3de0-4d01-88a5-1508996aef9f'::uuid),
  ('6f77cee0-f838-4d3d-b9c5-540bcc48b6f1'::uuid, 'Better Love', 'better-love-v-be-6', 'archived', 'e0b31768-5f69-4edc-afa4-2fdc01da7307'::uuid, 'v-be', 'V-Be', 'provider_primary_artist_slug', '06a5c66b-b86c-42d5-988c-0a09d4b7d51c'::uuid),
  ('7934a3cd-4774-4e9f-bc98-12f669cb43ba'::uuid, 'Tamu', 'tamu-iyanii-6', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', 'a9cd364e-4ca4-4d85-bdf5-7baad6197031'::uuid),
  ('7969024d-b9ed-4c84-9f01-3fb16653c1e4'::uuid, 'Day One', 'day-one-mutoriah-5', 'archived', '2a70efd2-7638-403c-9f6c-5bf4b05751bd'::uuid, 'mutoriah', 'Mutoriah', 'provider_primary_artist_slug', 'a0496552-ee6e-444c-869b-4f96e1bedfdc'::uuid),
  ('7b01cdcd-4a73-4608-9f06-c443cd6d5bc3'::uuid, 'better', 'better-afamefuna-2', 'archived', 'ca10b100-6812-44d6-a577-d863f2745221'::uuid, 'afamefuna', 'Afamefuna', 'provider_primary_artist_slug', null::uuid),
  ('8630fa00-33ce-4dac-934b-9c3e86f3ce29'::uuid, 'Colors', 'colors-njerae-4', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', 'a156bb7b-28ec-41ff-adab-7e74a9d7dc98'::uuid),
  ('94eb5acf-50d0-4a35-ab5e-e4e35e4bc68a'::uuid, 'Day One', 'day-one-mutoriah-3', 'archived', '2a70efd2-7638-403c-9f6c-5bf4b05751bd'::uuid, 'mutoriah', 'Mutoriah', 'provider_primary_artist_slug', '57823e64-01b2-4084-b3ca-4e957afe20b8'::uuid),
  ('997748c3-d125-40c3-b210-a41ff66ec36b'::uuid, '4mulla', '4mulla-naiboi-2', 'archived', '44edef3e-7329-4f2c-9559-d01a9529707c'::uuid, 'naiboi', 'Naiboi', 'provider_primary_artist_slug', null::uuid),
  ('9b483868-79a4-4791-8da7-37df34f641f2'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-4', 'archived', 'd9e19fd6-0cf5-44e5-8970-c75e17e8d7d2'::uuid, 'bridget-blue', 'Bridget Blue', 'provider_primary_artist_slug', '5479da75-c16a-422a-b442-fa779899018f'::uuid),
  ('9d51c0b5-8d39-44a0-b916-c5f8991133c7'::uuid, 'Colors', 'colors-njerae-7', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', 'dbbff5dd-a249-4148-b13e-3d58aee1fe76'::uuid),
  ('9e86c109-0fb1-4715-bf1b-ce551156c930'::uuid, '1 of 1', '1-of-1', 'needs_review', 'b46d899d-537b-4c6e-9f5a-f6a0e93dae46'::uuid, 'nyashinski', 'Nyashinski', 'provider_primary_artist_name', null::uuid),
  ('9f6e031a-9674-4c6d-875c-0b4daaf2213d'::uuid, 'Day One', 'day-one-mutoriah-4', 'archived', '2a70efd2-7638-403c-9f6c-5bf4b05751bd'::uuid, 'mutoriah', 'Mutoriah', 'provider_primary_artist_slug', 'b6bcfa62-cbc9-4a73-8594-172f86ef00fd'::uuid),
  ('a0a309fd-8145-42da-ba75-9f1e7c7df85f'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-2', 'archived', 'e7278c85-5a4c-4537-8bb2-55a7def214b0'::uuid, 'otile-brown', 'Otile Brown', 'provider_primary_artist_slug', 'd21b9c90-dc11-41c0-ae96-e7b1a62de074'::uuid),
  ('a0eafc8e-46d7-4f40-881e-e9b0991c7b8f'::uuid, 'Gynecologue', 'gynecologue-2', 'active', null::uuid, 'dr-chimano', 'Dr Chimano', 'single_existing_artist', '32695cfe-3287-4fb1-9d96-666923d64413'::uuid),
  ('a5dc12df-67e8-410c-8f5a-ab5e385b1d7f'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-2', 'archived', 'd9e19fd6-0cf5-44e5-8970-c75e17e8d7d2'::uuid, 'bridget-blue', 'Bridget Blue', 'provider_primary_artist_slug', 'dd243337-f0e4-48b8-87cd-5687e49890fe'::uuid),
  ('ad316c60-d434-49f0-9754-c771a6dd66ac'::uuid, 'Tamu', 'tamu-iyanii-9', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', '9fe54fd2-01d1-492e-a22c-3def051d204b'::uuid),
  ('ae6bed85-9e9f-4fec-a1e9-943f49118148'::uuid, 'Euphoria', 'euphoria-2', 'active', '2d9459c6-9ce9-4e6e-930c-ecddae824518'::uuid, 'toxic-lyrikali', 'Toxic Lyrikali', 'release_artist', null::uuid),
  ('b33ade6c-d9c2-488e-9b23-4ac5fc635bdd'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-3', 'archived', 'd9e19fd6-0cf5-44e5-8970-c75e17e8d7d2'::uuid, 'bridget-blue', 'Bridget Blue', 'provider_primary_artist_slug', '395040e2-2180-4026-b11d-5c90b9434413'::uuid),
  ('b6f2e8ea-ead8-4db0-b42b-1e712e369611'::uuid, 'Brayo', 'brayo-teslah-2', 'archived', '74ed92e5-2d13-4da8-92a7-41e9d28fe07f'::uuid, 'teslah', 'Teslah', 'provider_primary_artist_slug', 'a60b2c1c-885e-4b9d-8d05-08e6f123e7d1'::uuid),
  ('bd9cd195-6994-4ca4-af1e-de6e9e6af343'::uuid, 'Day One', 'day-one-mutoriah-7', 'archived', '2a70efd2-7638-403c-9f6c-5bf4b05751bd'::uuid, 'mutoriah', 'Mutoriah', 'provider_primary_artist_slug', 'f5af0f30-c6d6-4ba7-8e65-52c34884f6e6'::uuid),
  ('bfc47b7b-1ad9-4eb2-8648-1ab1ca83a129'::uuid, 'Colors', 'colors-njerae-2', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', '699e8703-603d-4c61-beea-3509deae5fec'::uuid),
  ('c139415a-9f0d-44c4-b5ea-123a8f66b97a'::uuid, 'Better Love', 'better-love-v-be-3', 'archived', 'e0b31768-5f69-4edc-afa4-2fdc01da7307'::uuid, 'v-be', 'V-Be', 'provider_primary_artist_slug', '0b77cb3c-5311-4444-9015-0ca6ba2d8237'::uuid),
  ('c2f244f0-ae1e-4234-a30c-c7c7e415caa7'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-5', 'archived', 'd9e19fd6-0cf5-44e5-8970-c75e17e8d7d2'::uuid, 'bridget-blue', 'Bridget Blue', 'provider_primary_artist_slug', '6ac16a32-4235-4b5f-8acd-86beecebbf0b'::uuid),
  ('c65fa47c-df83-4957-bec4-543ffb9a6e2c'::uuid, 'Better Love', 'better-love-v-be-7', 'archived', 'e0b31768-5f69-4edc-afa4-2fdc01da7307'::uuid, 'v-be', 'V-Be', 'provider_primary_artist_slug', '85923687-1268-4c45-9a10-a5bb06cdf15d'::uuid),
  ('cbfb9a08-0033-432b-ad46-f1c2d42f70c7'::uuid, 'Brayo', 'brayo-teslah-8', 'archived', '74ed92e5-2d13-4da8-92a7-41e9d28fe07f'::uuid, 'teslah', 'Teslah', 'provider_primary_artist_slug', 'de666ae8-2e2d-4ed5-802c-a1edbc4cb917'::uuid),
  ('ce7cc54b-4419-46ad-8c17-7051da01d2c9'::uuid, '1 Times 3', '1-times-3', 'needs_review', '2011e387-7de9-4cde-8965-2561ea17d93b'::uuid, 'itsdeco', 'ItsDeco', 'provider_primary_artist_name', null::uuid),
  ('cfa6d46a-bc88-4dd8-be8a-aa16701a91da'::uuid, 'Come My Way', 'come-my-way-fena-gitu-7', 'archived', '6377a0ee-7c9b-4fd8-9101-197fef3bbe9f'::uuid, 'fena-gitu', 'Fena Gitu', 'provider_primary_artist_slug', '2f96ce6d-1e63-4053-a6d2-0a0b98e342d4'::uuid),
  ('d8a4743f-dec0-4f81-b077-40e9c0498d5f'::uuid, 'More', 'more-mwanaa-3', 'archived', '41b1848e-e25b-4ca7-b5a0-18b0d390816d'::uuid, 'mwanaa', 'Mwanaa', 'provider_primary_artist_slug', 'b257cd3a-4339-461e-9aeb-5d9894243b4d'::uuid),
  ('de104c77-24a3-487f-8409-309d1928844a'::uuid, 'Tamu', 'tamu-iyanii-4', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', '4477f19b-de22-4550-af3f-ebc587e0aaf9'::uuid),
  ('e36310b0-f2c8-44a0-b4f4-3d1ea73b6ebd'::uuid, 'Colors', 'colors-njerae-5', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', '3d9e4cde-e258-4599-bb73-8237280dc5ce'::uuid),
  ('e51916e8-02fc-4e81-bf80-0c7f0fc3cd68'::uuid, 'Ni Wewe', 'ni-wewe-bridget-blue-7', 'archived', 'd9e19fd6-0cf5-44e5-8970-c75e17e8d7d2'::uuid, 'bridget-blue', 'Bridget Blue', 'provider_primary_artist_slug', '0c88ca6d-76b8-4726-8587-ca0a80c8d805'::uuid),
  ('e66f2fb2-edd4-4864-94a6-a09c287566d4'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-6', 'archived', 'e7278c85-5a4c-4537-8bb2-55a7def214b0'::uuid, 'otile-brown', 'Otile Brown', 'provider_primary_artist_slug', '4cff3e7d-608a-4c11-88db-fe0c6894d04b'::uuid),
  ('e8716f1c-0aff-4484-8f15-d3649eb1de8d'::uuid, 'Baddies Need Love', 'baddies-need-love-maandy-2', 'archived', 'ca501022-997b-4760-bb13-f3ee9bb7520d'::uuid, 'maandy', 'Maandy', 'provider_primary_artist_slug', null::uuid),
  ('e90898af-1895-4b5d-a63f-826ec30a1256'::uuid, 'Colors', 'colors-njerae-9', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', '72b58846-d4cc-4c8e-95e9-79c546881583'::uuid),
  ('e98f1618-ca69-43e1-8fd5-5e93ae47b16a'::uuid, 'Day One', 'day-one-mutoriah-2', 'archived', '2a70efd2-7638-403c-9f6c-5bf4b05751bd'::uuid, 'mutoriah', 'Mutoriah', 'provider_primary_artist_slug', '682e8d8a-0bef-4f4a-93ab-5bb70a23f8ae'::uuid),
  ('ed26df14-77d6-4706-88e6-0347908a5bd0'::uuid, 'Day One', 'day-one-mutoriah-8', 'archived', '2a70efd2-7638-403c-9f6c-5bf4b05751bd'::uuid, 'mutoriah', 'Mutoriah', 'provider_primary_artist_slug', '635bbaab-498a-409f-8d7e-5f0d255e9039'::uuid),
  ('f60f207e-17df-4127-a7e4-35c34399ab65'::uuid, 'Ni Wewe', 'ni-wewe-otile-brown-7', 'archived', 'e7278c85-5a4c-4537-8bb2-55a7def214b0'::uuid, 'otile-brown', 'Otile Brown', 'provider_primary_artist_slug', '555fb588-5da6-465c-91bc-415dc9082a9b'::uuid),
  ('f708481e-c537-4059-bfa9-6aceee8cf891'::uuid, 'Tamu', 'tamu-iyanii-2', 'archived', 'a3f5af93-8bf9-4510-a3dd-1e2764f22adc'::uuid, 'iyanii', 'Iyanii', 'provider_primary_artist_slug', 'c8299447-74b5-4850-937a-4cfc64ea2f09'::uuid),
  ('f7cf445e-dbe6-4358-9086-9b2b1b1fe69e'::uuid, 'Brayo', 'brayo-teslah-6', 'archived', '74ed92e5-2d13-4da8-92a7-41e9d28fe07f'::uuid, 'teslah', 'Teslah', 'provider_primary_artist_slug', '4606c378-7280-45ab-b029-a62fc3846c14'::uuid),
  ('fad3407f-0aff-48aa-af90-d4c3deaedf6a'::uuid, 'Better Love', 'better-love-v-be-2', 'archived', 'e0b31768-5f69-4edc-afa4-2fdc01da7307'::uuid, 'v-be', 'V-Be', 'provider_primary_artist_slug', '8f4af599-6abf-49a8-ae5b-74bface43105'::uuid),
  ('fe7a77e2-52ed-4fa9-ba50-f3bef822c112'::uuid, 'Colors', 'colors-njerae-8', 'archived', '0d23b2df-dd05-4f93-bd90-5c8ab4ab3b32'::uuid, 'njerae', 'Njerae', 'provider_primary_artist_slug', '85d649a1-73d7-481f-9ed6-56aff6229197'::uuid);

do $preconditions$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from artist_repairs;

  if v_count <> 85 then
    raise exception
      'Expected 85 artist repairs, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from artist_repairs repair
  join public.registry_tracks track
    on track.id = repair.track_id
   and track.title = repair.expected_title
   and track.slug = repair.expected_slug
   and track.status = repair.expected_status;

  if v_count <> 85 then
    raise exception
      'Exact track state changed; matched %',
      v_count;
  end if;

  select count(*)
  into v_count
  from artist_repairs repair
  join public.registry_artists artist
    on artist.id = repair.artist_id
   and artist.slug = repair.artist_slug
   and artist.display_name = repair.artist_name
   and artist.status in (
     'active',
     'needs_review',
     'draft'
   )
  where repair.artist_id is not null;

  if v_count <> 82 then
    raise exception
      'Expected 82 registry-backed artists, matched %',
      v_count;
  end if;

  if (
    select count(*)
    from artist_repairs
    where artist_id is null
      and artist_slug is not null
      and existing_relationship_id is not null
  ) <> 3 then
    raise exception
      'Slug-only artist relationship boundary changed';
  end if;

  if exists (
    select 1
    from artist_repairs repair
    where (
      select count(*)
      from public.registry_track_artists relationship
      where relationship.track_id = repair.track_id
        and coalesce(
          relationship.is_primary,
          false
        ) = true
        and relationship.status in (
          'active',
          'needs_review',
          'draft'
        )
    ) <> 0
  ) then
    raise exception
      'A target track already has a usable primary artist';
  end if;

  if exists (
    select 1
    from artist_repairs repair
    where repair.existing_relationship_id is not null
      and not exists (
        select 1
        from public.registry_track_artists relationship
        where relationship.id =
          repair.existing_relationship_id
          and relationship.track_id =
            repair.track_id
          and (
            relationship.artist_id =
              repair.artist_id
            or relationship.artist_slug =
              repair.artist_slug
          )
      )
  ) then
    raise exception
      'An existing target relationship changed';
  end if;

  if exists (
    select 1
    from artist_repairs repair
    where (
      select count(*)
      from public.registry_track_artists relationship
      where relationship.track_id = repair.track_id
        and (
          relationship.artist_id =
            repair.artist_id
          or relationship.artist_slug =
            repair.artist_slug
        )
    ) > 1
  ) then
    raise exception
      'A target track has duplicate target relationships';
  end if;
end
$preconditions$;

do $promote_existing$
declare
  v_count integer;
begin
  with updated as (
    update public.registry_track_artists relationship
    set
      artist_id = repair.artist_id,
      artist_slug = repair.artist_slug,
      artist_name_text = repair.artist_name,
      role = 'primary_artist',
      is_primary = true,
      is_featured = false,
      credit_order = 1,
      display_credit = repair.artist_name,
      source = 'numbered_track_artist_repair_20260714',
      confidence = 100,
      status = 'active',
      metadata = coalesce(
        relationship.metadata,
        '{}'::jsonb
      ) || jsonb_build_object(
        'repair_batch',
          'numbered_track_artist_repair_20260714',
        'repair_evidence',
          repair.evidence
      ),
      updated_at = now()
    from artist_repairs repair
    where repair.existing_relationship_id is not null
      and relationship.id =
        repair.existing_relationship_id
    returning relationship.id
  )
  select count(*)
  into v_count
  from updated;

  if v_count <> 73 then
    raise exception
      'Expected to promote 73 relationships, promoted %',
      v_count;
  end if;
end
$promote_existing$;

do $insert_missing$
declare
  v_count integer;
begin
  with inserted as (
    insert into public.registry_track_artists (
      track_id,
      artist_id,
      artist_slug,
      artist_name_text,
      role,
      is_primary,
      is_featured,
      credit_order,
      display_credit,
      source,
      confidence,
      status,
      metadata,
      created_at,
      updated_at
    )
    select
      repair.track_id,
      repair.artist_id,
      repair.artist_slug,
      repair.artist_name,
      'primary_artist',
      true,
      false,
      1,
      repair.artist_name,
      'numbered_track_artist_repair_20260714',
      100,
      'active',
      jsonb_build_object(
        'repair_batch',
          'numbered_track_artist_repair_20260714',
        'repair_evidence',
          repair.evidence
      ),
      now(),
      now()
    from artist_repairs repair
    where repair.existing_relationship_id is null
    returning id
  )
  select count(*)
  into v_count
  from inserted;

  if v_count <> 12 then
    raise exception
      'Expected to insert 12 relationships, inserted %',
      v_count;
  end if;
end
$insert_missing$;

do $postconditions$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from artist_repairs repair
  join public.registry_track_artists relationship
    on relationship.track_id = repair.track_id
   and relationship.artist_id is not distinct from repair.artist_id
   and relationship.artist_slug = repair.artist_slug
   and relationship.role = 'primary_artist'
   and relationship.is_primary = true
   and relationship.is_featured = false
   and relationship.credit_order = 1
   and relationship.status = 'active';

  if v_count <> 85 then
    raise exception
      'Exact primary relationship postcondition matched %',
      v_count;
  end if;

  if exists (
    select 1
    from artist_repairs repair
    where (
      select count(*)
      from public.registry_track_artists relationship
      where relationship.track_id = repair.track_id
        and relationship.status in (
          'active',
          'needs_review',
          'draft'
        )
        and coalesce(
          relationship.is_primary,
          false
        ) = true
    ) <> 1
  ) then
    raise exception
      'A repaired track does not have exactly one primary artist';
  end if;
end
$postconditions$;

commit;
