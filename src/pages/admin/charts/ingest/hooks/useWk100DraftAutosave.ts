import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWk100AdminDraft, saveWk100AdminDraft,
  type Wk100AdminDraftConfig,
} from "@/services/chartsIngestion/client";

export type Wk100SaveState =
  | "idle" | "loading" | "saving" | "saved"
  | "error" | "conflict" | "unsaved";

function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const entry = value as Record<string,unknown>;
    return "{" + Object.keys(entry).sort().map(
      key => JSON.stringify(key) + ":" + stable(entry[key]),
    ).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * A server ACK, not localStorage, is the only meaning of "Saved".
 * A single-writer queue serializes overlapping edits. SQL enforces CAS
 * against a second browser, preserving every accepted draft revision.
 */
export function useWk100DraftAutosave({
  enabled, weekStartEat, config, onHydrate,
}: {
  enabled: boolean;
  weekStartEat: string;
  config: Wk100AdminDraftConfig | null;
  onHydrate: (saved: Wk100AdminDraftConfig) => void;
}) {
  const [state,setState] = useState<Wk100SaveState>("idle");
  const [message,setMessage] = useState<string|null>(null);
  const [reloadToken,setReloadToken] = useState(0);
  const [loadedGeneration,setLoadedGeneration] = useState(0);
  const activeWeek = useRef("");
  const epoch = useRef(0);
  const hydrate = useRef(onHydrate);
  hydrate.current = onHydrate;
  const loaded = useRef(false);
  const hydrationFingerprint = useRef<string|null>(null);
  const revision = useRef(new Map<string,number>());
  const acknowledged = useRef(new Map<string,string>());
  const pending = useRef<{
    week:string; key:string; config:Wk100AdminDraftConfig;
  }|null>(null);
  const busy = useRef(false);
  const blocked = useRef(false);

  const flush = useCallback(async function write():Promise<void> {
    if(busy.current || blocked.current) return;
    const item=pending.current;
    if(!item)return;
    if(acknowledged.current.get(item.week)===item.key) {
      if(activeWeek.current===item.week)setState("saved");
      return;
    }
    busy.current=true;
    try {
      const expectedRevision=revision.current.get(item.week)??0;
      const receipt=await saveWk100AdminDraft(
        item.week,expectedRevision,item.config);
      revision.current.set(item.week,receipt.revision);
      acknowledged.current.set(item.week,item.key);
      if(activeWeek.current===item.week &&
         pending.current?.key===item.key){
        setState("saved");
        setMessage(null);
      }
    } catch(e) {
      if(activeWeek.current===item.week){
        blocked.current=true;
        const conflict=e instanceof Error &&
          e.message.includes("draft_revision_conflict");
        setState(conflict?"conflict":"error");
        setMessage(conflict
          ? "Another Admin session saved this week. Your edits are retained; resolve the conflict before continuing."
          : "Could not save this configuration. Your edits are retained. Retry to save before continuing.");
      }
    } finally {
      busy.current=false;
      if(!blocked.current && pending.current &&
         acknowledged.current.get(pending.current.week)!==pending.current.key){
        void write();
      }
    }
  },[]);

  useEffect(()=>{
    activeWeek.current=enabled?weekStartEat:"";
    const stamp=++epoch.current;
    loaded.current=false;
    hydrationFingerprint.current=null;
    pending.current=null;
    blocked.current=false;
    if(!enabled){setState("idle");setMessage(null);return;}
    setState("loading");
    setMessage(null);
    void getWk100AdminDraft(weekStartEat).then(draft=>{
      if(stamp!==epoch.current)return;
      revision.current.set(weekStartEat,draft?.revision??0);
      if(draft){
        const {ingestPolicySha256: _unused,...saved}=draft.config;
        const clean=saved as Wk100AdminDraftConfig;
        hydrationFingerprint.current=stable(clean);
        acknowledged.current.set(weekStartEat,stable(clean));
        hydrate.current(clean);
      }else{
        acknowledged.current.delete(weekStartEat);
      }
      loaded.current=true;
      setLoadedGeneration(v=>v+1);
      setState(draft?"loading":"unsaved");
    }).catch(()=>{
      if(stamp!==epoch.current)return;
      loaded.current=false;
      blocked.current=true;
      setState("error");
      setMessage("Unable to read this week's saved configuration. Nothing was overwritten.");
    });
  },[enabled,weekStartEat,reloadToken]);

  const serialized=config?stable(config):"";
  useEffect(()=>{
    if(!enabled || !loaded.current)return;
    if(!config){setState("unsaved");return;}
    if(hydrationFingerprint.current!==null){
      if(serialized===hydrationFingerprint.current){
        hydrationFingerprint.current=null;
        setState("saved");
      }
      return;
    }
    if(acknowledged.current.get(weekStartEat)===serialized){
      if(!blocked.current)setState("saved");
      return;
    }
    pending.current={week:weekStartEat,key:serialized,config};
    if(blocked.current)return;
    setState("saving");
    setMessage(null);
    const timer=setTimeout(()=>{void flush();},250);
    return ()=>clearTimeout(timer);
  },[enabled,weekStartEat,serialized,flush,loadedGeneration]);

  useEffect(()=>{
    if(!enabled || state==="saved" || state==="idle")return;
    const prevent=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
    window.addEventListener("beforeunload",prevent);
    return ()=>window.removeEventListener("beforeunload",prevent);
  },[enabled,state]);

  const retry=useCallback(()=>{
    if(!loaded.current){setReloadToken(v=>v+1);return;}
    blocked.current=false;
    setState("saving");
    setMessage(null);
    void flush();
  },[flush]);

  return {
    state,message,
    canContinue:!enabled || state==="saved",
    retry,
    discardAndReload:()=>setReloadToken(x=>x+1),
    revision:revision.current.get(weekStartEat)??0,
  };
}
