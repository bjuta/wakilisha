import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const fail=(text)=>{console.error("Workbook font delivery audit failed: "+text);process.exit(1);};
const read=(file)=>fs.readFileSync(file,"utf8");
const index=read("index.html");
const root=read("src/index.css");
const css=read("src/styles/wakilisha-workbook-fonts.css");
const field=read("src/pages/guides/field-guide/styles.css");
const source=read("src/design-system/wakilisha.tokens.css");
const distributed=read("packages/design-system/src/wakilisha.tokens.css");
const manifest=JSON.parse(read("public/assets/fonts/wakilisha-font-manifest.json"));
if(source!==distributed)fail("source and distributed design tokens diverge");
if(!root.includes('@import "./styles/wakilisha-workbook-fonts.css";')||
 root.includes("wakilisha-fonts.css")||root.includes("mobile-v5.css")||
 root.includes("mobile-ch53-75.css"))fail("retired stylesheet still imported");
if(!index.includes("font-src 'self'")||!index.includes("style-src 'self'")||
 /fonts.googleapis.com|fonts.gstatic.com/.test(index))fail("CSP or external font regression");
if(field.includes("@font-face"))fail("obsolete field guide font declaration");
const actualPreloads=[...index.matchAll(/rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin/g)].map(x=>x[1]);
if(actualPreloads.length!==1||actualPreloads[0]!==manifest.root_preload||
 manifest.root_preload!=="/assets/fonts/workbook/figtree-latin.woff2")fail("root preload authority mismatch");
if(manifest.schema!==2||manifest.assets.length!==6||manifest.faces.length!==2)fail("unrecognized Workbook font manifest");
const allowed=new Map([["/assets/fonts/workbook/figtree-latin.woff2","8330490a01c60c196eae00b823de8102275aaa5862e7b76a7af21b8745338928"],["/assets/fonts/workbook/figtree-latin-ext.woff2","f153aa07c1b16fbb12391c2512860c97819a0a9fd014f338b2b3f12496479d13"],["/assets/fonts/workbook/plexmono-400-latin.woff2","c36f509c0a8f9f85f29cb44bc8701d8a9e0b14c499e77a884f789ead7093a7ac"],["/assets/fonts/workbook/plexmono-400-latin-ext.woff2","f1050dc5317b43434c0aeda599d4624c774ffc162e87a8cf204b949b6a85816d"],["/assets/fonts/workbook/plexmono-500-latin.woff2","a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0"],["/assets/fonts/workbook/plexmono-500-latin-ext.woff2","77f03e26f981c582bdba3a7abed4baa2d3149211c01366bb3ab3ba7622ec4ae5"]]);
for(const asset of manifest.assets){
 if(!allowed.has(asset.file)||allowed.get(asset.file)!==asset.sha256)fail("font manifest not source-verified: "+asset.file);
 const disk=path.join("public",asset.file.slice(1));if(!fs.existsSync(disk))fail("font missing: "+disk);
 const bytes=fs.readFileSync(disk);
 if(bytes.toString("ascii",0,4)!=="wOF2"||
  crypto.createHash("sha256").update(bytes).digest("hex")!==asset.sha256)fail("font bytes not authentic: "+disk);
 if(!css.includes(asset.file))fail("font not declared: "+asset.file);
}
for(const file of manifest.licences){
 const disk=path.join("public",file.slice(1));
 if(!/SIL OPEN FONT LICENSE/i.test(read(disk)))fail("font license missing: "+file);
}
for(const value of ["--wk-font-body:'Figtree'","--wk-font-mono:'IBM Plex Mono'","--wk-brand:#85C441"]){
 if(!source.includes(value))fail("Workbook token missing: "+value);
}
for(const file of fs.readdirSync("public/assets/fonts")){
 if(/^wk-font-[a-f\d]+\.woff2$/.test(file))fail("retired design font remains: "+file);
}
const forbidden=new RegExp("\\b(DM Sans|DM Mono|Cormorant Garamond)\\b|wk-font-[a-f0-9]{16}\\.woff2");
function scan(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())scan(full);
  else if(/\.(css|tsx|jsx|ts|js)$/.test(entry.name)&&
   forbidden.test(read(full)))fail("old font authority remains in runtime: "+full);
 }
}
scan("src");
console.log("WAKILISHA_FONT_DELIVERY_AUDIT_PASS Workbook-v4=6 legacy=0");
