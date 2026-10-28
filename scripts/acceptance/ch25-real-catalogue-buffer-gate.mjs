#!/usr/bin/env node
// WAKILISHA Chapter 25 candidate-only REAL-CATALOGUE / real-media acceptance.
// Uses installed Mac Playwright and a locally built candidate frontend, served
// under the real production origin only within two isolated browser contexts.
// NO mocked catalogue, media responses, changes to Production, or GitHub Actions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const expected = 'f68b0c77cc7d15485bacc8d9871b7ef714c410eb';
const repo = path.join(os.homedir(), 'Downloads', 'wk-ch25-buffer-runtime-20261028');
const outdir = path.join(os.homedir(), 'Downloads', 'wakilisha-ch25-repair-browser-evidence');
const origin = 'https://wakilisha.africa';
const releasePath = '/releases/mejja/mtoto-wa-khadija/';
const fullUrl = origin + releasePath;
if (!fs.existsSync(path.join(repo, '.git'))) throw Error(`Expected detached worktree absent: ${repo}`);
const actual = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actual !== expected) throw Error(`Refuse non-proven candidate: expected ${expected}, got ${actual}`);
const dist = path.join(repo, 'dist');
const html = path.join(dist, 'index.html');
if (!fs.existsSync(html)) throw Error(`Candidate build absent: ${html}`);
const require = createRequire(path.join(repo, 'package.json'));
const { chromium, webkit, devices } = require('playwright');
fs.mkdirSync(outdir, { recursive: true });

function browserInstrumentation() {
  const monitor = { audios: [], sources: [], analysers: [], gains: [], contexts: [],
    playRejects: [], fetches: [], sourceStarts: 0, mediaSourceAttachments: 0 };
  Object.defineProperty(window, '__wkCh25RealBufferMonitor', { value: monitor });
  const NativeAudio = window.Audio;
  window.Audio = new Proxy(NativeAudio, {
    construct(Target, args, NewTarget) {
      const a = Reflect.construct(Target, args, NewTarget);
      monitor.audios.push(a);
      return a;
    },
    apply(Target, thisArg, args) {
      const a = Reflect.construct(Target, args);
      monitor.audios.push(a);
      return a;
    },
  });
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    let result;
    try { result = nativePlay.apply(this, args); }
    catch (error) {
      monitor.playRejects.push(String(error?.name || error).slice(0,80));
      throw error;
    }
    result?.catch?.(error => {
      if (monitor.playRejects.length < 12) monitor.playRejects.push(String(error?.name || error).slice(0,80));
    });
    return result;
  };
  const NativeContext = window.AudioContext || window.webkitAudioContext;
  if (!NativeContext) return;
  const createSource = NativeContext.prototype.createBufferSource;
  const createGain = NativeContext.prototype.createGain;
  const createAnalyser = NativeContext.prototype.createAnalyser;
  const createMedia = NativeContext.prototype.createMediaElementSource;
  NativeContext.prototype.createBufferSource = function (...args) {
    const s = createSource.apply(this,args);
    monitor.sources.push(s);
    const originalStart = s.start;
    s.start = function (...values) { monitor.sourceStarts++; return originalStart.apply(this,values); };
    return s;
  };
  NativeContext.prototype.createGain = function (...args) {
    const g = createGain.apply(this,args);
    monitor.gains.push(g);
    return g;
  };
  NativeContext.prototype.createAnalyser = function (...args) {
    const a = createAnalyser.apply(this,args);
    monitor.analysers.push(a);
    return a;
  };
  NativeContext.prototype.createMediaElementSource = function (...args) {
    monitor.mediaSourceAttachments++;
    return createMedia.apply(this,args);
  };
  window.AudioContext = new Proxy(NativeContext, {
    construct(Target, args, NewTarget) {
      const c = Reflect.construct(Target, args, NewTarget);
      monitor.contexts.push(c);
      return c;
    }
  });
}

async function snapshot(page, label) {
  return page.evaluate((label) => {
    const p = window.__wkCh25RealBufferMonitor;
    let peaks = [];
    for (const analyser of p?.analysers || []) {
      const pcm = new Float32Array(analyser.fftSize);
      try { analyser.getFloatTimeDomainData(pcm); } catch {}
      let peak = 0;
      for (const v of pcm) peak = Math.max(peak,Math.abs(v));
      peaks.push(Number(peak.toFixed(5)));
    }
    const audios = (p?.audios || []).map(a => ({
      src: (()=>{ try {const u=new URL(a.currentSrc||a.src); return {
        host:u.hostname, class:u.pathname.startsWith('/__wk-mix/')?'wakilisha-mix-proxy':
        u.pathname.includes('/itunes-assets/AudioPreview')?'itunes-preview':'other'};}
        catch {return {class:'absent'};} })(),
      paused:a.paused, ended:a.ended,
      time:Number(a.currentTime.toFixed(2)),
      duration:Number.isFinite(a.duration)?Number(a.duration.toFixed(2)):null,
      readyState:a.readyState,error:a.error?.code??null,
    }));
    const gains = (p?.gains || []).map(g => Number(g.gain.value.toFixed(5)));
    const title = document.querySelector('[data-wk-player-overlay] [data-wk-player-full] h1')?.textContent?.trim() ||
      document.querySelector('[data-wk-player-compact]')?.textContent?.slice(0,110).trim() || '';
    return {
      label, at:Date.now(), title,
      contexts:(p?.contexts||[]).map(c=>({state:c.state,seconds:Number(c.currentTime.toFixed(2))})),
      sources:(p?.sources||[]).length,
      starts:p?.sourceStarts||0,
      analysers:peaks,
      gains,
      mediaSourceAttachments:p?.mediaSourceAttachments||0,
      audios,
      playRejects:p?.playRejects||[],
      dualPCM:peaks.filter(v=>v>0.0005).length>=2,
      dualGains:gains.filter(v=>v>0.05).length>=3,
    };
  },label);
}

async function inspect(engineName, browserType) {
  const result = {engine:engineName,candidateHead:expected,release:fullUrl,
    verdict:'UNTESTED', checks:[], network:[], errors:[], warnings:[], observations:[], assetOverlay:{documents:0,assets:0,missing:[]}};
  let browser,context,page;
  try {
    browser = await browserType.launch({headless:true});
    context = await browser.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
    page = await context.newPage();
    page.on('pageerror',e=>{if(result.errors.length<10)result.errors.push(String(e.message).slice(0,180));});
    page.on('requestfailed',request=>{
      if(result.network.length>=25)return;
      try {const u=new URL(request.url());result.network.push({host:u.hostname,pathClass:u.pathname.startsWith('/__wk-mix/')?'mix-proxy':u.pathname.includes('/itunes-assets/')?'itunes-preview':'other',failure:request.failure()?.errorText?.slice(0,110)});}catch{}
    });
    page.on('response',response=>{
      if(result.network.length>=25)return;
      try {const u=new URL(response.url());if(u.pathname.startsWith('/__wk-mix/')||u.pathname.includes('/itunes-assets/AudioPreview'))result.network.push({host:u.hostname,pathClass:u.pathname.startsWith('/__wk-mix/')?'mix-proxy':'itunes-preview',status:response.status()});}catch{}
    });
    page.on('console',msg=>{if(msg.type()==='error'&&result.warnings.length<15)result.warnings.push(msg.text().slice(0,160));});
    await page.route('https://wakilisha.africa/**', async route=>{
      const request=route.request();const u=new URL(request.url());
      if(request.resourceType()==='document'&&u.pathname===releasePath){
        result.assetOverlay.documents++;
        return route.fulfill({status:200,path:html,contentType:'text/html; charset=utf-8'});
      }
      if(u.pathname.startsWith('/assets/')){
        const relative=decodeURIComponent(u.pathname);
        const file=path.resolve(dist,'.'+relative);
        if(file.startsWith(dist+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
          result.assetOverlay.assets++;
          const ext=path.extname(file).toLowerCase();
          const type={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[ext]||'application/octet-stream';
          return route.fulfill({path:file,contentType:type});
        }
        if(result.assetOverlay.missing.length<15)result.assetOverlay.missing.push(relative);
      }
      return route.continue();
    });
    await page.addInitScript(browserInstrumentation);
    const documentResponse=await page.goto(fullUrl,{waitUntil:'domcontentloaded',timeout:45000});
    result.http=documentResponse?.status()??null;
    if(result.http!==200||result.assetOverlay.documents!==1||result.assetOverlay.assets===0||result.assetOverlay.missing.length){
      result.verdict='CANDIDATE_ASSET_OVERLAY_NOT_READY';return result;
    }
    const play=page.getByRole('button',{name:/^Play$/i}).first();
    await play.waitFor({state:'visible',timeout:15000});
    if(await play.isDisabled()){result.verdict='REAL_PUBLIC_RELEASE_NOT_PLAYABLE';return result;}
    await play.click();
    try {await page.waitForFunction(()=>{
      const p=window.__wkCh25RealBufferMonitor;
      return (p?.audios||[]).some(a=>!a.paused&&!a.ended&&a.currentTime>.3);
    },null,{timeout:12500,polling:150});}
    catch {result.verdict='REAL_NATIVE_PREVIEW_DID_NOT_PROGRESS';result.observations.push(await snapshot(page,'native-failed'));return result;}
    result.checks.push({name:'real-native-preview-progresses',pass:true});
    result.observations.push(await snapshot(page,'native-preview-started'));
    const compact=page.locator('[data-wk-player-compact="mobile"]');
    await compact.waitFor({state:'visible',timeout:10000});
    await compact.getByRole('button').first().click();
    const expanded=page.locator('[data-wk-player-overlay]');
    await expanded.waitFor({state:'visible',timeout:12000});
    await expanded.getByRole('button',{name:'More Player actions'}).click();
    await page.getByRole('button',{name:/Transitions/}).last().click();
    const smart=page.getByRole('radio',{name:/Smart Mix/}).last();
    await smart.click();
    const checked=await smart.getAttribute('aria-checked');
    result.checks.push({name:'real-player-smart-mix-selected',pass:checked==='true'});
    if(checked!=='true'){result.verdict='SMART_MIX_SELECTION_FAILED';return result;}
    result.observations.push(await snapshot(page,'smart-mix-selected'));
    const firstTitle=await page.locator('[data-wk-player-overlay] [data-wk-player-full] h1').first().textContent();
    const start=Date.now();
    // Observe a natural transition, no fake time, no seek and no mock audio.
    // 40 seconds also bounds potential provider/ingress hangs.
    let dual=false, advanced=false, best={pcm:0,gains:0,sourceCount:0};
    for(let i=0;i<320;i++){
      await page.waitForTimeout(125);
      const s=await snapshot(page,`natural-${i}`);
      result.observations.push(s);
      best.pcm=Math.max(best.pcm,s.analysers.filter(v=>v>0.0005).length);
      best.gains=Math.max(best.gains,s.gains.filter(v=>v>0.05).length);
      best.sourceCount=Math.max(best.sourceCount,s.sources);
      dual ||= s.dualPCM&&s.dualGains&&s.sources>=2&&s.mediaSourceAttachments===0;
      advanced ||= Boolean(firstTitle&&s.title&&s.title!==firstTitle);
      if(dual&&advanced)break;
      if(Date.now()-start>45000)break;
    }
    result.maximums=best;
    result.checks.push({name:'real-public-media-dual-decoded-pcm-and-three-nonzero-gains',pass:dual});
    result.checks.push({name:'real-release-queue-advances-in-full-player',pass:advanced});
    result.checks.push({name:'no-html-media-source-attachments',pass:result.observations.every(s=>s.mediaSourceAttachments===0)});
    const mediaErrors=result.network.filter(entry=>entry.pathClass==='mix-proxy' &&
      ((entry.status && entry.status>=400) || entry.failure));
    result.verdict=dual&&advanced?'REAL_CATALOGUE_BUFFER_PCM_OVERLAP_PASS':
      mediaErrors.some(entry=>entry.status>=400)?'REAL_MIX_MEDIA_HTTP_REJECTED':
      mediaErrors.length?'REAL_MIX_MEDIA_NETWORK_FAILED':
      best.sourceCount===0?'BUFFER_HANDOFF_DID_NOT_ACTIVATE':
      best.sourceCount===1?'NEXT_REAL_PREVIEW_NOT_DECODED_OR_TRANSITION_NOT_REACHED':
      best.pcm<2?'REAL_MEDIA_DUAL_PCM_NOT_PROVEN':
      best.gains<3?'REAL_MEDIA_DUAL_GAIN_NOT_PROVEN':
      !advanced?'REAL_MEDIA_QUEUE_ADVANCE_NOT_PROVEN':'REAL_CATALOGUE_INCOMPLETE';
    return result;
  }catch(err){
    result.verdict='HARNESS_OR_PUBLIC_ROUTE_STOPPED';
    result.error=String(err?.message||err).slice(0,1100);
    if(page)await page.screenshot({path:path.join(outdir,`ch25-real-${engineName}-failure.png`),fullPage:false}).catch(()=>{});
    return result;
  }finally{
    await context?.close().catch(()=>{});
    await browser?.close().catch(()=>{});
  }
}

const results=[];
for(const [name,type] of [['webkit-iphone-profile',webkit],['chromium-mobile',chromium]]){
  const r=await inspect(name,type);results.push(r);
  console.log(`CH25_REAL_CATALOGUE_${name.toUpperCase().replaceAll('-','_')}=${r.verdict}`);
  console.log(`CH25_${name.toUpperCase().replaceAll('-','_')}_CHECKS=${JSON.stringify(r.checks)}`);
  console.log(`CH25_${name.toUpperCase().replaceAll('-','_')}_MAXIMUMS=${JSON.stringify(r.maximums||{})}`);
  if(r.error)console.log(`CH25_${name.toUpperCase().replaceAll('-','_')}_ERROR=${r.error}`);
  if(r.network.length)console.log(`CH25_${name.toUpperCase().replaceAll('-','_')}_MEDIA_NETWORK=${JSON.stringify(r.network.filter(x=>x.pathClass==='mix-proxy'||x.pathClass==='itunes-preview').slice(0,12))}`);
  // First unexplained real-client failure stops subsequent runs, per deployment authority.
  if(r.verdict!=='REAL_CATALOGUE_BUFFER_PCM_OVERLAP_PASS')break;
}
const json=path.join(outdir,'ch25-real-catalogue-buffer-results.json');
fs.writeFileSync(json,JSON.stringify({expected,productionOrigin:origin,release:fullUrl,
  notice:'Candidate assets isolated inside Playwright; real public catalogue and media; no Production deployment. WebKit iPhone profile is not physical iOS Safari.',results},null,2));
console.log(`CH25_REAL_CATALOGUE_EVIDENCE=${json}`);
if(!results.length||results.some(x=>x.verdict!=='REAL_CATALOGUE_BUFFER_PCM_OVERLAP_PASS')||results.length<2)process.exitCode=2;
