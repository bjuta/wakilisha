import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  projectMiziziWk100RegistryCandidates as candidates,
  wk100CandidateTitleKey,
  MIZIZI_WK100_CANDIDATE_CONTRACT,
} from '../../supabase/functions/_shared/mizizi-wk100-registry-candidates.mjs';

const mboka='4a610192-c5bf-483c-9e4b-bf715836d640';
const siaka='208e0284-93b8-43fd-991e-b17ffa624c4b';
const freestyle='62525a7c-c582-48b6-93dc-a10496fbc626';
const mejja='efdf79dc-9280-406a-b6e3-f8672f6b783f';
const waka='77777777-7777-4777-8777-777777777777';
const track=(id,title,isrc)=>({id,title,normalized_title:wk100CandidateTitleKey(title),
  status:'active',isrc});
const row=(title,artist,identityState='needs_review')=>({
  observedTitle:title,observedArtist:artist,providerArtistName:null,
  providerTrackId:null,canonicalTrackId:null,identityState,
});
const base=()=>{
  const registryTracks=[track(mboka,'Mboka','QZQAY2651792'),
    track(siaka,'Siaka','QZTLA2696488'),
    track(freestyle,'Freestyle','QZTAS2181684')];
  const registryCredits=[
    {track_id:mboka,artist_id:mejja,status:'active'},
    {track_id:siaka,artist_id:mejja,status:'active'},
    {track_id:freestyle,artist_id:waka,status:'active'},
  ];
  const registryArtists=[
    {id:mejja,display_name:'Mejja',status:'active'},
    {id:waka,display_name:'Wakadinali',status:'active'},
  ];
  return {registryTracks,registryCredits,registryArtists};
};

test('Mboka and Siaka are proposed from existing active Registry credits, never resolved',()=>{
 const source=[row('Mboka','Mejja'),row('Mboka','Mejja Genge'),
   row('Siaka','Mejja, Fik Fameica'),row('Freestyle','Lil Baby')];
 const result=candidates({...base(),rows:source});
 assert.equal(result.contractVersion,MIZIZI_WK100_CANDIDATE_CONTRACT);
 assert.equal(result.candidateRows,3);
 assert.equal(result.rows[0].registryCandidates[0].trackId,mboka);
 assert.equal(result.rows[0].registryCandidates[0].basis,'exact_artist_credit');
 assert.equal(result.rows[1].registryCandidates[0].basis,'artist_credit_variant');
 assert.equal(result.rows[2].registryCandidates[0].basis,'listed_artist_credit');
 assert.deepEqual(result.rows[3].registryCandidates,[]);
 for(let i=0;i<source.length;i++){
   assert.equal(result.rows[i].canonicalTrackId,null);
   assert.equal(result.rows[i].identityState,'needs_review');
 }
 assert.deepEqual([result.canWriteRegistry,result.canScore,result.canPublish],[false,false,false]);
});
test('accepted Artist alias is only a research clue; pending alias cannot create a lead',()=>{
 const registryAliases=[{canonical_artist_id:mejja,alias_display_name:'Mejja Genge',status:'active'}];
 const accepted=candidates({...base(),registryAliases,rows:[row('Mboka','Mejja Genge')]});
 assert.equal(accepted.candidateRows,1);
 assert.equal(accepted.rows[0].registryCandidates[0].basis,'exact_artist_credit');
 assert.equal(accepted.rows[0].canonicalTrackId,null);
 const unapproved=candidates({...base(),registryAliases:[{...registryAliases[0],status:'pending'}],
   rows:[row('Mboka','Entirely Different Performer')]});
 assert.equal(unapproved.candidateRows,0);
});
test('same title, unrelated Artist is not a candidate, even with a real ISRC on the Registry Track',()=>{
 const out=candidates({...base(),rows:[row('Freestyle','Lil Baby'),row('Mboka','Completely Different'),
   row('Freestyle','Wakadinali')]});
 assert.deepEqual(out.rows[0].registryCandidates,[]);
 assert.deepEqual(out.rows[1].registryCandidates,[]);
 assert.equal(out.rows[2].registryCandidates[0].trackId,freestyle);
 assert.equal(out.rows[2].registryCandidates[0].identifierCorroborated,false);
});
test('Shazam missing provider ID is a lead at most; existing resolved Track receives no new claim',()=>{
 const out=candidates({...base(),rows:[
   row('Mboka','Mejja'),row('Mboka','Mejja','resolved'),
   row('Siaka',null),
 ]});
 assert.equal(out.rows[0].registryCandidates.length,1);
 assert.deepEqual(out.rows[1].registryCandidates,[]);
 assert.deepEqual(out.rows[2].registryCandidates,[]);
 assert.equal(out.rows[0].providerTrackId,null);
});
test('inactive, uncredited, and overflow Registry inputs fail closed',()=>{
 const b=base();b.registryTracks[0].status='needs_review';
 assert.equal(candidates({...b,rows:[row('Mboka','Mejja')]}).candidateRows,0);
 assert.throws(()=>candidates({...base(),rows:Array.from({length:201},()=>row('Mboka','Mejja'))}),
   /input_unbounded/);
 assert.throws(()=>candidates({...base(),registryCredits:Array(1601).fill({}),
   rows:[row('Mboka','Mejja')]}),/input_unbounded/);
});
