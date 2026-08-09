-- Phase 5B Migration 225: seed the first real public Playlist intake.
--
-- This is a controlled editorial data seed for the accepted Phase 5B exit Playlist.
-- It does not create canonical Registry Track or Artist identity.
-- Every imported artist credit remains unresolved until an editor reviews it.
-- Every track carries the article's editorial copy as the Playlist item note.

begin;

do $phase_5b_m225_seed$
declare
  v_playlist_id uuid := gen_random_uuid();
  v_suggestion_id uuid;
  v_item jsonb;
  v_artist jsonb;
  v_credit_order integer;
  v_manifest jsonb := $manifest$[{"position":1,"title":"Pungulu","artists":["Angry Panda Clan","Papa Nyosto"],"editor_note":"Angry Panda Clan started the year with a reminder that Gengetone is still alive and kicking. Pungulu is a banger that has been dominating the dance floors since its release and has inspired a viral dance on TikTok. It proves that Gengetone as a genre is still as strong as ever.","provider_key":"spotify","provider_object_id":"1HV80tfavd82wOUOlL7q6O","provider_url":"https://open.spotify.com/track/1HV80tfavd82wOUOlL7q6O?si=742516d4e1714655","playback_kind":"audio"},{"position":2,"title":"Khali Cartel 5","artists":["Khaligraph Jones","Jakk Quill","Ruyonga","Fresh Like Uhh","Dyana Cods","Mex Cortez","Abbas K뫿"],"editor_note":"The bars are back! Three years after giving us Khali Cartel 4, the legendary series returns with a twist. Expanding beyond Kenya to East Africa, Khaligraph has assembled some of the region’s best rappers to showcase their skills and keep all the hip-hop heads talking.","provider_key":"youtube","provider_object_id":"DFRkyOh8jng","provider_url":"https://www.youtube.com/watch?v=DFRkyOh8jng&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=2","playback_kind":"video"},{"position":3,"title":"Keki","artists":["Willy Paul","Bahati"],"editor_note":"The long-awaited collaboration between Bahati and Willy Paul dropped earlier this year, and fans couldn’t get enough. With over 3 million views on YouTube and a trending remix gaining popularity on social media, this is surely one of the songs you’ll hear throughout 2025.","provider_key":"youtube","provider_object_id":"CLheBLtj1FI","provider_url":"https://www.youtube.com/watch?v=CLheBLtj1FI&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=3","playback_kind":"video"},{"position":4,"title":"Sianda","artists":["Savara"],"editor_note":"Savara continues his fine form as a solo artist on his self-proclaimed journey to redefine Kenyan music. Sianda is a Luo-inspired banger that keeps the dance floors alive whenever it plays.","provider_key":"youtube","provider_object_id":"uz1XXbkNWyU","provider_url":"https://www.youtube.com/watch?v=uz1XXbkNWyU&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=4","playback_kind":"video"},{"position":5,"title":"Hujawahi Nipenda","artists":["Nviiri The Storyteller"],"editor_note":"Nviiri returns in 2025 with a song about love and loss. He sings about losing trust in a relationship and the reluctance to continue. It’s a track that resonates with anyone familiar with lengthy texts and reflective moments.","provider_key":"youtube","provider_object_id":"ZRKngrrZs3w","provider_url":"https://www.youtube.com/watch?v=ZRKngrrZs3w&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=5","playback_kind":"video"},{"position":6,"title":"Last Name","artists":["Mau From Nowhere"],"editor_note":"Mau From Nowhere opened the year with his PrePack EP, and this jungle-inspired rap track is its jewel. The rapper flows effortlessly over the production, paying homage to the musical culture of his multicultural upbringing.","provider_key":"youtube","provider_object_id":"Oc2fwASoymw","provider_url":"https://www.youtube.com/watch?v=Oc2fwASoymw&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=6","playback_kind":"video"},{"position":7,"title":"Zimeshika","artists":["Trio Mio","Khaligraph Jones"],"editor_note":"Trio Mio links up with Khaligraph Jones for Zimeshika, a track that cements Trio’s evolution as a young rap heavyweight. Khaligraph delivers his signature aggressive flow, while Trio rides the beat with effortless confidence.","provider_key":"youtube","provider_object_id":"z9_qdj94kcI","provider_url":"https://www.youtube.com/watch?v=z9_qdj94kcI&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=7","playback_kind":"video"},{"position":8,"title":"Fine by Me","artists":["Genes1s","Soundkraft"],"editor_note":"Fine by Me is an Arbantone track that celebrates the joy of youth and is sure to be on rotation at house parties across Nairobi. Genes1s seems to have the Arbantone secret sauce, following up the wildly successful Ikitoka with another hit.","provider_key":"youtube","provider_object_id":"Al9HcnoSNyI","provider_url":"https://www.youtube.com/watch?v=Al9HcnoSNyI&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=8","playback_kind":"video"},{"position":9,"title":"Diamonds","artists":["Otile Brown","Jovial"],"editor_note":"Diamonds is a soulful Afro-R&B collaboration by Otile Brown and Jovial, delivering a powerful message of resilience and love. True to his style, Otile emphasizes that, like diamonds, true love and unwavering faith endure through life’s hardships, symbolizing strength and perseverance.","provider_key":"youtube","provider_object_id":"hMRq9RuUiMQ","provider_url":"https://www.youtube.com/watch?v=hMRq9RuUiMQ&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=9","playback_kind":"video"},{"position":10,"title":"Bembea","artists":["BlvckMoon","Saint Evo"],"editor_note":"Since they began collaborating in 2020, BlvckMoon and Saint Evo have consistently dropped Afro House staples, and this time is no different. Bembea is built on the high BPM of Afro House, with Swahili lyrics carrying deep and introspective meanings.","provider_key":"youtube","provider_object_id":"zHwmjtnR4Rk","provider_url":"https://www.youtube.com/watch?v=zHwmjtnR4Rk&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=10","playback_kind":"video"},{"position":11,"title":"Miondoko","artists":["ONENESS","Nes Mburu"],"editor_note":"After concluding last year with Hakuna Kulala, Nes Mburu returns with another Afro House track sure to keep you dancing. Collaborating with producer ONENESS, Miondoko explores desire and the universal feeling of wanting to be with the most captivating person at the party.","provider_key":"youtube","provider_object_id":"2H2AdWxRQT0","provider_url":"https://www.youtube.com/watch?v=2H2AdWxRQT0&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=11","playback_kind":"video"},{"position":12,"title":"Beg For It","artists":["Njerae"],"editor_note":"After tugging on our heartstrings throughout 2024, Njerae starts the year with Beg For It, the lead single from her Four Letter Word EP. As her first release under Universal Music, the song stays true to her style of being hopelessly in love and sharing it with the world.","provider_key":"youtube","provider_object_id":"HYzDOLqw49E","provider_url":"https://www.youtube.com/watch?v=HYzDOLqw49E&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=12","playback_kind":"video"},{"position":13,"title":"Khartoum","artists":["Ochungulo Family"],"editor_note":"Gengetone is making a significant push for reemergence in 2025. Ochungulo Family’s Khartoum is a throwback to the genre’s peak, filled with Nelly The Goon’s wordplay, Benzema’s flair, and D’more’s humor—a true return to form for the group.","provider_key":"youtube","provider_object_id":"vSobi0kStBQ","provider_url":"https://www.youtube.com/watch?v=vSobi0kStBQ&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=13","playback_kind":"video"},{"position":14,"title":"Tamashani","artists":["Wakadinali","Skillo","Su Dough Boss","Katapilla"],"editor_note":"Wakadinali never seem to take a break. They’ve opened the year with Tamashani, a blend of hip-hop and traditional Kenyan genres that’s become a massive hit. The song showcases the group’s versatility and sets the tone for the rest of the year.","provider_key":"youtube","provider_object_id":"XPiIgXhbGnc","provider_url":"https://www.youtube.com/watch?v=XPiIgXhbGnc&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=14","playback_kind":"video"},{"position":15,"title":"My Boo","artists":["4Mr Frank White","Iyanah Kiragu"],"editor_note":"The lyrics, melody, and production of My Boo are top-tier, making it one of the hidden gems in Kenya’s music scene this year. Built on a sample of Usher and Alicia Keys’ song, 4Mr Frank White and Iyanah Kiragu deliver a mesmerizing back-and-forth over the beat.","provider_key":"youtube","provider_object_id":"OdQH1o7wSbw","provider_url":"https://www.youtube.com/watch?v=OdQH1o7wSbw&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=15","playback_kind":"video"},{"position":16,"title":"Jipe Shughuli Nani (Remix)","artists":["Kanzu","BenaiA","OVR2","Vigel Brian","Fushi The Sage"],"editor_note":"What’s better than the original? The remix, of course! Kanzu assembles a stellar supporting cast to give this Amapiano-inspired track new life, allowing each artist to showcase their talents throughout Jipe Shughuli Nani.","provider_key":"youtube","provider_object_id":"XcK0yaNDDMI","provider_url":"https://www.youtube.com/watch?v=XcK0yaNDDMI&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=16","playback_kind":"video"},{"position":17,"title":"Sick","artists":["Toxic Lyrikali"],"editor_note":"Toxic Lyrikali has been weaving tales of the streets since his music career began, and he’s not stopping in 2025. Sick maintains the gruff and menacing tone of his music while offering fans new stories from the Eastside, which we all love.","provider_key":"youtube","provider_object_id":"iqMIjKe-HGs","provider_url":"https://www.youtube.com/watch?v=iqMIjKe-HGs&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=17","playback_kind":"video"},{"position":18,"title":"Chill Kiasi","artists":["Flier"],"editor_note":"Flier entered the scene like a breath of fresh air and has maintained that vibe ever since. He starts the year with Chill Kiasi, a track about asking your loved one to wait a bit while you sort out your affairs. The song feels both new and familiar, ensuring it’s on rotation for the rest of the year.","provider_key":"youtube","provider_object_id":"WN-DNFA3RgY","provider_url":"https://www.youtube.com/watch?v=WN-DNFA3RgY&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=18","playback_kind":"video"},{"position":19,"title":"Pressure","artists":["X.O."],"editor_note":"The latest offering from upcoming artist X.O., Pressure is a slow Afrobeat-inspired song addressing the challenges of being in a relationship and questioning a partner’s true intentions. Set against a slow and sensual beat, it creates a captivating contrast.","provider_key":"youtube","provider_object_id":"CasGu94UK5U","provider_url":"https://www.youtube.com/watch?v=CasGu94UK5U&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=19","playback_kind":"video"},{"position":20,"title":"Baddies Need Love","artists":["Maandy","Watendawili"],"editor_note":"In a surprising change of pace, Gengetone sensation and rapper Maandy released her Baddies Need Love EP, focusing on a more romantic and softer side. The title track features Watendawili’s Ywaya Tajiri.","provider_key":"youtube","provider_object_id":"O6Vrt0H-Xu8","provider_url":"https://www.youtube.com/embed/O6Vrt0H-Xu8?list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj","playback_kind":"video"},{"position":21,"title":"Turn It Off","artists":["Mr. Tee","Fidel Rayd"],"editor_note":"Arbantone mainstay Mr. Tee returns with Turn It Off, a song that maintains his trend of releasing hit after hit. The rhythmic production, inspired by dancehall, is perfectly matched with braggadocious lyrics, creating a quintessential Arbantone track.","provider_key":"youtube","provider_object_id":"Bysgl_BIfEo","provider_url":"https://www.youtube.com/watch?v=Bysgl_BIfEo&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=21","playback_kind":"video"},{"position":22,"title":"TUMA MADOO | Black Tax","artists":["MATATA"],"editor_note":"MATATA never shy away from making statements in their music, and TUMA MADOO is no exception. The track cleverly blends humor with social commentary, touching on the realities of financial responsibility and the “black tax” concept, all while keeping the vibe light and danceable.","provider_key":"youtube","provider_object_id":"WOXo4TfkjwM","provider_url":"https://www.youtube.com/watch?v=WOXo4TfkjwM&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=22","playback_kind":"video"},{"position":23,"title":"Kifaa","artists":["Diaso","Rahmu"],"editor_note":"TikTok sensations Diaso and Rahmu make the jump from viral dance creators to full-fledged artists with Kifaa. The Gengetone track has been embraced by their massive online following and is already a staple on party playlists.","provider_key":"youtube","provider_object_id":"aw4fAMgj_XQ","provider_url":"https://www.youtube.com/watch?v=aw4fAMgj_XQ&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=23","playback_kind":"video"},{"position":24,"title":"Fiti Na","artists":["Chris Kaiga"],"editor_note":"Ever since his debut, Chris Kaiga has always been about celebration and loving life, and Fiti Na is no different. The song is all about enjoying life and dismissing negativity, with production designed to keep you dancing—classic Chris Kaiga.","provider_key":"youtube","provider_object_id":"Nk-mG8nQYyo","provider_url":"https://www.youtube.com/watch?v=Nk-mG8nQYyo&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=24","playback_kind":"video"},{"position":25,"title":"Hope","artists":["Njoki Karu","Fadhilee Itulya"],"editor_note":"A heartfelt, uplifting duet in both English and Kiswahili, Hope blends gospel and folk influences to deliver a message of resilience and optimism. Njoki Karu and Fadhilee Itulya create a call-and-response dynamic that builds into an upbeat anthem of encouragement.","provider_key":"youtube","provider_object_id":"UWODg6VCG-k","provider_url":"https://www.youtube.com/watch?v=UWODg6VCG-k&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=25","playback_kind":"video"},{"position":26,"title":"All My Enemies Are Suffering","artists":["Bien"],"editor_note":"Bien is like a rocket ship headed straight to the moon, having reached the pinnacle of Kenyan music and aiming even higher. His latest single is a celebration and a victory lap over his enemies who can only look on in envy at his success. The song is already a monster hit and an indication of how good the next album is going to be.","provider_key":"youtube","provider_object_id":"2tkOVIYMUXA","provider_url":"https://www.youtube.com/watch?v=2tkOVIYMUXA&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=26","playback_kind":"video"},{"position":27,"title":"Bing Bong","artists":["El Chi"],"editor_note":"From the moment the beat drops, you can feel how confident and menacing this song is. It’s a pick up, a threat and a knockout all in one. El Chi continues to be completely unorthodox and inimitable while delivering the baddie anthem of the year. “Sippin on that Jaba while shaking ass” is definitely the mood for the rest of the year.","provider_key":"youtube","provider_object_id":"ZufLOzG0YtQ","provider_url":"https://www.youtube.com/watch?v=ZufLOzG0YtQ&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=27","playback_kind":"video"},{"position":28,"title":"Ficha White","artists":["Agent Mgumbe","Jovie Jovv","Shappaman","KXOBIE"],"editor_note":"Agent Mgumbe is always making moves and here he teams up with Jovie Jovv, Shappaman and KXOBIE in what can best be described as a rap exhibition. Over the Agent’s hauntingly beautiful production, all the featured artists put their pens to work to give us one of the best Kenyan rap songs in recent memory. This is an instant classic for any hip-hop fan.","provider_key":"youtube","provider_object_id":"f2W41E8n1WA","provider_url":"https://www.youtube.com/watch?v=f2W41E8n1WA&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=28","playback_kind":"video"},{"position":29,"title":"Kum Baba","artists":["Wakadinali","Abbas K뫿","Wakuu","Pepela","Masterpiece King"],"editor_note":"Wakadinali continue their trend of having their songs go mega-viral with Kum Baba. The dancehall tinged track is already a mainstay on social media as dance challenges are created just for it. While it keeps the spirit of Wakadinali alive it also serves to introduce new rappers who take the opportunity and knock it out of the park.","provider_key":"youtube","provider_object_id":"2l39jHVbf08","provider_url":"https://www.youtube.com/watch?v=2l39jHVbf08&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=29","playback_kind":"video"},{"position":30,"title":"Look The Other Way","artists":["Maya Amolo"],"editor_note":"Maya Amolo is talking softly to all her haters and detractors on this one, asking them why they never stand on business when they see her. RnB records are not the usual medium for subtle jabs and hits but Maya Amolo floats on the record which asks a simple question “Why they never say it to her face”.","provider_key":"youtube","provider_object_id":"cpkI2VhtR78","provider_url":"https://www.youtube.com/watch?v=cpkI2VhtR78&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=30","playback_kind":"video"},{"position":31,"title":"Backbencher","artists":["Toxic Lyrikali"],"editor_note":"2025 is the year of Toxic Lyrikali and the Mboka Doba general has dropped what can only be described as the song of the summer. With a catchy hook, dense sheng lyrics and an infectious energy, it is no surprise the Backbencher has become one of the biggest songs of the year and a glimpse into what Toxic Lyrikali is capable of.","provider_key":"youtube","provider_object_id":"RPIykhz53-E","provider_url":"https://www.youtube.com/watch?v=RPIykhz53-E&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=31","playback_kind":"video"},{"position":32,"title":"Likizo","artists":["DJ Mura","Big Nyagz","Liboi","YAH LISTEN"],"editor_note":"Afro House continues to grow in leaps and bounds in 2025 and Likizo is just a taste of how good it can get. DJ Mura and Big Nyagz join forces and enlist the help of Liboi and YAH LISTEN to create an upbeat track that feels like dancing on the beach, the tropical breeze making everything feel better. Expect this track to be in rotation for a while.","provider_key":"youtube","provider_object_id":"OTP2um3D3Q0","provider_url":"https://www.youtube.com/watch?v=OTP2um3D3Q0&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=32","playback_kind":"video"},{"position":33,"title":"Taya","artists":["Okello Max"],"editor_note":"In the midst of a very busy period for him, Okello Max has released his latest album, Healing, and Yawa is the standout song from the record. Once again crooning his way into our hearts, Yawa is a reminder that Okello Max is still the best at what he does, evoking emotions and deep yearning in a way that is only reserved for the masters.","provider_key":"youtube","provider_object_id":"DtAdqyRQJ7M","provider_url":"https://www.youtube.com/watch?v=DtAdqyRQJ7M&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=33","playback_kind":"video"},{"position":34,"title":"Us Those","artists":["Ndovu Kuu","Iphoolish","Fena Gitu","Fathermoh","Harry Craze"],"editor_note":"When Ndovu Kuu gets it right he goes hard. In ‘Us Those’, Ndovu collaborates with Iphoolish, Fena na na naa, Fathermoh and Harry Craze to offer a fast paced track where each artist shines bright. Fena with her effortless multilingual flow, Fathermoh with some of that tongue-in-cheek storytelling he’s known for, done masterfully in a call and response with Harry Craze.","provider_key":"youtube","provider_object_id":"hRK4CkfzyrY","provider_url":"https://www.youtube.com/watch?v=hRK4CkfzyrY&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=34","playback_kind":"video"},{"position":35,"title":"Denge Dingo","artists":["Domani Munga","Toxic Lyrikali","4Mr Frank White"],"editor_note":"What happens when you put three of the most exciting rappers in Kenya on a track produced by a legend? You get Denge Dingo, produced by Dillie, a tongue-in-cheek track that promotes being vigilant after certain night time activities. The track plays through with each rapper relating their experiences in a wonderful approach to storytelling in music.","provider_key":"youtube","provider_object_id":"whxQ3pMiu3o","provider_url":"https://www.youtube.com/watch?v=whxQ3pMiu3o&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=35","playback_kind":"video"},{"position":36,"title":"Chizi","artists":["Serro","Israel Onyach"],"editor_note":"On her sophomore album, Dusk To Dawn, Serro is laying it all bare, making sure she lets the listeners know about the ups and downs of the past couple of years. On Chizi she joins with Israel Onyach to sing about the dangers of looking for love in Nairobi, infidelity and finally seeing through your partner’s lies. Finally, a song most of Nairobi can relate to.","provider_key":"youtube","provider_object_id":"dCRft4rBbTU","provider_url":"https://www.youtube.com/watch?v=dCRft4rBbTU&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=36","playback_kind":"video"},{"position":37,"title":"Baba","artists":["Ally Fresh","Polaris Pauline"],"editor_note":"As the Afro house revolution continues, Ally Fresh, the producer and DJ has enlisted the assistance of Polaris Pauline on Baba. The track is akin to a prayer, with lyrics that ask God for guidance and help in an unclear world, something that a lot of people can relate to. The production is upbeat and bouncy while Polaris effortlessly reminds everyone that she is still the gold standard for vocalists in Kenya.","provider_key":"youtube","provider_object_id":"LlgeE-6a71I","provider_url":"https://www.youtube.com/watch?v=LlgeE-6a71I&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=37","playback_kind":"video"},{"position":38,"title":"Amanda","artists":["Vijana Barubaru","Watendawili"],"editor_note":"When Watendawili released their album En Route in November 2024, it was received with acclaim. The Ywaya Tajiri and Onyach Israel duo are unarguably talented artists and when they collaborate with other artists, their star shines brighter. In Amanda, they partner with Vijana Barubaru to offer the Kenyan music scene a Friday night pop track for lovers and friends who have no boundaries.","provider_key":"youtube","provider_object_id":"YpvmKhn7nKE","provider_url":"https://www.youtube.com/watch?v=YpvmKhn7nKE&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=38","playback_kind":"video"},{"position":39,"title":"Tiki","artists":["Nigga Shawn","Perusi","44 Dugg"],"editor_note":"Inspired by southern hiphop and trap music, Nigga Shawn, Perusi and 44 Dugg deliver a menacing street anthem focused on the never ending hustle and the lust for money. The production is dark and menacing while the lyrics paint a picture of life in the streets of Nairobi, a dangerous and fleeting existence.","provider_key":"youtube","provider_object_id":"kRRgPRekV5o","provider_url":"https://www.youtube.com/watch?v=kRRgPRekV5o&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=39","playback_kind":"video"},{"position":40,"title":"Bella","artists":["Blinky Bill","Lisa Oduor Noah"],"editor_note":"Blinky Bill and Lisa Oduor Noah are unarguably two of the best artists the industry has to offer. In Bella, the two live up to their titles and deliver a sweet jam straight out of the nostalgia playbook.","provider_key":"youtube","provider_object_id":"CUTKKlNDiwc","provider_url":"https://www.youtube.com/watch?v=CUTKKlNDiwc&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=40","playback_kind":"video"},{"position":41,"title":"BaLaa","artists":["Kasha"],"editor_note":"Kasha reappears for her yearly single drop with BaLaa, a coastal inspired track that hypes up the party and makes it seem like the most fun thing in the world. Over the tropical production, Kasha gives us a track that balances between rapping and singing, shows her range as a singer and gives you that feeling of being out on a Friday night.","provider_key":"youtube","provider_object_id":"8kekzMccfpE","provider_url":"https://www.youtube.com/watch?v=8kekzMccfpE&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=41","playback_kind":"video"},{"position":42,"title":"Running","artists":["DJ Mura","Big Nyagz","N’Jiru"],"editor_note":"Another track of the Likizo EP, N’Jiru teams up with DJ Mura and Big Nyagz to give us a danceable track about the dangers of loving someone too much. In the midst of the sublime production N’Jiru reminds us that you should you love yourself first but it might not get to you because you’re dancing the whole time.","provider_key":"youtube","provider_object_id":"HUXWHkSJdFQ","provider_url":"https://www.youtube.com/watch?v=HUXWHkSJdFQ&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=42","playback_kind":"video"},{"position":43,"title":"Summer","artists":["Kethan","Bensoul"],"editor_note":"Kethan, fka Ethan Muziki has had a career renaissance since his rebrand and on his second album since then, he continues to wear his heart on his sleeve. On Summer he is joined by Bensoul to confess their love to their particular sweethearts and asking them to join them for summer. This is a wonderfully crafted song that celebrates the joy of love.","provider_key":"youtube","provider_object_id":"HOQIFtmqcV4","provider_url":"https://www.youtube.com/watch?v=HOQIFtmqcV4&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=43","playback_kind":"video"},{"position":44,"title":"True Love","artists":["Charisma"],"editor_note":"After a banner year in 2024, Charisma returns to his roots with True Love. The dreadlocked superstar goes on record about love and longing on this track, reminding all of us why we all became Charisma fans in the first place.","provider_key":"youtube","provider_object_id":"BngExsVIBms","provider_url":"https://www.youtube.com/watch?v=BngExsVIBms&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=44","playback_kind":"video"},{"position":45,"title":"Rattlesnake","artists":["Aahil","Dylan-S","Cordoban"],"editor_note":"Thumping its way into every house DJ’s rotation, Rattlesnake has become a mainstay in all the Afro house sets in Nairobi. A track that builds to a stunning crescendo, it represents everything that is great about the Afro house scene in Nairobi.","provider_key":"youtube","provider_object_id":"nHP7npPxDJs","provider_url":"https://www.youtube.com/watch?v=nHP7npPxDJs&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=45","playback_kind":"video"},{"position":46,"title":"Chizi","artists":["Wakadinali","Kitu Sewer"],"editor_note":"Over a simple beat is when you get to understand why Wakadinali are some of the best to ever do it in Kenya. Their lyrical flow, mastery of contexts and topics of interest and how they gel together to bring forth an authentic story told as entertainment. Whether it Sewersydaa with a sermon on hood morals, and a hook delivered poetically, Scar with some street smart delivery, or their collaborator Kitu Sewer with his unique flow and delivery, Chizi offers lessons fit for a full thesis.","provider_key":"youtube","provider_object_id":"NemoIqLQZ74","provider_url":"https://www.youtube.com/watch?v=NemoIqLQZ74&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=46","playback_kind":"video"},{"position":47,"title":"Kamini","artists":["Maandy"],"editor_note":"Back again with the bangers, Maandy dropped Kamini for all the baddies out there. A return to her usual style after releasing the more RnB flavored Baddies Need Love, Kamini is a reminder that Maandy is still the queen of the rap game and no one should forget it.","provider_key":"youtube","provider_object_id":"3H8MrtiHLk4","provider_url":"https://www.youtube.com/watch?v=3H8MrtiHLk4&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=47","playback_kind":"video"},{"position":48,"title":"Kionjo","artists":["Boutross","Lil Maina","Soundkraft"],"editor_note":"Boutross is the embodiment of kujienjoy. In Kionjo, he teams up with Lil Maina, in what makes for a collaboration made in the main halls of ‘they are perfect together’. Kionjo is a short and sweet song which I’m probably going to play the hell out of as I gallivant between Ngong Road, Westlands, and Ole Sereni following the call of partying.","provider_key":"youtube","provider_object_id":"FaCjsErrj9U","provider_url":"https://www.youtube.com/watch?v=FaCjsErrj9U&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=48","playback_kind":"video"},{"position":49,"title":"Kiwache Kisonge","artists":["Iborian","Jemedari"],"editor_note":"Iborian, the deep house DJ and Producer links up with Mr Jemedari for Kiwache Kisonge, a house track that pushes the boundaries on what the genre actually is by creating a fusion of genres and styles that gives us one of the best tracks of the year.","provider_key":"youtube","provider_object_id":"Asr8mS_etCQ","provider_url":"https://www.youtube.com/watch?v=Asr8mS_etCQ&list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj&index=49","playback_kind":"video"},{"position":50,"title":"Tiki Tako","artists":["Matata","Mejja"],"editor_note":"Back with another banger, Matata are continuing to show why they are the chart whisperers of Kenyan music. Every song is a hit and on this one they enlist the help of Mejja to give us Tiki Tako, an Afro pop banger that is sure to be on every radio playlist.","provider_key":"youtube","provider_object_id":"qZgEdZFzkVc","provider_url":"https://www.youtube.com/embed/qZgEdZFzkVc?list=PLAkpUV7eQi85HvRBVl8oCJMRqQPI8A-Oj","playback_kind":"video"}]$manifest$::jsonb;
  v_description text := $description$Kenyan music has been on an unprecedented positive growth curve for the last several years, with established artists evolving and new artists unleashing their talent with vibrant energy and diverse sounds. 2025 is no exception. From the infectious Gengetone rhythms, soulful R&B melodies and hard hitting hip-hop bangers, the Kenyan music scene is delivering a constant stream of hits and songs that you don’t want to miss. To keep you up-to-date with the best songs dominating the airwaves and playlists, we’ve compiled a list of the top 50 Kenyan songs that have set the standard for 2025 so far.$description$;
  v_source_article_url text :=
    'https://wakilisha.africa/magazine/top-kenyan-songs-of-2025';
  v_source_article_resource_id uuid :=
    '7295c263-bffb-4635-97ac-1688f4a29d5c'::uuid;
  v_source_article_version_id uuid :=
    '16448b28-c792-48e8-a234-59cb558ee009'::uuid;
  v_source_article_fingerprint text :=
    'b919f79db5c3a1c95770cae1b2774d1db249e7f7d7ad62677d8c1666b64be664';
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('public.wk_playlist_items') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('public.registry_provider_track_suggestions') is null
     or to_regclass('public.registry_provider_track_suggestion_artists') is null
     or to_regprocedure('editorial.ensure_playlist_registry_intake_item(uuid)') is null
  then
    raise exception
      'STOP: Phase 5B Playlist or Registry intake authority is incomplete.';
  end if;

  if not exists (
    select 1
    from editorial.article_versions version_row
    join editorial.resources resource_row
      on resource_row.id = version_row.resource_id
    where version_row.id = v_source_article_version_id
      and version_row.resource_id = v_source_article_resource_id
      and version_row.title = 'Top 50 Kenyan Songs Of 2025'
      and version_row.slug = 'top-kenyan-songs-of-2025'
      and version_row.lifecycle_state = 'published'
      and version_row.content_fingerprint =
        v_source_article_fingerprint
      and resource_row.current_published_version_id =
        version_row.id
      and resource_row.lifecycle_state = 'published'
      and resource_row.visibility = 'public'
  ) then
    raise exception
      'STOP: Published source Article Version no longer matches the accepted M225 provenance fingerprint.';
  end if;

  if jsonb_array_length(v_manifest) <> 50 then
    raise exception
      'STOP: Expected exactly 50 manifest tracks, found %.',
      jsonb_array_length(v_manifest);
  end if;

  if exists (
    select 1
    from public.wk_playlists
    where slug = 'top-50-kenyan-songs-of-2025'
  ) then
    raise exception
      'STOP: Top 50 Kenyan Songs Of 2025 Playlist already exists.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(v_manifest) entry
    where (entry ->> 'position')::integer between 1 and 50
  ) <> 50
     or (
       select count(distinct (entry ->> 'position')::integer)
       from jsonb_array_elements(v_manifest) entry
     ) <> 50
  then
    raise exception
      'STOP: Manifest positions must be the unique sequence 1 through 50.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(v_manifest) entry
    where nullif(btrim(entry ->> 'title'), '') is not null
      and nullif(btrim(entry ->> 'editor_note'), '') is not null
      and nullif(btrim(entry ->> 'provider_key'), '') is not null
      and nullif(btrim(entry ->> 'provider_object_id'), '') is not null
      and nullif(btrim(entry ->> 'provider_url'), '') is not null
      and jsonb_typeof(entry -> 'artists') = 'array'
      and jsonb_array_length(entry -> 'artists') > 0
  ) <> 50
  then
    raise exception
      'STOP: Every manifest row requires title, editor note, provider evidence, and artist evidence.';
  end if;

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_playlist_id,
    'playlist',
    null,
    'internal',
    'active',
    null
  );

  insert into public.wk_playlists (
    id,
    title,
    slug,
    description,
    curator_label,
    status,
    metadata,
    created_by,
    authority_revision
  )
  values (
    v_playlist_id,
    'Top 50 Kenyan Songs Of 2025',
    'top-50-kenyan-songs-of-2025',
    v_description,
    'Hafare Segelan',
    'draft',
    jsonb_build_object(
      'source_kind',
        'published_article',
      'source_article_author',
        'Hafare Segelan',
      'source_article_url',
        v_source_article_url,
      'source_article_resource_id',
        v_source_article_resource_id::text,
      'source_article_version_id',
        v_source_article_version_id::text,
      'source_article_content_fingerprint',
        v_source_article_fingerprint,
      'seed_contract',
        'phase5b_top50_2025_v1'
    ),
    null,
    1
  );

  insert into editorial.playlist_resources (
    resource_id,
    resource_kind,
    playlist_id
  )
  values (
    v_playlist_id,
    'playlist',
    v_playlist_id
  );

  for v_item in
    select entry
    from jsonb_array_elements(v_manifest) as manifest(entry)
    order by (entry ->> 'position')::integer
  loop
    insert into public.registry_provider_track_suggestions (
      source_playlist_id,
      source_playlist_item_id,
      requested_by,
      canonical_track_id,
      registry_artist_id,
      artist_resolution_mode,
      provider_key,
      provider_object_id,
      provider_url,
      provider_title,
      provider_artist_names,
      provider_release_title,
      playback_kind,
      validation_snapshot,
      status,
      canonicalized_track_id,
      reserved_position,
      playlist_note,
      intake_origin,
      source_contribution_id,
      submitted_track_title
    )
    values (
      v_playlist_id,
      null,
      null,
      null,
      null,
      'unresolved',
      v_item ->> 'provider_key',
      v_item ->> 'provider_object_id',
      v_item ->> 'provider_url',
      v_item ->> 'title',
      array(
        select jsonb_array_elements_text(v_item -> 'artists')
      ),
      null,
      v_item ->> 'playback_kind',
      jsonb_build_object(
        'source_kind',
          'published_article_track',
        'source_article_url',
          v_source_article_url,
        'source_article_resource_id',
          v_source_article_resource_id::text,
        'source_article_version_id',
          v_source_article_version_id::text,
        'source_article_content_fingerprint',
          v_source_article_fingerprint,
        'source_article_position',
          (v_item ->> 'position')::integer,
        'source_article_provider_url',
          v_item ->> 'provider_url',
        'provider_key',
          v_item ->> 'provider_key',
        'provider_object_id',
          v_item ->> 'provider_object_id',
        'playback_kind',
          v_item ->> 'playback_kind'
      ),
      'needs_review',
      null,
      (v_item ->> 'position')::integer,
      v_item ->> 'editor_note',
      'playlist_editor',
      null,
      v_item ->> 'title'
    )
    returning id
    into v_suggestion_id;

    v_credit_order := 0;

    for v_artist in
      select artist
      from jsonb_array_elements(v_item -> 'artists') as credits(artist)
    loop
      v_credit_order := v_credit_order + 1;

      insert into public.registry_provider_track_suggestion_artists (
        suggestion_id,
        credit_order,
        credit_role,
        resolution_mode,
        registry_artist_id,
        observed_name
      )
      values (
        v_suggestion_id,
        v_credit_order,
        'unresolved',
        'unresolved',
        null,
        btrim(v_artist #>> '{}')
      );
    end loop;
  end loop;

  if (
    select count(*)
    from public.wk_playlist_items item
    where item.playlist_id = v_playlist_id
      and item.lifecycle_state = 'active'
  ) <> 50
  then
    raise exception
      'STOP: Seed did not materialize exactly 50 Playlist items.';
  end if;

  if exists (
    select 1
    from public.wk_playlist_items item
    where item.playlist_id = v_playlist_id
      and item.lifecycle_state = 'active'
      and (
        item.registry_track_id is not null
        or item.match_status <> 'needs_review'
        or nullif(btrim(item.notes), '') is null
      )
  ) then
    raise exception
      'STOP: Seed created unexpected canonical identity, match state, or missing editor note.';
  end if;

  if (
    select count(*)
    from public.registry_provider_track_suggestions suggestion
    where suggestion.source_playlist_id = v_playlist_id
      and suggestion.status = 'needs_review'
      and suggestion.source_playlist_item_id is not null
      and suggestion.reserved_position is null
      and suggestion.canonical_track_id is null
      and suggestion.canonicalized_track_id is null
  ) <> 50
  then
    raise exception
      'STOP: Seed did not create exactly 50 active Track Intake rows.';
  end if;

  if (
    select count(*)
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    where suggestion.source_playlist_id = v_playlist_id
      and credit.credit_role = 'unresolved'
      and credit.resolution_mode = 'unresolved'
      and credit.registry_artist_id is null
  ) <> 107
  then
    raise exception
      'STOP: Seed did not preserve exactly 107 unresolved artist credits.';
  end if;
end;
$phase_5b_m225_seed$;

commit;

