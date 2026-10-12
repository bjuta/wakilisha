/** A read-only Pensieve projection rooted exclusively in genuine MIZIZI review IDs. */
import { supabase } from "@/lib/supabase";
import type { HeadquartersQueueV2 } from "./miziziHeadquartersBrief";
export type CaseSubject = Readonly<{
  reviewId:string; sourceId:string; kind:"track"|"release"; title:string;
  isrc:string|null; status:"open"|"resolved"|"other"; workstream:string;
  artists:readonly Readonly<{id:string; name:string; status:string; slug:string|null}>[];
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const limit=300;
export async function loadMiziziCaseSubjects(queue:HeadquartersQueueV2):Promise<readonly CaseSubject[]> {
  const target=queue.items.filter(r=>r.workstream==="mizizi_data_hygiene" &&
    (r.subjectType==="track"||r.subjectType==="release")).slice(0,limit);
  if (!target.length) return [];
  const permitted=new Map(target.map(x=>[x.id,x]));
  const {data:refs,error}=await supabase.from("registry_review_items")
    .select("id,source_id,entity_type").in("id",target.map(x=>x.id));
  if(error) throw error;
  const valid=(refs??[]).filter(x=>permitted.has(x.id)&&UUID.test(x.source_id??"")&&
    permitted.get(x.id)?.subjectType===x.entity_type);
  const tracks=valid.filter(x=>x.entity_type==="track");
  const releases=valid.filter(x=>x.entity_type==="release");
  const [t,r,c]=await Promise.all([
    tracks.length?supabase.from("registry_tracks").select("id,title,isrc").in("id",tracks.map(x=>x.source_id))
      :Promise.resolve({data:[],error:null}),
    releases.length?supabase.from("registry_releases").select("id,title").in("id",releases.map(x=>x.source_id))
      :Promise.resolve({data:[],error:null}),
    tracks.length?supabase.from("registry_track_artists")
      .select("track_id,artist_id,artist_name_text,artist_slug,status")
      .in("track_id",tracks.map(x=>x.source_id))
      :Promise.resolve({data:[],error:null}),
  ]);
  if(t.error||r.error||c.error) throw t.error||r.error||c.error;
  const bySource=new Map([...(t.data??[]),...(r.data??[])].map(x=>[x.id,x]));
  const artists=new Map<string,{id:string;name:string;status:string;slug:string|null}[]>();
  for(const credit of c.data??[]){
    if(!credit.artist_id||!credit.artist_name_text) continue;
    const arr=artists.get(credit.track_id)??[];
    arr.push({id:credit.artist_id,name:credit.artist_name_text,status:credit.status??"unknown",slug:credit.artist_slug??null});
    artists.set(credit.track_id,arr);
  }
  return valid.flatMap(ref=>{
    const record=bySource.get(ref.source_id),review=permitted.get(ref.id);
    if(!record||!review||!record.title) return [];
    return [{reviewId:ref.id,sourceId:ref.source_id,kind:ref.entity_type as "track"|"release",
      title:record.title,isrc:"isrc" in record?record.isrc??null:null,
      status:review.status,workstream:review.workstream,
      artists:artists.get(ref.source_id)??[]}];
  });
}
export function findMiziziSubjects(items:readonly CaseSubject[],query:string):readonly CaseSubject[] {
  const q=query.trim().toLocaleLowerCase();
  if(!q) return [];
  return items.filter(x=>[x.title,x.isrc??"",x.reviewId,x.sourceId,
    ...x.artists.map(a=>a.name)].some(t=>t.toLocaleLowerCase().includes(q))).slice(0,36);
}


/** Search returns real subject CHOICES. It does not promote the first matching case to
 * an artist node or turn independent search results into implied relationships. */
export type MiziziFieldHit = Readonly<{
  key:string; kind:"artist"|"case"; label:string; subtitle:string; linkedCases:number;
}>;
export function searchMiziziFieldHits(
  rows:readonly CaseSubject[], query:string, state:"all"|"open"|"resolved"="all"
):readonly MiziziFieldHit[] {
  const needle=query.trim().toLocaleLowerCase();
  if(needle.length<3)return [];
  const artists=new Map<string,{name:string;slug:string|null;ids:Set<string>;review:boolean}>();
  const cases:MiziziFieldHit[]=[];
  for(const row of rows){
    if(state!=="all"&&row.status!==state)continue;
    if([row.title,row.isrc??"",row.sourceId,row.reviewId].some(v=>v.toLocaleLowerCase().includes(needle))){
      cases.push({key:"case:"+row.reviewId,kind:"case",label:row.title,
        subtitle:(row.kind==="track"?"Recording":"Release")+" · "+(row.status==="resolved"?"Resolved review":"Open review")+
          (row.isrc?" · ISRC "+row.isrc:""),linkedCases:1});
    }
    for(const credit of row.artists){
      if(!credit.name.toLocaleLowerCase().includes(needle)&&
         !credit.slug?.toLocaleLowerCase().includes(needle))continue;
      const item=artists.get(credit.id)??{
        name:credit.name,slug:credit.slug,ids:new Set<string>(),review:false
      };
      item.ids.add(row.reviewId);item.review ||= credit.status==="needs_review";
      artists.set(credit.id,item);
    }
  }
  // The query discovers artist IDs via a matching name/slug, but the displayed
  // relationship count must include ALL authorised reviewed credits under that
  // exact ID, including name variants (e.g. Lilmaina / Lil Maina). Never merge IDs.
  for(const row of rows){
    if(state!=="all"&&row.status!==state)continue;
    for(const credit of row.artists){
      const matched=artists.get(credit.id);
      if(!matched)continue;
      matched.ids.add(row.reviewId);
      matched.review ||= credit.status==="needs_review";
    }
  }
  const artistHits:MiziziFieldHit[]=[...artists].map(([id,x])=>({
    key:"artist:"+id,kind:"artist",label:x.name,linkedCases:x.ids.size,
    subtitle:"Artist credit"+(x.slug?" · "+x.slug:"")+
      " · "+x.ids.size+" linked review"+(x.ids.size===1?"":"s")+
      (x.review?" · Needs review":"")
  }));
  return [...artistHits,...cases].sort((a,b)=>
    Number(b.label.toLocaleLowerCase()===needle)-Number(a.label.toLocaleLowerCase()===needle)||
    Number(b.kind==="artist")-Number(a.kind==="artist")||
    b.linkedCases-a.linkedCases||a.label.localeCompare(b.label)||a.key.localeCompare(b.key)
  );
}
export type MiziziFieldFocus =
  | Readonly<{kind:"artist";name:string;artistId:string;related:readonly CaseSubject[]}>
  | Readonly<{kind:"case";name:string;record:CaseSubject;credits:CaseSubject["artists"]}>;
export function projectMiziziFieldFocus(rows:readonly CaseSubject[],key:string,state:"all"|"open"|"resolved"="all"):MiziziFieldFocus|null {
  if(key.startsWith("case:")){
    const record=rows.find(x=>x.reviewId===key.slice(5)&&(state==="all"||x.status===state));
    return record?{kind:"case",name:record.title,record,credits:record.artists}:null;
  }
  if(key.startsWith("artist:")){
    const id=key.slice(7);
    const related=rows.filter(x=>(state==="all"||x.status===state)&&x.artists.some(a=>a.id===id));
    const credit=related.flatMap(x=>x.artists).find(a=>a.id===id);
    return credit?{kind:"artist",name:credit.name,artistId:id,related}:null;
  }
  return null;
}
