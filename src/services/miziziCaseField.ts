/** A read-only Pensieve projection rooted exclusively in genuine MIZIZI review IDs. */
import { supabase } from "@/lib/supabase";
import type { HeadquartersQueueV2 } from "./miziziHeadquartersBrief";
export type CaseSubject = Readonly<{
  reviewId:string; sourceId:string; kind:"track"|"release"; title:string;
  isrc:string|null; status:"open"|"resolved"|"other"; workstream:string;
  artists:readonly Readonly<{id:string; name:string; status:string}>[];
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
      .select("track_id,artist_id,artist_name_text,status")
      .in("track_id",tracks.map(x=>x.source_id))
      :Promise.resolve({data:[],error:null}),
  ]);
  if(t.error||r.error||c.error) throw t.error||r.error||c.error;
  const bySource=new Map([...(t.data??[]),...(r.data??[])].map(x=>[x.id,x]));
  const artists=new Map<string,{id:string;name:string;status:string}[]>();
  for(const credit of c.data??[]){
    if(!credit.artist_id||!credit.artist_name_text) continue;
    const arr=artists.get(credit.track_id)??[];
    arr.push({id:credit.artist_id,name:credit.artist_name_text,status:credit.status??"unknown"});
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
