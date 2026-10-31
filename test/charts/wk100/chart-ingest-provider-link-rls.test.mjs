import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessRegistryProviderLinkEvidence as assess} from '../../../supabase/functions/_shared/chart-ingest-run-provenance.mjs';

const TRACK='11111111-1111-4111-8111-111111111111';
const OTHER='99999999-9999-4999-8999-999999999999';
const base={canonicalTrackId:TRACK,provider:'Mdundo',providerTrackId:'MDUNDO_123'};
const link=(status='matched',id='mdundo-123',track=TRACK,provider='mdundo')=>({track_id:track,provider_key:provider,provider_track_id:id,match_status:status});
const check=(links)=>assess({...base,registryProviderLinks:links});

test('existing matched canonical ID remains valid evidence (never score authorization)',()=>assert.deepEqual(check([link()]),[]));
test('needs_review link must produce named hold',()=>assert.deepEqual(check([link('needs_review')]).map(b=>b.code),['provider_link_not_accepted']));
test('rejected canonical link is a hard identity conflict',()=>assert.equal(check([link('rejected')])[0].severity,'CONFLICTED'));
test('stale canonical link requires editorial review',()=>assert.equal(check([link('stale')])[0].severity,'REVIEW_REQUIRED'));
test('unavailable canonical link requires editorial review',()=>assert.equal(check([link('unavailable')])[0].severity,'REVIEW_REQUIRED'));
test('different attached ID under same provider must not be treated as matching',()=>assert.equal(check([link('matched','different-track')])[0].code,'provider_link_identity_unverified'));
test('distinct IDs compacted to one provider alias cannot be double counted',()=>assert.equal(check([link('matched','mdundo-123'),link('matched','MDUNDO_123')])[0].code,'provider_link_compaction_collision'));
test('unrelated canonical Track provider links do not contaminate candidate',()=>assert.deepEqual(check([link('needs_review','mdundo-123',OTHER)]),[]));
test('different provider link under same Track is not the source identity',()=>assert.deepEqual(check([link('needs_review','mdundo-123',TRACK,'spotify')]),[]));
test('empty materialized link list does not fabricate Registry identity',()=>assert.deepEqual(check([]),[]));
test('omitted caller-scoped provider link rows cannot be treated as complete',()=>assert.throws(()=>assess({...base}),/complete Registry/));
test('unknown provider ID triggers review, never a green source result',()=>assert.equal(assess({...base,providerTrackId:'',registryProviderLinks:[]})[0].severity,'REVIEW_REQUIRED'));
test('alias normalization respects compact provider object identity only',()=>assert.deepEqual(assess({...base,provider:'YouTubeMusic',providerTrackId:'Vid_123',registryProviderLinks:[link('matched','vid-123',TRACK,'youtube')]}),[]));

test('exact RLS policy preserves public matched read and gates expanded Admin read with existing capability only',()=>{
 const sql=readFileSync(new URL('../../../supabase/migrations/20261030180827_chart_full_filter_decision_execution_v1.sql',import.meta.url),'utf8');
 const frag=sql.split('CREATE POLICY wk100_registry_track_provider_links_admin_review_read_v1')[1]?.split(';',1)[0]??'';
 assert.match(frag,/ON public\.registry_track_provider_links\s+FOR SELECT TO authenticated/);
 assert.match(frag,/current_user_has_capability\('view_registry'\)/);
 assert.match(frag,/current_user_is_administrator\(\)/);
 assert.doesNotMatch(frag,/\bGRANT\s+(?:SELECT|ALL)\b/i);
 assert.doesNotMatch(frag,/\bservice_role\b/i);
});
