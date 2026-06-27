import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { inMinorKeysData } from "../detail/data";
import "./styles.css";

const { stats, quote, curator, pavilions, focus, context } = inMinorKeysData;

/* ── Artist data from the PDF ── */
const lodestarArtists = [
  {
    tag: "SHRINE",
    name: "Issa Samb",
    origin: "Born 1945, Dakar, Senegal. D. 2017",
    image: "https://wakilisha.africa/api/search-image?query=Abstract%20artistic%20portrait%20of%20Senegalese%20artist%20and%20poet%2C%20warm%20earthy%20tones%2C%20textured%20painterly%20style%2C%20contemplative%20expression%2C%20soft%20dramatic%20lighting%2C%20African%20contemporary%20art%20aesthetic%2C%20museum%20quality%2C%20golden%20amber%20and%20deep%20brown%20palette%2C%20artist%20studio%20atmosphere%2C%20intellectual%20presence&width=400&height=400&seq=issa-samb-portrait&orientation=squarish",
    description:
      "Artist, poet, playwright and co-founder of Laboratoire Agit’Art in Dakar. An enduring presence and mentor for Kouoh, his practice resists easy categorisation.",
  },
  {
    tag: "SHRINE",
    name: "Beverly Buchanan",
    origin: "Born 1940, Fuquay, NC, USA. D. 2015",
    image: "https://wakilisha.africa/api/search-image?query=Artistic%20interpretation%20of%20African%20American%20land%20art%2C%20wooden%20shack%20structures%20in%20rural%20landscape%2C%20earthy%20terracotta%20and%20ochre%20tones%2C%20Southern%20vernacular%20architecture%2C%20textured%20surface%2C%20memory%20and%20place%2C%20contemporary%20art%20photography%2C%20warm%20natural%20light%2C%20poetic%20simplicity&width=400&height=400&seq=beverly-buchanan-art&orientation=squarish",
    description:
      "An African-American artist whose anti-monumental approaches to land art and public sculpture placed work in sites of charged memory.",
  },
];

const fieldArtists = [
  { tag: "PHOTO", name: "Akinbode Akinbiyi", origin: "Nigerian heritage | Berlin", image: "https://wakilisha.africa/api/search-image?query=Black%20and%20white%20documentary%20street%20photography%20of%20African%20city%20life%2C%20Lagos%20urban%20scenes%2C%20grainy%20film%20texture%2C%20candid%20moments%2C%20architectural%20geometry%2C%20deep%20contrast%2C%20contemplative%20atmosphere%2C%20art%20photography&width=400&height=400&seq=akinbiyi-photo&orientation=squarish", description: "Urban documentary photography and African city life." },
  { tag: "SCHOOL", name: "blaxTARLINES KUMASI", origin: "Ghana | School", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20African%20art%20school%20studio%20space%20in%20Ghana%2C%20creative%20collaborative%20environment%2C%20students%20working%20with%20mixed%20media%2C%20vibrant%20warm%20colors%2C%20natural%20light%20through%20windows%2C%20community%20art%20practice%2C%20Ghanaian%20cultural%20aesthetic&width=400&height=400&seq=blaxtarlines-kumasi&orientation=squarish", description: "Art education outside capital cities." },
  { tag: "HISTORY", name: "Godfried Donkor", origin: "Ghana | London and Accra", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20art%20collage%20referencing%20Black%20historical%20figures%2C%20archival%20imagery%20mixed%20with%20gold%20leaf%20and%20bold%20color%2C%20Ghanaian%20British%20artist%20style%2C%20art%20historical%20revision%2C%20layered%20composition%2C%20museum%20quality%20fine%20art&width=400&height=400&seq=godfried-donkor&orientation=squarish", description: "Black heroics and art historical revision." },
  { tag: "RITUAL", name: "Ayrson Heráclito", origin: "Brazil", image: "https://wakilisha.africa/api/search-image?query=Afro%20Brazilian%20spiritual%20ceremony%20art%20installation%2C%20organic%20materials%20like%20palm%20oil%20and%20herbs%2C%20ritualistic%20arrangement%2C%20deep%20reds%20and%20earthy%20browns%2C%20candomble%20aesthetic%2C%20contemporary%20art%20photography%2C%20sacred%20objects%20composition&width=400&height=400&seq=ayrson-heraclito&orientation=squarish", description: "Afro-Atlantic spiritual traditions and ceremony." },
  { tag: "MEMORY", name: "Sammy Baloji", origin: "DRC | Brussels and Lubumbashi", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20Congolese%20art%20photography%20exploring%20colonial%20mining%20history%2C%20archival%20images%20layered%20with%20industrial%20landscapes%2C%20copper%20and%20earth%20tones%2C%20photographic%20montage%2C%20memory%20and%20extraction%2C%20museum%20quality%20art&width=400&height=400&seq=sammy-baloji&orientation=squarish", description: "Colonial modernity, mining histories and the image." },
  { tag: "CERAMIC", name: "Seyni Awa Camara", origin: "Senegal", image: "https://wakilisha.africa/api/search-image?query=Senegalese%20ceramic%20figurative%20sculptures%2C%20hand%20built%20clay%20figures%20with%20textured%20surface%2C%20earth%20tones%20and%20natural%20pigments%2C%20traditional%20African%20craft%20aesthetic%2C%20studio%20setting%20with%20natural%20light%2C%20warm%20terracotta%20palette&width=400&height=400&seq=seyni-awa-camara&orientation=squarish", description: "Ceramic figures rooted in Senegalese cosmology." },
  { tag: "MATERIAL", name: "Adebunmi Gbadebo", origin: "Nigerian heritage | Philadelphia", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20art%20made%20from%20human%20hair%20and%20indigo%20dye%2C%20textured%20abstract%20surface%2C%20deep%20blue%20and%20black%20palette%2C%20material%20histories%20and%20ancestral%20memory%2C%20fine%20art%20textile%20sculpture%2C%20minimal%20composition&width=400&height=400&seq=adebunmi-gbadebo&orientation=squarish", description: "Material histories and ancestral memory." },
  { tag: "WONDER", name: "Nicholas Hlobo", origin: "South Africa | Johannesburg", image: "https://wakilisha.africa/api/search-image?query=South%20African%20contemporary%20art%20installation%20with%20ribbon%20and%20rubber%20materials%2C%20organic%20sculptural%20forms%2C%20deep%20red%20and%20black%20palette%2C%20sensual%20textures%2C%20bodily%20forms%2C%20gallery%20setting%2C%20fine%20art%20photography&width=400&height=400&seq=nicholas-hlobo&orientation=squarish", description: "Installations inviting reverie and bodily sensation." },
  { tag: "CLAY", name: "Ranti Bam", origin: "Nigeria | Paris and Lagos", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20ceramic%20vessels%20with%20bodily%20imprints%2C%20hand%20built%20clay%20forms%2C%20warm%20terracotta%20and%20cream%20palette%2C%20tactile%20surface%20texture%2C%20Nigerian%20artist%20studio%2C%20natural%20light%2C%20fine%20craft%20photography&width=400&height=400&seq=ranti-bam&orientation=squarish", description: "Clay vessels holding bodily impressions and memory." },
  { tag: "MAPS", name: "Nolan Oswald Dennis", origin: "Zambia | Johannesburg", image: "https://wakilisha.africa/api/search-image?query=Abstract%20cartographic%20art%20installation%2C%20diagrams%20and%20geological%20maps%20on%20dark%20paper%2C%20Black%20cartography%20and%20decolonial%20mapping%2C%20minimal%20line%20work%2C%20graphite%20and%20ink%2C%20conceptual%20art%2C%20architectural%20drawing%20aesthetic&width=400&height=400&seq=nolan-oswald-dennis&orientation=squarish", description: "Geological memory, extraction and Black cartography." },
  { tag: "SCHOOL", name: "G.A.S. Foundation", origin: "Nigeria | School", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20art%20residency%20space%20in%20Lagos%20Nigeria%2C%20modern%20studio%20with%20natural%20light%2C%20artists%20working%2C%20green%20garden%20surroundings%2C%20creative%20community%20hub%2C%20tropical%20modernist%20architecture%2C%20warm%20atmosphere&width=400&height=400&seq=gas-foundation-lagos&orientation=squarish", description: "Experimental residencies and artist infrastructure." },
  { tag: "DRAWING", name: "Marcia Kure", origin: "Nigeria | Princeton", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20drawing%20with%20charcoal%20gold%20leaf%20and%20synthetic%20hair%20materials%2C%20female%20figures%20in%20historical%20costume%2C%20Nigerian%20artist%2C%20layered%20mixed%20media%20composition%2C%20gold%20accents%20on%20dark%20background%2C%20fine%20art%2C%20elegant%20aesthetic&width=400&height=400&seq=marcia-kure&orientation=squarish", description: "Charcoal, gold and synthetic hair in historical revision." },
];

const fieldArtistsContinued = [
  { tag: "THEATRE", name: "Werewere Liking", origin: "Cameroon | Abidjan", image: "https://wakilisha.africa/api/search-image?query=African%20theatre%20performance%20space%20in%20village%20setting%2C%20cultural%20laboratory%20atmosphere%2C%20performers%20in%20traditional%20and%20contemporary%20costume%2C%20warm%20evening%20light%2C%20community%20gathering%2C%20ritual%20theatre%20aesthetic%2C%20West%20African%20cultural%20scene&width=400&height=400&seq=werewere-liking&orientation=squarish", description: "Theatre, village, oasis and cultural laboratory." },
  { tag: "KENYA", name: "Wangechi Mutu", origin: "Kenya | New York and Nairobi", image: "https://wakilisha.africa/wp-content/plugins/wakilisha-v2.0.201-cpt-cleanup/assets/guides/in-minor-keys/p17-img1.webp", description: "Plants and insect homes wild the Central Pavilion." },
  { tag: "KENYA", name: "Kaloki Nyamai", origin: "Kenya | Nairobi", image: "https://wakilisha.africa/wp-content/plugins/wakilisha-v2.0.201-cpt-cleanup/assets/guides/in-minor-keys/p17-img2.webp", description: "Sisal rope embedded in painting and Kenyan material memory." },
  { tag: "MEMORY", name: "Berni Searle", origin: "South Africa | Cape Town", image: "https://wakilisha.africa/api/search-image?query=South%20African%20contemporary%20art%20video%20still%2C%20female%20figure%20covered%20in%20spices%20and%20pigments%2C%20plantation%20memory%20themes%2C%20warm%20earthy%20orange%20and%20brown%20tones%2C%20poetic%20bodily%20presence%2C%20fine%20art%20photography&width=400&height=400&seq=berni-searle&orientation=squarish", description: "Plantation memory and colonial afterlives." },
  { tag: "LIBERATION", name: "Senzeni Marasela", origin: "South Africa | Johannesburg", image: "https://wakilisha.africa/api/search-image?query=South%20African%20contemporary%20art%20with%20red%20fabric%20and%20textile%20elements%2C%20female%20artistic%20practice%20exploring%20memory%20and%20resistance%2C%20deep%20red%20and%20white%20palette%2C%20embroidery%20and%20stitching%2C%20gallery%20installation%2C%20poetic%20political%20art&width=400&height=400&seq=senzeni-marasela&orientation=squarish", description: "Liberatory methods against colonial capture." },
  { tag: "SCHOOL", name: "NCAI", origin: "Kenya | School", image: "https://wakilisha.africa/wp-content/plugins/wakilisha-v2.0.201-cpt-cleanup/assets/guides/in-minor-keys/p17-img3.webp", description: "East African art collection and institutional voice." },
  { tag: "REST", name: "Temitayo Ogunbiyi", origin: "Nigeria | Lagos", image: "https://wakilisha.africa/api/search-image?query=Playful%20contemporary%20sculpture%20installation%20in%20public%20space%2C%20woven%20and%20organic%20forms%2C%20Nigerian%20artist%2C%20children%20interacting%20with%20art%2C%20garden%20setting%2C%20warm%20sunlight%2C%20joyful%20and%20restful%20atmosphere%2C%20Lagos%20contemporary%20art&width=400&height=400&seq=temitayo-ogunbiyi&orientation=squarish", description: "Sculpture as rest, reflection and radical pause." },
  { tag: "SILK", name: "Billie Zangewa", origin: "Malawi | Johannesburg", image: "https://wakilisha.africa/api/search-image?query=Hand%20stitched%20silk%20textile%20art%20depicting%20everyday%20Black%20domestic%20life%2C%20warm%20intimate%20interior%20scene%2C%20Malawian%20artist%2C%20rich%20fabric%20textures%2C%20golden%20and%20amber%20palette%2C%20feminine%20aesthetic%2C%20fine%20craft%20photography&width=400&height=400&seq=billie-zangewa&orientation=squarish", description: "Hand-stitched silk and everyday Black life." },
  { tag: "TEXTILE", name: "Georgina Maxim", origin: "Zimbabwe", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20Zimbabwean%20textile%20art%20with%20reclaimed%20fabric%20and%20stitching%2C%20patchwork%20composition%2C%20everyday%20materials%20transformed%2C%20warm%20earthy%20colors%2C%20tactile%20surface%2C%20craft%20and%20fine%20art%20boundary%2C%20gallery%20wall%20display&width=400&height=400&seq=georgina-maxim&orientation=squarish", description: "Daily life, enchantment and the material." },
  { tag: "ECOLOGY", name: "Otobong Nkanga", origin: "Nigeria | Berlin", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20art%20installation%20with%20living%20plants%20and%20botanical%20elements%2C%20tapestry%20and%20natural%20materials%2C%20ecological%20themes%2C%20Nigerian%20artist%2C%20gallery%20setting%20with%20natural%20light%2C%20green%20and%20earth%20tones%2C%20environmental%20art&width=400&height=400&seq=otobong-nkanga&orientation=squarish", description: "Botanical interventions and material ecology." },
  { tag: "RITUAL", name: "Ebony G. Patterson", origin: "Jamaica | Chicago", image: "https://wakilisha.africa/api/search-image?query=Jamaican%20contemporary%20art%20installation%20with%20vibrant%20floral%20patterns%20and%20glitter%2C%20carnival%20aesthetic%2C%20garden%20themes%20with%20dark%20undertones%2C%20rich%20color%20palette%2C%20tropical%20ornamentation%2C%20gallery%20installation%2C%20collective%20presence&width=400&height=400&seq=ebony-patterson&orientation=squarish", description: "Carnival, ritual and collective presence." },
  { tag: "SCHOOL", name: "Raw Material Company", origin: "Senegal | School", image: "https://wakilisha.africa/api/search-image?query=Contemporary%20art%20center%20in%20Dakar%20Senegal%2C%20modern%20gallery%20space%20with%20exhibition%2C%20cultural%20institution%20architecture%2C%20warm%20atmosphere%2C%20African%20contemporary%20art%20hub%2C%20natural%20light%2C%20community%20gathering%20space&width=400&height=400&seq=raw-material-dakar&orientation=squarish", description: "Kouoh’s Dakar institution and living archive." },
];

const schools = [
  { year: "2008", name: "RAW Material Company", location: "Dakar, Senegal", description: "Founded by Koyo Kouoh. A centre for art, knowledge and society." },
  { year: "2019", name: "G.A.S. Foundation", location: "Lagos and Ikise, Nigeria", description: "Experimental residencies and programming outside the commercial gallery structure." },
  { year: "2004", name: "lugar a dudas", location: "Cali, Colombia", description: "A Latin American institution committed to art as social knowledge." },
  { year: "2015", name: "blaxTARLINES KUMASI", location: "Kumasi, Ghana", description: "Art education and community practice outside dominant capitals." },
  { year: "2020", name: "Nairobi Contemporary Art Institute", location: "Nairobi, Kenya", description: "An East African art collection and research institution giving Nairobi a stronger institutional voice." },
  { year: "—", name: "Denniston Hill", location: "New York, USA", description: "Artist-run collective learning space in the Southern Catskills." },
];

const tickets = [
  { type: "Single visit, full price", price: "EUR 30", notes: "Standard entry" },
  { type: "Reduced, over 65 or Venice residents", price: "EUR 20", notes: "Valid ID required" },
  { type: "Students and visitors under 26", price: "EUR 16", notes: "ID or student card required" },
  { type: "3-day ticket", price: "EUR 40", notes: "Valid for 3 consecutive days" },
  { type: "Weekly ticket", price: "EUR 50", notes: "Valid for 7 consecutive days" },
  { type: "Adult groups", price: "EUR 20 pp", notes: "Min 10, max 25" },
  { type: "University student groups", price: "EUR 15 pp", notes: "Min 10, max 25" },
  { type: "Secondary school groups", price: "EUR 10 pp", notes: "Min 10, max 25" },
  { type: "Biennale Sessions", price: "EUR 20", notes: "Affiliated institutions, min 50" },
  { type: "Press ticket", price: "EUR 16", notes: "Professional press card required" },
  { type: "Visitors with disabilities", price: "EUR 20", notes: "Companion may be admitted free" },
  { type: "Children under 6", price: "Free", notes: "" },
];

export default function VeniceFieldGuidePage() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    document.title = "Through an African Lens: Venice Biennale 2026 Field Guide | WAKILISHA";
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fg-wrapper">
      {/* ── Print Header ── */}
      <div className="fg-print-header">
        <div className="fg-print-header-inner">
          <span className="fg-print-logo">WAKILISHA</span>
          <span className="fg-print-meta">Through an African Lens: Venice Biennale Arte 2026</span>
          <button onClick={handlePrint} className="fg-print-btn">
            <i className="ri-printer-line" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 01 · COVER
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section fg-cover">
        <div className="fg-cover-inner">
          <div className="fg-cover-label">A WAKILISHA FIELD GUIDE</div>
          <h1 className="fg-cover-title">
            <span className="fg-cover-title-line">Through an</span>
            <span className="fg-cover-title-line fg-cover-title-accent">African Lens</span>
          </h1>
          <div className="fg-cover-divider" />
          <p className="fg-cover-subtitle">
            Venice Biennale Arte 2026
            <br />
            In Minor Keys | Curated by Koyo Kouoh
            <br />
            9 May to 22 November 2026
          </p>
          <div className="fg-cover-stats">
            {stats.map((s) => (
              <div key={s.label} className="fg-cover-stat">
                <span className="fg-cover-stat-number">{s.number}</span>
                <span className="fg-cover-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="fg-cover-footer">
            An African field guide to the artists, pavilions, schools, routes and questions shaping Venice
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 02 · EDITOR’S NOTE
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">Editor’s Note</div>
          <h2 className="fg-h-section">
            Africa at the
            <br />
            <span className="fg-h-accent">2026 Venice Biennale</span>
          </h2>
          <div className="fg-prose">
            <p className="fg-prose-lead">
              The 61st Venice Biennale Arte does not just include Africa. It is shaped, haunted and held by African intelligence.
            </p>
            <p>
              At the centre of this edition is Koyo Kouoh, the Cameroonian curator whose vision became <em>In Minor Keys</em>. She shaped the artists, the themes, the catalogue, the Schools, the performances and the emotional architecture of the exhibition before her passing in 2025. That she did not live to see it open does not weaken her authorship. It makes the exhibition feel more like a final transmission.
            </p>
            <p>
              <em>In Minor Keys</em> asks us to listen differently. Not everything important arrives loudly. Some things move through hums, silences, laments, shrines, gardens, schools, processions, oases, rest and enchantment. Kouoh’s exhibition is not interested in spectacle for its own sake. It is interested in the lower frequencies of life: the things that remain, the things that gather, the things that survive without always asking permission to be seen.
            </p>
            <p>
              For WAKILISHA, this guide is both practical and emotional. Practical because Venice can overwhelm you. There are pavilions, routes, venues, queues, tickets, schedules and more art than one person can hold in a single visit. Emotional because this edition asks us to stop treating African art as a side room inside the larger house of world art. Africa is not a footnote here.
            </p>
            <p>
              This guide is written for African collectors, artists, cultural institutions, students, writers, travellers and art lovers who want to enter Venice 2026 through its African presences. It is for anyone who understands that Nairobi, Johannesburg, or Cairo are not far from Venice when our artists, institutions and ideas are already in the room.
            </p>
          </div>
          <div className="fg-signature">
            <span className="fg-signature-name">Muiruri Beautah</span>
            <span className="fg-signature-title">WAKILISHA Editorial</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 03 · TONI MORRISON QUOTE
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section fg-quote-section">
        <div className="fg-container">
          <div className="fg-pullquote">
            <blockquote>
              "In our myths, in our songs, that's where the seeds are. It is not possible to constantly hone on the crisis. You have to have the love and you have to have the magic, that is also life."
            </blockquote>
            <cite>Toni Morrison, 1977, cited by Koyo Kouoh in her curatorial text</cite>
          </div>
          <p className="fg-quote-context">
            Koyo Kouoh chose this quote as one of two literary anchors for the exhibition. The other was Gabriel García Márquez’s <em>One Hundred Years of Solitude</em>. Both texts connect thresholds between lifeworlds and temporalities through magical realism that deepens rather than distracts from an emotional register. This is the intellectual climate of <em>In Minor Keys</em>.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 04 · KOYO KOUOH
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">01 | The Curator</div>
          <h2 className="fg-h-section">
            Koyo
            <br />
            <span className="fg-h-accent">Kouoh</span>
          </h2>
          <div className="fg-curator-grid">
            <div className="fg-curator-portrait">
              <div className="fg-curator-img">
                <img
                  src={curator.image}
                  alt="Koyo Kouoh"
                  className="fg-img"
                />
              </div>
              <div className="fg-curator-caption">
                Koyo Kouoh | Photograph: © Mehdi Benkler, BAK
              </div>
            </div>
            <div className="fg-curator-body">
              <p className="fg-prose-lead">
                The curator who gave <em>In Minor Keys</em> its structure, mood and moral intelligence.
              </p>
              <p>
                Koyo Kouoh was the Executive Director and Chief Curator of Zeitz MOCAA in Cape Town, and the founding Artistic Director of RAW Material Company in Dakar. Her appointment as Artistic Director of the 61st Venice Biennale Arte marked a major moment for African curatorial thought on the world's most visible art stage.
              </p>
              <p>
                Kouoh had completed the curatorial project before her death in May 2025. The artists, framework, catalogue, architecture and exhibition language were already hers. The team carried that vision forward.
              </p>
              <p>
                <em>In Minor Keys</em> draws from musical metaphor. It privileges undercurrents, lament, call and response, shrines, schools, processions, oases, rest and enchantment.
              </p>
              <div className="fg-timeline">
                {curator.timeline.map((t) => (
                  <div key={t.year} className="fg-timeline-item">
                    <span className="fg-timeline-year">{t.year}</span>
                    <span className="fg-timeline-event">{t.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 05 · QUOTE SPREAD
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section fg-quote-spread">
        <div className="fg-quote-spread-inner">
          <div className="fg-quote-spread-label">WAKILISHA</div>
          <h2 className="fg-quote-spread-text">
            Art does not
            <br />
            always arrive
            <br />
            loudly
          </h2>
          <p className="fg-quote-spread-sub">
            It can move through hums, silences and lower frequencies
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 06 · THE SHRINES
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">02 | The Shrines</div>
          <h2 className="fg-h-section">
            Two lodestar
            <br />
            <span className="fg-h-accent">artists</span>
          </h2>
          <p className="fg-section-intro">
            Two artists whose lives and practices illuminate the exhibition's deeper architecture.
          </p>
          <div className="fg-shrine-grid">
            {lodestarArtists.map((artist) => (
              <div key={artist.name} className="fg-shrine-card">
                <div className="fg-shrine-img">
                  <img src={artist.image} alt={artist.name} className="fg-img" />
                  <div className="fg-shrine-tag-overlay">{artist.tag}</div>
                </div>
                <div className="fg-shrine-body">
                  <h3 className="fg-shrine-name">{artist.name}</h3>
                  <p className="fg-shrine-origin">{artist.origin}</p>
                  <p className="fg-shrine-desc">{artist.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 07 · ARTIST FIELD GUIDE
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">02 | Artist Field</div>
          <h2 className="fg-h-section">
            African and
            <br />
            <span className="fg-h-accent">diaspora artists</span>
          </h2>
          <p className="fg-section-intro">
            First routes into the artists, materials and questions shaping the main exhibition.
          </p>
          <div className="fg-artist-grid">
            {fieldArtists.map((artist) => (
              <div key={artist.name} className="fg-artist-card">
                <div className="fg-artist-img">
                  <img src={artist.image} alt={artist.name} className="fg-img" />
                  <div className="fg-artist-tag-overlay">{artist.tag}</div>
                </div>
                <div className="fg-artist-body">
                  <h3 className="fg-artist-name">{artist.name}</h3>
                  <p className="fg-artist-origin">{artist.origin}</p>
                  <p className="fg-artist-desc">{artist.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 08 · ARTIST FIELD CONTINUED
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">02 | Continued Field</div>
          <h2 className="fg-h-section">
            More routes into
            <br />
            <span className="fg-h-accent">the exhibition</span>
          </h2>
          <p className="fg-section-intro">
            Use this page as a second route through the exhibition's artists, schools and recurring themes.
          </p>
          <div className="fg-artist-grid fg-artist-grid--continued">
            {fieldArtistsContinued.map((artist) => (
              <div key={artist.name} className="fg-artist-card">
                <div className="fg-artist-img">
                  <img src={artist.image} alt={artist.name} className="fg-img" />
                  <div className="fg-artist-tag-overlay">{artist.tag}</div>
                </div>
                <div className="fg-artist-body">
                  <h3 className="fg-artist-name">{artist.name}</h3>
                  <p className="fg-artist-origin">{artist.origin}</p>
                  <p className="fg-artist-desc">{artist.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 09 · AFRICAN PAVILIONS (all 13, unified)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container fg-container--wide">
          <div className="fg-eyebrow">03 | African Pavilions</div>
          <h2 className="fg-h-section">
            National presences,
            <br />
            <span className="fg-h-accent">mapped</span>
          </h2>
          <p className="fg-section-intro">
            Thirteen African national pavilions create routes through Venice, from the Giardini and Arsenale to palazzos, islands and side streets.
            Each dossier below gives you the full picture: commissioner, curator, exhibitors, venue, route, context, why it matters and how to read it.
            Debut pavilions are flagged because first appearances build infrastructure.
          </p>
          <div className="fg-pavilion-dossier-grid">
            {pavilions.pavilions.map((p) => (
              <article key={p.country} className={`fg-pavilion-dossier ${p.type === "Debut" ? "fg-pavilion-dossier--debut" : ""}`}>
                {/* ── Header bar ── */}
                <div className="fg-pavilion-dossier-bar">
                  <span className="fg-pavilion-dossier-num">{p.number}</span>
                  {p.type === "Debut" && <span className="fg-pavilion-dossier-debut-badge">DEBUT</span>}
                  <span className="fg-pavilion-dossier-route">{p.route}</span>
                  <span className="fg-pavilion-dossier-flag">{p.flag}</span>
                </div>

                {/* ── Country + Title ── */}
                <h3 className="fg-pavilion-dossier-country">{p.country}</h3>
                <h4 className="fg-pavilion-dossier-title">{p.title}</h4>

                <hr className="fg-pavilion-dossier-div" />

                {/* ── Structured data block ── */}
                <dl className="fg-pavilion-dossier-fields">
                  <div className="fg-pavilion-dossier-field">
                    <dt>Commissioner</dt>
                    <dd>{p.commissioner}</dd>
                  </div>
                  <div className="fg-pavilion-dossier-field">
                    <dt>Curator</dt>
                    <dd>{p.curator}</dd>
                  </div>
                  <div className="fg-pavilion-dossier-field">
                    <dt>Exhibitors</dt>
                    <dd>{p.exhibitors}</dd>
                  </div>
                  <div className="fg-pavilion-dossier-field">
                    <dt>Venue</dt>
                    <dd>{p.venue}</dd>
                  </div>
                </dl>

                <hr className="fg-pavilion-dossier-div" />

                {/* ── Context ── */}
                <div className="fg-pavilion-dossier-block">
                  <div className="fg-pavilion-dossier-block-label">Context</div>
                  <p>{p.context}</p>
                </div>

                {/* ── Why it matters ── */}
                <div className="fg-pavilion-dossier-block">
                  <div className="fg-pavilion-dossier-block-label">Why it matters</div>
                  <p>{p.why}</p>
                </div>

                {/* ── How to read ── */}
                <div className="fg-pavilion-dossier-block">
                  <div className="fg-pavilion-dossier-block-label">How to read</div>
                  <p>{p.howToRead}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="fg-field-note">
            <p>{pavilions.fieldNote}</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 13 · KENYA AT VENICE
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">04 | A WAKILISHA Focus</div>
          <h2 className="fg-h-section">
            Kenya at
            <br />
            <span className="fg-h-accent">Venice</span>
          </h2>
          <p className="fg-section-intro">
            No national pavilion. Still a serious Kenyan presence through Wangechi Mutu, Kaloki Nyamai and Nairobi Contemporary Art Institute.
          </p>
          <p className="fg-section-intro">
            Kenya enters through image, material and institution: Mutu wilds the Central Pavilion facade with plants and insect homes, Nyamai carries sisal into painting, and NCAI appears as one of the Schools.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 14 · THREE KENYAN PRESENCES
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">04 | Three Kenyan Presences</div>
          <div className="fg-focus-grid">
            {focus.cards.map((card) => (
              <div key={card.number} className="fg-focus-card">
                <div className="fg-focus-tag">{card.label}</div>
                <h3 className="fg-focus-name">{card.title}</h3>
                <p className="fg-focus-desc">{card.description}</p>
              </div>
            ))}
          </div>
          <div className="fg-field-note">
            <p>{focus.note}</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 15 · THE AFRICAN SCHOOLS
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">05 | Knowledge Network</div>
          <h2 className="fg-h-section">
            Grassroots institutions
            <br />
            <span className="fg-h-accent">at the centre</span>
          </h2>
          <p className="fg-section-intro">
            These institutions show how art is taught, gathered, argued over and kept alive outside the usual centres of power.
          </p>
          <div className="fg-schools-grid">
            {schools.map((school) => (
              <div key={school.name} className="fg-school-card">
                <div className="fg-school-year">{school.year}</div>
                <h3 className="fg-school-name">{school.name}</h3>
                <p className="fg-school-location">{school.location}</p>
                <p className="fg-school-desc">{school.description}</p>
              </div>
            ))}
          </div>
          <div className="fg-schools-summary">
            <p>
              What connects these institutions is an ethos of gathering, sharing knowledge, staying a while, taking systems apart, sowing seeds of intent and building cultural centres beyond the commercial market.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 16 · PRACTICAL INFO
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">06 | Visitor Information</div>
          <h2 className="fg-h-section">
            Dates, tickets
            <br />
            <span className="fg-h-accent">and getting there</span>
          </h2>
          <p className="fg-section-intro">Start here before you plan your route through Venice.</p>
          <div className="fg-practical-grid">
            <div className="fg-practical-card">
              <div className="fg-practical-icon"><i className="ri-calendar-line" /></div>
              <h3 className="fg-practical-label">Exhibition</h3>
              <p className="fg-practical-value">61st International Art Exhibition: In Minor Keys by Koyo Kouoh</p>
            </div>
            <div className="fg-practical-card">
              <div className="fg-practical-icon"><i className="ri-time-line" /></div>
              <h3 className="fg-practical-label">Dates</h3>
              <p className="fg-practical-value">9 May to 22 November 2026</p>
            </div>
            <div className="fg-practical-card">
              <div className="fg-practical-icon"><i className="ri-map-pin-line" /></div>
              <h3 className="fg-practical-label">Venues</h3>
              <p className="fg-practical-value">Giardini, Arsenale and locations across Venice</p>
            </div>
            <div className="fg-practical-card">
              <div className="fg-practical-icon"><i className="ri-global-line" /></div>
              <h3 className="fg-practical-label">Official Website</h3>
              <p className="fg-practical-value">www.labiennale.org</p>
            </div>
            <div className="fg-practical-card">
              <div className="fg-practical-icon"><i className="ri-mail-line" /></div>
              <h3 className="fg-practical-label">Press Contact</h3>
              <p className="fg-practical-value">pressoffice@labiennale.org</p>
            </div>
            <div className="fg-practical-card">
              <div className="fg-practical-icon"><i className="ri-hashtag" /></div>
              <h3 className="fg-practical-label">Hashtags</h3>
              <p className="fg-practical-value">#BiennaleArte2026 #InMinorKeys</p>
            </div>
          </div>
          <div className="fg-hours-box">
            <h3 className="fg-hours-title">Opening Hours</h3>
            <p className="fg-hours-text">
              <strong>Summer:</strong> 11am to 7pm. The Arsenale remains open until 8pm on Fridays and Saturdays until 26 September.
            </p>
            <p className="fg-hours-text">
              <strong>Autumn:</strong> 10am to 6pm, from 29 September to 22 November.
            </p>
            <p className="fg-hours-text">
              <strong>Closed:</strong> Mondays except selected dates. Pre-opening: 6, 7 and 8 May 2026.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 17 · TICKETS
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section">
        <div className="fg-container">
          <div className="fg-eyebrow">06 | Tickets</div>
          <h2 className="fg-h-section">
            Ticket
            <br />
            <span className="fg-h-accent">guide</span>
          </h2>
          <p className="fg-section-intro">A quick ticket guide for planning your visit.</p>
          <div className="fg-ticket-table-wrap">
            <table className="fg-ticket-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.type}>
                    <td>{t.type}</td>
                    <td className="fg-ticket-price">{t.price}</td>
                    <td>{t.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 18 · CLOSING
      ═══════════════════════════════════════════════════════════════ */}
      <section className="fg-section fg-closing">
        <div className="fg-container">
          <h2 className="fg-closing-title">
            Your people are
            <br />
            <span className="fg-h-accent">already here</span>
          </h2>
          <div className="fg-closing-body">
            <p>
              WAKILISHA is building cultural infrastructure for African creative life, beginning with music and expanding across art, film, fashion, food, language, places, stories and systems.
            </p>
            <p>
              This guide is for Kenyan collectors, cultural institutions, artists and art lovers who want to engage with the 61st Venice Biennale Arte through its African voices. Venice is not distant from Nairobi. It is one of the places where the artists, institutions and ideas WAKILISHA supports meet the world.
            </p>
          </div>
          <div className="fg-closing-cta">
            <Link to="/guides" className="fg-closing-link">
              <i className="ri-arrow-left-line" /> Back to WAKILISHA Guides
            </Link>
            <span className="fg-closing-url">wakilisha.africa</span>
          </div>
        </div>
      </section>

      {/* ── Print Footer ── */}
      <div className="fg-print-footer">
        <div className="fg-print-footer-inner">
          <span>Through an African Lens: Venice Biennale Arte 2026 Field Guide</span>
          <span>wakilisha.africa</span>
        </div>
      </div>
    </div>
  );
}