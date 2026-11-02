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
async function install(page:Page,{invalid=false,deny=false}:{invalid?:boolean;deny?:boolean}={}) {
  const reads:unknown[]=[];
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
    if(url.pathname==='/functions/v1/wk100-source-admin-read') {
      if(req.method()!=='POST'){await json(route,{error:'read_only_post_required'},405);return;}
      let body:unknown;
      try {body=JSON.parse(req.postData()||'null');}catch{body=null;}
      reads.push(body);
      const week=body&&typeof body==='object'&&'weekStartEat' in body
        ?String(body.weekStartEat):'';
      await json(route,{
        schemaVersion:'wk100-admin-source-health-v1',weekStartEat:week,
        sourceCount:0,successfulSources:0,failedSources:0,qualifiedSources:0,
        canScore:false,canPublish:invalid,sources:[],
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
  return {reads,unexpected};
}

test('source overview stays truthful, carries EAT week through navigation and uses no publisher',async({page})=>{
  const ctx=await install(page);
  await page.goto('/admin/charts/wk100-operations?week=2026-10-26',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Weekly Overview'})).toBeVisible({timeout:20_000});
  await expect(page.getByText('No enrolled capture sources yet.')).toBeVisible();
  await expect(page.getByText('Publication locked')).toBeVisible();
  await page.getByRole('button',{name:'Sources',exact:true}).click();
  await expect(page).toHaveURL(/wk100-operations\/sources\?week=2026-10-26/);
  await expect(page.getByRole('heading',{name:'Source Registry'}).first()).toBeVisible();
  await expect(page.getByText('No source capture contracts are registered.')).toBeVisible();
  expect(ctx.reads.length).toBeGreaterThanOrEqual(2);
  for(const body of ctx.reads)expect(body).toEqual({action:'read_source_health',weekStartEat:'2026-10-26'});
  expect(ctx.unexpected).toEqual([]);
});

test('Add Source is a three-step review, not an ungoverned source write',async({page})=>{
  const ctx=await install(page);
  await page.goto('/admin/charts/wk100-operations/sources?week=2026-11-02',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('No source capture contracts are registered.')).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Add Source'}).click();
  await expect(page.getByRole('heading',{name:'Which provider?'})).toBeVisible();
  await page.getByRole('button',{name:/YouTube Kenya/}).click();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'Verify the approved surface'})).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'Review source qualification'})).toBeVisible();
  await expect(page.getByText('Source creation is not yet enabled.')).toBeVisible();
  await page.getByRole('button',{name:'Close review'}).click();
  for(const body of ctx.reads)expect(body).toEqual({action:'read_source_health',weekStartEat:'2026-11-02'});
  expect(ctx.unexpected).toEqual([]);
});

test('mobile source navigation and parent theme toggle remain usable',async({page})=>{
  const ctx=await install(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin/charts/wk100-operations/collection?week=2026-11-02',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Collection & Incidents'})).toBeVisible({timeout:20_000});
  await expect(page.getByText('No source capture contracts or attempts exist for this week.')).toBeVisible();
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
