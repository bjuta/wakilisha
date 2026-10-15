import {describe,it,expect,vi} from "vitest";
import {admitExactCaseResearchJobV1,parseExactResearchArgsV1}
 from "../../scripts/registry/agents/mizizi/runtime/run-exact-case-research-job";

const caseId="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const workspaceId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const jobId="11111111-1111-4111-8111-111111111111";
const receiptId="ffffffff-ffff-4fff-8fff-ffffffffffff";
const command={caseId,workspaceId,expectedRevision:2,
 reason:"Review independent source evidence before changing this case."};
function executor(login="mizizi_executor",outcome="created"){
 return vi.fn(async (sql:string,values:readonly unknown[])=>{
   if(sql.includes("session_user::text"))return {rowCount:1,rows:[{login_role:login}]};
   if(sql.includes("admit_case_research_job_v1"))return {rowCount:1,rows:[{
      case_id:caseId,workspace_id:workspaceId,resource_id:caseId,
      case_revision:2,command_receipt_id:receiptId,job_id:jobId,
      job_status:"queued",outcome,
   }]};
   throw new Error("UNEXPECTED SQL");
 });
}
describe("exact JIT admitted case -> shared research job",()=>{
 it("adopts existing SQL receipt with two queries and deterministic replay key",async()=>{
   const q=executor();
   const result=await admitExactCaseResearchJobV1(q,command);
   expect(result).toMatchObject({caseId,jobId,commandReceiptId:receiptId,outcome:"created"});
   expect(q).toHaveBeenCalledTimes(2);
   const [sql,values]=q.mock.calls[1];
   expect(sql).toContain("admit_case_research_job_v1");
   expect(sql).not.toMatch(/\b(insert|update|delete|grant|create role)\b/i);
   expect(values.slice(0,4)).toEqual([caseId,workspaceId,2,"system:mizizi"]);
   expect(values[4]).toBe("mizizi.case_research_v1."+caseId+".2");
   expect(values[5]).toMatch(/^[0-9a-f]{64}$/);
 });
 it("only admits with actual session_user mizizi_executor",async()=>{
   for(const role of ["postgres","service_role","authenticated","anon"]){
     const q=executor(role);
     await expect(admitExactCaseResearchJobV1(q,command)).rejects.toThrow(/REAL_JIT_LOGIN_REQUIRED/);
     expect(q).toHaveBeenCalledTimes(1);
   }
 });
 it("exact same case and revision replays the same durable receipt",async()=>{
   const first=executor(),replayed=executor("mizizi_executor","replayed");
   await admitExactCaseResearchJobV1(first,command);
   const receipt=await admitExactCaseResearchJobV1(replayed,command);
   expect(receipt.outcome).toBe("replayed");
   expect(first.mock.calls[1][1]).toEqual(replayed.mock.calls[1][1]);
 });
 it("malformed case, revision, reason cannot even reach JIT login",async()=>{
   const q=executor();
   for(const request of [
     {...command,caseId:"invalid"},
     {...command,workspaceId:"invalid"},
     {...command,expectedRevision:0},
     {...command,reason:"short"},
   ])await expect(admitExactCaseResearchJobV1(q,request)).rejects.toThrow();
   expect(q).not.toHaveBeenCalled();
 });
 it("does not invent success when the database denies the human stage",async()=>{
   const q=executor();
   q.mockResolvedValueOnce({rowCount:1,rows:[{login_role:"mizizi_executor"}]});
   q.mockRejectedValueOnce(new Error("55000: current stage is triage"));
   await expect(admitExactCaseResearchJobV1(q,command)).rejects.toThrow(/triage/);
   expect(q).toHaveBeenCalledTimes(2);
 });
 it("argument contract is exact, reviewed and explicitly confirmed",()=>{
   const args=["--case-id="+caseId,"--workspace-id="+workspaceId,
      "--revision=2","--reason="+command.reason,
      "--confirm=MIZIZI_JIT_READ_ONLY_CASE_RESEARCH"];
   expect(parseExactResearchArgsV1(args)).toEqual(command);
   expect(Object.isFrozen(parseExactResearchArgsV1(args))).toBe(true);
   for(const altered of [
     args.filter(a=>!a.startsWith("--confirm")),
     [...args,"--other=yes"],
     [...args,args[0]],
     args.map(a=>a.startsWith("--revision=")?"--revision=0":a),
     args.map(a=>a.startsWith("--reason=")?"--reason=short":a),
     args.map(a=>a.startsWith("--confirm=")?"--confirm=yes":a),
   ]) expect(()=>parseExactResearchArgsV1(altered)).toThrow();
 });
});
