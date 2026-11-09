import test from 'node:test';
import assert from 'node:assert/strict';
import {projectWk100EligibilityPreview as project} from '../../supabase/functions/_shared/wk100-eligibility-preview.mjs';
const W='2026-11-09', T='11111111-1111-4111-8111-111111111111', A='22222222-2222-4222-8222-222222222222';
const R='33333333-3333-4333-8333-333333333333';
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?
  Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
async function digest(v){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(canonical(v))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function fixture(){
 const profile={id:'elig_kenyan',name:'Kenya',slug:'kenya',visibility:'admin_only',
  artistOriginEligibility:{mode:'country_only',countries:['KE'],regions:[]},
  artistGenderEligibility:{mode:'any'},artistTypeEligibility:{mode:'any'},
  releaseEligibility:{releaseTypes:['single'],includeReissues:true,includeRemixes:true,includeAcousticVersions:true,includeInstrumentals:true},
  trackEligibility:{explicitAllowed:true,requireIsrc:false,requirePreview:false},
  collaborationRules:{allowFeaturedArtists:true,countFeaturedArtistNationality:false,
    primaryArtistMustMatchEligibility:true,allArtistsMustMatchEligibility:false},
  sourceRules:{allowedProviders:['mdundo_ke'],requireAtLeastOneProviderId:true,
    requireProviderAvailabilityInMarket:false},
  reviewRules:{requireManualReviewForUnknownGender:false,requireManualReviewForUnknownNationality:true,
    requireManualReviewForUnknownArtistType:false,requireManualReviewForGroups:false,
    allowUnknownMetadataWithWarning:false}};
 const scope={id:'scope_kenya',slug:'kenya',primaryMarketSlug:'kenya',
  includedMarkets:[{marketSlug:'kenya',countryCode:'KE'}],aggregationMode:'combined',
  artistOriginCountries:['KE'],artistOriginUnknownMode:'exclude'};
 const config={schemaVersion:'wk100-admin-edition-config/v1',programId:'top100',
  weekStartEat:W,market:'KE',chartSize:100,eligibilityProfileId:'elig_kenyan',
  marketScopeId:'scope_kenya',eligibilityProfileSnapshot:profile,marketScopeSnapshot:scope,
  ingestPolicySha256:await digest({profileId:'elig_kenyan',marketScopeId:'scope_kenya',
    eligibilityProfileSnapshot:profile,marketScopeSnapshot:scope})};
 const one={captureRowId:'44444444-4444-4444-8444-444444444444',rank:1,
  observedTitle:'Song One',observedArtist:'Artist One',providerTrackId:'mdundo1',
  canonicalTrackId:T,identityState:'resolved',reviewReason:null,provisionalRef:null};
 const two={captureRowId:'55555555-5555-4555-8555-555555555555',rank:2,
  observedTitle:'Song Two',observedArtist:'Artist Two',providerTrackId:'mdundo2',
  canonicalTrackId:null,identityState:'needs_review',reviewReason:'provider_link_missing',
  provisionalRef:'wk100:obs:v1:'+'a'.repeat(64)+':55555555-5555-4555-8555-555555555555'};
 return {weekStartEat:W,
  draft:{week_start_eat:W,revision:1,updated_by:'88888888-8888-4888-8888-888888888888',
    updated_at:'2026-11-09T18:00:00Z',config_json:config},
  sourceReview:{schemaVersion:'wk100-admin-identify-observations-v1',weekStartEat:W,
    contractId:'66666666-6666-4666-8666-666666666666',
    receiptId:'77777777-7777-4777-8777-777777777777',
    sourceKey:'mdundo_ke_public_top_songs',registryProviderKey:'mdundo_ke',
    payloadSha256:'a'.repeat(64),expectedDepth:2,receiptStatus:'succeeded',
    identityStatus:'exact_provider_links_only',
    totals:{observed:2,resolved:1,needsReview:1,conflicting:0,inactive:0},
    rows:[one,two],canWriteRegistry:false,canScore:false,canPublish:false},
  registryTracks:[{id:T,title:'Song One',isrc:'KEABC2600001',release_id:R,
    explicit:false,duration_ms:180000,status:'active'}],
  registryCredits:[{id:'99999999-9999-4999-8999-999999999999',track_id:T,
    artist_id:A,role:'primary_artist',is_primary:true,status:'active'}],
  registryArtists:[{id:A,origin_iso2:'KE',status:'active'}],
  registryReleases:[{id:R,release_type:'single',release_date:'2026-10-20',
    status:'active',metadata:{versions:{}}}]};
}
test('valid linked recording meets predicates, unresolved recording needs review; neither may score',async()=>{
 const x=await fixture();const r=await project(x);
 assert.equal(r.counts.ELIGIBLE,1);
 assert.equal(r.counts.REVIEW_REQUIRED,1);
 assert.equal(r.rows[1].reasonCodes[0],'canonical_identity_needs_review');
 assert.equal(r.configRevision,1);
 assert.equal(r.policySha256,x.draft.config_json.ingestPolicySha256);
 assert.deepEqual([r.canScore,r.canPublish,r.canWriteRegistry],[false,false,false]);
});
test('verified foreign country is excluded by the existing country rule',async()=>{
 const x=await fixture();x.registryArtists[0].origin_iso2='NG';
 const r=await project(x);assert.equal(r.rows[0].outcome,'EXCLUDED');
 assert(r.rows[0].reasonCodes.includes('primary_artist_origin_not_allowed'));
});
test('unknown origin causes review, not presumed Kenyan origin',async()=>{
 const x=await fixture();x.registryArtists[0].origin_iso2=null;
 const r=await project(x);assert.equal(r.rows[0].outcome,'REVIEW_REQUIRED');
 assert(r.rows[0].reasonCodes.includes('primary_artist_origin_unknown'));
});
test('tampered policy or source digest is rejected',async()=>{
 const x=await fixture();x.draft.config_json.eligibilityProfileSnapshot.artistOriginEligibility.countries=['US'];
 await assert.rejects(()=>project(x),/draft_policy_digest_mismatch/);
 const y=await fixture();y.sourceReview.payloadSha256='bad';
 await assert.rejects(()=>project(y),/source_evidence_invalid/);
});
test('missing Registry Track cannot become eligible',async()=>{
 const x=await fixture();x.registryTracks=[];
 const r=await project(x);assert.equal(r.rows[0].outcome,'REVIEW_REQUIRED');
 assert(r.rows[0].reasonCodes.includes('registry_track_not_verifiable'));
});
test('conflicted provider link stays conflicted regardless of other filters',async()=>{
 const x=await fixture();x.sourceReview.rows[1].identityState='conflicting';
 const r=await project(x);assert.equal(r.rows[1].outcome,'CONFLICTED');
});
