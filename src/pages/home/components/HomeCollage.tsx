import { Link } from "react-router-dom";

interface Tile {
  img: string;
  label: string;
  tag: "Live" | "Road";
  line: string;
  href: string;
  col: string;
  row: string;
}

const TILES: Tile[] = [
  {
    img: "https://readdy.ai/api/search-image?query=Dramatic%20African%20live%20music%20concert%20venue%20interior%20colorful%20stage%20lighting%20beams%20cutting%20through%20atmospheric%20smoke%20haze%20vibrant%20purple%20magenta%20cyan%20lights%20silhouettes%20of%20performers%20on%20stage%20moody%20cinematic%20music%20photography%20editorial%20quality%20dark%20rich%20atmosphere%20cultural%20performance%20deep%20colors&width=600&height=800&seq=collage-music-wk26&orientation=portrait",
    label: "Music", tag: "Live", line: "Charts, artists & releases",
    href: "/charts", col: "1", row: "1 / 3",
  },
  {
    img: "https://readdy.ai/api/search-image?query=Contemporary%20African%20fashion%20editorial%20photography%20model%20wearing%20bold%20vibrant%20modern%20African%20designer%20garments%20with%20vivid%20geometric%20prints%20and%20rich%20textures%20clean%20minimal%20dark%20studio%20background%20dramatic%20side%20lighting%20high%20fashion%20quality%20confident%20sophisticated%20styling%20warm%20color%20palette&width=600&height=400&seq=collage-style-wk26&orientation=landscape",
    label: "Style", tag: "Road", line: "Textiles & creative direction",
    href: "/fashion", col: "2", row: "1",
  },
  {
    img: "https://readdy.ai/api/search-image?query=Overhead%20aerial%20flat%20lay%20of%20East%20African%20market%20stall%20colorful%20fresh%20tropical%20fruits%20vegetables%20spices%20and%20grains%20arranged%20in%20woven%20baskets%20warm%20golden%20sunlight%20vibrant%20food%20photography%20editorial%20style%20authentic%20cultural%20market%20atmosphere%20rich%20warm%20colors%20beautiful%20composition&width=600&height=400&seq=collage-food-wk26&orientation=landscape",
    label: "Food", tag: "Road", line: "Cultural dining & memory",
    href: "/food", col: "3", row: "1",
  },
  {
    img: "https://readdy.ai/api/search-image?query=Stack%20of%20vintage%20aged%20African%20manuscripts%20handwritten%20books%20and%20documents%20with%20cultural%20calligraphy%20patterns%20warm%20amber%20tones%20from%20golden%20light%20library%20archive%20atmosphere%20aged%20paper%20texture%20soft%20dramatic%20lighting%20scholarly%20cultural%20documentation%20preservation%20beauty%20in%20the%20written%20word&width=600&height=400&seq=collage-lang-wk26&orientation=landscape",
    label: "Language", tag: "Road", line: "Lyrics, idioms, oral history",
    href: "/language", col: "4", row: "1",
  },
  {
    img: "https://readdy.ai/api/search-image?query=Dynamic%20African%20contemporary%20dance%20performance%20fluid%20motion%20energy%20and%20grace%20colorful%20traditional%20modern%20costume%20blurred%20movement%20trails%20long%20exposure%20dramatic%20stage%20lighting%20editorial%20dance%20photography%20dark%20background%20emphasizing%20movement%20and%20cultural%20expression%20emotional%20powerful%20kinetic%20image&width=800&height=400&seq=collage-move-wk26&orientation=landscape",
    label: "Movement", tag: "Road", line: "Choreography & live culture",
    href: "/places", col: "2 / 4", row: "2",
  },
  {
    img: "https://readdy.ai/api/search-image?query=Thoughtful%20portrait%20of%20African%20cultural%20guide%20storyteller%20elder%20in%20warm%20natural%20outdoor%20setting%20dappled%20sunlight%20through%20trees%20confident%20wise%20expression%20traditional%20and%20contemporary%20elements%20blended%20editorial%20portrait%20photography%20shallow%20depth%20of%20field%20soft%20bokeh%20background%20authentic%20documentary%20quality%20rich%20character%20depth&width=600&height=800&seq=collage-guides-wk26&orientation=portrait",
    label: "Guides", tag: "Live", line: "The discovery layer",
    href: "/guides", col: "4", row: "2",
  },
];

export function HomeCollage() {
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px clamp(20px,4vw,40px) 40px" }}>
      {/* Header */}
      <div className="mb-10">
        <div
          className="mb-3 text-[var(--wk-brand)]"
          style={{ fontFamily: "var(--wk-font-mono, monospace)", fontSize: ".72rem", letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 600 }}
        >
          One ecosystem, built in stages
        </div>
        <h2
          className="font-bold tracking-[-0.025em] text-[var(--wk-text)] max-w-[24ch]"
          style={{ fontSize: "clamp(1.7rem,3.2vw,2.4rem)", lineHeight: 1.05 }}
        >
          The whole of culture — Music live, the rest on the road ahead.
        </h2>
      </div>

      {/* Collage grid */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] lg:gap-[14px]"
        style={{ gridAutoRows: "140px", ...((typeof window !== "undefined" && window.innerWidth >= 1024) ? { gridAutoRows: "200px" } : {}) }}
      >
        {TILES.map((tile, i) => {
          const isLarge = tile.row.includes("/");
          const isWide = tile.col.includes("/");
          return (
            <Link
              key={tile.label}
              to={tile.href}
              className={`group relative rounded-2xl overflow-hidden border border-[var(--wk-border)] block cursor-pointer ${
                isLarge && !isWide ? "row-span-2" : ""
              } ${isWide ? "col-span-2 lg:col-span-2" : ""}`}
              style={isLarge && isWide ? { gridRow: "auto", gridColumn: "auto" } : {}}
            >
              <img
                src={tile.img}
                alt={tile.label}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.07]"
                loading="lazy"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,9,8,0.08) 30%, rgba(8,9,8,0.82) 100%)" }} />
              <div className="absolute left-4 right-4 bottom-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[15px] font-bold text-white leading-none">{tile.label}</span>
                  <span
                    className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
                    style={{
                      color: tile.tag === "Live" ? "var(--wk-brand)" : "var(--wk-text-faint)",
                      background: tile.tag === "Live" ? "rgba(132,194,65,0.15)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${tile.tag === "Live" ? "rgba(132,194,65,0.35)" : "rgba(255,255,255,0.12)"}`,
                    }}
                  >
                    {tile.tag}
                  </span>
                </div>
                <div className="text-[12px] text-white/60 leading-snug">{tile.line}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}