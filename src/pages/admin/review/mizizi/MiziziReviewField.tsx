import { useEffect,useMemo,useRef,useState,type PointerEvent,type WheelEvent } from "react";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { WkViewportControls } from "@/components/data-viz/WkViewportControls";
import { loadMiziziCaseSubjects,findMiziziSubjects,type CaseSubject } from "@/services/miziziCaseField";
import type { HeadquartersQueueV2 } from "@/services/miziziHeadquartersBrief";
const WIDTH=1100,HEIGHT=700;
export function MiziziReviewField({queue,onInspect}:{queue:HeadquartersQueueV2;onInspect:(id:string)=>void}) {
  const [all,setAll]=useState<readonly CaseSubject[]>([]);
  const [loadState,setLoadState]=useState<"loading"|"ready"|"error">("loading");
  const [search,setSearch]=useState("");
  const [chosen,setChosen]=useState<string|null>(null);
  const [zoom,setZoom]=useState(1);
  const [origin,setOrigin]=useState({x:0,y:0});
  const [status,setStatus]=useState<"all"|"open"|"resolved">("all");
  const drag=useRef<{x:number;y:number;ox:number;oy:number;active:boolean}|null>(null);
  useEffect(()=>{let alive=true;setLoadState("loading");
    void loadMiziziCaseSubjects(queue).then(data=>{if(alive){setAll(data);setLoadState("ready");}},
      ()=>{if(alive)setLoadState("error");});
    return()=>{alive=false;};},[queue]);
  const matches=useMemo(()=>findMiziziSubjects(all,search)
    .filter(x=>status==="all"||x.status===status),[all,search,status]);
  const selected=matches.find(x=>x.reviewId===chosen)??matches[0]??null;
  const shiftZoom=(factor:number)=>setZoom(z=>Math.min(4,Math.max(.65,z*factor)));
  const fit=()=>{setZoom(1);setOrigin({x:0,y:0});};
  const onWheel=(e:WheelEvent<SVGSVGElement>)=>{
    if(!search.trim())return;
    e.preventDefault();shiftZoom(e.deltaY<0?1.08:1/1.08);
  };
  const start=(e:PointerEvent<SVGSVGElement>)=>{if(e.button!==0)return;
    drag.current={x:e.clientX,y:e.clientY,ox:origin.x,oy:origin.y,active:false};};
  const move=(e:PointerEvent<SVGSVGElement>)=>{const d=drag.current;if(!d)return;
    const r=e.currentTarget.getBoundingClientRect();if(!r.width||!r.height)return;
    if(Math.abs(e.clientX-d.x)+Math.abs(e.clientY-d.y)>5)d.active=true;
    if(d.active)setOrigin({x:d.ox-(e.clientX-d.x)*WIDTH/(r.width*zoom),
      y:d.oy-(e.clientY-d.y)*HEIGHT/(r.height*zoom)});};
  const nodes=matches.filter(x=>x.reviewId!==selected?.reviewId).slice(0,12);
  const credits=selected?.artists.slice(0,9)??[];
  const center={x:WIDTH/2,y:HEIGHT/2};
  return <section data-wk-mizizi-field aria-label="MIZIZI case universe"
    className="relative h-[min(76vh,850px)] min-h-[580px] overflow-hidden border-y border-wk-border bg-wk-surface">
    <svg className="h-full w-full touch-pan-y" role="group" aria-label="Real MIZIZI cases and recorded credits"
      viewBox={`${origin.x} ${origin.y} ${WIDTH/zoom} ${HEIGHT/zoom}`}
      onWheel={onWheel} onPointerDown={start} onPointerMove={move}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <g className="text-wk-text-muted" stroke="currentColor" strokeOpacity=".30">
        {credits.map((credit,i)=>{const a=i*Math.PI*2/Math.max(1,credits.length)-.8,r=178;
          return <line key={credit.id+"-"+i} x1={center.x} y1={center.y}
            x2={center.x+Math.cos(a)*r} y2={center.y+Math.sin(a)*r}/>;})}
      </g>
      {selected?<g><circle cx={center.x} cy={center.y} r="63" fill="currentColor" fillOpacity=".07"
        stroke="currentColor" strokeWidth="2" className="text-wk-brand"/>
        <text x={center.x} y={center.y-5} fontSize="18" textAnchor="middle" fontWeight="700" fill="currentColor"
          className="text-wk-text">{selected.title.slice(0,24)}</text>
        <text x={center.x} y={center.y+17} fontSize="12" textAnchor="middle" fill="currentColor"
          className="text-wk-text-muted">{selected.status==="resolved"?"Resolved case":"Open case"}</text></g>:null}
      {credits.map((credit,i)=>{const a=i*Math.PI*2/Math.max(1,credits.length)-.8,r=178,
        px=center.x+Math.cos(a)*r,py=center.y+Math.sin(a)*r;
        return <g key={credit.id+"-"+i} role="group"
          aria-label={`Recorded artist credit ${credit.name}, ${credit.status.replaceAll("_"," ")}`}>
          <circle cx={px} cy={py} r="25" strokeWidth="2" stroke="currentColor"
            fill="currentColor" fillOpacity=".10"
            className={credit.status==="needs_review"?"text-wk-warning":"text-wk-brand"}/>
          <text x={px} y={py-2} textAnchor="middle" fontSize="11" fill="currentColor"
            className="text-wk-text">{credit.name.slice(0,18)}</text>
          <text x={px} y={py+13} textAnchor="middle" fontSize="10" fill="currentColor"
            className="text-wk-text-muted">{credit.status.replaceAll("_"," ").slice(0,20)}</text>
        </g>;})}
      {nodes.map((x,i)=>{const a=i*2.39996,r=265+Math.sqrt(i)*47,
        px=center.x+Math.cos(a)*r,py=center.y+Math.sin(a)*r;
        return <g key={x.reviewId} role="button" tabIndex={0}
          aria-label={`${x.title}, ${x.status}, inspect case`}
          onClick={()=>{setChosen(x.reviewId);onInspect(x.reviewId);}}
          onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setChosen(x.reviewId);onInspect(x.reviewId);}}}>
          <title>{x.title} · {x.status} · {x.isrc??"No recorded ISRC"}</title>
          <circle cx={px} cy={py} r="16" strokeWidth="2" stroke="currentColor"
            fill="currentColor" fillOpacity=".14"
            className={x.status==="resolved"?"text-wk-brand":"text-wk-warning"}/>
          <text x={px} y={py+29} textAnchor="middle" fontSize="11" fill="currentColor"
            className="text-wk-text">{x.title.slice(0,26)}</text>
        </g>;})}
    </svg>
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between gap-3">
      <div className="pointer-events-auto w-[min(320px,78%)] border-b border-r border-wk-border bg-wk-surface/95 p-4">
        <h2 className="mb-3 text-[17px] font-black text-wk-text">The Field</h2>
        <WkSearchField ariaLabel="Search real MIZIZI cases by title, artist, or ISRC"
          placeholder="Artist, recording, ISRC…" value={search} onChange={v=>{setSearch(v);setChosen(null);fit();}}
          inputClassName="!rounded-md"/>
        <p className="mt-2 text-[11px] text-wk-text-muted">
          {loadState==="loading"?"Loading verified cases…":loadState==="error"?"Cases unavailable":
            search? `${matches.length} matching cases`:"Search to reveal connected cases"}
        </p>
        <div className="mt-3 flex gap-1.5" aria-label="Case state filters">
          {(["all","open","resolved"] as const).map(v=><button key={v} type="button"
            aria-pressed={status===v} onClick={()=>setStatus(v)}
            className={`border-b-2 px-2 py-1.5 text-[12px] ${status===v?"border-wk-brand text-wk-text":"border-transparent text-wk-text-muted"}`}>
            {v==="all"?"All":v==="open"?"Open":"Resolved"}</button>)}
        </div>
        {search&&matches.length>0?<div className="mt-3 max-h-40 overflow-y-auto border-t border-wk-border">
          {matches.slice(0,6).map(item=><button type="button" key={item.reviewId}
            onClick={()=>{setChosen(item.reviewId);onInspect(item.reviewId);}}
            className="block w-full border-b border-wk-border py-2 text-left text-[12px] text-wk-text hover:text-wk-brand">
            {item.title} <span className="text-wk-text-muted">· {item.status}</span></button>)}
        </div>:null}
      </div>
      <div className="pointer-events-auto hidden border-b border-l border-wk-border bg-wk-surface/95 p-3 text-[11px] md:block"
        aria-label="Case state key">
        <p><span className="text-wk-warning">●</span> Open case or credit needs review</p>
        <p className="mt-2"><span className="text-wk-brand">●</span> Resolved case or existing credit</p>
        <p className="mt-2 text-wk-text-muted">Lines connect recorded credits only.</p>
      </div>
    </div>
    {selected?<div className="absolute bottom-4 left-4 max-w-[min(62%,390px)] border-l-2 border-wk-brand bg-wk-surface/95 p-3 text-[12px]">
      <p className="font-bold text-wk-text">{selected.title}</p>
      <p className="text-wk-text-muted">{selected.artists.length
        ?selected.artists.map(a=>a.name+" ("+a.status.replaceAll("_"," ")+")").join(", ")
        :"No artist credit in this case source"}</p>
      <button type="button" className="mt-2 font-semibold text-wk-brand"
        onClick={()=>onInspect(selected.reviewId)}>Inspect case →</button>
    </div>:null}
    <WkViewportControls onZoomIn={()=>shiftZoom(1.2)} onZoomOut={()=>shiftZoom(1/1.2)}
      onFit={fit} canZoomIn={zoom<4} canZoomOut={zoom>.65}/>
  </section>;
}
