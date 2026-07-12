create or replace function public.accept_registry_missing_artist_intake(p_submission_id uuid,p_review_reason text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare s public.contributor_submissions; slug text; artist_id uuid; src_count int:=0; tgt_count int:=0; r record;
begin
if not (auth.role()='service_role' or public.current_user_has_capability('manage_registry') or public.current_user_has_capability('manage_review_queue') or public.current_user_is_administrator()) then raise exception 'You do not have permission to accept Registry artist intake submissions.'; end if;
if nullif(btrim(p_review_reason),'') is null then raise exception 'A review reason is required.'; end if;
select * into s from public.contributor_submissions where id=p_submission_id for update;
if not found then raise exception 'Contributor submission not found.'; end if;
if s.submission_type<>'context_note' then raise exception 'This submission is not a missing-artist intake record.'; end if;
slug:=substring(s.source_note from '^missing_artist_slug:([^[:space:]]+)');
if nullif(slug,'') is null then raise exception 'The submission does not contain a missing artist slug.'; end if;
if s.review_status not in ('submitted','triaged','needs_source','needs_clarification') then raise exception 'This intake submission is not in an acceptable review state.'; end if;
if not exists(select 1 from public.registry_relationship_endpoint_work_queue q where q.endpoint_work_state='missing_entity' and q.missing_entity_type='artist' and q.legacy_slug=slug) then raise exception 'This artist is no longer required by the missing endpoint queue.'; end if;
if exists(select 1 from public.registry_artists a where lower(a.slug)=lower(slug)) then raise exception 'A Registry artist already exists for this slug.'; end if;
insert into public.registry_artists(slug,display_name,normalized_name,sort_name,artist_type,status,metadata)
values(slug,btrim(s.title),lower(regexp_replace(btrim(s.title),'\s+',' ','g')),btrim(s.title),'unknown','needs_review',jsonb_build_object('created_from','missing_artist_intake','source_submission_id',s.id::text,'source_url',s.source_url,'intake_reason',s.body,'acceptance_reason',btrim(p_review_reason),'created_at',now())) returning id into artist_id;
update public.registry_artist_aliases set canonical_artist_id=artist_id,alias_display_name=btrim(s.title),confidence=100,source='manual_intake',notes=btrim(p_review_reason),status='active' where lower(alias_slug)=lower(slug);
if not found then insert into public.registry_artist_aliases(alias_slug,canonical_artist_id,alias_display_name,confidence,source,notes,status) values(slug,artist_id,btrim(s.title),100,'manual_intake',btrim(p_review_reason),'active'); end if;
for r in select id from public.registry_entity_relationships where relationship_status<>'archived' and source_entity_id is null and source_entity_type='artist' and source_slug=slug loop perform public.resolve_registry_relationship_endpoint(r.id,'source','artist',artist_id,btrim(p_review_reason)); src_count:=src_count+1; end loop;
for r in select id from public.registry_entity_relationships where relationship_status<>'archived' and target_entity_id is null and target_entity_type='artist' and target_slug=slug loop perform public.resolve_registry_relationship_endpoint(r.id,'target','artist',artist_id,btrim(p_review_reason)); tgt_count:=tgt_count+1; end loop;
update public.contributor_submissions set entity_id=artist_id,review_status='merged',reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_review_reason),updated_at=now() where id=p_submission_id;
insert into public.review_decisions(subject_type,subject_id,decision,reason,reviewer_id) values('contributor_submission',p_submission_id,'approved',btrim(p_review_reason),auth.uid());
return jsonb_build_object('submissionId',p_submission_id,'artistId',artist_id,'artistSlug',slug,'artistStatus','needs_review','sourceEndpointsResolved',src_count,'targetEndpointsResolved',tgt_count,'relationshipsResolved',src_count+tgt_count,'publicSafe',false);
end;$$;
revoke all on function public.accept_registry_missing_artist_intake(uuid,text) from public,anon;
grant execute on function public.accept_registry_missing_artist_intake(uuid,text) to authenticated,service_role;
comment on function public.accept_registry_missing_artist_intake(uuid,text) is 'Accepts one reviewed missing-artist intake, creates a needs-review Registry artist, resolves exact legacy relationship endpoints, and keeps all affected relationships non-public.';;
