-- Canonicalize the remaining safe numbered track slugs.
-- Frozen inventory SHA256: 788ddab03af2932f9053c0c25dd1461a5f32dad9accf310560ca466eb33b1f69
-- Live audit SHA256: 5cc835f5876b3d055b19639aacf70ad3698ec646de65e82294f845c1db6bc02d
-- Candidate tracks: 53
-- Direct canonicalizations: 8
-- Release-resolved canonicalizations: 45
-- Release-scoped redirects: 73
-- Total redirects: 126

begin;

select pg_advisory_xact_lock(
  hashtext('wakilisha:canonicalize-remaining-numbered-tracks')
);

create temporary table numbered_track_candidates (
  track_id uuid primary key,
  title text not null,
  old_slug text not null,
  new_slug text not null,
  expected_status text not null,
  track_artist_slug text not null,
  proposed_action text not null,
  selected_release_id uuid,
  selected_release_slug text,
  selected_route_artist_slug text,
  standalone_old_path text not null,
  standalone_new_path text not null
) on commit drop;

insert into numbered_track_candidates (
  track_id, title, old_slug, new_slug, expected_status,
  track_artist_slug, proposed_action, selected_release_id,
  selected_release_slug, selected_route_artist_slug,
  standalone_old_path, standalone_new_path
)
values
  ('051d1fea-8171-4ec8-b290-88006e1cdfca'::uuid, 'Oriti', 'oriti-2', 'oriti', 'active', 'winyo', 'resolve_using_release_membership', '340b3a6d-5963-4ba8-8206-666717c121b1'::uuid, 'sazile-ep', 'winyo', '/tracks/winyo/oriti-2', '/releases/winyo/sazile-ep/oriti'),
  ('0809a3c6-41e8-4e5c-9de6-12844e56ed3f'::uuid, 'Interlude', 'interlude-6', 'interlude', 'active', 'wakadinali', 'canonicalize_directly', null::uuid, null, null, '/tracks/wakadinali/interlude-6', '/tracks/wakadinali/interlude'),
  ('1c8beb7b-e4f9-4394-bd04-3766b0657c1e'::uuid, 'Bad Side', 'bad-side-2', 'bad-side', 'active', 'xenia-manasseh', 'resolve_using_release_membership', '21cb1f58-ffb5-47bd-80dd-a00429a5169e'::uuid, 'love-hate-pt-2', 'xenia-manasseh', '/tracks/xenia-manasseh/bad-side-2', '/releases/xenia-manasseh/love-hate-pt-2/bad-side'),
  ('1e4152fc-85bc-4dde-808a-19c1d337e25d'::uuid, 'Trouble', 'trouble-2', 'trouble', 'active', 'fena-gitu', 'canonicalize_directly', null::uuid, null, null, '/tracks/fena-gitu/trouble-2', '/tracks/fena-gitu/trouble'),
  ('23a36038-d6d9-406c-93dd-b2026db6fb24'::uuid, 'Phases', 'phases-2', 'phases', 'active', 'xenia-manasseh', 'resolve_using_release_membership', '21cb1f58-ffb5-47bd-80dd-a00429a5169e'::uuid, 'love-hate-pt-2', 'xenia-manasseh', '/tracks/xenia-manasseh/phases-2', '/releases/xenia-manasseh/love-hate-pt-2/phases'),
  ('24090663-2a03-4816-816e-18aeddf79234'::uuid, 'Interlude', 'interlude-7', 'interlude', 'active', 'wakadinali', 'canonicalize_directly', null::uuid, null, null, '/tracks/wakadinali/interlude-7', '/tracks/wakadinali/interlude'),
  ('26b141da-b5d6-47f6-84e2-2c085eddd955'::uuid, 'Ahere', 'ahere-2', 'ahere', 'active', 'willy-paul', 'resolve_using_release_membership', '13a6a7d1-d492-4de5-9b3b-f554606b809e'::uuid, 'ahere-single', 'willy-paul', '/tracks/willy-paul/ahere-2', '/releases/willy-paul/ahere-single/ahere'),
  ('28bb72e3-b912-4a7f-bea0-b75a838a14d7'::uuid, 'Suna (Da Africa Deep Afrikan Remix)', 'suna-da-africa-deep-afrikan-remix-2', 'suna-da-africa-deep-afrikan-remix', 'active', 'winyo', 'resolve_using_release_membership', 'c1460481-2740-43ee-b16e-fb9b78022ebb'::uuid, 'sazile-remixes', 'winyo', '/tracks/winyo/suna-da-africa-deep-afrikan-remix-2', '/releases/winyo/sazile-remixes/suna-da-africa-deep-afrikan-remix'),
  ('28cc036b-5f8d-46ba-886c-3ad214da9977'::uuid, 'Kaende', 'kaende-2', 'kaende', 'active', 'fena-gitu', 'resolve_using_release_membership', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu', '/tracks/fena-gitu/kaende-2', '/releases/fena-gitu/unleashed/kaende'),
  ('2ceb66bb-3388-43a5-97e5-fe7bc2f87d03'::uuid, 'Disko', 'disko-2', 'disko', 'active', 'kodongklan', 'resolve_using_release_membership', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan', '/tracks/kodongklan/disko-2', '/releases/kodongklan/disko/disko'),
  ('3afdfc10-bd55-4d99-b851-60c8ce53ba9a'::uuid, 'Intro (kitu Sewer)', 'intro-kitu-sewer-2', 'intro-kitu-sewer', 'active', 'wakadinali', 'resolve_using_release_membership', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali', '/tracks/wakadinali/intro-kitu-sewer-2', '/releases/wakadinali/victims-of-madness-2-0/intro-kitu-sewer'),
  ('3c61900c-e73a-4cf6-8657-061a27a558ea'::uuid, 'Outro', 'outro-2', 'outro', 'active', 'kleptomaniax', 'resolve_using_release_membership', 'dc5bd9de-4a1e-4152-987d-f0d4fdbd41f7'::uuid, 'nitt-now-is-the-time', 'kleptomaniax', '/tracks/kleptomaniax/outro-2', '/releases/kleptomaniax/nitt-now-is-the-time/outro'),
  ('3f9a096a-81b6-46e5-808c-ea46060dbb6e'::uuid, 'Feel You', 'feel-you-2', 'feel-you', 'active', 'karun', 'resolve_using_release_membership', '92944175-436c-4547-b836-2e344fe4f63b'::uuid, 'eternal-ep', 'karun', '/tracks/karun/feel-you-2', '/releases/karun/eternal-ep/feel-you'),
  ('4cfb28a2-692a-4707-953b-100892d4726c'::uuid, '1 of 1', '1-of-1-2', '1-of-1', 'active', 'nyashinski', 'resolve_using_release_membership', '2d921587-6c9d-4583-be4c-20e7546597aa'::uuid, 'to-whom-it-may-concern-ep', 'nyashinski', '/tracks/nyashinski/1-of-1-2', '/releases/nyashinski/to-whom-it-may-concern-ep/1-of-1'),
  ('54b79dd6-3108-4345-9dda-5fc96561f3f2'::uuid, 'Mimi Na Wewe', 'mimi-na-wewe-3', 'mimi-na-wewe', 'active', 'bridget-blue', 'resolve_using_release_membership', 'c40ad9b9-ca36-4f7b-bf7d-0f7df468b915'::uuid, 'rnb', 'bridget-blue', '/tracks/bridget-blue/mimi-na-wewe-3', '/releases/bridget-blue/rnb/mimi-na-wewe'),
  ('5a25bbb9-49db-4868-985c-1f18aeaa58ac'::uuid, 'Legendary', 'legendary-2', 'legendary', 'active', 'nyashinski', 'resolve_using_release_membership', '8f25b29f-ce76-4a34-9791-e230d2750f9a'::uuid, 'yariasu', 'nyashinski', '/tracks/nyashinski/legendary-2', '/releases/nyashinski/yariasu/legendary'),
  ('5ddfb449-a403-4793-bd8f-af8acd05cea2'::uuid, 'Tamashani (feat. Skillo, Sudough Doss & Katapilla)', 'tamashani-feat-skillo-sudough-doss-katapilla-2', 'tamashani-feat-skillo-sudough-doss-katapilla', 'active', 'wakadinali', 'resolve_using_release_membership', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali', '/tracks/wakadinali/tamashani-feat-skillo-sudough-doss-katapilla-2', '/releases/wakadinali/victims-of-madness-2-0/tamashani-feat-skillo-sudough-doss-katapilla'),
  ('625668a6-60e1-4a78-917e-d6ca28943a51'::uuid, 'Beba Beba', 'beba-beba-2', 'beba-beba', 'active', 'v-be', 'resolve_using_release_membership', '29f2aa9f-861a-41ec-b545-747a0a63405a'::uuid, 'beba-beba-single', 'v-be', '/tracks/v-be/beba-beba-2', '/releases/v-be/beba-beba-single/beba-beba'),
  ('62d16b06-1161-4ed3-9014-76a3fd1ed38e'::uuid, 'TRUST ISSUES (feat. Bensoul)', 'trust-issues-feat-bensoul-2', 'trust-issues-feat-bensoul', 'active', 'charisma', 'resolve_using_release_membership', '2bae756b-4619-4dcb-8c60-1c0adee72522'::uuid, 'the-motions', 'charisma', '/tracks/charisma/trust-issues-feat-bensoul-2', '/releases/charisma/the-motions/trust-issues-feat-bensoul'),
  ('6ccfacab-1a38-46bc-9494-c8016bf18f35'::uuid, 'Ngozi Kama Jua', 'ngozi-kama-jua-2', 'ngozi-kama-jua', 'active', 'bridget-blue', 'resolve_using_release_membership', 'c40ad9b9-ca36-4f7b-bf7d-0f7df468b915'::uuid, 'rnb', 'bridget-blue', '/tracks/bridget-blue/ngozi-kama-jua-2', '/releases/bridget-blue/rnb/ngozi-kama-jua'),
  ('707f58b6-b42b-4eea-a06f-42859f15d075'::uuid, 'SINA NOMA', 'sina-noma-2', 'sina-noma', 'active', 'charisma', 'resolve_using_release_membership', '2bae756b-4619-4dcb-8c60-1c0adee72522'::uuid, 'the-motions', 'charisma', '/tracks/charisma/sina-noma-2', '/releases/charisma/the-motions/sina-noma'),
  ('75083467-11cb-4a2e-a35e-0fe3a5fbbde9'::uuid, 'Mbuzi', 'mbuzi-2', 'mbuzi', 'active', 'bridget-blue', 'resolve_using_release_membership', '9f80e380-87b4-488e-988e-a1321977087e'::uuid, 'mbuzi-single', 'bridget-blue', '/tracks/bridget-blue/mbuzi-2', '/releases/bridget-blue/mbuzi-single/mbuzi'),
  ('7b91b435-816f-4d14-bc0d-0c389f0dfefe'::uuid, 'Ma G Kwenye Klabu', 'ma-g-kwenye-klabu-2', 'ma-g-kwenye-klabu', 'active', 'lil-maina', 'resolve_using_release_membership', 'f965feac-b97e-4611-9c6f-0ea15a182a27'::uuid, 'maisha-ya-stunna', 'lil-maina', '/tracks/lil-maina/ma-g-kwenye-klabu-2', '/releases/lil-maina/maisha-ya-stunna/ma-g-kwenye-klabu'),
  ('7c916b0a-1ea1-4869-b3bc-f178d84b6694'::uuid, 'Look The Other Way', 'look-the-other-way-2', 'look-the-other-way', 'active', 'maya-amolo', 'resolve_using_release_membership', '6c50ed4f-337a-4ca9-adc8-f79fffbb935b'::uuid, 'look-the-other-way-single', 'maya-amolo', '/tracks/maya-amolo/look-the-other-way-2', '/releases/maya-amolo/look-the-other-way-single/look-the-other-way'),
  ('873be05c-1a7f-400a-ab3e-4c8fb7a2e33e'::uuid, 'All My Enemies Are Suffering', 'all-my-enemies-are-suffering-2', 'all-my-enemies-are-suffering', 'active', 'bien', 'resolve_using_release_membership', 'e88108d4-c08f-491a-af92-ff55c6e50f54'::uuid, 'all-my-enemies-are-suffering-single', 'bien', '/tracks/bien/all-my-enemies-are-suffering-2', '/releases/bien/all-my-enemies-are-suffering-single/all-my-enemies-are-suffering'),
  ('8787b351-6a70-4d96-894d-9d04e52059c6'::uuid, 'Kodong', 'kodong-2', 'kodong', 'active', 'kodongklan', 'resolve_using_release_membership', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan', '/tracks/kodongklan/kodong-2', '/releases/kodongklan/disko/kodong'),
  ('89b60b00-d7f2-4309-b5b2-999adfb33015'::uuid, 'Intro.', 'intro-9', 'intro', 'active', 'wakadinali', 'canonicalize_directly', null::uuid, null, null, '/tracks/wakadinali/intro-9', '/tracks/wakadinali/intro'),
  ('9159e0f0-26ec-43b4-aa92-7f062886ebcb'::uuid, 'Confession', 'confession-2', 'confession', 'active', 'buruklyn-boyz', 'resolve_using_release_membership', 'f397bbf1-08e3-4595-a31c-207d8de362b1'::uuid, '58-flava', 'buruklyn-boyz', '/tracks/buruklyn-boyz/confession-2', '/releases/buruklyn-boyz/58-flava/confession'),
  ('91e17547-6168-475c-9f4d-b9bffcd87922'::uuid, 'Trouble', 'trouble-3', 'trouble', 'active', 'fena-gitu', 'canonicalize_directly', null::uuid, null, null, '/tracks/fena-gitu/trouble-3', '/tracks/fena-gitu/trouble'),
  ('93359e51-1f0a-4ce2-b3a2-2d1aff877cc4'::uuid, 'Mfalme Wa Mapenzi', 'mfalme-wa-mapenzi-2', 'mfalme-wa-mapenzi', 'active', 'sanaipei-tande', 'resolve_using_release_membership', '54504103-f6bd-4be7-850f-798452c459d5'::uuid, 'mfalme-wa-mapenzi-single', 'sanaipei-tande', '/tracks/sanaipei-tande/mfalme-wa-mapenzi-2', '/releases/sanaipei-tande/mfalme-wa-mapenzi-single/mfalme-wa-mapenzi'),
  ('94831845-4c9f-48e6-bc33-e2eef81c6f22'::uuid, 'Interlude 2', 'interlude-2-3', 'interlude-2', 'active', 'jua-cali', 'canonicalize_directly', null::uuid, null, null, '/tracks/jua-cali/interlude-2-3', '/tracks/jua-cali/interlude-2'),
  ('9535f468-ab55-46f7-a44b-7f3c6b52b02d'::uuid, 'Treasure', 'treasure-2', 'treasure', 'active', 'karun', 'resolve_using_release_membership', '92944175-436c-4547-b836-2e344fe4f63b'::uuid, 'eternal-ep', 'karun', '/tracks/karun/treasure-2', '/releases/karun/eternal-ep/treasure'),
  ('97badb7a-6fb2-432e-a805-abf30a6c1b72'::uuid, 'NYONGI', 'nyongi-2', 'nyongi', 'active', 'matata', 'resolve_using_release_membership', '3aa92377-0e35-4f96-8bee-756b77060336'::uuid, 'nyongi-single', 'matata', '/tracks/matata/nyongi-2', '/releases/matata/nyongi-single/nyongi'),
  ('97fbe42e-03ef-406b-aaad-d6fb09dec9e7'::uuid, 'Maproso (feat. Suzanna Owiyo)', 'maproso-feat-suzanna-owiyo-2', 'maproso-feat-suzanna-owiyo', 'active', 'wakadinali', 'resolve_using_release_membership', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali', '/tracks/wakadinali/maproso-feat-suzanna-owiyo-2', '/releases/wakadinali/victims-of-madness-2-0/maproso-feat-suzanna-owiyo'),
  ('a21b4ea2-9aa2-4d29-b4f7-23a7c7ae604e'::uuid, 'Duog Dala', 'duog-dala-2', 'duog-dala', 'active', 'fancy-fingers', 'resolve_using_release_membership', '7647c96b-9d67-4bde-8b1e-e2187eec6f4a'::uuid, 'duog-dala-single', 'fancy-fingers', '/tracks/fancy-fingers/duog-dala-2', '/releases/fancy-fingers/duog-dala-single/duog-dala'),
  ('a3b24646-44d0-4550-9f46-addb1463a143'::uuid, 'Show Me Love', 'show-me-love-2', 'show-me-love', 'active', 'fancy-fingers', 'resolve_using_release_membership', '436ac068-0ca6-4304-a120-68278fe92793'::uuid, 'show-me-love-single', 'fancy-fingers', '/tracks/fancy-fingers/show-me-love-2', '/releases/fancy-fingers/show-me-love-single/show-me-love'),
  ('a4a9cf75-697b-489f-bdc5-6905898025a9'::uuid, 'Pumua', 'pumua-2', 'pumua', 'active', 'bridget-blue', 'resolve_using_release_membership', '07397467-419c-4aff-970d-8a42b3d03f63'::uuid, 'pumua-single', 'bridget-blue', '/tracks/bridget-blue/pumua-2', '/releases/bridget-blue/pumua-single/pumua'),
  ('a8ea6199-b3f2-4e33-8975-6d9ff9e500a7'::uuid, 'Karibia', 'karibia-2', 'karibia', 'active', 'fena-gitu', 'resolve_using_release_membership', 'd03d3ea9-9df4-466a-b0e1-2cc0263d6f40'::uuid, 'karibia-single', 'fena-gitu', '/tracks/fena-gitu/karibia-2', '/releases/fena-gitu/karibia-single/karibia'),
  ('ad32ccfd-3c6c-4c20-bfee-3212417da1e0'::uuid, 'Steam', 'steam-2', 'steam', 'active', 'fena-gitu', 'resolve_using_release_membership', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu', '/tracks/fena-gitu/steam-2', '/releases/fena-gitu/unleashed/steam'),
  ('adc09a45-a815-47f7-8cfd-c5fa773ec888'::uuid, 'Celebrate Life', 'celebrate-life-2', 'celebrate-life', 'active', 'nyashinski', 'resolve_using_release_membership', '8f25b29f-ce76-4a34-9791-e230d2750f9a'::uuid, 'yariasu', 'nyashinski', '/tracks/nyashinski/celebrate-life-2', '/releases/nyashinski/yariasu/celebrate-life'),
  ('b7828900-aab2-483f-8a38-11d443544f58'::uuid, 'I Like It', 'i-like-it-2', 'i-like-it', 'active', 'maya-amolo', 'resolve_using_release_membership', 'aa3b2a80-2506-4773-a0ad-db3b08a0aecf'::uuid, 'the-sweetest-time', 'maya-amolo', '/tracks/maya-amolo/i-like-it-2', '/releases/maya-amolo/the-sweetest-time/i-like-it'),
  ('befb0a24-235f-4268-b894-0eff78b5b687'::uuid, 'Dream Ya Kutoka Kwa Block', 'dream-ya-kutoka-kwa-block-2', 'dream-ya-kutoka-kwa-block', 'active', 'buruklyn-boyz', 'resolve_using_release_membership', 'a3b1226b-b8ef-405c-8ff4-4096622dc0de'::uuid, 'dream-ya-kutoka-kwa-block-single', 'buruklyn-boyz', '/tracks/buruklyn-boyz/dream-ya-kutoka-kwa-block-2', '/releases/buruklyn-boyz/dream-ya-kutoka-kwa-block-single/dream-ya-kutoka-kwa-block'),
  ('cb205683-9039-4d6b-adbf-903199cdd7b8'::uuid, 'Mc Mca', 'mc-mca-2', 'mc-mca', 'active', 'wakadinali', 'resolve_using_release_membership', 'e38ceffc-7022-432e-a625-7101840b9c11'::uuid, 'ndani-ya-cockpit-3', 'wakadinali', '/tracks/wakadinali/mc-mca-2', '/releases/wakadinali/ndani-ya-cockpit-3/mc-mca'),
  ('cb2446a9-903c-46e5-b177-9acb769608c3'::uuid, 'Zing Zong', 'zing-zong-2', 'zing-zong', 'active', 'fena-gitu', 'resolve_using_release_membership', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu', '/tracks/fena-gitu/zing-zong-2', '/releases/fena-gitu/unleashed/zing-zong'),
  ('cdaecdd5-2f42-47ed-8336-4d4c7e9b7144'::uuid, 'Finale', 'finale-2', 'finale', 'active', 'bien', 'resolve_using_release_membership', '9529a2f9-605f-40b1-a37c-e27514ece640'::uuid, 'finale-single', 'bien', '/tracks/bien/finale-2', '/releases/bien/finale-single/finale'),
  ('d13517db-08a2-420b-ba3e-2282314e0a59'::uuid, 'Nyaduse', 'nyaduse-2', 'nyaduse', 'active', 'kodongklan', 'resolve_using_release_membership', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan', '/tracks/kodongklan/nyaduse-2', '/releases/kodongklan/disko/nyaduse'),
  ('d1944367-afdc-47de-83f3-820b8739a913'::uuid, 'Tumia Pesa', 'tumia-pesa-2', 'tumia-pesa', 'active', 'watendawili', 'resolve_using_release_membership', '4a9887f5-f906-450f-8934-956d410484a6'::uuid, 'hekaya-ep', 'watendawili', '/tracks/watendawili/tumia-pesa-2', '/releases/watendawili/hekaya-ep/tumia-pesa'),
  ('d457ce0b-48e6-44cc-bedf-5c5510419055'::uuid, 'Bluff', 'bluff-2', 'bluff', 'active', 'nyashinski', 'resolve_using_release_membership', '2d921587-6c9d-4583-be4c-20e7546597aa'::uuid, 'to-whom-it-may-concern-ep', 'nyashinski', '/tracks/nyashinski/bluff-2', '/releases/nyashinski/to-whom-it-may-concern-ep/bluff'),
  ('d538f144-0de0-4131-8637-ed7a63688717'::uuid, 'Mapenzi', 'mapenzi-2', 'mapenzi', 'active', 'bridget-blue', 'resolve_using_release_membership', '0b824be9-b7ed-4e76-8ae7-d5f4c92619da'::uuid, 'mapenzi-single', 'bridget-blue', '/tracks/bridget-blue/mapenzi-2', '/releases/bridget-blue/mapenzi-single/mapenzi'),
  ('dadb8676-9ab6-4688-b4d0-072af5275ff0'::uuid, 'Far Away', 'far-away-2', 'far-away', 'active', 'fancy-fingers', 'resolve_using_release_membership', 'ff15b220-d7d1-448c-8202-213bbc695e88'::uuid, 'far-away-single', 'fancy-fingers', '/tracks/fancy-fingers/far-away-2', '/releases/fancy-fingers/far-away-single/far-away'),
  ('f5a37185-9112-4dcb-97b2-965203e836c6'::uuid, 'Intro', 'intro-10', 'intro', 'active', 'wakadinali', 'canonicalize_directly', null::uuid, null, null, '/tracks/wakadinali/intro-10', '/tracks/wakadinali/intro'),
  ('fb8e1f3b-6b4f-465f-92f2-a7d807b282fc'::uuid, 'Hizi Stance', 'hizi-stance-2', 'hizi-stance', 'active', 'wakadinali', 'resolve_using_release_membership', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali', '/tracks/wakadinali/hizi-stance-2', '/releases/wakadinali/victims-of-madness-2-0/hizi-stance'),
  ('fd6934ed-d2a9-4e55-be56-a64aa0b2a931'::uuid, 'Interlude 2', 'interlude-2-4', 'interlude-2', 'active', 'jua-cali', 'canonicalize_directly', null::uuid, null, null, '/tracks/jua-cali/interlude-2-4', '/tracks/jua-cali/interlude-2');

create temporary table numbered_track_redirects (
  track_id uuid not null,
  redirect_kind text not null,
  old_slug text not null,
  new_slug text not null,
  scope_slug text not null,
  old_path text not null unique,
  new_path text not null,
  release_id uuid,
  release_slug text,
  route_artist_slug text
) on commit drop;

insert into numbered_track_redirects (
  track_id, redirect_kind, old_slug, new_slug, scope_slug,
  old_path, new_path, release_id, release_slug, route_artist_slug
)
values
  ('befb0a24-235f-4268-b894-0eff78b5b687'::uuid, 'release', 'dream-ya-kutoka-kwa-block-2', 'dream-ya-kutoka-kwa-block', 'ajay', '/releases/ajay/dream-ya-kutoka-kwa-block-single/dream-ya-kutoka-kwa-block-2', '/releases/ajay/dream-ya-kutoka-kwa-block-single/dream-ya-kutoka-kwa-block', 'a3b1226b-b8ef-405c-8ff4-4096622dc0de'::uuid, 'dream-ya-kutoka-kwa-block-single', 'ajay'),
  ('cdaecdd5-2f42-47ed-8336-4d4c7e9b7144'::uuid, 'release', 'finale-2', 'finale', 'alikiba', '/releases/alikiba/finale-single/finale-2', '/releases/alikiba/finale-single/finale', '9529a2f9-605f-40b1-a37c-e27514ece640'::uuid, 'finale-single', 'alikiba'),
  ('dadb8676-9ab6-4688-b4d0-072af5275ff0'::uuid, 'release', 'far-away-2', 'far-away', 'azawi', '/releases/azawi/far-away-single/far-away-2', '/releases/azawi/far-away-single/far-away', 'ff15b220-d7d1-448c-8202-213bbc695e88'::uuid, 'far-away-single', 'azawi'),
  ('873be05c-1a7f-400a-ab3e-4c8fb7a2e33e'::uuid, 'release', 'all-my-enemies-are-suffering-2', 'all-my-enemies-are-suffering', 'bien', '/releases/bien/all-my-enemies-are-suffering-single/all-my-enemies-are-suffering-2', '/releases/bien/all-my-enemies-are-suffering-single/all-my-enemies-are-suffering', 'e88108d4-c08f-491a-af92-ff55c6e50f54'::uuid, 'all-my-enemies-are-suffering-single', 'bien'),
  ('cdaecdd5-2f42-47ed-8336-4d4c7e9b7144'::uuid, 'release', 'finale-2', 'finale', 'bien', '/releases/bien/finale-single/finale-2', '/releases/bien/finale-single/finale', '9529a2f9-605f-40b1-a37c-e27514ece640'::uuid, 'finale-single', 'bien'),
  ('3f9a096a-81b6-46e5-808c-ea46060dbb6e'::uuid, 'release', 'feel-you-2', 'feel-you', 'bigfootinyourface', '/releases/bigfootinyourface/eternal-ep/feel-you-2', '/releases/bigfootinyourface/eternal-ep/feel-you', '92944175-436c-4547-b836-2e344fe4f63b'::uuid, 'eternal-ep', 'bigfootinyourface'),
  ('9535f468-ab55-46f7-a44b-7f3c6b52b02d'::uuid, 'release', 'treasure-2', 'treasure', 'bigfootinyourface', '/releases/bigfootinyourface/eternal-ep/treasure-2', '/releases/bigfootinyourface/eternal-ep/treasure', '92944175-436c-4547-b836-2e344fe4f63b'::uuid, 'eternal-ep', 'bigfootinyourface'),
  ('d538f144-0de0-4131-8637-ed7a63688717'::uuid, 'release', 'mapenzi-2', 'mapenzi', 'bridget-blue', '/releases/bridget-blue/mapenzi-single/mapenzi-2', '/releases/bridget-blue/mapenzi-single/mapenzi', '0b824be9-b7ed-4e76-8ae7-d5f4c92619da'::uuid, 'mapenzi-single', 'bridget-blue'),
  ('75083467-11cb-4a2e-a35e-0fe3a5fbbde9'::uuid, 'release', 'mbuzi-2', 'mbuzi', 'bridget-blue', '/releases/bridget-blue/mbuzi-single/mbuzi-2', '/releases/bridget-blue/mbuzi-single/mbuzi', '9f80e380-87b4-488e-988e-a1321977087e'::uuid, 'mbuzi-single', 'bridget-blue'),
  ('a4a9cf75-697b-489f-bdc5-6905898025a9'::uuid, 'release', 'pumua-2', 'pumua', 'bridget-blue', '/releases/bridget-blue/pumua-single/pumua-2', '/releases/bridget-blue/pumua-single/pumua', '07397467-419c-4aff-970d-8a42b3d03f63'::uuid, 'pumua-single', 'bridget-blue'),
  ('75083467-11cb-4a2e-a35e-0fe3a5fbbde9'::uuid, 'release', 'mbuzi-2', 'mbuzi', 'bridget-blue', '/releases/bridget-blue/rnb/mbuzi-2', '/releases/bridget-blue/rnb/mbuzi', 'c40ad9b9-ca36-4f7b-bf7d-0f7df468b915'::uuid, 'rnb', 'bridget-blue'),
  ('54b79dd6-3108-4345-9dda-5fc96561f3f2'::uuid, 'release', 'mimi-na-wewe-3', 'mimi-na-wewe', 'bridget-blue', '/releases/bridget-blue/rnb/mimi-na-wewe-3', '/releases/bridget-blue/rnb/mimi-na-wewe', 'c40ad9b9-ca36-4f7b-bf7d-0f7df468b915'::uuid, 'rnb', 'bridget-blue'),
  ('6ccfacab-1a38-46bc-9494-c8016bf18f35'::uuid, 'release', 'ngozi-kama-jua-2', 'ngozi-kama-jua', 'bridget-blue', '/releases/bridget-blue/rnb/ngozi-kama-jua-2', '/releases/bridget-blue/rnb/ngozi-kama-jua', 'c40ad9b9-ca36-4f7b-bf7d-0f7df468b915'::uuid, 'rnb', 'bridget-blue'),
  ('9159e0f0-26ec-43b4-aa92-7f062886ebcb'::uuid, 'release', 'confession-2', 'confession', 'buruklyn-boyz', '/releases/buruklyn-boyz/58-flava/confession-2', '/releases/buruklyn-boyz/58-flava/confession', 'f397bbf1-08e3-4595-a31c-207d8de362b1'::uuid, '58-flava', 'buruklyn-boyz'),
  ('befb0a24-235f-4268-b894-0eff78b5b687'::uuid, 'release', 'dream-ya-kutoka-kwa-block-2', 'dream-ya-kutoka-kwa-block', 'buruklyn-boyz', '/releases/buruklyn-boyz/dream-ya-kutoka-kwa-block-single/dream-ya-kutoka-kwa-block-2', '/releases/buruklyn-boyz/dream-ya-kutoka-kwa-block-single/dream-ya-kutoka-kwa-block', 'a3b1226b-b8ef-405c-8ff4-4096622dc0de'::uuid, 'dream-ya-kutoka-kwa-block-single', 'buruklyn-boyz'),
  ('707f58b6-b42b-4eea-a06f-42859f15d075'::uuid, 'release', 'sina-noma-2', 'sina-noma', 'charisma', '/releases/charisma/the-motions/sina-noma-2', '/releases/charisma/the-motions/sina-noma', '2bae756b-4619-4dcb-8c60-1c0adee72522'::uuid, 'the-motions', 'charisma'),
  ('62d16b06-1161-4ed3-9014-76a3fd1ed38e'::uuid, 'release', 'trust-issues-feat-bensoul-2', 'trust-issues-feat-bensoul', 'charisma', '/releases/charisma/the-motions/trust-issues-feat-bensoul-2', '/releases/charisma/the-motions/trust-issues-feat-bensoul', '2bae756b-4619-4dcb-8c60-1c0adee72522'::uuid, 'the-motions', 'charisma'),
  ('f5a37185-9112-4dcb-97b2-965203e836c6'::uuid, 'release', 'intro-10', 'intro', 'domani-mkadinali-2', '/releases/domani-mkadinali-2/haitaki-hasira/intro-10', '/releases/domani-mkadinali-2/haitaki-hasira/intro', '6dcc70a4-1e73-459e-b9e5-75f00a4da7e8'::uuid, 'haitaki-hasira', 'domani-mkadinali-2'),
  ('a21b4ea2-9aa2-4d29-b4f7-23a7c7ae604e'::uuid, 'release', 'duog-dala-2', 'duog-dala', 'estere', '/releases/estere/duog-dala-single/duog-dala-2', '/releases/estere/duog-dala-single/duog-dala', '7647c96b-9d67-4bde-8b1e-e2187eec6f4a'::uuid, 'duog-dala-single', 'estere'),
  ('a21b4ea2-9aa2-4d29-b4f7-23a7c7ae604e'::uuid, 'release', 'duog-dala-2', 'duog-dala', 'fancy-fingers', '/releases/fancy-fingers/duog-dala-single/duog-dala-2', '/releases/fancy-fingers/duog-dala-single/duog-dala', '7647c96b-9d67-4bde-8b1e-e2187eec6f4a'::uuid, 'duog-dala-single', 'fancy-fingers'),
  ('dadb8676-9ab6-4688-b4d0-072af5275ff0'::uuid, 'release', 'far-away-2', 'far-away', 'fancy-fingers', '/releases/fancy-fingers/far-away-single/far-away-2', '/releases/fancy-fingers/far-away-single/far-away', 'ff15b220-d7d1-448c-8202-213bbc695e88'::uuid, 'far-away-single', 'fancy-fingers'),
  ('a3b24646-44d0-4550-9f46-addb1463a143'::uuid, 'release', 'show-me-love-2', 'show-me-love', 'fancy-fingers', '/releases/fancy-fingers/show-me-love-single/show-me-love-2', '/releases/fancy-fingers/show-me-love-single/show-me-love', '436ac068-0ca6-4304-a120-68278fe92793'::uuid, 'show-me-love-single', 'fancy-fingers'),
  ('a8ea6199-b3f2-4e33-8975-6d9ff9e500a7'::uuid, 'release', 'karibia-2', 'karibia', 'fena-gitu', '/releases/fena-gitu/karibia-single/karibia-2', '/releases/fena-gitu/karibia-single/karibia', 'd03d3ea9-9df4-466a-b0e1-2cc0263d6f40'::uuid, 'karibia-single', 'fena-gitu'),
  ('1e4152fc-85bc-4dde-808a-19c1d337e25d'::uuid, 'release', 'trouble-2', 'trouble', 'fena-gitu', '/releases/fena-gitu/trouble-single/trouble-2', '/releases/fena-gitu/trouble-single/trouble', '8f530665-e537-44c1-8816-117593480ea2'::uuid, 'trouble-single', 'fena-gitu'),
  ('28cc036b-5f8d-46ba-886c-3ad214da9977'::uuid, 'release', 'kaende-2', 'kaende', 'fena-gitu', '/releases/fena-gitu/unleashed/kaende-2', '/releases/fena-gitu/unleashed/kaende', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu'),
  ('ad32ccfd-3c6c-4c20-bfee-3212417da1e0'::uuid, 'release', 'steam-2', 'steam', 'fena-gitu', '/releases/fena-gitu/unleashed/steam-2', '/releases/fena-gitu/unleashed/steam', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu'),
  ('91e17547-6168-475c-9f4d-b9bffcd87922'::uuid, 'release', 'trouble-3', 'trouble', 'fena-gitu', '/releases/fena-gitu/unleashed/trouble-3', '/releases/fena-gitu/unleashed/trouble', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu'),
  ('cb2446a9-903c-46e5-b177-9acb769608c3'::uuid, 'release', 'zing-zong-2', 'zing-zong', 'fena-gitu', '/releases/fena-gitu/unleashed/zing-zong-2', '/releases/fena-gitu/unleashed/zing-zong', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu'),
  ('fd6934ed-d2a9-4e55-be56-a64aa0b2a931'::uuid, 'release', 'interlude-2-4', 'interlude-2', 'jua-cali', '/releases/jua-cali/ngeli-ya-genge/interlude-2-4', '/releases/jua-cali/ngeli-ya-genge/interlude-2', 'd7abab62-9a6f-41f6-8f71-28e307c4758f'::uuid, 'ngeli-ya-genge', 'jua-cali'),
  ('94831845-4c9f-48e6-bc33-e2eef81c6f22'::uuid, 'release', 'interlude-2-3', 'interlude-2', 'jua-cali', '/releases/jua-cali/tugenge-yajayo/interlude-2-3', '/releases/jua-cali/tugenge-yajayo/interlude-2', '0e13ce67-fcbb-456e-9998-de76cd15c8f6'::uuid, 'tugenge-yajayo', 'jua-cali'),
  ('3f9a096a-81b6-46e5-808c-ea46060dbb6e'::uuid, 'release', 'feel-you-2', 'feel-you', 'karun', '/releases/karun/eternal-ep/feel-you-2', '/releases/karun/eternal-ep/feel-you', '92944175-436c-4547-b836-2e344fe4f63b'::uuid, 'eternal-ep', 'karun'),
  ('9535f468-ab55-46f7-a44b-7f3c6b52b02d'::uuid, 'release', 'treasure-2', 'treasure', 'karun', '/releases/karun/eternal-ep/treasure-2', '/releases/karun/eternal-ep/treasure', '92944175-436c-4547-b836-2e344fe4f63b'::uuid, 'eternal-ep', 'karun'),
  ('051d1fea-8171-4ec8-b290-88006e1cdfca'::uuid, 'release', 'oriti-2', 'oriti', 'kato-change', '/releases/kato-change/sazile-ep/oriti-2', '/releases/kato-change/sazile-ep/oriti', '340b3a6d-5963-4ba8-8206-666717c121b1'::uuid, 'sazile-ep', 'kato-change'),
  ('28bb72e3-b912-4a7f-bea0-b75a838a14d7'::uuid, 'release', 'suna-da-africa-deep-afrikan-remix-2', 'suna-da-africa-deep-afrikan-remix', 'kato-change', '/releases/kato-change/sazile-remixes/suna-da-africa-deep-afrikan-remix-2', '/releases/kato-change/sazile-remixes/suna-da-africa-deep-afrikan-remix', 'c1460481-2740-43ee-b16e-fb9b78022ebb'::uuid, 'sazile-remixes', 'kato-change'),
  ('3c61900c-e73a-4cf6-8657-061a27a558ea'::uuid, 'release', 'outro-2', 'outro', 'kleptomaniax', '/releases/kleptomaniax/nitt-now-is-the-time/outro-2', '/releases/kleptomaniax/nitt-now-is-the-time/outro', 'dc5bd9de-4a1e-4152-987d-f0d4fdbd41f7'::uuid, 'nitt-now-is-the-time', 'kleptomaniax'),
  ('2ceb66bb-3388-43a5-97e5-fe7bc2f87d03'::uuid, 'release', 'disko-2', 'disko', 'kodongklan', '/releases/kodongklan/disko/disko-2', '/releases/kodongklan/disko/disko', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan'),
  ('8787b351-6a70-4d96-894d-9d04e52059c6'::uuid, 'release', 'kodong-2', 'kodong', 'kodongklan', '/releases/kodongklan/disko/kodong-2', '/releases/kodongklan/disko/kodong', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan'),
  ('d13517db-08a2-420b-ba3e-2282314e0a59'::uuid, 'release', 'nyaduse-2', 'nyaduse', 'kodongklan', '/releases/kodongklan/disko/nyaduse-2', '/releases/kodongklan/disko/nyaduse', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan'),
  ('7b91b435-816f-4d14-bc0d-0c389f0dfefe'::uuid, 'release', 'ma-g-kwenye-klabu-2', 'ma-g-kwenye-klabu', 'lil-maina', '/releases/lil-maina/maisha-ya-stunna/ma-g-kwenye-klabu-2', '/releases/lil-maina/maisha-ya-stunna/ma-g-kwenye-klabu', 'f965feac-b97e-4611-9c6f-0ea15a182a27'::uuid, 'maisha-ya-stunna', 'lil-maina'),
  ('97badb7a-6fb2-432e-a805-abf30a6c1b72'::uuid, 'release', 'nyongi-2', 'nyongi', 'marioo', '/releases/marioo/nyongi-single/nyongi-2', '/releases/marioo/nyongi-single/nyongi', '3aa92377-0e35-4f96-8bee-756b77060336'::uuid, 'nyongi-single', 'marioo'),
  ('97badb7a-6fb2-432e-a805-abf30a6c1b72'::uuid, 'release', 'nyongi-2', 'nyongi', 'matata', '/releases/matata/nyongi-single/nyongi-2', '/releases/matata/nyongi-single/nyongi', '3aa92377-0e35-4f96-8bee-756b77060336'::uuid, 'nyongi-single', 'matata'),
  ('7c916b0a-1ea1-4869-b3bc-f178d84b6694'::uuid, 'release', 'look-the-other-way-2', 'look-the-other-way', 'maya-amolo', '/releases/maya-amolo/look-the-other-way-single/look-the-other-way-2', '/releases/maya-amolo/look-the-other-way-single/look-the-other-way', '6c50ed4f-337a-4ca9-adc8-f79fffbb935b'::uuid, 'look-the-other-way-single', 'maya-amolo'),
  ('b7828900-aab2-483f-8a38-11d443544f58'::uuid, 'release', 'i-like-it-2', 'i-like-it', 'maya-amolo', '/releases/maya-amolo/the-sweetest-time/i-like-it-2', '/releases/maya-amolo/the-sweetest-time/i-like-it', 'aa3b2a80-2506-4773-a0ad-db3b08a0aecf'::uuid, 'the-sweetest-time', 'maya-amolo'),
  ('7c916b0a-1ea1-4869-b3bc-f178d84b6694'::uuid, 'release', 'look-the-other-way-2', 'look-the-other-way', 'maya-amolo', '/releases/maya-amolo/the-sweetest-time/look-the-other-way-2', '/releases/maya-amolo/the-sweetest-time/look-the-other-way', 'aa3b2a80-2506-4773-a0ad-db3b08a0aecf'::uuid, 'the-sweetest-time', 'maya-amolo'),
  ('befb0a24-235f-4268-b894-0eff78b5b687'::uuid, 'release', 'dream-ya-kutoka-kwa-block-2', 'dream-ya-kutoka-kwa-block', 'mr-right', '/releases/mr-right/dream-ya-kutoka-kwa-block-single/dream-ya-kutoka-kwa-block-2', '/releases/mr-right/dream-ya-kutoka-kwa-block-single/dream-ya-kutoka-kwa-block', 'a3b1226b-b8ef-405c-8ff4-4096622dc0de'::uuid, 'dream-ya-kutoka-kwa-block-single', 'mr-right'),
  ('4cfb28a2-692a-4707-953b-100892d4726c'::uuid, 'release', '1-of-1-2', '1-of-1', 'nyashinski', '/releases/nyashinski/to-whom-it-may-concern-ep/1-of-1-2', '/releases/nyashinski/to-whom-it-may-concern-ep/1-of-1', '2d921587-6c9d-4583-be4c-20e7546597aa'::uuid, 'to-whom-it-may-concern-ep', 'nyashinski'),
  ('d457ce0b-48e6-44cc-bedf-5c5510419055'::uuid, 'release', 'bluff-2', 'bluff', 'nyashinski', '/releases/nyashinski/to-whom-it-may-concern-ep/bluff-2', '/releases/nyashinski/to-whom-it-may-concern-ep/bluff', '2d921587-6c9d-4583-be4c-20e7546597aa'::uuid, 'to-whom-it-may-concern-ep', 'nyashinski'),
  ('adc09a45-a815-47f7-8cfd-c5fa773ec888'::uuid, 'release', 'celebrate-life-2', 'celebrate-life', 'nyashinski', '/releases/nyashinski/yariasu/celebrate-life-2', '/releases/nyashinski/yariasu/celebrate-life', '8f25b29f-ce76-4a34-9791-e230d2750f9a'::uuid, 'yariasu', 'nyashinski'),
  ('5a25bbb9-49db-4868-985c-1f18aeaa58ac'::uuid, 'release', 'legendary-2', 'legendary', 'nyashinski', '/releases/nyashinski/yariasu/legendary-2', '/releases/nyashinski/yariasu/legendary', '8f25b29f-ce76-4a34-9791-e230d2750f9a'::uuid, 'yariasu', 'nyashinski'),
  ('26b141da-b5d6-47f6-84e2-2c085eddd955'::uuid, 'release', 'ahere-2', 'ahere', 'okello-max', '/releases/okello-max/ahere-single/ahere-2', '/releases/okello-max/ahere-single/ahere', '13a6a7d1-d492-4de5-9b3b-f554606b809e'::uuid, 'ahere-single', 'okello-max'),
  ('93359e51-1f0a-4ce2-b3a2-2d1aff877cc4'::uuid, 'release', 'mfalme-wa-mapenzi-2', 'mfalme-wa-mapenzi', 'sanaipei-tande', '/releases/sanaipei-tande/mfalme-wa-mapenzi-single/mfalme-wa-mapenzi-2', '/releases/sanaipei-tande/mfalme-wa-mapenzi-single/mfalme-wa-mapenzi', '54504103-f6bd-4be7-850f-798452c459d5'::uuid, 'mfalme-wa-mapenzi-single', 'sanaipei-tande'),
  ('24090663-2a03-4816-816e-18aeddf79234'::uuid, 'release', 'interlude-7', 'interlude', 'sewersydaa', '/releases/sewersydaa/mauru-unit/interlude-7', '/releases/sewersydaa/mauru-unit/interlude', '698dc858-a02d-48dd-a517-6cc3b25baa00'::uuid, 'mauru-unit', 'sewersydaa'),
  ('a3b24646-44d0-4550-9f46-addb1463a143'::uuid, 'release', 'show-me-love-2', 'show-me-love', 'simmy', '/releases/simmy/show-me-love-single/show-me-love-2', '/releases/simmy/show-me-love-single/show-me-love', '436ac068-0ca6-4304-a120-68278fe92793'::uuid, 'show-me-love-single', 'simmy'),
  ('051d1fea-8171-4ec8-b290-88006e1cdfca'::uuid, 'release', 'oriti-2', 'oriti', 'suraj', '/releases/suraj/sazile-ep/oriti-2', '/releases/suraj/sazile-ep/oriti', '340b3a6d-5963-4ba8-8206-666717c121b1'::uuid, 'sazile-ep', 'suraj'),
  ('28bb72e3-b912-4a7f-bea0-b75a838a14d7'::uuid, 'release', 'suna-da-africa-deep-afrikan-remix-2', 'suna-da-africa-deep-afrikan-remix', 'suraj', '/releases/suraj/sazile-remixes/suna-da-africa-deep-afrikan-remix-2', '/releases/suraj/sazile-remixes/suna-da-africa-deep-afrikan-remix', 'c1460481-2740-43ee-b16e-fb9b78022ebb'::uuid, 'sazile-remixes', 'suraj'),
  ('d538f144-0de0-4131-8637-ed7a63688717'::uuid, 'release', 'mapenzi-2', 'mapenzi', 'toxic-lyrikali', '/releases/toxic-lyrikali/mapenzi-single/mapenzi-2', '/releases/toxic-lyrikali/mapenzi-single/mapenzi', '0b824be9-b7ed-4e76-8ae7-d5f4c92619da'::uuid, 'mapenzi-single', 'toxic-lyrikali'),
  ('625668a6-60e1-4a78-917e-d6ca28943a51'::uuid, 'release', 'beba-beba-2', 'beba-beba', 'v-be', '/releases/v-be/beba-beba-single/beba-beba-2', '/releases/v-be/beba-beba-single/beba-beba', '29f2aa9f-861a-41ec-b545-747a0a63405a'::uuid, 'beba-beba-single', 'v-be'),
  ('f5a37185-9112-4dcb-97b2-965203e836c6'::uuid, 'release', 'intro-10', 'intro', 'wakadinali', '/releases/wakadinali/haitaki-hasira/intro-10', '/releases/wakadinali/haitaki-hasira/intro', '6dcc70a4-1e73-459e-b9e5-75f00a4da7e8'::uuid, 'haitaki-hasira', 'wakadinali'),
  ('24090663-2a03-4816-816e-18aeddf79234'::uuid, 'release', 'interlude-7', 'interlude', 'wakadinali', '/releases/wakadinali/mauru-unit/interlude-7', '/releases/wakadinali/mauru-unit/interlude', '698dc858-a02d-48dd-a517-6cc3b25baa00'::uuid, 'mauru-unit', 'wakadinali'),
  ('cb205683-9039-4d6b-adbf-903199cdd7b8'::uuid, 'release', 'mc-mca-2', 'mc-mca', 'wakadinali', '/releases/wakadinali/ndani-ya-cockpit-3/mc-mca-2', '/releases/wakadinali/ndani-ya-cockpit-3/mc-mca', 'e38ceffc-7022-432e-a625-7101840b9c11'::uuid, 'ndani-ya-cockpit-3', 'wakadinali'),
  ('fb8e1f3b-6b4f-465f-92f2-a7d807b282fc'::uuid, 'release', 'hizi-stance-2', 'hizi-stance', 'wakadinali', '/releases/wakadinali/victims-of-madness-2-0/hizi-stance-2', '/releases/wakadinali/victims-of-madness-2-0/hizi-stance', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali'),
  ('3afdfc10-bd55-4d99-b851-60c8ce53ba9a'::uuid, 'release', 'intro-kitu-sewer-2', 'intro-kitu-sewer', 'wakadinali', '/releases/wakadinali/victims-of-madness-2-0/intro-kitu-sewer-2', '/releases/wakadinali/victims-of-madness-2-0/intro-kitu-sewer', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali'),
  ('97fbe42e-03ef-406b-aaad-d6fb09dec9e7'::uuid, 'release', 'maproso-feat-suzanna-owiyo-2', 'maproso-feat-suzanna-owiyo', 'wakadinali', '/releases/wakadinali/victims-of-madness-2-0/maproso-feat-suzanna-owiyo-2', '/releases/wakadinali/victims-of-madness-2-0/maproso-feat-suzanna-owiyo', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali'),
  ('5ddfb449-a403-4793-bd8f-af8acd05cea2'::uuid, 'release', 'tamashani-feat-skillo-sudough-doss-katapilla-2', 'tamashani-feat-skillo-sudough-doss-katapilla', 'wakadinali', '/releases/wakadinali/victims-of-madness-2-0/tamashani-feat-skillo-sudough-doss-katapilla-2', '/releases/wakadinali/victims-of-madness-2-0/tamashani-feat-skillo-sudough-doss-katapilla', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali'),
  ('0809a3c6-41e8-4e5c-9de6-12844e56ed3f'::uuid, 'release', 'interlude-6', 'interlude', 'wakadinali', '/releases/wakadinali/victims-of-madness/interlude-6', '/releases/wakadinali/victims-of-madness/interlude', 'db95ed04-a492-4b58-b400-d9e2041bbbbf'::uuid, 'victims-of-madness', 'wakadinali'),
  ('89b60b00-d7f2-4309-b5b2-999adfb33015'::uuid, 'release', 'intro-9', 'intro', 'wakadinali', '/releases/wakadinali/victims-of-madness/intro-9', '/releases/wakadinali/victims-of-madness/intro', 'db95ed04-a492-4b58-b400-d9e2041bbbbf'::uuid, 'victims-of-madness', 'wakadinali'),
  ('d1944367-afdc-47de-83f3-820b8739a913'::uuid, 'release', 'tumia-pesa-2', 'tumia-pesa', 'watendawili', '/releases/watendawili/hekaya-ep/tumia-pesa-2', '/releases/watendawili/hekaya-ep/tumia-pesa', '4a9887f5-f906-450f-8934-956d410484a6'::uuid, 'hekaya-ep', 'watendawili'),
  ('26b141da-b5d6-47f6-84e2-2c085eddd955'::uuid, 'release', 'ahere-2', 'ahere', 'willy-paul', '/releases/willy-paul/ahere-single/ahere-2', '/releases/willy-paul/ahere-single/ahere', '13a6a7d1-d492-4de5-9b3b-f554606b809e'::uuid, 'ahere-single', 'willy-paul'),
  ('a21b4ea2-9aa2-4d29-b4f7-23a7c7ae604e'::uuid, 'release', 'duog-dala-2', 'duog-dala', 'winyo', '/releases/winyo/duog-dala-single/duog-dala-2', '/releases/winyo/duog-dala-single/duog-dala', '7647c96b-9d67-4bde-8b1e-e2187eec6f4a'::uuid, 'duog-dala-single', 'winyo'),
  ('051d1fea-8171-4ec8-b290-88006e1cdfca'::uuid, 'release', 'oriti-2', 'oriti', 'winyo', '/releases/winyo/sazile-ep/oriti-2', '/releases/winyo/sazile-ep/oriti', '340b3a6d-5963-4ba8-8206-666717c121b1'::uuid, 'sazile-ep', 'winyo'),
  ('28bb72e3-b912-4a7f-bea0-b75a838a14d7'::uuid, 'release', 'suna-da-africa-deep-afrikan-remix-2', 'suna-da-africa-deep-afrikan-remix', 'winyo', '/releases/winyo/sazile-remixes/suna-da-africa-deep-afrikan-remix-2', '/releases/winyo/sazile-remixes/suna-da-africa-deep-afrikan-remix', 'c1460481-2740-43ee-b16e-fb9b78022ebb'::uuid, 'sazile-remixes', 'winyo'),
  ('1c8beb7b-e4f9-4394-bd04-3766b0657c1e'::uuid, 'release', 'bad-side-2', 'bad-side', 'xenia-manasseh', '/releases/xenia-manasseh/love-hate-pt-2/bad-side-2', '/releases/xenia-manasseh/love-hate-pt-2/bad-side', '21cb1f58-ffb5-47bd-80dd-a00429a5169e'::uuid, 'love-hate-pt-2', 'xenia-manasseh'),
  ('23a36038-d6d9-406c-93dd-b2026db6fb24'::uuid, 'release', 'phases-2', 'phases', 'xenia-manasseh', '/releases/xenia-manasseh/love-hate-pt-2/phases-2', '/releases/xenia-manasseh/love-hate-pt-2/phases', '21cb1f58-ffb5-47bd-80dd-a00429a5169e'::uuid, 'love-hate-pt-2', 'xenia-manasseh'),
  ('873be05c-1a7f-400a-ab3e-4c8fb7a2e33e'::uuid, 'standalone', 'all-my-enemies-are-suffering-2', 'all-my-enemies-are-suffering', 'bien', '/tracks/bien/all-my-enemies-are-suffering-2', '/releases/bien/all-my-enemies-are-suffering-single/all-my-enemies-are-suffering', 'e88108d4-c08f-491a-af92-ff55c6e50f54'::uuid, 'all-my-enemies-are-suffering-single', 'bien'),
  ('cdaecdd5-2f42-47ed-8336-4d4c7e9b7144'::uuid, 'standalone', 'finale-2', 'finale', 'bien', '/tracks/bien/finale-2', '/releases/bien/finale-single/finale', '9529a2f9-605f-40b1-a37c-e27514ece640'::uuid, 'finale-single', 'bien'),
  ('d538f144-0de0-4131-8637-ed7a63688717'::uuid, 'standalone', 'mapenzi-2', 'mapenzi', 'bridget-blue', '/tracks/bridget-blue/mapenzi-2', '/releases/bridget-blue/mapenzi-single/mapenzi', '0b824be9-b7ed-4e76-8ae7-d5f4c92619da'::uuid, 'mapenzi-single', 'bridget-blue'),
  ('75083467-11cb-4a2e-a35e-0fe3a5fbbde9'::uuid, 'standalone', 'mbuzi-2', 'mbuzi', 'bridget-blue', '/tracks/bridget-blue/mbuzi-2', '/releases/bridget-blue/mbuzi-single/mbuzi', '9f80e380-87b4-488e-988e-a1321977087e'::uuid, 'mbuzi-single', 'bridget-blue'),
  ('54b79dd6-3108-4345-9dda-5fc96561f3f2'::uuid, 'standalone', 'mimi-na-wewe-3', 'mimi-na-wewe', 'bridget-blue', '/tracks/bridget-blue/mimi-na-wewe-3', '/releases/bridget-blue/rnb/mimi-na-wewe', 'c40ad9b9-ca36-4f7b-bf7d-0f7df468b915'::uuid, 'rnb', 'bridget-blue'),
  ('6ccfacab-1a38-46bc-9494-c8016bf18f35'::uuid, 'standalone', 'ngozi-kama-jua-2', 'ngozi-kama-jua', 'bridget-blue', '/tracks/bridget-blue/ngozi-kama-jua-2', '/releases/bridget-blue/rnb/ngozi-kama-jua', 'c40ad9b9-ca36-4f7b-bf7d-0f7df468b915'::uuid, 'rnb', 'bridget-blue'),
  ('a4a9cf75-697b-489f-bdc5-6905898025a9'::uuid, 'standalone', 'pumua-2', 'pumua', 'bridget-blue', '/tracks/bridget-blue/pumua-2', '/releases/bridget-blue/pumua-single/pumua', '07397467-419c-4aff-970d-8a42b3d03f63'::uuid, 'pumua-single', 'bridget-blue'),
  ('9159e0f0-26ec-43b4-aa92-7f062886ebcb'::uuid, 'standalone', 'confession-2', 'confession', 'buruklyn-boyz', '/tracks/buruklyn-boyz/confession-2', '/releases/buruklyn-boyz/58-flava/confession', 'f397bbf1-08e3-4595-a31c-207d8de362b1'::uuid, '58-flava', 'buruklyn-boyz'),
  ('befb0a24-235f-4268-b894-0eff78b5b687'::uuid, 'standalone', 'dream-ya-kutoka-kwa-block-2', 'dream-ya-kutoka-kwa-block', 'buruklyn-boyz', '/tracks/buruklyn-boyz/dream-ya-kutoka-kwa-block-2', '/releases/buruklyn-boyz/dream-ya-kutoka-kwa-block-single/dream-ya-kutoka-kwa-block', 'a3b1226b-b8ef-405c-8ff4-4096622dc0de'::uuid, 'dream-ya-kutoka-kwa-block-single', 'buruklyn-boyz'),
  ('707f58b6-b42b-4eea-a06f-42859f15d075'::uuid, 'standalone', 'sina-noma-2', 'sina-noma', 'charisma', '/tracks/charisma/sina-noma-2', '/releases/charisma/the-motions/sina-noma', '2bae756b-4619-4dcb-8c60-1c0adee72522'::uuid, 'the-motions', 'charisma'),
  ('62d16b06-1161-4ed3-9014-76a3fd1ed38e'::uuid, 'standalone', 'trust-issues-feat-bensoul-2', 'trust-issues-feat-bensoul', 'charisma', '/tracks/charisma/trust-issues-feat-bensoul-2', '/releases/charisma/the-motions/trust-issues-feat-bensoul', '2bae756b-4619-4dcb-8c60-1c0adee72522'::uuid, 'the-motions', 'charisma'),
  ('a21b4ea2-9aa2-4d29-b4f7-23a7c7ae604e'::uuid, 'standalone', 'duog-dala-2', 'duog-dala', 'fancy-fingers', '/tracks/fancy-fingers/duog-dala-2', '/releases/fancy-fingers/duog-dala-single/duog-dala', '7647c96b-9d67-4bde-8b1e-e2187eec6f4a'::uuid, 'duog-dala-single', 'fancy-fingers'),
  ('dadb8676-9ab6-4688-b4d0-072af5275ff0'::uuid, 'standalone', 'far-away-2', 'far-away', 'fancy-fingers', '/tracks/fancy-fingers/far-away-2', '/releases/fancy-fingers/far-away-single/far-away', 'ff15b220-d7d1-448c-8202-213bbc695e88'::uuid, 'far-away-single', 'fancy-fingers'),
  ('a3b24646-44d0-4550-9f46-addb1463a143'::uuid, 'standalone', 'show-me-love-2', 'show-me-love', 'fancy-fingers', '/tracks/fancy-fingers/show-me-love-2', '/releases/fancy-fingers/show-me-love-single/show-me-love', '436ac068-0ca6-4304-a120-68278fe92793'::uuid, 'show-me-love-single', 'fancy-fingers'),
  ('28cc036b-5f8d-46ba-886c-3ad214da9977'::uuid, 'standalone', 'kaende-2', 'kaende', 'fena-gitu', '/tracks/fena-gitu/kaende-2', '/releases/fena-gitu/unleashed/kaende', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu'),
  ('a8ea6199-b3f2-4e33-8975-6d9ff9e500a7'::uuid, 'standalone', 'karibia-2', 'karibia', 'fena-gitu', '/tracks/fena-gitu/karibia-2', '/releases/fena-gitu/karibia-single/karibia', 'd03d3ea9-9df4-466a-b0e1-2cc0263d6f40'::uuid, 'karibia-single', 'fena-gitu'),
  ('ad32ccfd-3c6c-4c20-bfee-3212417da1e0'::uuid, 'standalone', 'steam-2', 'steam', 'fena-gitu', '/tracks/fena-gitu/steam-2', '/releases/fena-gitu/unleashed/steam', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu'),
  ('1e4152fc-85bc-4dde-808a-19c1d337e25d'::uuid, 'standalone', 'trouble-2', 'trouble', 'fena-gitu', '/tracks/fena-gitu/trouble-2', '/tracks/fena-gitu/trouble', null::uuid, null, null),
  ('91e17547-6168-475c-9f4d-b9bffcd87922'::uuid, 'standalone', 'trouble-3', 'trouble', 'fena-gitu', '/tracks/fena-gitu/trouble-3', '/tracks/fena-gitu/trouble', null::uuid, null, null),
  ('cb2446a9-903c-46e5-b177-9acb769608c3'::uuid, 'standalone', 'zing-zong-2', 'zing-zong', 'fena-gitu', '/tracks/fena-gitu/zing-zong-2', '/releases/fena-gitu/unleashed/zing-zong', 'a23e37af-fd80-47cf-9c2d-a6505a8a75b7'::uuid, 'unleashed', 'fena-gitu'),
  ('94831845-4c9f-48e6-bc33-e2eef81c6f22'::uuid, 'standalone', 'interlude-2-3', 'interlude-2', 'jua-cali', '/tracks/jua-cali/interlude-2-3', '/tracks/jua-cali/interlude-2', null::uuid, null, null),
  ('fd6934ed-d2a9-4e55-be56-a64aa0b2a931'::uuid, 'standalone', 'interlude-2-4', 'interlude-2', 'jua-cali', '/tracks/jua-cali/interlude-2-4', '/tracks/jua-cali/interlude-2', null::uuid, null, null),
  ('3f9a096a-81b6-46e5-808c-ea46060dbb6e'::uuid, 'standalone', 'feel-you-2', 'feel-you', 'karun', '/tracks/karun/feel-you-2', '/releases/karun/eternal-ep/feel-you', '92944175-436c-4547-b836-2e344fe4f63b'::uuid, 'eternal-ep', 'karun'),
  ('9535f468-ab55-46f7-a44b-7f3c6b52b02d'::uuid, 'standalone', 'treasure-2', 'treasure', 'karun', '/tracks/karun/treasure-2', '/releases/karun/eternal-ep/treasure', '92944175-436c-4547-b836-2e344fe4f63b'::uuid, 'eternal-ep', 'karun'),
  ('3c61900c-e73a-4cf6-8657-061a27a558ea'::uuid, 'standalone', 'outro-2', 'outro', 'kleptomaniax', '/tracks/kleptomaniax/outro-2', '/releases/kleptomaniax/nitt-now-is-the-time/outro', 'dc5bd9de-4a1e-4152-987d-f0d4fdbd41f7'::uuid, 'nitt-now-is-the-time', 'kleptomaniax'),
  ('2ceb66bb-3388-43a5-97e5-fe7bc2f87d03'::uuid, 'standalone', 'disko-2', 'disko', 'kodongklan', '/tracks/kodongklan/disko-2', '/releases/kodongklan/disko/disko', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan'),
  ('8787b351-6a70-4d96-894d-9d04e52059c6'::uuid, 'standalone', 'kodong-2', 'kodong', 'kodongklan', '/tracks/kodongklan/kodong-2', '/releases/kodongklan/disko/kodong', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan'),
  ('d13517db-08a2-420b-ba3e-2282314e0a59'::uuid, 'standalone', 'nyaduse-2', 'nyaduse', 'kodongklan', '/tracks/kodongklan/nyaduse-2', '/releases/kodongklan/disko/nyaduse', 'f71f6e19-d70e-4fa0-86a0-59a87e893a39'::uuid, 'disko', 'kodongklan'),
  ('7b91b435-816f-4d14-bc0d-0c389f0dfefe'::uuid, 'standalone', 'ma-g-kwenye-klabu-2', 'ma-g-kwenye-klabu', 'lil-maina', '/tracks/lil-maina/ma-g-kwenye-klabu-2', '/releases/lil-maina/maisha-ya-stunna/ma-g-kwenye-klabu', 'f965feac-b97e-4611-9c6f-0ea15a182a27'::uuid, 'maisha-ya-stunna', 'lil-maina'),
  ('97badb7a-6fb2-432e-a805-abf30a6c1b72'::uuid, 'standalone', 'nyongi-2', 'nyongi', 'matata', '/tracks/matata/nyongi-2', '/releases/matata/nyongi-single/nyongi', '3aa92377-0e35-4f96-8bee-756b77060336'::uuid, 'nyongi-single', 'matata'),
  ('b7828900-aab2-483f-8a38-11d443544f58'::uuid, 'standalone', 'i-like-it-2', 'i-like-it', 'maya-amolo', '/tracks/maya-amolo/i-like-it-2', '/releases/maya-amolo/the-sweetest-time/i-like-it', 'aa3b2a80-2506-4773-a0ad-db3b08a0aecf'::uuid, 'the-sweetest-time', 'maya-amolo'),
  ('7c916b0a-1ea1-4869-b3bc-f178d84b6694'::uuid, 'standalone', 'look-the-other-way-2', 'look-the-other-way', 'maya-amolo', '/tracks/maya-amolo/look-the-other-way-2', '/releases/maya-amolo/look-the-other-way-single/look-the-other-way', '6c50ed4f-337a-4ca9-adc8-f79fffbb935b'::uuid, 'look-the-other-way-single', 'maya-amolo'),
  ('4cfb28a2-692a-4707-953b-100892d4726c'::uuid, 'standalone', '1-of-1-2', '1-of-1', 'nyashinski', '/tracks/nyashinski/1-of-1-2', '/releases/nyashinski/to-whom-it-may-concern-ep/1-of-1', '2d921587-6c9d-4583-be4c-20e7546597aa'::uuid, 'to-whom-it-may-concern-ep', 'nyashinski'),
  ('d457ce0b-48e6-44cc-bedf-5c5510419055'::uuid, 'standalone', 'bluff-2', 'bluff', 'nyashinski', '/tracks/nyashinski/bluff-2', '/releases/nyashinski/to-whom-it-may-concern-ep/bluff', '2d921587-6c9d-4583-be4c-20e7546597aa'::uuid, 'to-whom-it-may-concern-ep', 'nyashinski'),
  ('adc09a45-a815-47f7-8cfd-c5fa773ec888'::uuid, 'standalone', 'celebrate-life-2', 'celebrate-life', 'nyashinski', '/tracks/nyashinski/celebrate-life-2', '/releases/nyashinski/yariasu/celebrate-life', '8f25b29f-ce76-4a34-9791-e230d2750f9a'::uuid, 'yariasu', 'nyashinski'),
  ('5a25bbb9-49db-4868-985c-1f18aeaa58ac'::uuid, 'standalone', 'legendary-2', 'legendary', 'nyashinski', '/tracks/nyashinski/legendary-2', '/releases/nyashinski/yariasu/legendary', '8f25b29f-ce76-4a34-9791-e230d2750f9a'::uuid, 'yariasu', 'nyashinski'),
  ('93359e51-1f0a-4ce2-b3a2-2d1aff877cc4'::uuid, 'standalone', 'mfalme-wa-mapenzi-2', 'mfalme-wa-mapenzi', 'sanaipei-tande', '/tracks/sanaipei-tande/mfalme-wa-mapenzi-2', '/releases/sanaipei-tande/mfalme-wa-mapenzi-single/mfalme-wa-mapenzi', '54504103-f6bd-4be7-850f-798452c459d5'::uuid, 'mfalme-wa-mapenzi-single', 'sanaipei-tande'),
  ('625668a6-60e1-4a78-917e-d6ca28943a51'::uuid, 'standalone', 'beba-beba-2', 'beba-beba', 'v-be', '/tracks/v-be/beba-beba-2', '/releases/v-be/beba-beba-single/beba-beba', '29f2aa9f-861a-41ec-b545-747a0a63405a'::uuid, 'beba-beba-single', 'v-be'),
  ('fb8e1f3b-6b4f-465f-92f2-a7d807b282fc'::uuid, 'standalone', 'hizi-stance-2', 'hizi-stance', 'wakadinali', '/tracks/wakadinali/hizi-stance-2', '/releases/wakadinali/victims-of-madness-2-0/hizi-stance', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali'),
  ('0809a3c6-41e8-4e5c-9de6-12844e56ed3f'::uuid, 'standalone', 'interlude-6', 'interlude', 'wakadinali', '/tracks/wakadinali/interlude-6', '/tracks/wakadinali/interlude', null::uuid, null, null),
  ('24090663-2a03-4816-816e-18aeddf79234'::uuid, 'standalone', 'interlude-7', 'interlude', 'wakadinali', '/tracks/wakadinali/interlude-7', '/tracks/wakadinali/interlude', null::uuid, null, null),
  ('f5a37185-9112-4dcb-97b2-965203e836c6'::uuid, 'standalone', 'intro-10', 'intro', 'wakadinali', '/tracks/wakadinali/intro-10', '/tracks/wakadinali/intro', null::uuid, null, null),
  ('89b60b00-d7f2-4309-b5b2-999adfb33015'::uuid, 'standalone', 'intro-9', 'intro', 'wakadinali', '/tracks/wakadinali/intro-9', '/tracks/wakadinali/intro', null::uuid, null, null),
  ('3afdfc10-bd55-4d99-b851-60c8ce53ba9a'::uuid, 'standalone', 'intro-kitu-sewer-2', 'intro-kitu-sewer', 'wakadinali', '/tracks/wakadinali/intro-kitu-sewer-2', '/releases/wakadinali/victims-of-madness-2-0/intro-kitu-sewer', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali'),
  ('97fbe42e-03ef-406b-aaad-d6fb09dec9e7'::uuid, 'standalone', 'maproso-feat-suzanna-owiyo-2', 'maproso-feat-suzanna-owiyo', 'wakadinali', '/tracks/wakadinali/maproso-feat-suzanna-owiyo-2', '/releases/wakadinali/victims-of-madness-2-0/maproso-feat-suzanna-owiyo', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali'),
  ('cb205683-9039-4d6b-adbf-903199cdd7b8'::uuid, 'standalone', 'mc-mca-2', 'mc-mca', 'wakadinali', '/tracks/wakadinali/mc-mca-2', '/releases/wakadinali/ndani-ya-cockpit-3/mc-mca', 'e38ceffc-7022-432e-a625-7101840b9c11'::uuid, 'ndani-ya-cockpit-3', 'wakadinali'),
  ('5ddfb449-a403-4793-bd8f-af8acd05cea2'::uuid, 'standalone', 'tamashani-feat-skillo-sudough-doss-katapilla-2', 'tamashani-feat-skillo-sudough-doss-katapilla', 'wakadinali', '/tracks/wakadinali/tamashani-feat-skillo-sudough-doss-katapilla-2', '/releases/wakadinali/victims-of-madness-2-0/tamashani-feat-skillo-sudough-doss-katapilla', '88a19fdf-aed0-4cd2-aa31-e843b932c17a'::uuid, 'victims-of-madness-2-0', 'wakadinali'),
  ('d1944367-afdc-47de-83f3-820b8739a913'::uuid, 'standalone', 'tumia-pesa-2', 'tumia-pesa', 'watendawili', '/tracks/watendawili/tumia-pesa-2', '/releases/watendawili/hekaya-ep/tumia-pesa', '4a9887f5-f906-450f-8934-956d410484a6'::uuid, 'hekaya-ep', 'watendawili'),
  ('26b141da-b5d6-47f6-84e2-2c085eddd955'::uuid, 'standalone', 'ahere-2', 'ahere', 'willy-paul', '/tracks/willy-paul/ahere-2', '/releases/willy-paul/ahere-single/ahere', '13a6a7d1-d492-4de5-9b3b-f554606b809e'::uuid, 'ahere-single', 'willy-paul'),
  ('051d1fea-8171-4ec8-b290-88006e1cdfca'::uuid, 'standalone', 'oriti-2', 'oriti', 'winyo', '/tracks/winyo/oriti-2', '/releases/winyo/sazile-ep/oriti', '340b3a6d-5963-4ba8-8206-666717c121b1'::uuid, 'sazile-ep', 'winyo'),
  ('28bb72e3-b912-4a7f-bea0-b75a838a14d7'::uuid, 'standalone', 'suna-da-africa-deep-afrikan-remix-2', 'suna-da-africa-deep-afrikan-remix', 'winyo', '/tracks/winyo/suna-da-africa-deep-afrikan-remix-2', '/releases/winyo/sazile-remixes/suna-da-africa-deep-afrikan-remix', 'c1460481-2740-43ee-b16e-fb9b78022ebb'::uuid, 'sazile-remixes', 'winyo'),
  ('1c8beb7b-e4f9-4394-bd04-3766b0657c1e'::uuid, 'standalone', 'bad-side-2', 'bad-side', 'xenia-manasseh', '/tracks/xenia-manasseh/bad-side-2', '/releases/xenia-manasseh/love-hate-pt-2/bad-side', '21cb1f58-ffb5-47bd-80dd-a00429a5169e'::uuid, 'love-hate-pt-2', 'xenia-manasseh'),
  ('23a36038-d6d9-406c-93dd-b2026db6fb24'::uuid, 'standalone', 'phases-2', 'phases', 'xenia-manasseh', '/tracks/xenia-manasseh/phases-2', '/releases/xenia-manasseh/love-hate-pt-2/phases', '21cb1f58-ffb5-47bd-80dd-a00429a5169e'::uuid, 'love-hate-pt-2', 'xenia-manasseh');

do $preconditions$
declare
  v_count integer;
begin
  if to_regclass('public.wk_slug_redirects_scoped_path_unique') is null then
    raise exception 'Path-aware redirect index is not active';
  end if;

  if to_regclass('public.wk_slug_redirects_scoped_entity_unique') is not null then
    raise exception 'Legacy slug-only scoped redirect index still exists';
  end if;

  select count(*) into v_count from numbered_track_candidates;
  if v_count <> 53 then
    raise exception 'Expected 53 frozen candidates, found %', v_count;
  end if;

  select count(*) into v_count
  from numbered_track_candidates
  where proposed_action = 'canonicalize_directly';
  if v_count <> 8 then
    raise exception 'Expected 8 direct candidates, found %', v_count;
  end if;

  select count(*) into v_count
  from numbered_track_candidates
  where proposed_action = 'resolve_using_release_membership';
  if v_count <> 45 then
    raise exception 'Expected 45 release-resolved candidates, found %', v_count;
  end if;

  select count(*) into v_count from numbered_track_redirects;
  if v_count <> 126 then
    raise exception 'Expected 126 planned redirects, found %', v_count;
  end if;

  select count(*) into v_count
  from numbered_track_redirects
  where redirect_kind = 'release';
  if v_count <> 73 then
    raise exception 'Expected 73 release redirects, found %', v_count;
  end if;

  select count(*) into v_count
  from numbered_track_candidates c
  join public.registry_tracks t
    on t.id = c.track_id
   and t.title = c.title
   and t.slug = c.old_slug
   and t.status = c.expected_status;
  if v_count <> 53 then
    raise exception 'Exact live candidate state changed; matched % rows', v_count;
  end if;

  if exists (
    select 1
    from numbered_track_candidates c
    where (
      select count(*)
      from public.registry_track_artists ta
      where ta.track_id = c.track_id
        and ta.status in ('active', 'needs_review', 'draft')
        and coalesce(ta.is_primary, false) = true
    ) <> 1
    or (
      select count(*)
      from public.registry_track_artists ta
      where ta.track_id = c.track_id
        and ta.artist_slug = c.track_artist_slug
        and ta.status in ('active', 'needs_review', 'draft')
        and coalesce(ta.is_primary, false) = true
    ) <> 1
  ) then
    raise exception 'A frozen primary artist relationship changed';
  end if;

  if exists (
    select 1
    from numbered_track_candidates c
    where c.proposed_action = 'canonicalize_directly'
      and exists (
        select 1
        from public.registry_tracks peer
        join public.registry_track_artists peer_artist
          on peer_artist.track_id = peer.id
         and peer_artist.artist_slug = c.track_artist_slug
         and peer_artist.status in ('active', 'needs_review', 'draft')
         and coalesce(peer_artist.is_primary, false) = true
        where peer.id <> c.track_id
          and peer.slug = c.new_slug
      )
  ) then
    raise exception 'Direct canonicalization now has an artist collision';
  end if;

  if exists (
    select 1
    from numbered_track_candidates c
    where c.proposed_action = 'resolve_using_release_membership'
      and not exists (
        select 1
        from public.registry_tracks peer
        join public.registry_track_artists peer_artist
          on peer_artist.track_id = peer.id
         and peer_artist.artist_slug = c.track_artist_slug
         and peer_artist.status in ('active', 'needs_review', 'draft')
         and coalesce(peer_artist.is_primary, false) = true
        where peer.id <> c.track_id
          and peer.slug = c.new_slug
      )
  ) then
    raise exception 'A release-resolved artist collision disappeared';
  end if;

  if exists (
    select 1
    from numbered_track_redirects r
    where r.redirect_kind = 'release'
      and not exists (
        select 1
        from public.registry_release_tracks rt
        join public.registry_releases release on release.id = rt.release_id
        join public.registry_release_artists ra on ra.release_id = release.id
        where rt.track_id = r.track_id
          and rt.release_id = r.release_id
          and release.slug = r.release_slug
          and ra.artist_slug = r.route_artist_slug
          and coalesce(ra.status, 'active') in ('active', 'needs_review', 'draft')
      )
  ) then
    raise exception 'A frozen release route scope changed';
  end if;

  if exists (
    select 1
    from numbered_track_candidates c
    where c.proposed_action = 'resolve_using_release_membership'
      and (
        c.selected_release_id is null
        or c.selected_release_slug is null
        or c.selected_route_artist_slug is null
        or not exists (
          select 1
          from public.registry_release_tracks rt
          join public.registry_releases release on release.id = rt.release_id
          join public.registry_release_artists ra on ra.release_id = release.id
          where rt.track_id = c.track_id
            and rt.release_id = c.selected_release_id
            and release.slug = c.selected_release_slug
            and ra.artist_slug = c.selected_route_artist_slug
        )
      )
  ) then
    raise exception 'A selected standalone release target changed';
  end if;

  if exists (
    select 1
    from numbered_track_redirects r
    join public.registry_release_tracks peer_link on peer_link.release_id = r.release_id
    join public.registry_tracks peer on peer.id = peer_link.track_id
    where r.redirect_kind = 'release'
      and peer.id <> r.track_id
      and peer.slug = r.new_slug
  ) then
    raise exception 'A canonical slug now collides inside a release';
  end if;

  if exists (
    select 1
    from numbered_track_redirects planned
    join public.wk_slug_redirects existing on existing.old_path = planned.old_path
  ) then
    raise exception 'A planned legacy path already has a redirect';
  end if;
end
$preconditions$;

insert into public.wk_slug_redirects (
  old_slug, new_slug, entity_type, scope_slug,
  old_path, new_path, redirect_status, created_by, updated_at
)
select
  old_slug,
  new_slug,
  'track',
  scope_slug,
  old_path,
  new_path,
  308,
  'remaining-numbered-track-canonicalization-20260714',
  now()
from numbered_track_redirects
order by old_path;

do $redirect_gate$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.wk_slug_redirects existing
  join numbered_track_redirects planned
    on planned.old_path = existing.old_path
   and planned.new_path = existing.new_path
   and planned.old_slug = existing.old_slug
   and planned.new_slug = existing.new_slug
   and planned.scope_slug = existing.scope_slug
  where existing.entity_type = 'track'
    and existing.redirect_status = 308;

  if v_count <> 126 then
    raise exception 'Expected 126 exact redirects before updates, found %', v_count;
  end if;
end
$redirect_gate$;

do $track_updates$
declare
  v_count integer;
begin
  with updated as (
    update public.registry_tracks track
    set slug = candidate.new_slug,
        updated_at = now()
    from numbered_track_candidates candidate
    where track.id = candidate.track_id
      and track.slug = candidate.old_slug
      and track.title = candidate.title
      and track.status = candidate.expected_status
    returning track.id
  )
  select count(*) into v_count from updated;

  if v_count <> 53 then
    raise exception 'Expected 53 track updates, updated %', v_count;
  end if;
end
$track_updates$;

do $postconditions$
declare
  v_count integer;
begin
  select count(*) into v_count
  from numbered_track_candidates c
  join public.registry_tracks t
    on t.id = c.track_id
   and t.title = c.title
   and t.slug = c.new_slug
   and t.status = c.expected_status;
  if v_count <> 53 then
    raise exception 'Canonical track postcondition matched % rows', v_count;
  end if;

  if exists (
    select 1
    from numbered_track_candidates c
    join public.registry_tracks t on t.id = c.track_id
    where t.slug = c.old_slug
  ) then
    raise exception 'A candidate still has its legacy numbered slug';
  end if;

  select count(*) into v_count
  from numbered_track_candidates c
  join public.registry_entity_index idx
    on idx.entity_type = 'track'
   and idx.entity_id = c.track_id
   and idx.slug = c.new_slug
   and idx.name = c.title
   and idx.status = c.expected_status;
  if v_count <> 53 then
    raise exception 'Entity-index view postcondition matched % rows', v_count;
  end if;

  select count(*) into v_count
  from public.wk_slug_redirects existing
  join numbered_track_redirects planned
    on planned.old_path = existing.old_path
   and planned.new_path = existing.new_path
  where existing.entity_type = 'track'
    and existing.redirect_status = 308;
  if v_count <> 126 then
    raise exception 'Redirect postcondition matched % rows', v_count;
  end if;

  if exists (
    select 1
    from numbered_track_redirects r
    join public.registry_tracks t on t.id = r.track_id
    where r.redirect_kind = 'release'
      and (
        t.slug <> r.new_slug
        or not exists (
          select 1
          from public.registry_release_tracks rt
          where rt.track_id = r.track_id
            and rt.release_id = r.release_id
        )
      )
  ) then
    raise exception 'A release-scoped canonical destination is invalid';
  end if;
end
$postconditions$;

commit;
