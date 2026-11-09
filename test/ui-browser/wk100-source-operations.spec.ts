import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Real WAKILISHA React routes, isolated synthetic GoTrue and read-only API.
 * No network request reaches a hosted Supabase project or writes a fixture.
 */
const PROJECT_REF='pgzizndxdyhqmtyywjmt';
const USER_ID='00000000-0000-4000-8000-000000000121';
const cors={
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  'access-control-allow-methods':'GET, HEAD, POST, PATCH, OPTIONS',
};
async function json(route:Route,body:unknown,status=200) {
  await route.fulfill({status,contentType:'application/json',headers:cors,body:JSON.stringify(body)});
}
async function install(page:Page,{invalid=false,deny=false,failProposal=false,existingProposals=[],existingMethods=[],existingSources=[],existingEditionDraft=null}:{invalid?:boolean;deny?:boolean;failProposal?:boolean;existingProposals?:unknown[];existingMethods?:unknown[];existingSources?:Record<string,unknown>[];existingEditionDraft?:Record<string,unknown>|null}={}) {
  const reads:unknown[]=[];
  const originalReads:unknown[]=[];
  const editionReads:unknown[]=[];
  const writes:unknown[]=[];
  const methodWrites:unknown[]=[];
  const contractWrites:unknown[]=[];
  const recoveryWrites:Record<string,unknown>[]=[];
  const collectNowWrites:Record<string,unknown>[]=[];
  const recoveryRecords:Record<string,unknown>[]=[];
  const methodRecords:Record<string,unknown>[]=[...existingMethods] as Record<string,unknown>[];
  const proposalRecords:Record<string,unknown>[]=[...existingProposals] as Record<string,unknown>[];
  const unexpected:string[]=[];
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)) {
      await route.continue();return;
    }
    if(url.hostname!==PROJECT_REF+'.supabase.co') {
      unexpected.push(req.method()+' '+url.hostname+url.pathname);
      await route.abort();return;
    }
    if(req.method()==='OPTIONS') {
      await route.fulfill({status:204,headers:cors});return;
    }
    if(url.pathname==='/auth/v1/user') {
      await json(route,{id:USER_ID,aud:'authenticated',role:'authenticated',
        email:'wk100-ui-only@example.test',app_metadata:{},user_metadata:{},
        created_at:'2026-10-21T00:00:00Z'});return;
    }
    if(url.pathname==='/rest/v1/user_profiles') {
      await json(route,{user_id:USER_ID,status:'active',display_name:'Browser Test'});return;
    }
    if(url.pathname==='/rest/v1/user_role_assignments') {
      await json(route,[{id:'synthetic-administrator',user_id:USER_ID,role_key:'administrator',
        status:'active',expires_at:null,created_at:'2026-10-21T00:00:00Z',updated_at:'2026-10-21T00:00:00Z'}]);return;
    }
    if(url.pathname==='/rest/v1/role_capabilities') {
      await json(route,(deny?['view_dashboard','view_admin_readonly']:['view_dashboard','view_admin_readonly','view_charts_admin','manage_ingest','manage_charts'])
        .map(capability_key=>({capability_key})));return;
    }
    if(url.pathname==='/rest/v1/user_access_scopes') {await json(route,[]);return;}
    if(url.pathname==='/rest/v1/rpc/wk100_list_collection_actions_v1') {
      let body:Record<string,unknown>;
      try{body=JSON.parse(req.postData()||'null');}catch{body={};}
      await json(route,recoveryRecords.filter(a=>a.weekStartEat===body.p_week));return;
    }
    if(url.pathname==='/rest/v1/rpc/wk100_record_collection_action_v1') {
      let body:Record<string,unknown>;
      try{body=JSON.parse(req.postData()||'null');}catch{body={};}
      const kinds:Record<string,string>={request_retry:'retry_requested',
        request_exception:'coverage_requested',
        accept_exception:'coverage_accepted',reject_exception:'coverage_rejected'};
      if(typeof body.p_action!=='string'||!kinds[body.p_action]||
         typeof body.p_reason!=='string'||body.p_reason.length<8||
         typeof body.p_operation_id!=='string'){
        await json(route,{code:'22023',message:'invalid'},400);return;
      }
      const saved={
        actionId:String(body.p_operation_id),actionKind:kinds[body.p_action],
        contractId:body.p_contract_id,weekStartEat:body.p_week,
        revision:body.p_action==='request_retry'?0:Number(body.p_expected_revision)+1,
        attemptNumber:body.p_action==='request_retry'?Number(body.p_expected_attempt_number)+1:null,
        recorded:true,canCollect:false,canScore:false,canPublish:false,
      };
      const event={...saved,sourceKey:'apple_ke_catalog_most_played',
        scheduledAt:body.p_scheduled_at,reason:body.p_reason,createdAt:new Date().toISOString()};
      recoveryRecords.push(event);
      recoveryWrites.push(body);
      await json(route,saved);return;
    }
    if(url.pathname==='/rest/v1/rpc/wk100_request_collect_now_v1'){
      let payload:Record<string,unknown>;
      try{payload=JSON.parse(req.postData()||'null');}catch{payload={};}
      collectNowWrites.push(payload);
      if(deny){await json(route,{code:'42501',message:'not_authorized'},403);return;}
      const now=new Date(),east=new Date(now.valueOf()+3*60*60*1000);
      east.setUTCDate(east.getUTCDate()-((east.getUTCDay()+6)%7));
      await json(route,{
        operationId:payload.p_operation_id,contractId:payload.p_contract_id,
        sourceKey:'apple_ke_catalog_most_played',
        weekStartEat:east.toISOString().slice(0,10),
        scheduledAt:now.toISOString().slice(0,16)+':00Z',
        status:'requested',canScore:false,canPublish:false,
      });return;
    }
    if(url.pathname==='/rest/v1/rpc/wk100_get_admin_draft_v1') {
      if(req.method()!=='POST'){await json(route,{error:'method_not_allowed'},405);return;}
      let payload:Record<string,unknown>;
      try{payload=JSON.parse(req.postData()||'null');}catch{payload={};}
      editionReads.push(payload);
      await json(route,existingEditionDraft?.weekStartEat===payload.p_week?existingEditionDraft:null);
      return;
    }
    if(url.pathname==='/functions/v1/wk100-source-admin-proposals') {
      if(req.method()!=='POST'){await json(route,{error:'method_not_allowed'},405);return;}
      let body:Record<string,unknown>;
      try{body=JSON.parse(req.postData()||'null');}catch{body={};}
      if(body.action==='list_source_proposals'){
        await json(route,{schemaVersion:'wk100-source-proposals-v1',proposals:proposalRecords,
          canCollect:false,canScore:false,canPublish:false});return;
      }
      if(body.action==='submit_source_proposal'){
        if(failProposal){await json(route,{error:'proposal_write_unavailable'},503);return;}
        const proposal=body.proposal;
        if(!proposal||typeof proposal!=='object'||Array.isArray(proposal)){
          await json(route,{error:'proposal_invalid'},400);return;
        }
        const candidate=proposal as Record<string,unknown>;
        const last=proposalRecords.filter(p=>p.sourceKey===candidate.sourceKey).at(-1);
        const nextRevision=Number(body.expectedRevision)+1;
        if(Number(last?.revision??0)!==Number(body.expectedRevision)){
          await json(route,{error:'proposal_revision_conflict'},409);return;
        }
        const saved={...candidate,
          id:'22222222-2222-4222-8222-222222222222',revision:nextRevision,
          createdAt:'2026-11-02T19:00:00Z',state:'proposed',
          canCollect:false,canScore:false,canPublish:false,
        };
        proposalRecords.push(saved);
        writes.push(body);
        await json(route,{schemaVersion:'wk100-source-proposal-written-v1',saved});return;
      }
      await json(route,{error:'unexpected_proposal_action'},400);return;
    }
    if(url.pathname==='/functions/v1/wk100-source-admin-methods') {
      if(req.method()!=='POST'){await json(route,{error:'method_not_allowed'},405);return;}
      let body:Record<string,unknown>;
      try{body=JSON.parse(req.postData()||'null');}catch{body={};}
      if(body.action==='list_method_decisions'){
        await json(route,{schemaVersion:'wk100-source-method-decisions-v1',
          decisions:methodRecords,canCollect:false,canScore:false,canPublish:false});return;
      }
      if(body.action==='review_source_method'){
        const next=Number(body.expectedDecisionRevision)+1;
        const decision=body.decision as Record<string,unknown>;
        if(!decision||typeof decision!=='object'||Number(body.expectedDecisionRevision)<0){
          await json(route,{error:'method_review_invalid'},400);return;
        }
        const prior=methodRecords.find(p=>p.sourceKey===decision.sourceKey);
        if(Number(prior?.decisionRevision??0)!==Number(body.expectedDecisionRevision)){
          await json(route,{error:'method_revision_conflict'},409);return;
        }
        const saved={sourceKey:decision.sourceKey,providerKey:decision.providerKey,
          proposalRevision:decision.proposalRevision,decisionRevision:next,
          decisionState:decision.decisionState,
          constitutionVersion:decision.constitutionVersion,
          createdAt:'2026-11-03T06:00:00Z',
          nativePeriodAuthority:decision.nativePeriodAuthority,
          hasMethodEvidence:!!decision.accessEvidenceSha256,
          canScore:false,canPublish:false};
        methodRecords.splice(0,methodRecords.length,
          ...methodRecords.filter(p=>p.sourceKey!==decision.sourceKey),saved);
        methodWrites.push(body);
        await json(route,{schemaVersion:'wk100-source-method-written-v1',
          saved,canCollect:false,canScore:false,canPublish:false});return;
      }
      if(body.action==='enroll_capture_contract'){
        const intent=body.enrollment as Record<string,unknown>|null;
        const current=methodRecords.find(m=>m.sourceKey===intent?.sourceKey);
        if(!intent||!current||current.decisionState!=='collector_admitted'||
          current.proposalRevision!==intent.expectedProposalRevision||
          current.decisionRevision!==intent.expectedDecisionRevision||
          current.captureContractVersion){
          await json(route,{error:'contract_enrollment_conflict'},409);return;
        }
        const enrolled={
          contractId:'33333333-3333-4333-8333-333333333333',
          sourceKey:intent.sourceKey,
          contractVersion:intent.contractVersion,
          proposalRevision:intent.expectedProposalRevision,
          decisionRevision:intent.expectedDecisionRevision,
          state:'candidate',canCollect:false,canScore:false,canPublish:false,
        };
        current.captureContractVersion=intent.contractVersion;
        contractWrites.push(body);
        await json(route,{schemaVersion:'wk100-capture-contract-enrolled-v1',
          enrollment:enrolled,canCollect:false,canScore:false,canPublish:false});return;
      }
      await json(route,{error:'unexpected_method_action'},400);return;
    }
    if(url.pathname==='/functions/v1/wk100-source-admin-read') {
      if(req.method()!=='POST'){await json(route,{error:'read_only_post_required'},405);return;}
      let body:unknown;
      try {body=JSON.parse(req.postData()||'null');}catch{body=null;}
      if(body&&typeof body==='object'&&'action' in body&&
        body.action==='verify_private_original'){
        originalReads.push(body);
        const request=body as {weekStartEat:string;contractId:string;receiptId:string};
        await json(route,{
          schemaVersion:'wk100-admin-original-readback-v1',
          weekStartEat:request.weekStartEat,contractId:request.contractId,
          receiptId:request.receiptId,originalVerified:true,
          payloadSha256:'f'.repeat(64),byteLength:247,status:'succeeded',
          nativePeriodAuthority:'unknown',canScore:false,canPublish:false,
        });return;
      }
      reads.push(body);
      const week=body&&typeof body==='object'&&'weekStartEat' in body
        ?String(body.weekStartEat):'';
      await json(route,{
        schemaVersion:'wk100-admin-source-health-v1',weekStartEat:week,
        sourceCount:existingSources.length,
        successfulSources:existingSources.filter(s=>typeof s.receiptSha256==='string'&&/^[a-f0-9]{64}$/.test(s.receiptSha256)).length,
        failedSources:existingSources.filter(s=>s.captureState==='transport_failed').length,
        qualifiedSources:0,canScore:false,canPublish:invalid,sources:existingSources,
      });return;
    }
    // Any unrecognized Supabase call is denied, not forwarded.
    await json(route,{error:'outside_ui_test'},503);
  });
  await page.addInitScript(({ref,id})=>{
    const now=Math.floor(Date.now()/1000);
    window.localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify({
      access_token:'isolated-browser-token-not-a-real-jwt',token_type:'bearer',
      expires_in:3600,expires_at:now+3600,refresh_token:'isolated-browser-refresh',
      user:{id,aud:'authenticated',role:'authenticated',email:'wk100-ui-only@example.test',
        app_metadata:{},user_metadata:{},identities:[],created_at:'2026-10-21T00:00:00Z'},
    }));
  },{ref:PROJECT_REF,id:USER_ID});
  return {reads,originalReads,editionReads,unexpected,writes,methodWrites,contractWrites,recoveryWrites,collectNowWrites};
}

test('five founder-selected core providers show truthful readiness and no invented source admission',async({page})=>{
  const ctx=await install(page);
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  const table=page.getByRole('table',{name:'Five core provider readiness'});
  await expect(table).toBeVisible({timeout:20_000});
  // The operator's source master/detail must precede secondary October research.
  const registryBeforeArchive=await page.locator('main').first().evaluate(root=>{
    const headings=Array.from(root.querySelectorAll('h2'));
    const registry=headings.find(h=>h.textContent?.trim()==='Source Registry');
    const archive=headings.find(h=>h.textContent?.trim()==='Research Already Captured');
    return !!registry&&!!archive&&
      Boolean(registry.compareDocumentPosition(archive)&Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(registryBeforeArchive).toBe(true);
  await expect(page.getByRole('region',{name:'Selected source inspector'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Selected source inspector'}).getByRole('heading',{name:'Select a source',exact:true}))
    .toBeVisible();
  const selectedCore=['Apple Music Kenya','Shazam Kenya','Mdundo Kenya',
    'YouTube Kenya','Audiomack Kenya'];
  for(const provider of selectedCore)
    await expect(table.getByText(provider,{exact:true})).toBeVisible();
  const actualCoreRows=await table.getByRole('row').allTextContents();
  expect(actualCoreRows).toHaveLength(6); // one header, five core sources
  for(let i=0;i<selectedCore.length;i++)
    expect(actualCoreRows[i+1]).toContain(selectedCore[i]);
  await expect(table.getByText('Boomplay Kenya',{exact:true})).toHaveCount(0);
  await expect(table.getByText('Spotify Kenya',{exact:true})).toHaveCount(0);
  // Required editorial observations remain visible outside the five primary
  // readiness rows. Four playlists are ONE supplementary provider family.
  const editorial=page.getByRole('list',{name:'Required Spotify editorial sources'});
  await expect(editorial).toBeVisible();
  const editorialLinks=[
    ['Hot Hits Kenya','37i9dQZF1DWWWXigQZAD8B'],
    ['New Music Friday Kenya','37i9dQZF1DX5lbl7P6kJFp'],
    ['Made In Kenya','37i9dQZF1DX7z7RLIui5KP'],
    ['Gengetone Fire','37i9dQZF1DX80fLED6RkGS'],
  ];
  for(const [name,id] of editorialLinks){
    await expect(editorial.getByRole('link',{name,exact:true}))
      .toHaveAttribute('href','https://open.spotify.com/playlist/'+id);
  }
  await expect(editorial.getByRole('listitem')).toHaveCount(4);
  await expect(page.getByText('Numeric weighting and anti-double-counting are approved in Phase 3.',{exact:false}))
    .toBeVisible();
  // The genuine 29–30 October original-byte archive is independent of
  // candidate collection. Research remains visible with zero proposals.
  const archive=page.getByRole('table',{name:'Archived Kenya research observations'});
  await expect(archive).toBeVisible();
  await expect(archive.getByRole('row').filter({hasText:'Shazam Kenya'})
    .getByText('200 observed discovery ranks')).toBeVisible();
  await expect(archive.getByRole('row').filter({hasText:'Mdundo Kenya'})
    .getByText('100 observed platform chart ranks')).toBeVisible();
  await expect(archive.getByRole('row').filter({hasText:'Apple Music Kenya'})
    .getByText('100 observed daily playlist ranks')).toBeVisible();
  await expect(archive.getByRole('row').filter({hasText:'Audiomack Kenya'})
    .getByText('Original retained; ranks unverified')).toBeVisible();
  await expect(page.getByRole('button',{name:'Open Ingest Studio'})).toBeVisible();
    await expect(table.getByRole('button',{name:/^Add .+ Source$/})).toHaveCount(5);
  await expect(table.getByText('No proposal')).toHaveCount(5);
  await expect(table.getByText('Candidate enrolled')).toHaveCount(0);
  await table.getByRole('button',{name:'Add YouTube Kenya Source'}).click();
  await expect(page.getByRole('heading',{name:'Choose a Kenya provider'})).toBeVisible();
  expect(ctx.writes).toEqual([]);
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.contractWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('historical research remains visible when collector health denies its own authority',async({page})=>{
  const ctx=await install(page,{invalid:true});
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Source status unavailable'}))
    .toBeVisible({timeout:20_000});
  const archive=page.getByRole('table',{name:'Archived Kenya research observations'});
  await expect(archive).toBeVisible();
  await expect(archive.getByRole('row').filter({hasText:'Shazam Kenya'})
    .getByText('200 observed discovery ranks')).toBeVisible();
  await expect(archive.getByRole('row').filter({hasText:'Mdundo Kenya'})
    .getByText('100 observed platform chart ranks')).toBeVisible();
  await expect(archive.getByRole('row').filter({hasText:'Audiomack Kenya'})
    .getByText('Original retained; ranks unverified')).toBeVisible();
  await expect(page.getByRole('button',{name:'Open Ingest Studio'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sources',exact:true})).toHaveCount(0);
  expect(ctx.writes).toEqual([]);
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.contractWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('a stale reviewed method does not appear as an enrolled, current platform source',async({page})=>{
  const sourceKey='youtube_ke_weekly_top_songs';
  const proposal={
    id:'11111111-1111-4111-8111-111111111111',
    providerKey:'youtube_ke',sourceKey,revision:2,
    surface:'YouTube Kenya weekly songs',methodClass:'provider_api',
    behavior:'video_consumption',metric:'rank_and_count',expectedDepth:100,
    cadence:'weekly',intervalHours:null,eatHour:12,eatMinute:0,weekdayEat:3,
    minimumHealthyCheckpoints:1,evidenceReference:'synthetic-review-revision',
    reason:null,createdAt:'2026-11-03T09:00:00Z',state:'proposed',
    canCollect:false,canScore:false,canPublish:false,
  };
  const oldDecision={
    sourceKey,providerKey:'youtube_ke',proposalRevision:1,decisionRevision:3,
    decisionState:'collector_admitted',constitutionVersion:'ci-only-v1',
    createdAt:'2026-11-01T09:00:00Z',hasMethodEvidence:true,
    nativePeriodAuthority:'provider_defined',captureContractVersion:'old-fixture-v1',
    canScore:false,canPublish:false,
  };
  const ctx=await install(page,{existingProposals:[proposal],existingMethods:[oldDecision]});
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  const roster=page.getByRole('table',{name:'Five core provider readiness'});
  const youtube=roster.getByRole('row').filter({hasText:'YouTube Kenya'});
  await expect(youtube.getByText('Method review needed')).toBeVisible({timeout:20_000});
  await expect(youtube.getByText('Candidate enrolled')).toHaveCount(0);
  const sourceMaster=page.getByRole('table',{name:'Source registry'});
  await expect(sourceMaster.getByRole('button',{name:'YouTube Kenya weekly songs'})).toBeVisible();
  await expect(sourceMaster.getByText('Review outdated',{exact:true})).toBeVisible();
  await sourceMaster.getByRole('button',{name:'YouTube Kenya weekly songs'}).click();
  const inspector=page.getByRole('region',{name:'Selected source inspector'});
  await expect(inspector.getByText('Source proposal · no capture contract enrolled')).toBeVisible();
  await expect(inspector.getByText('Not enrolled',{exact:true})).toBeVisible();
  await youtube.getByRole('button',{name:'Review YouTube Kenya Method'}).click();
  const review=page.getByRole('dialog',{name:'Review Source Method'});
  await expect(review.getByRole('heading',{name:'Review Source Method'})).toBeVisible();
  await expect(review.getByText('YouTube Kenya weekly songs')).toBeVisible();
  await expect(review.getByText('collector admitted · revision 3')).toBeVisible();
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.contractWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('observed-as-of receipts are visible without asserting provider-native measurement dates',async({page})=>{
  const sourceKey='apple_ke_public_top100';
  const sourceId='88888888-8888-4888-8888-888888888888';
  const originalTime='2026-11-03T10:02:00Z';
  const proposals=[{
    id:'77777777-7777-4777-8777-777777777777',
    providerKey:'apple_ke',sourceKey,revision:1,
    surface:'Apple public Kenya Top 100',methodClass:'reviewed_page_adapter',
    behavior:'consumption',metric:'rank',expectedDepth:100,
    cadence:'daily',intervalHours:null,eatHour:12,eatMinute:0,
    weekdayEat:null,minimumHealthyCheckpoints:1,
    evidenceReference:'reviewed_first_party_apple_chart',
    reason:null,createdAt:'2026-11-02T10:00:00Z',state:'proposed',
    canCollect:false,canScore:false,canPublish:false,
  }];
  const methods=[{
    sourceKey,providerKey:'apple_ke',proposalRevision:1,decisionRevision:1,
    decisionState:'collector_admitted',constitutionVersion:'ci-accepted-only-v1',
    nativePeriodAuthority:'observed_as_of',captureContractVersion:'ci-v1',
    hasMethodEvidence:true,createdAt:'2026-11-02T10:00:00Z',
    canScore:false,canPublish:false,
  }];
  const sources=[{
    id:sourceId,sourceKey,provider:'apple_ke',surface:'Apple public Kenya Top 100',
    market:'KE',metric:'rank',behavior:'consumption',expectedDepth:100,
    cadence:'daily',version:'ci-v1',intervalHours:null,eatHour:12,eatMinute:0,
    weekdayEat:null,minimumHealthyCheckpoints:1,adapterVersion:'apple_kenya_chart_v1',
    admissionState:'candidate',captureState:'succeeded',attemptCount:1,
    lastAttemptAt:originalTime,lastScheduledAt:'2026-11-03T10:00:00Z',lastAttemptNumber:1,
    lastSuccessfulAt:originalTime,observedDepth:100,nativePeriodAuthority:'unknown',
    nativePeriodStart:null,nativePeriodEnd:null,receiptSha256:'a'.repeat(64),
    failureCode:null,canScore:false,canPublish:false,
    recentAttempts:[{id:'99999999-9999-4999-8999-999999999999',status:'succeeded',
      attemptedAt:originalTime,scheduledAt:'2026-11-03T10:00:00Z',
      attemptNumber:1,fetchedAt:originalTime,failureCode:null,observedDepth:100}],
  }];
  const ctx=await install(page,{existingProposals:proposals,existingMethods:methods,
    existingSources:sources});
  await page.goto('/admin/charts/wk100-operations?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  await expect(page.getByText('Reporting dates and observation time')).toBeVisible({timeout:20_000});
  await expect(page.getByText('1 verified as-of observation(s). Provider measurement windows remain unknown.')).toBeVisible();
  await expect(page.getByText('Private · Not ready')).toBeVisible();
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  await page.getByRole('table',{name:'Source registry'}).getByRole('button',{
    name:'Apple public Kenya Top 100'}).click();
  await expect(page.getByText('WAKILISHA observed-as-of. Provider reporting period unknown.')).toBeVisible();
  await page.goto('/admin/charts/wk100-operations/collection?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  await page.getByRole('table',{name:'Weekly source collection'}).getByRole('button',{
    name:'Apple public Kenya Top 100'}).click();
  await expect(page.getByText('Verified for this EAT Edition. Provider measurement period remains unknown.')).toBeVisible();
  expect(ctx.unexpected).toEqual([]);
});

test('W1 W2 and W3 distinguish a retained partial original from full-depth health and retry authority',async({page})=>{
  const captured=(id:string,key:string,provider:string,surface:string,status:string,depth:number,expectedDepth:number)=>({
    id,sourceKey:key,provider,surface,market:'KE',metric:'rank',behavior:'consumption',
    expectedDepth,version:'wk100-public-original-v1',admissionState:'candidate',
    cadence:'daily',intervalHours:null,eatHour:9,eatMinute:0,weekdayEat:null,
    minimumHealthyCheckpoints:1,adapterVersion:'fixture-v1',
    captureState:status,attemptCount:1,
    lastAttemptAt:'2026-11-09T16:10:20Z',lastSuccessfulAt:'2026-11-09T16:10:20Z',
    lastScheduledAt:'2026-11-09T16:09:00Z',lastAttemptNumber:1,observedDepth:depth,
    nativePeriodAuthority:'unknown',nativePeriodStart:null,nativePeriodEnd:null,
    receiptSha256:'a'.repeat(64),failureCode:null,
    recentAttempts:[{id,status,attemptedAt:'2026-11-09T16:10:20Z',
      scheduledAt:'2026-11-09T16:09:00Z',attemptNumber:1,
      fetchedAt:'2026-11-09T16:10:20Z',failureCode:null,observedDepth:depth}],
    canScore:false,canPublish:false,
  });
  const sources=[
    captured('11111111-1111-4111-8111-111111111111','shazam_ke_public_top200','shazam_ke',
      'Shazam Kenya Top 200','succeeded',200,200),
    captured('22222222-2222-4222-8222-222222222222','apple_ke_public_top100','apple_ke',
      'Apple Music Kenya Top 100','succeeded',100,100),
    captured('33333333-3333-4333-8333-333333333333','mdundo_ke_public_top_songs','mdundo_ke',
      'Mdundo Kenya Top Songs','partial_depth',99,100),
  ];
  const ctx=await install(page,{existingSources:sources});
  await page.goto('/admin/charts/wk100-operations?week=2026-11-09',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('3 verified originals (2 complete, 1 partial).',{exact:false}))
    .toBeVisible({timeout:20_000});
  await expect(page.getByText('Full-depth captures',{exact:true})).toBeVisible();
  await expect(page.getByText('Partial-depth captures',{exact:true})).toBeVisible();
  await expect(page.getByText('Research only · Publication locked')).toBeVisible();
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-09',
    {waitUntil:'domcontentloaded'});
  const registry=page.getByRole('table',{name:'Source registry'});
  await expect(registry.getByRole('row').filter({hasText:'Mdundo Kenya Top Songs'})
    .getByText('Partial depth',{exact:true})).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Filter health'}).click();
  await page.getByRole('option',{name:'Partial depth'}).click();
  await expect(registry.getByText('Mdundo Kenya Top Songs')).toBeVisible();
  await expect(registry.getByText('Shazam Kenya Top 200')).toHaveCount(0);
  await page.goto('/admin/charts/wk100-operations/collection?week=2026-11-09',
    {waitUntil:'domcontentloaded'});
  await expect(page.getByText('1 partial-depth source',{exact:true})).toBeVisible({timeout:20_000});
  await expect(page.getByText('Partial-depth originals',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'A source returned fewer ranks than expected'}))
    .toBeVisible();
  const row=page.getByRole('table',{name:'Weekly source collection'})
    .getByRole('row').filter({hasText:'Mdundo Kenya Top Songs'});
  await expect(row.getByText('99',{exact:false})).toBeVisible();
  await expect(row.getByRole('button',{name:'Request Retry'})).toHaveCount(0);
  await expect(row.getByRole('button',{name:'Request Coverage Review'})).toHaveCount(0);
  await row.getByRole('button',{name:'Inspect Partial Original'}).click();
  await expect(page.getByText('No retry permitted for this outcome')).toBeVisible();
  await expect(page.getByText('Partial original retained. Missing ranks remain visible',{exact:false}))
    .toBeVisible();
  expect(ctx.recoveryWrites).toEqual([]);
  expect(ctx.collectNowWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('W1 keeps a partial original visible after a newer failed attempt without unlocking recovery',async({page})=>{
  const source={
    id:'33333333-3333-4333-8333-333333333333',
    sourceKey:'mdundo_ke_public_top_songs',provider:'mdundo_ke',
    surface:'Mdundo Kenya Top Songs',market:'KE',
    metric:'rank',behavior:'consumption',version:'v1',expectedDepth:100,
    cadence:'daily',intervalHours:null,eatHour:9,eatMinute:0,weekdayEat:null,
    minimumHealthyCheckpoints:1,adapterVersion:'fixture-v1',admissionState:'candidate',
    captureState:'transport_failed',attemptCount:2,observedDepth:99,
    lastSuccessfulAt:'2026-11-09T13:09:00Z',
    lastAttemptAt:'2026-11-09T16:10:00Z',
    lastScheduledAt:'2026-11-09T16:09:00Z',lastAttemptNumber:1,
    nativePeriodAuthority:'unknown',nativePeriodStart:null,nativePeriodEnd:null,
    receiptSha256:'a'.repeat(64),failureCode:'source_transport_unavailable',
    recentAttempts:[],canScore:false,canPublish:false,
  };
  const ctx=await install(page,{existingSources:[source]});
  await page.goto('/admin/charts/wk100-operations?week=2026-11-09',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('1 verified originals (0 complete, 1 partial).',{exact:false}))
    .toBeVisible({timeout:20_000});
  await page.goto('/admin/charts/wk100-operations/collection?week=2026-11-09',
    {waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'A source returned fewer ranks than expected'}))
    .toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Inspect Partial Original'}).click();
  await expect(page.getByText('Partial original retained. Missing ranks remain visible',{exact:false}))
    .toBeVisible();
  expect(ctx.recoveryWrites).toEqual([]);
  expect(ctx.collectNowWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('source overview stays truthful, carries EAT week through navigation and uses no publisher',async({page})=>{
  const ctx=await install(page);
  await page.goto('/admin/charts/wk100-operations?week=2026-10-26',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Weekly Overview'})).toBeVisible({timeout:20_000});
  await expect(page.getByText('No enrolled capture sources yet.')).toBeVisible();
  for(const gate of ['Qualified source constitution','Original source evidence',
    'Reporting dates and observation time','Canonical recording identities',
    'Complete eligibility and corrections','Frozen methodology and private Top 100',
    'Edition staging and explicit publication']){
    await expect(page.getByText(gate,{exact:true})).toBeVisible();
  }
  await expect(page.getByText('Publication locked')).toBeVisible();
  await page.getByRole('button',{name:'Sources',exact:true}).click();
  await expect(page).toHaveURL(/wk100-operations\/sources\?week=2026-10-26/);
  await expect(page.getByRole('heading',{name:'Source Registry'}).first()).toBeVisible();
  await expect(page.getByText('No sources proposed or enrolled yet.')).toBeVisible();
  expect(ctx.reads.length).toBeGreaterThanOrEqual(2);
  for(const body of ctx.reads)expect(body).toEqual({action:'read_source_health',weekStartEat:'2026-10-26'});
  expect(ctx.unexpected).toEqual([]);
});

test('W1 opens the established sealed Edition editor for the selected EAT week without a second draft writer',async({page})=>{
  const ctx=await install(page);
  await page.goto('/admin/charts/wk100-operations?week=2026-10-26',
    {waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Weekly Overview'})).toBeVisible({timeout:20_000});
  // A completed protected W1 read, not merely a mounted heading, is the
  // prerequisite for proving the handoff preserved the selected Edition.
  await expect(page.getByText('No saved Edition configuration')).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Configure this Edition'}).click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/admin/charts/ingest');
  await expect.poll(()=>new URL(page.url()).searchParams.get('wk100Week')).toBe('2026-10-26');
  expect(ctx.editionReads).toContainEqual({p_week:'2026-10-26'});
  expect(ctx.recoveryWrites).toEqual([]);
  expect(ctx.collectNowWrites).toEqual([]);
});

test('W1 founder-workbook hierarchy is two-column on desktop and stacked on mobile',async({page})=>{
  const ctx=await install(page);
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/admin/charts/wk100-operations?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  const layout=page.locator('[data-wk-weekly-layout]');
  const primary=page.locator('[data-wk-weekly-primary]');
  const summary=page.locator('[data-wk-weekly-summary]');
  await expect(layout).toBeVisible({timeout:20_000});
  await expect(primary.getByRole('heading',{name:'Readiness'})).toBeVisible();
  await expect(summary.getByRole('heading',{name:'This week'})).toBeVisible();
  await expect(summary.getByRole('heading',{name:'Collection activity'})).toBeVisible();
  await expect(summary.getByText('Registered candidates')).toBeVisible();
  const desktopLeft=await primary.boundingBox(),desktopRight=await summary.boundingBox();
  expect(desktopLeft&&desktopRight&&desktopRight.x>desktopLeft.x+desktopLeft.width-5).toBe(true);
  await page.setViewportSize({width:390,height:844});
  // Read both rectangles in one layout pass and poll after responsive reflow.
  // The assertion retains the actual no-overlap/stacking contract.
  await expect.poll(async()=>layout.evaluate(root=>{
    const a=root.querySelector('[data-wk-weekly-primary]')?.getBoundingClientRect();
    const b=root.querySelector('[data-wk-weekly-summary]')?.getBoundingClientRect();
    const cols=getComputedStyle(root).gridTemplateColumns.trim().split(/\s+/);
    return !!a&&!!b&&cols.length===1&&b.top>=a.bottom-5;
  }),{timeout:10_000}).toBe(true);
  expect(ctx.unexpected).toEqual([]);
});

test('W1 counts only reviewed current candidate contracts, never qualifies them or unlocks readiness',async({page})=>{
  const key='apple_ke_catalog_most_played';
  const source={id:'33333333-3333-4333-8333-333333333333',
    sourceKey:key,provider:'apple_ke',surface:'Apple Music Kenya native most played',
    version:'apple-ke-v1',admissionState:'candidate',captureState:'not_collected',
    recentAttempts:[],receiptSha256:null,canScore:false,canPublish:false};
  const proposal={providerKey:'apple_ke',sourceKey:key,revision:2,
    surface:'Apple Music Kenya native most played',state:'proposed',
    canCollect:false,canScore:false,canPublish:false};
  const method={providerKey:'apple_ke',sourceKey:key,proposalRevision:2,
    decisionRevision:2,decisionState:'collector_admitted',
    captureContractVersion:'apple-ke-v1',canScore:false,canPublish:false};
  const ctx=await install(page,{
    existingSources:[source],existingProposals:[proposal],existingMethods:[method],
  });
  await page.goto('/admin/charts/wk100-operations?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  const overview=page.getByRole('heading',{name:'Readiness'}).locator('..');
  await expect(overview.getByText('1 current reviewed candidate contracts.',{exact:false}))
    .toBeVisible({timeout:20_000});
  await expect(page.getByText('Reviewed candidate contracts',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Verify a source capture'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Review captured source evidence'})).toHaveCount(0);
  await expect(page.getByText('Qualified sources')).toHaveCount(0);
  await expect(page.getByText('Research only · Publication locked')).toBeVisible();
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.contractWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});


test('W1 directs the Admin to current source review before enrollment',async({page})=>{
  const sourceKey='shazam_ke_top_200';
  const proposal={
    id:'11111111-1111-4111-8111-111111111111',
    providerKey:'shazam_ke',sourceKey,revision:2,
    surface:'Shazam Kenya Top 200',methodClass:'offered_export',
    behavior:'discovery',metric:'rank',expectedDepth:200,cadence:'daily',
    intervalHours:null,eatHour:9,eatMinute:0,weekdayEat:null,
    minimumHealthyCheckpoints:1,evidenceReference:'historical-csv-research',
    reason:null,createdAt:'2026-11-03T09:00:00Z',state:'proposed',
    canCollect:false,canScore:false,canPublish:false,
  };
  const ctx=await install(page,{existingProposals:[proposal]});
  await page.goto('/admin/charts/wk100-operations?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Review proposed source methods'}))
    .toBeVisible({timeout:20_000});
  await expect(page.getByText('No enrolled capture sources yet.',{exact:false})).toBeVisible();
  await expect(page.getByText('0 current reviewed candidate contracts.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Review Methods'}).click();
  await expect(page).toHaveURL(/wk100-operations\/sources\?week=2026-11-02/);
  const registry=page.getByRole('table',{name:'Source registry'});
  await expect(registry.getByRole('button',{name:'Shazam Kenya Top 200'})).toBeVisible();
  await expect(registry.getByText('Not enrolled',{exact:true})).toBeVisible();
  expect(ctx.contractWrites).toEqual([]);
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('W2 filters current reviewed candidates without inventing scoring constitution admission',async({page})=>{
  const apple='apple_ke_catalog_most_played',youtube='youtube_ke_top_songs_weekly';
  const source=(id:string,key:string,provider:string,surface:string)=>({
    id,sourceKey:key,provider,surface,market:'KE',version:'v1',
    metric:'rank',behavior:'consumption',expectedDepth:100,
    cadence:'weekly',eatHour:9,eatMinute:0,weekdayEat:0,
    intervalHours:null,minimumHealthyCheckpoints:1,adapterVersion:'fixture-v1',
    admissionState:'candidate',captureState:'not_collected',
    attemptCount:0,recentAttempts:[],receiptSha256:null,
    nativePeriodAuthority:'unknown',canScore:false,canPublish:false,
  });
  const ctx=await install(page,{existingSources:[
    source('22222222-2222-4222-8222-222222222222',apple,'apple_ke','Apple candidate'),
    source('33333333-3333-4333-8333-333333333333',youtube,'youtube_ke','YouTube candidate'),
  ],existingProposals:[{
    id:'11111111-1111-4111-8111-111111111111',
    providerKey:'apple_ke',sourceKey:apple,revision:1,
    surface:'Apple candidate',methodClass:'provider_api',
    behavior:'consumption',metric:'rank',expectedDepth:100,
    cadence:'weekly',intervalHours:null,eatHour:9,eatMinute:0,
    weekdayEat:0,minimumHealthyCheckpoints:1,
    evidenceReference:'synthetic-reviewed-method',reason:null,
    createdAt:'2026-11-02T06:00:00Z',
    state:'proposed',canCollect:false,canScore:false,canPublish:false,
  }],existingMethods:[{
    providerKey:'apple_ke',sourceKey:apple,proposalRevision:1,
    decisionRevision:2,decisionState:'collector_admitted',
    captureContractVersion:'v1',canScore:false,canPublish:false,
  }]});
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  const table=page.getByRole('table',{name:'Source registry'});
  await expect(table.getByRole('button',{name:'Apple candidate'})).toBeVisible({timeout:20_000});
  await expect(table.getByRole('button',{name:'YouTube candidate'})).toBeVisible();
  await page.getByRole('button',{name:'Filter method review'}).click();
  await page.getByRole('option',{name:'Current reviewed candidates'}).click();
  await expect(table.getByRole('button',{name:'Apple candidate'})).toBeVisible();
  await expect(table.getByRole('button',{name:'YouTube candidate'})).toHaveCount(0);
  await expect(table.getByText('Reviewed candidate',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Filter constitution'}).click();
  await page.getByRole('option',{name:'Constitution · In'}).click();
  await expect(table.getByRole('button',{name:'Apple candidate'})).toHaveCount(0);
  await expect(page.getByRole('status').filter({hasText:'No sources match these filters.'})).toBeVisible();
  expect(ctx.contractWrites).toEqual([]);
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('W1 reads actual week-bound Edition configuration revision without inferring collection readiness',async({page})=>{
  const draft={weekStartEat:'2026-10-26',revision:7,configSha256:'f'.repeat(64),
    updatedAt:'2026-11-01T07:00:00Z'};
  const ctx=await install(page,{existingEditionDraft:draft});
  await page.goto('/admin/charts/wk100-operations?week=2026-10-26',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('status').filter({hasText:'Edition configuration · Revision 7'}))
    .toBeVisible({timeout:20_000});
  await expect(page.getByText('No enrolled capture sources yet.')).toBeVisible();
  await page.getByRole('button',{name:'Next week'}).click();
  await expect(page).toHaveURL(/week=2026-11-02/);
  await expect(page.getByRole('status').filter({hasText:'No saved Edition configuration'}))
    .toBeVisible();
  expect(ctx.editionReads).toContainEqual({p_week:'2026-10-26'});
  expect(ctx.editionReads).toContainEqual({p_week:'2026-11-02'});
  expect(ctx.writes).toEqual([]);
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.contractWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('Add Source sends only a proposed candidate through the isolated governed endpoint',async({page})=>{
  const ctx=await install(page);
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('No sources proposed or enrolled yet.')).toBeVisible({timeout:20_000});
  await expect(page.getByText('No source proposals have been saved.')).toBeVisible();
  await page.getByRole('button',{name:'Add Source'}).click();
  await expect(page.getByRole('heading',{name:'Choose a Kenya provider'})).toBeVisible();
  await page.getByRole('dialog',{name:'Add Source'}).getByRole('button',{name:/^YouTube Kenya/}).click();
  const methodGroup=page.getByRole('group',{name:'Proposed source access methods'});
  await expect(methodGroup.getByRole('button',{name:'Research only'})).toHaveAttribute('aria-pressed','true');
  await methodGroup.getByRole('button',{name:'Provider API'}).click();
  await expect(page.getByText('No approved YouTube Kenya weekly Charts API route is verified.',{exact:false})).toBeVisible();
  await expect(page.getByText('No collector method is approved by this form.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'Configure the proposed source method'})).toBeVisible();
  await expect(page.getByText('Proposed method:')).toBeVisible();
  await expect(page.getByRole('button',{name:'Change Method'})).toBeVisible();
  await page.getByRole('textbox',{name:'Stable source ID (provider-scoped)'}).fill('youtube_ke_top_songs_weekly');
  await page.getByRole('textbox',{name:'Source surface'}).fill('YouTube Kenya official weekly chart');
  await page.getByRole('textbox',{name:/Internal evidence reference/}).fill('wk100-youtube-method-2026');
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'Review before saving'})).toBeVisible();
  await page.getByRole('button',{name:'Save proposal'}).click();
  await expect(page.getByRole('heading',{name:'Add Source'})).toHaveCount(0);
  const sourceMaster=page.getByRole('table',{name:'Source registry'});
  await expect(sourceMaster.getByRole('button',{name:'YouTube Kenya official weekly chart'})).toBeVisible();
  await expect(sourceMaster.getByText('Method review needed',{exact:true})).toBeVisible();
  await expect(sourceMaster.getByText('Not enrolled',{exact:true})).toBeVisible();
  await sourceMaster.getByRole('button',{name:'YouTube Kenya official weekly chart'}).click();
  const inspector=page.getByRole('region',{name:'Selected source inspector'});
  await expect(inspector.getByText('Source proposal · no capture contract enrolled')).toBeVisible();
  await expect(inspector.getByText('Not enrolled',{exact:true})).toBeVisible();
  await expect(inspector.getByText('Source evidence reference')).toBeVisible();
  await expect(inspector.getByText('wk100-youtube-method-2026')).toBeVisible();
  await expect(inspector.getByRole('button',{name:'Revise Proposal'})).toBeVisible();
  await expect(inspector.getByRole('button',{name:'Review Method'})).toBeVisible();
  expect(ctx.writes).toHaveLength(1);
  const submitted=ctx.writes[0] as {action:string;proposal:Record<string,unknown>;expectedRevision:number};
  expect(submitted.action).toBe('submit_source_proposal');
  expect(submitted.expectedRevision).toBe(0);
  expect(submitted.proposal.providerKey).toBe('youtube_ke');
  expect(submitted.proposal.sourceKey).toBe('youtube_ke_top_songs_weekly');
  expect(submitted.proposal.methodClass).toBe('provider_api');
  expect(submitted.proposal.evidenceReference).toBe('wk100-youtube-method-2026');
  expect(submitted.proposal).not.toHaveProperty('endpoint');
  expect(submitted.proposal).not.toHaveProperty('canPublish');
  expect(ctx.unexpected).toEqual([]);
});

test('a provider can own multiple independent source proposals without overriding one another',async({page})=>{
  const existing=[{
    id:'11111111-1111-4111-8111-111111111111',providerKey:'youtube_ke',
    sourceKey:'youtube_ke_top_songs_weekly',revision:1,
    surface:'YouTube Kenya official weekly chart',methodClass:'provider_api',
    behavior:'video_consumption',metric:'rank',expectedDepth:100,
    cadence:'weekly',intervalHours:null,eatHour:12,eatMinute:0,weekdayEat:0,
    minimumHealthyCheckpoints:1,evidenceReference:'source-method-evidence',reason:null,
    createdAt:'2026-11-02T00:00:00Z',state:'proposed',
    canCollect:false,canScore:false,canPublish:false,
  }];
  const ctx=await install(page,{existingProposals:existing});
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('table',{name:'Source registry'}).getByText('youtube_ke_top_songs_weekly')).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Add Source'}).click();
  await expect(page.getByRole('dialog',{name:'Add Source'}).getByRole('button',{name:/^YouTube Kenya/})).toBeEnabled();
  await expect(page.getByText('1 existing proposed sources')).toBeVisible();
  await page.getByRole('dialog',{name:'Add Source'}).getByRole('button',{name:/^YouTube Kenya/}).click();
  await page.getByRole('button',{name:'Continue'}).click();
  const id=page.getByRole('textbox',{name:'Stable source ID (provider-scoped)'});
  await id.fill('youtube_ke_top_songs_weekly');
  await expect(page.getByText('This source ID already exists.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Continue'})).toBeDisabled();
  await id.fill('youtube_ke_daily_playlist');
  await page.getByRole('textbox',{name:'Source surface'}).fill('YouTube Kenya editorial playlist');
  await page.getByRole('textbox',{name:/Internal evidence reference/}).fill('youtube-playlist-evidence');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('button',{name:'Save proposal'}).click();
  // Wait for the asynchronous Edge call AND the confirmed UI readback.
  // A Playwright click alone does not await an async React event handler.
  await expect(page.getByRole('heading',{name:'Add Source'})).toHaveCount(0);
  const sourceMaster=page.getByRole('table',{name:'Source registry'});
  await expect(sourceMaster.getByText('youtube_ke_daily_playlist')).toBeVisible();
  await expect(sourceMaster.getByText('youtube_ke_top_songs_weekly')).toBeVisible();
  await expect(sourceMaster.getByRole('row')).toHaveCount(3);
  expect(ctx.writes).toHaveLength(1);
  const written=ctx.writes[0] as {proposal:{providerKey:string;sourceKey:string};expectedRevision:number};
  expect(written.proposal.providerKey).toBe('youtube_ke');
  expect(written.proposal.sourceKey).toBe('youtube_ke_daily_playlist');
  expect(written.expectedRevision).toBe(0);
  expect(ctx.unexpected).toEqual([]);
});

test('failed source proposal command does not claim persistence',async({page})=>{
  const ctx=await install(page,{failProposal:true});
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('No source proposals have been saved.')).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Add Source'}).click();
  await page.getByRole('dialog',{name:'Add Source'}).getByRole('button',{name:/^YouTube Kenya/}).click();
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('textbox',{name:'Stable source ID (provider-scoped)'}).fill('youtube_ke_top_songs_weekly');
  await page.getByRole('textbox',{name:'Source surface'}).fill('YouTube Kenya official weekly chart');
  await page.getByRole('textbox',{name:/Internal evidence reference/}).fill('wk100-youtube-method-2026');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('button',{name:'Save proposal'}).click();
  await expect(page.getByRole('alert')).toContainText('not confirmed by the protected server');
  await expect(page.getByRole('heading',{name:'Add Source'})).toBeVisible();
  expect(ctx.writes).toHaveLength(0);
  expect(ctx.unexpected).toEqual([]);
});

test('mobile source navigation and parent theme toggle remain usable',async({page})=>{
  const ctx=await install(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin/charts/wk100-operations/collection?week=2026-11-02',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Collection & Incidents'})).toBeVisible({timeout:20_000});
  await expect(page.getByText('No source capture contracts or attempts exist for this week.')).toBeVisible();
  await expect(page.getByRole('progressbar',{name:'Candidate receipt coverage'}))
    .toHaveAttribute('aria-valuenow','0');
  const menu=page.getByRole('button',{name:'Open Charts navigation'});
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded','true');
  const main=page.locator('main').first();
  expect(await main.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(2);
  expect(ctx.unexpected).toEqual([]);
});

test('a falsely publishable source projection is rejected without showing claims',async({page})=>{
  const ctx=await install(page,{invalid:true});
  await page.goto('/admin/charts/wk100-operations?week=2026-11-02',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Source status unavailable'})).toBeVisible({timeout:20_000});
  await expect(page.getByRole('heading',{name:'Week of 2 November 2026'})).toHaveCount(0);
  expect(ctx.reads.length).toBeGreaterThanOrEqual(1);
  expect(ctx.unexpected).toEqual([]);
});

test('Admin method hold is independently persisted and never claims collection or publishing',async({page})=>{
  const proposals=[{
    id:'11111111-1111-4111-8111-111111111111',
    providerKey:'youtube_ke',sourceKey:'youtube_ke_top_songs_weekly',
    revision:1,surface:'YouTube Kenya official weekly chart',
    methodClass:'provider_api',behavior:'video_consumption',
    metric:'rank_and_count',expectedDepth:100,cadence:'weekly',
    intervalHours:null,eatHour:12,eatMinute:0,weekdayEat:0,
    minimumHealthyCheckpoints:1,evidenceReference:'wk100-method-research-2026',
    reason:null,createdAt:'2026-11-02T00:00:00Z',
    state:'proposed',canCollect:false,canScore:false,canPublish:false,
  }];
  const ctx=await install(page,{existingProposals:proposals});
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('youtube_ke_top_songs_weekly').first()).toBeVisible({timeout:20_000});
  await expect(page.getByText('No reviewed source methods yet.')).toBeVisible();
  await page.getByRole('button',{name:'Review Method'}).click();
  await expect(page.getByRole('heading',{name:'Review Source Method'})).toBeVisible();
  await page.getByRole('textbox',{name:'Constitution version'}).fill('wk100-research-constitution-v1');
  await page.getByRole('textbox',{name:'Decision reason'}).fill('Provider-native period remains unverified');
  await page.getByRole('button',{name:'Save method decision'}).click();
  await expect(page.getByRole('heading',{name:'Review Source Method'})).toHaveCount(0);
  await expect(page.getByRole('table',{name:'Source method decisions'}).getByText('held')).toBeVisible();
  expect(ctx.methodWrites).toHaveLength(1);
  const saved=ctx.methodWrites[0] as {action:string;decision:Record<string,unknown>;
    expectedDecisionRevision:number};
  expect(saved.action).toBe('review_source_method');
  expect(saved.expectedDecisionRevision).toBe(0);
  expect(saved.decision.sourceKey).toBe('youtube_ke_top_songs_weekly');
  expect(saved.decision.decisionState).toBe('held');
  expect(saved.decision.endpointSha256).toBeNull();
  expect(saved.decision.authorizationRef).toBeNull();
  expect(saved.decision).not.toHaveProperty('canCollect');
  expect(saved.decision).not.toHaveProperty('canPublish');
  expect(ctx.unexpected).toEqual([]);
});

test('Admin can enroll only an admitted current method as an inert candidate contract',async({page})=>{
  const sourceKey='apple_ke_catalog_most_played';
  const proposals=[{
    id:'11111111-1111-4111-8111-111111111111',
    providerKey:'apple_ke',sourceKey,revision:1,
    surface:'Apple Music Kenya native most played',
    methodClass:'provider_api',behavior:'consumption',metric:'rank',
    expectedDepth:100,cadence:'weekly',intervalHours:null,
    eatHour:9,eatMinute:0,weekdayEat:0,minimumHealthyCheckpoints:1,
    evidenceReference:'wk100-apple-method-research-2026',reason:null,
    createdAt:'2026-11-02T00:00:00Z',
    state:'proposed',canCollect:false,canScore:false,canPublish:false,
  }];
  const methods=[{
    sourceKey,providerKey:'apple_ke',proposalRevision:1,
    decisionRevision:2,decisionState:'collector_admitted',
    constitutionVersion:'research-acceptance-v1',createdAt:'2026-11-03T06:00:00Z',
    nativePeriodAuthority:'provider_defined',
    hasMethodEvidence:true,captureContractVersion:null,
    canScore:false,canPublish:false,
  }];
  const ctx=await install(page,{existingProposals:proposals,existingMethods:methods});
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  await expect(page.getByText(sourceKey).first()).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Review Method'}).click();
  await expect(page.getByText('Capture contract enrollment')).toBeVisible();
  await page.getByRole('textbox',{name:'Capture contract version'}).fill('apple-ke-v1');
  await page.getByRole('textbox',{name:'Verified adapter SHA-256'}).fill('a'.repeat(64));
  await page.getByRole('button',{name:'Enroll candidate capture contract'}).click();
  await expect(page.getByRole('heading',{name:'Review Source Method'})).toHaveCount(0);
  expect(ctx.contractWrites).toHaveLength(1);
  const sent=ctx.contractWrites[0] as {
    action:string;enrollment:Record<string,unknown>;
  };
  expect(sent.action).toBe('enroll_capture_contract');
  expect(sent.enrollment).toEqual({
    sourceKey,contractVersion:'apple-ke-v1',adapterSha256:'a'.repeat(64),
    expectedProposalRevision:1,expectedDecisionRevision:2,
  });
  await page.getByRole('button',{name:'Review Method'}).click();
  await expect(page.getByText('Contract apple-ke-v1 enrolled · Collection Off')).toBeVisible();
  await expect(page.getByRole('button',{name:'Enroll candidate capture contract'})).toHaveCount(0);
  expect(ctx.unexpected).toEqual([]);
});

test('W3 checks the stored original through the Admin readback command without exposing a private object path',async({page})=>{
  const contractId='33333333-3333-4333-8333-333333333333';
  const receiptId='44444444-4444-4444-8444-444444444444';
  const ctx=await install(page,{existingSources:[{
    id:contractId,sourceKey:'apple_ke_catalog_most_played',provider:'apple_ke',
    surface:'Apple Kenya native chart',market:'KE',metric:'rank',behavior:'consumption',
    expectedDepth:100,cadence:'weekly',version:'v1',intervalHours:null,
    eatHour:9,eatMinute:0,weekdayEat:0,minimumHealthyCheckpoints:1,
    adapterVersion:'apple_kenya_chart_v1',admissionState:'candidate',
    captureState:'succeeded',attemptCount:1,lastAttemptAt:'2026-11-02T06:03:00Z',
    lastScheduledAt:'2026-11-02T06:00:00Z',lastAttemptNumber:1,
    lastSuccessfulAt:'2026-11-02T06:03:00Z',observedDepth:100,
    nativePeriodAuthority:'unknown',nativePeriodStart:null,nativePeriodEnd:null,
    receiptSha256:'f'.repeat(64),failureCode:null,canScore:false,canPublish:false,
    recentAttempts:[{
      id:receiptId,status:'succeeded',attemptNumber:1,
      scheduledAt:'2026-11-02T06:00:00Z',attemptedAt:'2026-11-02T06:03:00Z',
      fetchedAt:'2026-11-02T06:03:00Z',failureCode:null,observedDepth:100,
    }],
  }]});
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/admin/charts/wk100-operations/collection?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  const table=page.getByRole('table',{name:'Weekly source collection'});
  await table.getByRole('button',{name:'Inspect original receipt'}).click();
  const inspector=page.getByRole('region',{name:'Source incident inspector'});
  await expect(inspector.getByRole('heading',{name:'Apple Kenya native chart'})).toBeVisible();
  const workbench=page.locator('[data-wk-w3-layout]');
  await expect(workbench).toBeVisible();
  await expect(inspector).toHaveAttribute('data-wk-incident-inline','');
  await expect(inspector.getByText('Private Original Readback')).toBeVisible({timeout:20_000});
  await expect.poll(async()=>workbench.evaluate(root=>{
    const main=root.querySelector('[data-wk-w3-master]')?.getBoundingClientRect();
    const side=root.querySelector('[data-wk-incident-inline]')?.getBoundingClientRect();
    return !!main&&!!side&&side.left>=main.right-5&&side.top<=main.bottom;
  }),{timeout:10_000}).toBe(true);
  await inspector.getByRole('button',{name:'Verify original · Attempt 1'}).click();
  await expect(inspector.getByText('Original verified in private Storage.',{exact:false}))
    .toBeVisible();
  expect(ctx.originalReads).toEqual([{action:'verify_private_original',
    weekStartEat:'2026-11-02',contractId,receiptId}]);
  expect(ctx.unexpected).toEqual([]);
  expect(ctx.writes).toEqual([]);
});

test('W3 mobile collection keeps the accessible right-hand incident Sheet',async({page})=>{
  const ctx=await install(page,{existingSources:[{
    id:'33333333-3333-4333-8333-333333333333',
    sourceKey:'shazam_ke_top_200',provider:'shazam_ke',surface:'Shazam Kenya Top 200',
    market:'KE',metric:'rank',behavior:'discovery',expectedDepth:200,
    cadence:'daily',intervalHours:null,eatHour:8,eatMinute:0,weekdayEat:null,
    minimumHealthyCheckpoints:7,adapterVersion:'shazam-test',version:'v1',
    admissionState:'candidate',captureState:'not_collected',attemptCount:0,
    lastAttemptAt:null,lastScheduledAt:null,lastAttemptNumber:null,
    lastSuccessfulAt:null,observedDepth:0,nativePeriodAuthority:'unknown',
    nativePeriodStart:null,nativePeriodEnd:null,receiptSha256:null,
    failureCode:null,recentAttempts:[],canScore:false,canPublish:false,
  }]});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin/charts/wk100-operations/collection?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  await page.getByRole('table',{name:'Weekly source collection'})
    .getByRole('button',{name:'Shazam Kenya Top 200'}).click();
  const sheet=page.getByRole('dialog',{name:'Shazam Kenya Top 200'});
  await expect(sheet).toBeVisible();
  await expect(page.locator('[data-wk-incident-inline]')).toHaveCount(0);
  await expect(sheet.getByRole('tab',{name:'History'})).toBeVisible();
  await sheet.getByRole('button',{name:'Close'}).click();
  await expect(sheet).toHaveCount(0);
  expect(ctx.unexpected).toEqual([]);
});

test('W3 week-bound retry request and coverage review use one signed-in audit command without publishing',async({page})=>{
  const now=new Date(),eat=new Date(now.valueOf()+3*60*60*1000);
  eat.setUTCDate(eat.getUTCDate()-((eat.getUTCDay()+6)%7));
  const week=eat.toISOString().slice(0,10);
  const slot=new Date(now.valueOf()-5*60*1000).toISOString();
  const source={
    id:'33333333-3333-4333-8333-333333333333',
    sourceKey:'apple_ke_catalog_most_played',provider:'apple_ke',
    surface:'Apple Music Kenya',market:'KE',metric:'rank',behavior:'consumption',
    expectedDepth:100,cadence:'weekly',version:'v1',intervalHours:null,
    eatHour:9,eatMinute:0,weekdayEat:0,minimumHealthyCheckpoints:1,
    adapterVersion:'apple_kenya_chart_v1',admissionState:'candidate',
    captureState:'transport_failed',attemptCount:1,lastAttemptAt:slot,
    lastScheduledAt:slot,lastAttemptNumber:1,lastSuccessfulAt:null,
    observedDepth:0,nativePeriodAuthority:'unknown',
    nativePeriodStart:null,nativePeriodEnd:null,receiptSha256:null,
    failureCode:'transport_failed',recentAttempts:[],canScore:false,canPublish:false,
  };
  const ctx=await install(page,{existingSources:[source]});
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/admin/charts/wk100-operations/collection?week='+week,
    {waitUntil:'domcontentloaded'});
  const table=page.getByRole('table',{name:'Weekly source collection'});
  await expect(page.getByRole('group',{name:'Candidate collection coverage breakdown'}))
    .toBeVisible({timeout:20_000});
  await table.getByRole('button',{name:'Apple Music Kenya'}).click();
  const inspector=page.getByRole('region',{name:'Source incident inspector'});
  await expect(inspector.getByRole('heading',{name:'Apple Music Kenya'})).toBeVisible();
  await inspector.getByRole('tab',{name:'History'}).click();
  await expect(inspector.getByText('Incident impact and recovery')).toBeVisible();
  await expect(inspector.getByText('No accepted original receipt for this source')).toBeVisible();
  await inspector.getByRole('button',{name:'Close'}).click();
  await expect(table.getByRole('button',{name:'Request Retry'})).toBeVisible({timeout:20_000});
  await table.getByRole('button',{name:'Request Retry'}).click();
  const retry=page.getByRole('dialog',{name:'Request Source Retry'});
  await expect(retry).toBeVisible();
  await retry.getByRole('textbox',{name:'Reason'}).fill('Retry after a confirmed transport error');
  await retry.getByRole('button',{name:'Confirm Action'}).click();
  await expect(retry).toHaveCount(0);
  await expect(page.getByText('retry requested')).toBeVisible();
  expect(ctx.recoveryWrites).toHaveLength(1);
  expect(ctx.recoveryWrites[0].p_action).toBe('request_retry');
  expect(ctx.recoveryWrites[0].p_week).toBe(week);
  expect(ctx.recoveryWrites[0].p_expected_attempt_number).toBe(1);
  expect(ctx.recoveryWrites[0].p_scheduled_at).toBe(slot);
  await table.getByRole('button',{name:'Request Coverage Review'}).click();
  const coverage=page.getByRole('dialog',{name:'Request Coverage Review'});
  await coverage.getByRole('textbox',{name:'Reason'}).fill('Source missing after transport failure');
  await coverage.getByRole('button',{name:'Confirm Action'}).click();
  await expect(coverage).toHaveCount(0);
  expect(ctx.recoveryWrites).toHaveLength(2);
  expect(ctx.recoveryWrites[1].p_action).toBe('request_exception');
  expect(ctx.recoveryWrites[1].p_expected_revision).toBe(0);
  expect(ctx.recoveryWrites[1].p_scheduled_at).toBeNull();
  expect(ctx.writes).toEqual([]);
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.contractWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});

test('W3 incident pause uses the existing protected method command and cannot re-admit a source',async({page})=>{
  const sourceKey='apple_ke_catalog_most_played';
  const proposals=[{
    id:'11111111-1111-4111-8111-111111111111',
    providerKey:'apple_ke',sourceKey,revision:1,
    surface:'Apple Kenya chart method',
    methodClass:'provider_api',behavior:'consumption',metric:'rank',
    expectedDepth:100,cadence:'daily',intervalHours:null,eatHour:12,
    eatMinute:0,weekdayEat:null,minimumHealthyCheckpoints:7,
    evidenceReference:'synthetic_browser_evidence',reason:null,
    createdAt:'2026-11-02T00:00:00Z',state:'proposed',
    canCollect:false,canScore:false,canPublish:false,
  }];
  const methods=[{
    sourceKey,providerKey:'apple_ke',proposalRevision:1,
    decisionRevision:1,decisionState:'collector_admitted',
    constitutionVersion:'wk100-synthetic-v1',createdAt:'2026-11-03T06:00:00Z',
    nativePeriodAuthority:'provider_defined',hasMethodEvidence:true,
    captureContractVersion:'ci-v1',canScore:false,canPublish:false,
  }];
  const sources=[{
    id:'22222222-2222-4222-8222-222222222222',sourceKey,
    provider:'apple_ke',surface:'Apple Kenya chart method',
    market:'KE',metric:'rank',behavior:'consumption',expectedDepth:100,
    cadence:'daily',version:'ci-v1',intervalHours:null,eatHour:12,eatMinute:0,
    weekdayEat:null,minimumHealthyCheckpoints:7,adapterVersion:'apple_kenya_chart_v1',
    admissionState:'candidate',captureState:'transport_failed',attemptCount:1,
    lastAttemptAt:'2026-11-03T06:00:00Z',lastSuccessfulAt:null,observedDepth:0,
    nativePeriodAuthority:'unknown',nativePeriodStart:null,nativePeriodEnd:null,
    receiptSha256:null,failureCode:'transport_failed',canScore:false,canPublish:false,
    recentAttempts:[],
  }];
  const ctx=await install(page,{existingProposals:proposals,
    existingMethods:methods,existingSources:sources});
  await page.goto('/admin/charts/wk100-operations/collection?week=2026-11-02',
    {waitUntil:'domcontentloaded'});
  const table=page.getByRole('table',{name:'Weekly source collection'});
  await expect(table.getByRole('button',{name:'Pause Collection'})).toBeVisible({timeout:20_000});
  await table.getByRole('button',{name:'Pause Collection'}).click();
  await expect(page.getByRole('heading',{name:'Pause Source Method'})).toBeVisible();
  await expect(page.getByText('Pause reviewed method')).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Constitution version'})).toHaveValue('wk100-synthetic-v1');
  await expect(page.getByRole('button',{name:'Enroll candidate capture contract'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Confirm Pause'})).toBeDisabled();
  await page.getByRole('textbox',{name:'Decision reason'}).fill('Stop collection following a transport incident');
  await page.getByRole('button',{name:'Confirm Pause'}).click();
  await expect(page.getByRole('heading',{name:'Pause Source Method'})).toHaveCount(0);
  await expect(table.getByText('Paused')).toBeVisible();
  await expect(table.getByRole('button',{name:'Pause Collection'})).toHaveCount(0);
  expect(ctx.methodWrites).toHaveLength(1);
  const review=ctx.methodWrites[0] as {
    action:string;decision:Record<string,unknown>;expectedDecisionRevision:number;
  };
  expect(review.action).toBe('review_source_method');
  expect(review.expectedDecisionRevision).toBe(1);
  expect(review.decision.decisionState).toBe('paused');
  expect(review.decision.constitutionVersion).toBe('wk100-synthetic-v1');
  expect(review.decision.endpointSha256).toBeNull();
  expect(review.decision.authorizationRef).toBeNull();
  expect(ctx.contractWrites).toHaveLength(0);
  expect(ctx.unexpected).toEqual([]);
});


test('W3 Collect Now uses current-week signed-in SQL intent, never a browser collector',async({page})=>{
  const now=new Date(),east=new Date(now.valueOf()+3*60*60*1000);
  east.setUTCDate(east.getUTCDate()-((east.getUTCDay()+6)%7));
  const week=east.toISOString().slice(0,10);
  const source={
    id:'33333333-3333-4333-8333-333333333333',
    sourceKey:'apple_ke_catalog_most_played',provider:'apple_ke',
    surface:'Apple Music Kenya',market:'KE',metric:'rank',behavior:'consumption',
    expectedDepth:100,cadence:'weekly',version:'v1',intervalHours:null,
    eatHour:9,eatMinute:0,weekdayEat:0,minimumHealthyCheckpoints:1,
    adapterVersion:'apple_kenya_chart_v1',admissionState:'candidate',
    captureState:'not_collected',attemptCount:0,lastAttemptAt:null,
    lastScheduledAt:null,lastAttemptNumber:null,lastSuccessfulAt:null,
    observedDepth:0,nativePeriodAuthority:'unknown',
    nativePeriodStart:null,nativePeriodEnd:null,receiptSha256:null,
    failureCode:null,recentAttempts:[],canScore:false,canPublish:false,
  };
  const proposal={providerKey:'apple_ke',sourceKey:source.sourceKey,
    revision:1,surface:source.surface,state:'proposed',
    canCollect:false,canScore:false,canPublish:false};
  const method={providerKey:'apple_ke',sourceKey:source.sourceKey,
    proposalRevision:1,decisionRevision:1,decisionState:'collector_admitted',
    captureContractVersion:'v1',canScore:false,canPublish:false};
  const ctx=await install(page,{existingSources:[source],
    existingProposals:[proposal],existingMethods:[method]});
  await page.goto('/admin/charts/wk100-operations/collection?week='+week,
    {waitUntil:'domcontentloaded'});
  const table=page.getByRole('table',{name:'Weekly source collection'});
  const collect=table.getByRole('button',{name:'Collect Now'});
  await expect(collect).toBeVisible({timeout:20_000});
  await collect.click();
  await expect(table.getByRole('button',{name:'Request Recorded'})).toBeDisabled();
  await expect(page.getByRole('status').filter({hasText:'No capture receipt is confirmed yet.'}))
    .toBeVisible();
  expect(ctx.collectNowWrites).toHaveLength(1);
  expect(ctx.collectNowWrites[0].p_contract_id).toBe(source.id);
  expect(ctx.collectNowWrites[0].p_operation_id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(ctx.methodWrites).toEqual([]);
  expect(ctx.recoveryWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
  const previous=new Date(east.valueOf()-7*24*60*60*1000).toISOString().slice(0,10);
  await page.goto('/admin/charts/wk100-operations/collection?week='+previous,
    {waitUntil:'domcontentloaded'});
  await expect(table.getByRole('button',{name:'Collect Now'})).toHaveCount(0);
  expect(ctx.collectNowWrites).toHaveLength(1);
});

test('W3 does not expose Collect Now without a current reviewed and enrolled method',async({page})=>{
  const now=new Date(),east=new Date(now.valueOf()+3*60*60*1000);
  east.setUTCDate(east.getUTCDate()-((east.getUTCDay()+6)%7));
  const week=east.toISOString().slice(0,10);
  const ctx=await install(page,{existingSources:[{
    id:'33333333-3333-4333-8333-333333333333',
    sourceKey:'apple_ke_catalog_most_played',provider:'apple_ke',
    surface:'Apple Music Kenya',market:'KE',version:'v1',
    admissionState:'candidate',captureState:'not_collected',
    recentAttempts:[],receiptSha256:null,canScore:false,canPublish:false,
  }]});
  await page.goto('/admin/charts/wk100-operations/collection?week='+week,
    {waitUntil:'domcontentloaded'});
  const table=page.getByRole('table',{name:'Weekly source collection'});
  await expect(table.getByText('No current admitted method')).toBeVisible();
  await expect(table.getByRole('button',{name:'Collect Now'})).toHaveCount(0);
  expect(ctx.collectNowWrites).toEqual([]);
  expect(ctx.unexpected).toEqual([]);
});
