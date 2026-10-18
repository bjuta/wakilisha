import fs from "node:fs";
const project="nkgfoppunmnkcumalxqp";
function stop(x){throw Error("MIZIZI_PROVIDER_HEALTH_STOP_"+x);}
async function main(){
 if(process.env.GITHUB_ACTIONS!=="true"||
    process.env.GITHUB_REPOSITORY!=="bjuta/wakilisha"||
    process.env.GITHUB_HEAD_REF!=="feat/mizizi-slice2-adaptive-multipass-investigation"||
    process.env.MIZIZI_PREVIEW_PROJECT_REF!==project)stop("WRONG_ENVIRONMENT");
 const file=process.argv[2];
 if(!file||!process.env.RUNNER_TEMP||!file.startsWith(process.env.RUNNER_TEMP+"/"))
  stop("TEMP_FILE_REQUIRED");
 let obj;
 try{obj=JSON.parse(fs.readFileSync(file,"utf8"));}
 finally{fs.rmSync(file,{force:true});}
 const a=Array.isArray(obj)?obj:(obj.result||obj.data||[]);
 const keys=a.filter(x=>x.name==="service_role"||x.role==="service_role"||x.type==="service_role");
 if(keys.length!==1)stop("UNIQUE_SERVICE_KEY_UNAVAILABLE");
 const key=keys[0].api_key||keys[0].key||keys[0].value;
 if(typeof key!=="string"||!key.startsWith("eyJ"))stop("SERVICE_JWT_UNAVAILABLE");
 const claims=JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString("utf8"));
 if(claims.role!=="service_role")stop("WRONG_KEY_ROLE");
 console.log("::add-mask::"+key);
 const res=await fetch("https://"+project+".supabase.co/functions/v1/mizizi-research-runner",{
  method:"POST",redirect:"error",
  headers:{Authorization:"Bearer "+key,apikey:key,"Content-Type":"application/json"},
  body:JSON.stringify({action:"provider_health_system"}),
  signal:AbortSignal.timeout(24000)
 });
 const result=await res.json();
 console.log("MIZIZI_PREVIEW_PROVIDER_HEALTH="+JSON.stringify({
  edgeHttpStatus:res.status,model:result.model??null,
  providerHttpStatus:result.providerHttpStatus??null,
  providerAccessConfirmed:result.providerAccessConfirmed===true,
  caseClaimed:result.caseClaimed??null
 }));
 if(res.status!==200||result.caseClaimed!==false||result.registryMutations!==0)
  stop("PROTECTED_MODEL_PREFLIGHT_FAILED");
 if(result.providerAccessConfirmed!==true)
  stop("EXISTING_ANTHROPIC_MODEL_NOT_ACCESSIBLE");
}
main().catch(e=>{console.error(e.message.startsWith("MIZIZI_PROVIDER_HEALTH_STOP_")?e.message:"MIZIZI_PROVIDER_HEALTH_STOP_UNCLASSIFIED");process.exitCode=1;});
