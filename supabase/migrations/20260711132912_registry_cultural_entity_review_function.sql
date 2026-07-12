create or replace function public.review_registry_cultural_entity(p_entity_id uuid,p_next_review_status text,p_next_status text,p_public_safe boolean,p_reason text)
returns public.cultural_entities language plpgsql security definer set search_path=public,auth as $$
declare v_current public.cultural_entities; v_updated public.cultural_entities; v_decision text;
begin
if not public.institute_can_review() then raise exception 'You do not have permission to review Registry cultural entities.'; end if;
if p_next_review_status not in ('pending_review','approved','rejected','disputed') then raise exception 'Unsupported cultural entity review status.'; end if;
if p_next_status not in ('draft','active','archived') then raise exception 'Unsupported cultural entity status.'; end if;
if nullif(btrim(p_reason),'') is null then raise exception 'A review reason is required.'; end if;
select * into v_current from public.cultural_entities where id=p_entity_id for update;
if not found then raise exception 'Registry cultural entity not found.'; end if;
if v_current.entity_type in ('artist','track','release','label','genre') then raise exception 'Music entities must be reviewed in their authoritative Registry tables.'; end if;
if p_public_safe and (p_next_review_status<>'approved' or p_next_status<>'active' or nullif(btrim(v_current.description),'') is null) then raise exception 'Public-safe cultural entities must be active, approved, and described.'; end if;
v_decision:=case when p_next_review_status='approved' then 'approved' when p_next_review_status='rejected' then 'rejected' else 'needs_more_evidence' end;
update public.cultural_entities set review_status=p_next_review_status,status=p_next_status,public_safe=p_public_safe,reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_reason),updated_at=now() where id=p_entity_id returning * into v_updated;
insert into public.review_decisions(subject_type,subject_id,decision,reason,reviewer_id) values('cultural_entity',p_entity_id,v_decision,btrim(p_reason),auth.uid());
return v_updated;
end;$$;;
