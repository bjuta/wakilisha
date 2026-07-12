create or replace function public.enforce_registry_relationship_promotion_rules()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.review_status = 'approved' then
    if not exists (
      select 1
      from public.registry_relationship_evidence rre
      join public.evidence_items e on e.id = rre.evidence_id
      where rre.relationship_id = new.id
        and rre.support_type = 'supports'
        and e.review_status in ('reviewed', 'approved')
    ) then
      raise exception 'Approved relationships require at least one reviewed supporting evidence item.';
    end if;
  end if;

  if new.public_safe then
    if new.review_status <> 'approved'
       or new.relationship_status <> 'active'
       or nullif(btrim(new.plain_reason), '') is null then
      raise exception 'Public-safe relationships must be active, approved, and include a plain-language reason.';
    end if;

    if not exists (
      select 1
      from public.registry_relationship_evidence rre
      join public.evidence_items e on e.id = rre.evidence_id
      where rre.relationship_id = new.id
        and rre.support_type = 'supports'
        and e.review_status = 'approved'
        and e.retrieval_status = 'default_retrieval'
    ) then
      raise exception 'Public-safe relationships require approved supporting evidence enabled for default retrieval.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registry_relationship_promotion_rules
  on public.registry_entity_relationships;

create trigger trg_registry_relationship_promotion_rules
before insert or update of review_status, relationship_status, public_safe, plain_reason
on public.registry_entity_relationships
for each row
execute function public.enforce_registry_relationship_promotion_rules();

revoke all on function public.enforce_registry_relationship_promotion_rules() from public;
revoke all on function public.enforce_registry_relationship_promotion_rules() from anon;
revoke all on function public.enforce_registry_relationship_promotion_rules() from authenticated;;
