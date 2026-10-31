/**
 * WAKILISHA Chart Ingest full-filter policy decision kernel (isolated PACKAGE 2 prototype).
 * No DB, network, Registry mutations or ranking. All input facts must be evidence-backed.
 * This DOES NOT make the pending policy snapshot production-scoreable. The existing
 * assertIngestEvaluatorReady hold must remain until integration and acceptance.
 */
import {verifyIngestPolicySnapshot} from './chart-ingest-policy-snapshot.mjs';

export const FILTER_OUTCOME = Object.freeze({
  ELIGIBLE:'ELIGIBLE', EXCLUDED:'EXCLUDED', REVIEW_REQUIRED:'REVIEW_REQUIRED', CONFLICTED:'CONFLICTED',
});
const o = x => !!x && typeof x === 'object' && !Array.isArray(x);
const str = x => typeof x === 'string' && x.trim() ? x.trim() : null;
const iso = x => (typeof x === 'string' && /^[A-Z]{2}$/.test(x)) ? x : null;
const list = x => Array.isArray(x) ? x : [];
const norm = x => str(x)?.toLowerCase() ?? null;
const set = x => new Set(list(x).map(norm).filter(Boolean));
const has = (x,key) => Object.prototype.hasOwnProperty.call(x,key);
const validDate = d => typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d+'T00:00:00Z').toISOString().slice(0,10) === d;

function decision() {
  const events=[];
  const append=(status, code, field, detail='')=>events.push({status,code,field,detail});
  const missing=(code, field)=>append(FILTER_OUTCOME.REVIEW_REQUIRED, code, field);
  const exclude=(code, field)=>append(FILTER_OUTCOME.EXCLUDED, code, field);
  const conflict=(code, field)=>append(FILTER_OUTCOME.CONFLICTED, code, field);
  const done=()=>{
    const status=[FILTER_OUTCOME.CONFLICTED,FILTER_OUTCOME.EXCLUDED,FILTER_OUTCOME.REVIEW_REQUIRED].find(s=>events.some(e=>e.status===s))??FILTER_OUTCOME.ELIGIBLE;
    return {status, passesFilterPredicates:status===FILTER_OUTCOME.ELIGIBLE, mayScore:false, mayMutateRegistry:false, reasons:events};
  };
  return {append,missing,exclude,conflict,done};
}
function equalityKnown(value,allowed,scope,d) {
  if (value==null) d.missing(`${scope}_unknown`,scope);
  else if(!allowed.has(norm(value))) d.exclude(`${scope}_not_allowed`,scope);
}
function verifySource(facts,profile,scope,d) {
  const source=o(facts.source)?facts.source:{};
  const provider=norm(source.provider);
  if (!provider) d.missing('source_provider_unknown','source.provider');
  else if (profile.sourceRules.allowedProviders.length && !set(profile.sourceRules.allowedProviders).has(provider)) d.exclude('source_provider_not_allowed','source.provider');
  if (profile.sourceRules.requireAtLeastOneProviderId) {
    if(!str(source.providerTrackId)&&!str(source.providerReleaseId)) d.missing('provider_identity_unknown','source.providerTrackId');
  }
  if (profile.sourceRules.requireProviderAvailabilityInMarket) {
    const market=iso(facts.marketIso2);
    if(!market) d.missing('target_market_unknown','marketIso2');
    else if (source.availableMarkets==null && source.restrictedMarkets==null) d.missing('source_market_availability_unknown','source.availableMarkets');
    else {
      const available=list(source.availableMarkets).map(iso).filter(Boolean);
      const restricted=list(source.restrictedMarkets).map(iso).filter(Boolean);
      if((available.length && !available.includes(market)) || restricted.includes(market)) d.exclude('source_unavailable_in_market','source.availableMarkets');
    }
  }
  // Market selection cannot substitute for artist-origin or recording metadata.
  const included=list(scope.includedMarkets).map(v=>iso(v?.countryCode)).filter(Boolean);
  if(!included.length) d.conflict('configured_market_scope_invalid','marketScope.includedMarkets');
  if(facts.marketIso2!=null && !iso(facts.marketIso2)) d.conflict('invalid_target_market','marketIso2');
  if(iso(facts.marketIso2) && !included.includes(facts.marketIso2)) d.exclude('target_market_outside_scope','marketIso2');
}
function artistPrimary(credits,d) {
  if(!Array.isArray(credits) || !credits.length) {d.missing('artist_credits_unknown','credits'); return null;}
  const matched=credits.filter(c=>c?.role==='primary');
  if(matched.length!==1) {d.conflict('primary_credit_ambiguous','credits');return null;}
  if(credits.some(c=>!str(c?.artistId))) d.missing('canonical_artist_identity_unknown','credits.artistId');
  const ids=credits.map(c=>str(c?.artistId)).filter(Boolean);
  if(new Set(ids).size!==ids.length) d.conflict('duplicate_artist_credit','credits');
  if(credits.some(c=>!['primary','featured','other'].includes(c?.role))) d.conflict('unknown_credit_role','credits.role');
  return matched[0];
}
function artistRules(facts,profile,scope,d) {
  const credits=list(facts.credits);
  const primary=artistPrimary(facts.credits,d);
  const col=profile.collaborationRules;
  if (!col.allowFeaturedArtists && credits.some(c=>c.role==='featured')) d.exclude('featured_artist_not_allowed','credits.role');

  const origin=profile.artistOriginEligibility;
  const scoped=list(scope.artistOriginCountries);
  const enabled=origin.mode!=='any' || scoped.length>0;
  if(enabled) {
    if(['custom'].includes(origin.mode)) d.conflict('custom_origin_predicate_unconfigured','artistOriginEligibility.mode');
    const allowed=new Set((origin.mode==='any'?scoped:origin.countries).map(iso).filter(Boolean));
    // If BOTH scope and profile restrict ISO2, require BOTH (never choose one silently).
    const scopedSet=new Set(scoped.map(iso).filter(Boolean));
    function originStatus(c){
      if(!c) return 'unknown';
      const country=iso(c.originIso2);
      if(scopedSet.size && !country) return 'unknown';
      if(scopedSet.size && !scopedSet.has(country)) return 'no';
      if(origin.mode==='region_only'){
        const regions=list(c.regionIds).map(norm);
        if(!regions.length) return 'unknown';
        return regions.some(r=>set(origin.regions).has(r))?'yes':'no';
      }
      if(origin.mode==='diaspora_only'){
        // Country alone never proves diaspora membership.
        const diasporas=list(c.verifiedDiasporaMarkets).map(norm);
        if(!diasporas.length) return 'unknown';
        return diasporas.some(r=>set(origin.diasporaMarkets).has(r))?'yes':'no';
      }
      if(!country) return 'unknown';
      if(origin.mode!=='any' && !allowed.has(country)) return 'no';
      if(scopedSet.size && !scopedSet.has(country)) return 'no';
      return 'yes';
    }
    const eligibleCredits=col.countFeaturedArtistNationality?credits:credits.filter(c=>c.role==='primary');
    const relevant=eligibleCredits.map(originStatus);
    const first=originStatus(primary);
    if(col.primaryArtistMustMatchEligibility && first==='no') d.exclude('primary_artist_origin_not_allowed','credits.originIso2');
    if(col.primaryArtistMustMatchEligibility && first==='unknown') d.missing('primary_artist_origin_unknown','credits.originIso2');
    if(col.allArtistsMustMatchEligibility){
      const all=credits.map(originStatus);
      if(all.includes('no')) d.exclude('credited_artist_origin_not_allowed','credits.originIso2');
      if(all.includes('unknown')) d.missing('credited_artist_origin_unknown','credits.originIso2');
    }
    const required=col.minEligibleArtistsRequired??(col.primaryArtistMustMatchEligibility?0:1);
    if(required>0){
      const yes=relevant.filter(s=>s==='yes').length,unknown=relevant.filter(s=>s==='unknown').length;
      if(yes+unknown<required) d.exclude('eligible_artist_minimum_impossible','credits.originIso2');
      else if(yes<required) d.missing('eligible_artist_minimum_unverified','credits.originIso2');
    }
    // When no primary required and no min configured, min=1 above is essential.
  }
  const gender=profile.artistGenderEligibility.mode;
  if(gender!=='any') {
    if(['custom','non_binary_inclusive'].includes(gender)) d.conflict('gender_policy_definition_required','artistGenderEligibility.mode');
    else if(!primary || !norm(primary.gender)) d.missing('artist_gender_unknown','credits.gender');
    else if(!({'female_only':['female'],'male_only':['male'],'mixed_gender_only':['mixed','mixed_gender']}[gender]??[]).includes(norm(primary.gender))) d.exclude('artist_gender_not_allowed','credits.gender');
  }
  const kind=profile.artistTypeEligibility.mode;
  if(kind!=='any') {
    if(kind==='custom') d.conflict('artist_type_policy_definition_required','artistTypeEligibility.mode');
    else if(!primary || !norm(primary.artistType)) d.missing('artist_type_unknown','credits.artistType');
    else if(!({'solo_artists_only':['solo'],'groups_collectives_only':['group','collective','band','duo'],'bands_only':['band'],'duos_only':['duo'],'labels_only':['label']}[kind]??[]).includes(norm(primary.artistType))) d.exclude('artist_type_not_allowed','credits.artistType');
  }
  if(profile.reviewRules.requireManualReviewForGroups && primary && ['group','collective','band','duo'].includes(norm(primary.artistType))) d.missing('group_review_required','credits.artistType');
}
function releaseRules(facts,profile,d){
  const release=o(facts.release)?facts.release:{};
  const rule=profile.releaseEligibility;
  equalityKnown(norm(release.type), set(rule.releaseTypes),'release_type',d);
  if(rule.releaseWindowFrom||rule.releaseWindowTo){
    if(release.date==null)d.missing('release_date_unknown','release.date');
    else if(!validDate(release.date))d.conflict('release_date_invalid','release.date');
    else if((rule.releaseWindowFrom&&release.date<rule.releaseWindowFrom)||(rule.releaseWindowTo&&release.date>rule.releaseWindowTo))d.exclude('release_outside_window','release.date');
  }
  const flags=[['includeReissues','reissue'],['includeRemixes','remix'],['includeAcousticVersions','acoustic'],['includeInstrumentals','instrumental']];
  for(const [ruleKey,factKey] of flags){
    if(rule[ruleKey]===false){
      const f=release.versions?.[factKey];
      if(typeof f!=='boolean')d.missing(`release_${factKey}_status_unknown`,`release.versions.${factKey}`);
      else if(f)d.exclude(`release_${factKey}_not_allowed`,`release.versions.${factKey}`);
    }
  }
}
function trackRules(facts,profile,d){
  const t=o(facts.track)?facts.track:{};
  const r=profile.trackEligibility;
  if(!str(t.title))d.missing('track_title_unknown','track.title');
  if(r.requireIsrc){
    if(!str(t.isrc)) d.missing('isrc_unknown','track.isrc');
    else if(!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(t.isrc)) d.conflict('isrc_invalid','track.isrc');
  }
  if(r.requirePreview){
    if(!str(t.previewUrl))d.missing('preview_unknown','track.previewUrl');
    else if(!/^https:\/\//i.test(t.previewUrl))d.conflict('preview_url_invalid','track.previewUrl');
  }
  if(r.explicitAllowed===false){
    if(typeof t.explicit!=='boolean') d.missing('explicit_status_unknown','track.explicit');
    else if(t.explicit)d.exclude('explicit_track_not_allowed','track.explicit');
  }
  if(r.minDurationMs!=null||r.maxDurationMs!=null){
    if(!Number.isFinite(t.durationMs)||t.durationMs<=0) d.missing('track_duration_unknown','track.durationMs');
    else if((r.minDurationMs!=null&&t.durationMs<r.minDurationMs)||(r.maxDurationMs!=null&&t.durationMs>r.maxDurationMs))d.exclude('track_duration_outside_range','track.durationMs');
  }
  for(const [key,field] of [['allowedLanguages','languages'],['allowedGenres','genres']]){
    const allowed=set(r[key]);if(!allowed.size)continue;
    const observed=list(t[field]).map(norm).filter(Boolean);
    if(!observed.length)d.missing(`${field}_unknown`,`track.${field}`);
    else if(!observed.some(x=>allowed.has(x)))d.exclude(`${field}_not_allowed`,`track.${field}`);
  }
  const excluded=set(r.excludedGenres);
  if(excluded.size){
    const genres=list(t.genres).map(norm).filter(Boolean);
    if(!genres.length)d.missing('genres_unknown','track.genres');
    else if(genres.some(x=>excluded.has(x)))d.exclude('genre_excluded','track.genres');
  }
}

/** All four statuses are non-mutating. Every predicate is evaluated; known failures
 * do not erase unknown/conflicted requirements. A score can be considered only
 * after the separate existing stage/period/source/Registry release gates pass. */
export async function evaluateFrozenChartIngestCandidate(frozen, facts) {
  const d=decision();
  const verified=await verifyIngestPolicySnapshot(frozen);
  if(!verified.ok){d.conflict(`policy_${verified.code}`,'ingestPolicy');return d.done();}
  if(!o(facts)){d.conflict('candidate_facts_not_object','facts');return d.done();}
  if(facts.hasIdentityConflict===true) d.conflict('candidate_identity_conflict','canonicalTrackId');
  if(!str(facts.canonicalTrackId)) d.missing('canonical_track_identity_unknown','canonicalTrackId');
  const {eligibilityProfileSnapshot:profile,marketScopeSnapshot:scope}=verified.snapshot;
  verifySource(facts,profile,scope,d);
  artistRules(facts,profile,scope,d);
  releaseRules(facts,profile,d);
  trackRules(facts,profile,d);
  return d.done();
}
