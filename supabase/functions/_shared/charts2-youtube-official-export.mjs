// First-party YouTube Charts CSV export. The file supplies ranks and views;
// the signed-in operator, not the file, attests the selected market/week.
// No network, collection admission, Registry writes, scoring or publication.
export const YOUTUBE_EXPORT_ENDPOINT='https://charts.youtube.com/charts/TopSongs/ke';
export const YOUTUBE_EXPORT_MODE='official_export_upload';
export const YOUTUBE_EXPORT_PERIOD_AUTHORITY='operator_confirmed_official_export';
export const YOUTUBE_EXPORT_PARSER_VERSION='charts2-youtube-official-export-v1';
export const YOUTUBE_EXPORT_ACK='I confirm this unmodified YouTube Charts CSV is Kenya Weekly Top Songs for the selected week.';
const HEADER=['Rank','Previous Rank','Track Name','Artist Names','Periods on Chart','Views','Growth','YouTube URL'];
const fail=code=>{throw new Error('charts2_youtube_export_'+code);};
const DAY=86400000;
function day(s){
  if(!/^\d{8}$/.test(s))fail('period_invalid');
  const iso=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
  const ms=Date.parse(iso+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==iso)fail('period_invalid');
  return ms;
}
export function youtubeExportWeekEnd(period,observedAt){
  const m=typeof period==='string'&&/^weekly:(\d{8}):(\d{8}):ke$/.exec(period);
  if(!m)fail('period_invalid');
  const start=day(m[1]),end=day(m[2]),observed=Date.parse(observedAt);
  if(end-start!==6*DAY||new Date(end).getUTCDay()!==4||!Number.isFinite(observed)||observed<end+DAY)
    fail('period_invalid');
  return new Date(end).toISOString().slice(0,10);
}
function strictRows(raw){
  if(typeof raw!=='string'||raw.length<1||raw.length>4000000)fail('body_invalid');
  const s=raw.replace(/^\ufeff/,'');
  const out=[];let row=[],cell='',state=0;
  function field(){row.push(cell);cell='';state=0;if(row.length>HEADER.length)fail('column_count');}
  function line(){field();out.push(row);row=[];if(out.length>101)fail('row_count');}
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(state===1){
      if(c==='"'&&s[i+1]==='"'){cell+='"';i++;}
      else if(c==='"')state=2;
      else cell+=c;
      continue;
    }
    if(c===','){field();continue;}
    if(c==='\r'||c==='\n'){
      if(c==='\r'){if(s[i+1]!=='\n')fail('line_ending');i++;}
      line();continue;
    }
    if(state===2)fail('quote_invalid');
    if(c==='"'){if(cell)fail('quote_invalid');state=1;continue;}
    cell+=c;
  }
  if(state===1)fail('quote_invalid');
  if(row.length||cell||state===2)line();
  return out;
}
function uint(s,max,min=0){
  if(!/^(0|[1-9]\d{0,14})$/.test(s))fail('number_invalid');
  const n=Number(s);if(!Number.isSafeInteger(n)||n<min||n>max)fail('number_invalid');return n;
}
function credit(s){
  if(!s.trim()||s.length>500||/[\u0000-\u001f\u007f]/.test(s))fail('credit_invalid');
  return s;
}
export function parseYouTubeKenyaOfficialExport(raw,period,{endpoint,observed_at,acknowledgement}={}){
  if(endpoint!==YOUTUBE_EXPORT_ENDPOINT||acknowledgement!==YOUTUBE_EXPORT_ACK)fail('attestation_required');
  const end=youtubeExportWeekEnd(period,observed_at);
  const sheet=strictRows(raw),header=sheet.shift();
  if(!header||header.length!==HEADER.length||HEADER.some((v,i)=>header[i]!==v))fail('header_invalid');
  if(sheet.length!==100)fail('row_count');
  const ids=new Set();let previousViews=Infinity;
  const rows=sheet.map((r,i)=>{
    if(r.length!==HEADER.length)fail('column_count');
    const [rank,previous,title,artist,periods,views,growth,url]=r;
    if(uint(rank,100,1)!==i+1)fail('rank_invalid');
    if(previous!=='n/a')uint(previous,100,1);
    uint(periods,999999,1);
    if(growth!=='n/a'&&!/^-?\d{1,12}(?:\.\d{1,12})?%$/.test(growth))fail('growth_invalid');
    const match=/^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/.exec(url);
    if(!match||ids.has(match[1]))fail('video_invalid');
    ids.add(match[1]);
    const view_count=uint(views,999999999999999);
    if(view_count>previousViews)fail('view_order_invalid');
    previousViews=view_count;
    return {rank:i+1,provider_track_id:match[1],title:credit(title),artist:credit(artist),view_count,provider_url:url};
  });
  return {source_key:'youtube_ke',market:'KE',chart_depth:100,observed_depth:100,
    behavior:'video_consumption',metric:'rank_and_count',status:'succeeded',
    native_period:YOUTUBE_EXPORT_PERIOD_AUTHORITY,native_period_authority:YOUTUBE_EXPORT_PERIOD_AUTHORITY,
    provider_week_ending_date:end,source_period_key:period,candidate_only:true,
    eligible_for_scoring:false,rows};
}
