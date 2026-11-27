/** Local Docker implementation of the existing DeskLocalBrowserHostV1 contract.
 * The independently reviewed host grant and capacity allocation remain caller-owned.
 * Only Playwright protocol bytes traverse a single local TCP/docker-exec relay.
 * Chromium runs without network, repository, credentials or Docker socket.
 */
import {execFile,spawn} from "node:child_process";
import {createServer} from "node:net";
import {stat,realpath} from "node:fs/promises";
import {resolve} from "node:path";
import {promisify} from "node:util";
import {chromium} from "playwright";

const exec=promisify(execFile);
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SHA=/^[a-f0-9]{64}$/;
const IMAGE=/^sha256:[a-f0-9]{64}$/;
const SERVER=String.raw`
import os from "node:os";
import {writeSync} from "node:fs";
let stage="ISOLATION",server;
try {
 if (process.getuid()===0 || Object.keys(os.networkInterfaces()).some(n=>n!=="lo")) throw Error("isolation");
 stage="IMPORT";
 const {chromium}=await import("/opt/mizizi/node_modules/playwright/index.mjs");
 stage="LAUNCH";
 server=await chromium.launchServer({host:"127.0.0.1",port:0,headless:true});
} catch(error) {
 const msg=String(error?.message??"");
 const category=/Cannot find (package|module)|ERR_MODULE_NOT_FOUND/i.test(msg)?"MODULE":
  /Executable doesn't exist|browser executable/i.test(msg)?"EXECUTABLE":
  /EACCES|EPERM|permission denied/i.test(msg)?"PERMISSION":
  /sandbox/i.test(msg)?"SANDBOX":
  /profile|read.only|EROFS/i.test(msg)?"PROFILE":
  /resource temporarily unavailable|pthread|out of memory/i.test(msg)?"RESOURCE":
  /ENOTFOUND|EADDR|listen/i.test(msg)?"LISTEN":"OTHER";
 writeSync(1,"MIZIZI_BROWSER_START_FAILURE "+stage+"_"+category+"\n");
 process.exitCode=41;
 process.exit(41);
}
process.stdout.write("MIZIZI_BROWSER_READY "+server.wsEndpoint()+"\n");
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;try{await server.close();}finally{process.exit(0);}};
process.on("SIGTERM",stop);process.on("SIGINT",stop);
`;
const RELAY=String.raw`
const net=require("node:net");
const port=Number(process.argv[1]);
if(!Number.isSafeInteger(port)||port<1||port>65535)process.exit(41);
const socket=net.createConnection({host:"127.0.0.1",port});
socket.on("error",()=>process.exit(42));
socket.on("close",()=>process.exit(0));
process.stdin.on("error",()=>socket.destroy());
process.stdout.on("error",()=>socket.destroy());
process.stdin.pipe(socket);socket.pipe(process.stdout);
`;
const fail=code=>{throw Error("MIZIZI_DOCKER_BROWSER_"+code);};
const docker=async(args,timeout=10000)=>{
 const result=await exec("docker",["--host","unix:///var/run/docker.sock",...args],{timeout,maxBuffer:64*1024,windowsHide:true});
 return result.stdout.trim();
};
const delay=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal.aborted){reject(Error("MIZIZI_DOCKER_BROWSER_ABORTED"));return;}
 const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve();},ms);
 const abort=()=>{clearTimeout(timer);reject(Error("MIZIZI_DOCKER_BROWSER_ABORTED"));};
 signal.addEventListener("abort",abort,{once:true});
});

export async function createDockerDeskBrowserHostV1({accountFingerprint,imageId,dependenciesDirectory,authorizeHost,captureVisual=false}={}){
 if(!SHA.test(accountFingerprint??"")||!IMAGE.test(imageId??"")||typeof authorizeHost!=="function"||
    typeof dependenciesDirectory!=="string"||process.platform!=="linux")fail("CONFIGURATION");
 const dependencies=await realpath(resolve(dependenciesDirectory));
 if(!dependencies.endsWith("/node_modules")||!(await stat(resolve(dependencies,"playwright/index.mjs"))).isFile()||
    /[:,\r\n]/.test(dependencies))fail("DEPENDENCIES");
 if(await docker(["image","inspect","--format","{{.Id}}",imageId])!==imageId)fail("IMAGE_UNCONFIRMED");
 const uid=process.getuid(),gid=process.getgid();
 if(!Number.isSafeInteger(uid)||uid<1||!Number.isSafeInteger(gid)||gid<1)fail("NON_ROOT_REQUIRED");
 const active=new Map(),closed=new Set();
 const nameOf=id=>"mizizi-browser-"+id;
 const absent=async name=>(await docker(["ps","-a","--filter","name=^/"+name+"$","--format","{{.Names}}"],2500))==="";
 async function close(id,signal){
  if(!UUID.test(id??"")||!signal||signal.aborted)return false;
  if(closed.has(id))return true;
  const s=active.get(id);if(!s)return false;
  if(!s.cleanup){
   s.closing=true;
   s.signal?.removeEventListener("abort",s.onAbort);
   s.socket?.destroy();s.relay?.kill("SIGKILL");s.server?.close();
   // Await in-flight create/start before removal; never claim an absent
   // container if its create operation may still be running.
   s.cleanup=(async()=>{
    try{
     await s.create?.catch(()=>{});await s.start?.catch(()=>{});
     await docker(["rm","-f",s.name],2500).catch(()=>{});
     if(!await absent(s.name))return false;
     active.delete(id);closed.add(id);return true;
    }catch{return false;}
   })();
  }
  const result=await s.cleanup;
  return result===true&&!signal.aborted;
 }
 async function open(binding,id,signal){
  if(!UUID.test(id??"")||!signal||signal.aborted||active.size||closed.has(id)||
    binding?.accountFingerprint!==accountFingerprint||binding?.reserveSeconds!==120||binding?.mode!=="interactive"||
    !Number.isFinite(Date.parse(binding?.scope?.leaseExpiresAt))||Date.parse(binding.scope.leaseExpiresAt)<=Date.now())fail("SCOPE");
  const s={name:nameOf(id),signal,closing:false};active.set(id,s);
  let stage="CREATE";
  s.onAbort=()=>{void close(id,AbortSignal.timeout(5000));};
  signal.addEventListener("abort",s.onAbort,{once:true});
  const live=()=>{if(signal.aborted||s.closing)fail("ABORTED");};
  try{
   live();
   s.create=docker(["create","--name",s.name,"--pull","never","--network","none","--cap-drop","ALL",
    "--security-opt","no-new-privileges","--user",uid+":"+gid,"--read-only",
    "--tmpfs","/tmp:rw,nosuid,nodev,size=512m","--shm-size","256m","--pids-limit","256","--memory","1536m",
    "-e","HOME=/tmp","--mount","type=bind,source="+dependencies+",target=/opt/mizizi/node_modules,readonly",
    imageId,"node","--input-type=module","-e",SERVER],15000);
   await s.create;live();
   stage="ISOLATION";
   const isolation=await docker(["inspect","--format","{{.HostConfig.NetworkMode}}|{{.HostConfig.ReadonlyRootfs}}|{{.HostConfig.Privileged}}",s.name]);
   if(isolation!=="none|true|false")fail("ISOLATION_UNCONFIRMED");
   live();stage="START";s.start=docker(["start",s.name]);await s.start;live();
   stage="READY";let endpoint=null;
   const expires=Math.min(Date.now()+20000,Date.parse(binding.scope.leaseExpiresAt));
   while(Date.now()<expires){
    live();const log=await docker(["logs",s.name],2500);
    const failure=log.split("\n").find(line=>/^MIZIZI_BROWSER_START_FAILURE [A-Z_]+$/.test(line));
    if(failure)fail("SERVER_"+failure.split(" ")[1]);
    const state=await docker(["inspect","--format","{{.State.Running}}|{{.State.ExitCode}}",s.name],2500);
    if(/^false\|[0-9]+$/.test(state)){
     const final=await docker(["logs",s.name],2500);
     const reason=final.split("\n").find(line=>/^MIZIZI_BROWSER_START_FAILURE [A-Z_]+$/.test(line));
     if(reason)fail("SERVER_"+reason.split(" ")[1]);
     fail("SERVER_EXIT_"+state.split("|")[1]);
    }
    const match=log.split("\n").find(line=>line.startsWith("MIZIZI_BROWSER_READY "));
    if(match){
     const u=new URL(match.slice("MIZIZI_BROWSER_READY ".length));
     if(u.protocol!=="ws:"||u.hostname!=="127.0.0.1"||!u.port||
        !/^\/[a-zA-Z0-9/_-]{8,200}$/.test(u.pathname)||u.username||u.password||u.search||u.hash)
       fail("ENDPOINT_DENIED");
     endpoint=u;break;
    }
    await delay(100,signal);
   }
   if(!endpoint)fail("START_UNCONFIRMED");
   stage="RELAY";let connected=false;
   s.server=createServer(socket=>{
    if(s.closing||signal.aborted||connected){socket.destroy();return;}
    connected=true;s.socket=socket;
    const relay=spawn("docker",["--host","unix:///var/run/docker.sock","exec","-i",s.name,"node","-e",RELAY,endpoint.port],
      {stdio:["pipe","pipe","ignore"],windowsHide:true});
    s.relay=relay;
    const stop=()=>{socket.destroy();relay.kill("SIGKILL");};
    socket.on("error",stop);socket.on("close",stop);
    relay.on("error",stop);relay.on("exit",stop);
    relay.stdin.on("error",stop);relay.stdout.on("error",stop);
    socket.pipe(relay.stdin);relay.stdout.pipe(socket);
   });
   await new Promise((resolve,reject)=>{
    s.server.once("error",reject);
    s.server.listen(0,"127.0.0.1",resolve);
   });
   live();
   const address=s.server.address();
   if(!address||typeof address==="string")fail("RELAY_UNCONFIRMED");
   stage="CONNECT";const browser=await chromium.connect("ws://127.0.0.1:"+address.port+endpoint.pathname,{timeout:Math.max(1,Math.min(10000,expires-Date.now()))});
   live();return browser;
  }catch(error){
   await close(id,AbortSignal.timeout(5000));
   const known=String(error?.message??"");
   if(/^MIZIZI_DOCKER_BROWSER_[A-Z_0-9]+$/.test(known))throw Error(known);
   fail("OPEN_"+stage+"_UNCONFIRMED");
  }
 }
 return Object.freeze({accountFingerprint,captureVisual:captureVisual===true,authorizeHost,open,close});
}
