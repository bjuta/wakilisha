from __future__ import annotations
import csv, gzip, hashlib, html, json, os, re, ssl, time
from pathlib import Path
from urllib import request, error, parse

BASE = Path(
    os.environ.get(
        "WK_CHART_SOAK_BASE",
        str(Path.home() / "Library/Application Support/WAKILISHA/chart-source-soak-v2"),
    )
)
DATA = BASE / "data"
STATE = BASE / "state"
DATA.mkdir(parents=True, exist_ok=True)
STATE.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36"
SHAZAM_UA = "Dalvik/2.1.0 (Linux; U; Android 6.0.1; SM-G920F Build/MMB29K)"
MAX_BODY = 4_000_000

SAFE_HEADERS = {
    "content-type","content-length","cache-control","etag","last-modified","date",
    "retry-after","x-ratelimit-limit","x-ratelimit-remaining","x-ratelimit-reset",
    "ratelimit-limit","ratelimit-remaining","ratelimit-reset","server","vary","age",
}

def fetch(url, *, method="GET", headers=None, data=None, timeout=30):
    h={"User-Agent":UA,"Accept":"*/*"}
    if headers: h.update(headers)
    req=request.Request(url,data=data,headers=h,method=method)
    start=time.perf_counter()
    try:
        with request.urlopen(req,timeout=timeout,context=ssl.create_default_context()) as r:
            b=r.read(MAX_BODY+1)
            if len(b)>MAX_BODY: b=b[:MAX_BODY]
            return {
                "status":int(r.status),
                "latency_ms":round((time.perf_counter()-start)*1000,2),
                "headers":{str(k).lower():str(v) for k,v in r.headers.items() if str(k).lower() in SAFE_HEADERS},
                "body":b,
                "error":None,
            }
    except error.HTTPError as e:
        try: b=e.read(MAX_BODY+1)[:MAX_BODY]
        except Exception: b=b""
        return {
            "status":int(e.code),
            "latency_ms":round((time.perf_counter()-start)*1000,2),
            "headers":{str(k).lower():str(v) for k,v in e.headers.items() if str(k).lower() in SAFE_HEADERS},
            "body":b,
            "error":f"HTTP {e.code}",
        }
    except Exception as e:
        return {
            "status":None,
            "latency_ms":round((time.perf_counter()-start)*1000,2),
            "headers":{},
            "body":b"",
            "error":f"{type(e).__name__}: {e}",
        }

def sha(b): return hashlib.sha256(b).hexdigest() if b else None

def parse_apple(b):
    obj=json.loads(b)
    rows=obj.get("feed",{}).get("results",[])
    return {
        "depth":len(rows),
        "territory":obj.get("feed",{}).get("country"),
        "track_ids":sum(bool(x.get("id")) for x in rows),
        "artist_ids":sum(bool(x.get("artistId")) for x in rows),
        "top10":[{"rank":i+1,"title":x.get("name"),"artist":x.get("artistName"),"id":x.get("id")} for i,x in enumerate(rows[:10])],
    }

def parse_youtube(b):
    obj=json.loads(b)
    lists=[]
    def walk(v):
        if isinstance(v,dict):
            for k,x in v.items():
                if k=="trackViews" and isinstance(x,list): lists.append(x)
                walk(x)
        elif isinstance(v,list):
            for x in v: walk(x)
    walk(obj)
    rows=max(lists,key=len) if lists else []
    return {
        "depth":len(rows),
        "top10":[{
            "rank":x.get("chartEntryMetadata",{}).get("currentPosition"),
            "previous_rank":x.get("chartEntryMetadata",{}).get("previousPosition"),
            "views":x.get("viewCount"),
            "periods_on_chart":x.get("chartEntryMetadata",{}).get("periodsOnChart"),
            "title":x.get("name"),
            "artists":[a.get("name") for a in x.get("artists",[]) if isinstance(a,dict)],
            "video_id":x.get("encryptedVideoId"),
        } for x in rows[:10]],
    }

def parse_mdundo(b):
    text=html.unescape(b.decode("utf-8","replace")).replace('\\"','"').replace('\\/','/')
    tags=re.findall(r'<div[^>]+class="[^"]*md-playlist-song-item[^"]*"[^>]*>',text,re.I)
    rows={}
    for tag in tags:
        attrs=dict(re.findall(r'data-([A-Za-z0-9_-]+)="([^"]*)"',tag))
        if attrs.get("playlist-url")=="/top-charts/ke" and attrs.get("index") and attrs.get("id"):
            rows[(attrs["index"],attrs["id"])]=attrs
    ranked=sorted(rows.values(),key=lambda x:int(x["index"]))
    return {
        "depth":len(ranked),
        "top10":[{"rank":int(x["index"]),"id":x.get("id"),"title":x.get("title"),"artist":x.get("artist")} for x in ranked[:10]],
    }

def parse_audiomack(b):
    text=b.decode("utf-8","replace").replace('\\"','"').replace('\\/','/')
    m=re.search(r'"track_count":(\d+)',text)
    titles=re.findall(r'<meta property="music:song" content="([^"]+)"',text)
    return {
        "depth":int(m.group(1)) if m else len(titles),
        "embedded_song_objects":len(re.findall(r'"type":"song"',text)),
        "top10_titles":[html.unescape(x) for x in titles[:10]],
    }

def parse_boomplay(b):
    from html.parser import HTMLParser
    text=b.decode("utf-8","replace")
    # The ranked list is present as ordinary /songs/ anchors.
    hrefs=re.findall(r'href="([^"]*/songs/[^"]+)"',text,re.I)
    ids=[]
    for h in hrefs:
        m=re.search(r'/songs/([^?"/]+)',h)
        if m and m.group(1) not in ids: ids.append(m.group(1))
    # First 10 structured MusicRecording objects are also exposed via JSON-LD.
    titles=[]
    artists=[]
    for m in re.finditer(r'"@type"\s*:\s*"MusicRecording".{0,1800}?"name"\s*:\s*"([^"]+)".{0,1800}?"byArtist".{0,500}?"name"\s*:\s*"([^"]+)"',text,re.S):
        titles.append(m.group(1)); artists.append(m.group(2))
        if len(titles)>=10: break
    return {
        "depth":len(ids),
        "top10":[{"rank":i+1,"provider_id":ids[i] if i<len(ids) else None,
                  "title":titles[i] if i<len(titles) else None,
                  "artist":artists[i] if i<len(artists) else None} for i in range(min(10,len(ids)))],
    }

def parse_shazam(b):
    raw=gzip.decompress(b) if b[:2]==b"\x1f\x8b" else b
    rows=list(csv.reader(raw.decode("utf-8-sig","replace").splitlines()))
    header_i=None
    for i,r in enumerate(rows):
        if r[:3]==["Rank","Artist","Title"]:
            header_i=i; break
    data=[]
    if header_i is not None:
        data=[r for r in rows[header_i+1:] if len(r)>=3 and r[0].isdigit()]
    period_label=rows[1][0] if len(rows)>1 and rows[1] else None
    return {
        "depth":len(data),
        "period_label":period_label,
        "top10":[{"rank":int(r[0]),"artist":r[1],"title":r[2]} for r in data[:10]],
    }

sources = [
    ("apple", "https://rss.applemarketingtools.com/api/v2/ke/music/most-played/100/songs.json", {}, None, parse_apple),
    ("youtube", "https://charts.youtube.com/youtubei/v1/browse?alt=json",
     {"Content-Type":"application/json","Accept":"application/json"},
     json.dumps({
        "browseId":"FEmusic_analytics_charts_home",
        "context":{"capabilities":{},"client":{"clientName":"WEB_MUSIC_ANALYTICS","clientVersion":"0.2",
        "experimentIds":[],"experimentsToken":"","gl":"US","hl":"en","theme":"MUSIC"},
        "request":{"internalExperimentFlags":[]}},
        "query":"chart_params_type=WEEK&perspective=CHART&flags=viral_video_chart&selected_chart=TRACKS&chart_params_id=weekly:0:0:ke"
     },separators=(",",":")).encode(), parse_youtube),
    ("mdundo", "https://play.mdundo.com/top-charts/ke", {}, None, parse_mdundo),
    ("audiomack", "https://audiomack.com/geo-charts/playlist/kenya", {}, None, parse_audiomack),
    ("boomplay", "https://www-isp.boomplay.com/playlists/EQFJCbNTS0vEbeOL9pQjOToi?from=charts", {}, None, parse_boomplay),
    ("shazam", "https://www.shazam.com/services/charts/csv/top-200/kenya",
     {"User-Agent":SHAZAM_UA,"X-Shazam-Platform":"IPHONE","X-Shazam-AppVersion":"14.1.0",
      "Accept":"*/*","Accept-Language":"en-US","Accept-Encoding":"gzip, deflate"}, None, parse_shazam),
]

stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime())
run={"captured_at_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"sources":[]}

for name,url,headers,body,parser in sources:
    rec=fetch(url,method="POST" if body else "GET",headers=headers,data=body)
    item={
        "source":name,
        "status":rec["status"],
        "latency_ms":rec["latency_ms"],
        "headers":rec["headers"],
        "body_sha256":sha(rec["body"]),
        "body_bytes":len(rec["body"]),
        "error":rec["error"],
    }
    if rec["status"] is not None and 200 <= rec["status"] < 300:
        try:
            item["observation"]=parser(rec["body"])
            item["parse_ok"]=True
        except Exception as e:
            item["parse_ok"]=False
            item["parse_error"]=f"{type(e).__name__}: {e}"
    else:
        item["parse_ok"]=False
    run["sources"].append(item)

outfile=DATA/f"{stamp}.json"
outfile.write_text(json.dumps(run,indent=2,ensure_ascii=False,sort_keys=True))

# Update state.
state_file=STATE/"state.json"
try:
    state=json.loads(state_file.read_text()) if state_file.exists() else {}
except Exception:
    state={}
state.setdefault("started_at_utc",run["captured_at_utc"])
state["last_run_at_utc"]=run["captured_at_utc"]
state["run_count"]=int(state.get("run_count",0))+1
state["last_file"]=outfile.name
state_file.write_text(json.dumps(state,indent=2,sort_keys=True))

print(json.dumps({
    "captured_at_utc":run["captured_at_utc"],
    "file":str(outfile),
    "run_count":state["run_count"],
    "sources":[{"source":x["source"],"status":x["status"],"parse_ok":x["parse_ok"],
                "depth":(x.get("observation") or {}).get("depth")} for x in run["sources"]]
},indent=2))
