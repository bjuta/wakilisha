-- WAKILISHA 100 #1358. CLI-minted by Supabase CLI v2.107.0:
-- 20261112123805_wk100_governed_publisher_withdrawal_v1.sql
-- Governs visibility withdrawal; it does not undo historical publication.
-- Retain the original approval, stage, publication, 100 ranked entries, and
-- source/capture evidence. No Production activation by repository merge alone.
begin;
set local lock_timeout = '8s';
set local statement_timeout = '75s';

create table platform_private.wk100_governed_withdrawals_v1 (
  id uuid primary key default gen_random_uuid(),
  program_id text not null default 'top100' check (program_id = 'top100'),
  week_start_eat date not null check (extract(isodow from week_start_eat) = 1),
  edition_id text not null unique references public.wk_chart_editions_v2(id),
  publication_id uuid not null unique references platform_private.wk100_governed_publications_v1(id),
  proposal_sha256 text not null check (proposal_sha256 ~ '^[a-f0-9]{64}$'),
  reason text not null check (length(trim(reason)) between 20 and 1000),
  withdrawn_by uuid not null,
  withdrawn_at timestamptz not null default clock_timestamp(),
  authorized_tx bigint not null,
  unique(program_id, week_start_eat)
);
alter table platform_private.wk100_governed_withdrawals_v1 enable row level security;
-- The SECURITY DEFINER function owner inserts into this table.
-- Do not FORCE owner RLS without an explicit matching owner policy.
revoke all on platform_private.wk100_governed_withdrawals_v1
  from public, anon, authenticated, service_role;
create trigger wk100_withdrawal_receipt_immutable_rows
  before update or delete on platform_private.wk100_governed_withdrawals_v1
  for each row execute function platform_private.wk100_block_editorial_approval_mutation_v1();
create trigger wk100_withdrawal_receipt_immutable_truncate
  before truncate on platform_private.wk100_governed_withdrawals_v1
  for each statement execute function platform_private.wk100_block_editorial_approval_mutation_v1();

-- Published Editions cannot be demoted except by the exact withdrawal
-- transaction that already wrote an immutable matching receipt.
create or replace function platform_private.wk100_block_ungoverned_promotion_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $guard$
begin
  if old.program_id='top100' and old.status='published'
     and new.status is distinct from old.status then
    if new.status='withdrawn'
       and new.published_at is not distinct from old.published_at
       and new.published_by is not distinct from old.published_by
       and exists (
         select 1 from platform_private.wk100_governed_withdrawals_v1 w
         where w.edition_id=old.id and w.program_id='top100'
           and w.authorized_tx=txid_current() and w.withdrawn_by=auth.uid()
       ) then
      return new;
    end if;
    raise exception using errcode='42501',
      message='WK100 published Edition cannot be silently demoted';
  end if;
  if new.program_id='top100' and new.status='published'
     and old.status is distinct from 'published' then
    if not exists (
      select 1 from platform_private.wk100_governed_publications_v1 g
      where g.edition_id=new.id
        and g.authorized_tx=txid_current()
        and g.published_by=auth.uid()
    ) then
      raise exception using errcode='42501',
        message='WK100 ungoverned publication forbidden';
    end if;
  end if;
  return new;
end;
$guard$;

-- Preserve the immutable staged snapshot guard. It must accept exactly
-- reviewed draft -> published or receipt-authorized published -> withdrawn.
create or replace function platform_private.wk100_block_staged_content_mutation_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $guard$
declare
  v_program text;
  v_week date;
begin
  if tg_table_name='wk_chart_entries_v2' then
    select e.program_id,e.period_start into v_program,v_week
    from public.wk_chart_editions_v2 e where e.id=old.edition_id;
    if v_program='top100' and exists (
      select 1 from platform_private.wk100_governed_staged_editions_v1 s
      where s.program_id='top100' and s.week_start_eat=v_week
        and s.edition_id=old.edition_id
    ) then
      raise exception using errcode='42501',
        message='WK100 staged original observations are immutable';
    end if;
  elsif tg_table_name='wk_chart_editions_v2' and old.program_id='top100'
    and exists (
      select 1 from platform_private.wk100_governed_staged_editions_v1 s where s.edition_id=old.id
    ) then
    if tg_op='DELETE' then
      raise exception using errcode='42501',
        message='WK100 approved Edition cannot be deleted';
    end if;
    if (to_jsonb(new)-'updated_at'-'status'-'published_at'-'published_by')
       is distinct from (to_jsonb(old)-'updated_at'-'status'-'published_at'-'published_by') then
      raise exception using errcode='42501',
        message='WK100 approved Edition snapshot may not be rewritten';
    end if;
    if new.status is distinct from old.status
       or new.published_at is distinct from old.published_at
       or new.published_by is distinct from old.published_by
       or new.updated_at is distinct from old.updated_at then
      if not (
        (
          old.status='draft' and new.status='published'
          and new.published_by is not distinct from auth.uid()::text
          and new.published_at is not null
          and exists (
            select 1 from platform_private.wk100_governed_publications_v1 g
            where g.edition_id=old.id and g.published_by=auth.uid()
              and g.authorized_tx=txid_current()
          )
        ) or (
          old.status='published' and new.status='withdrawn'
          and new.published_by is not distinct from old.published_by
          and new.published_at is not distinct from old.published_at
          and exists (
            select 1 from platform_private.wk100_governed_withdrawals_v1 w
            where w.edition_id=old.id and w.withdrawn_by=auth.uid()
              and w.authorized_tx=txid_current()
          )
        )
      ) then
        raise exception using errcode='42501',
          message='WK100 publication metadata may only change in a governed transaction';
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$guard$;

create function public.wk100_withdraw_governed_weekly_edition_v1(
  p_week date, p_proposal_sha256 text, p_reason text
) returns text language plpgsql security definer set search_path=pg_catalog
as $withdraw$
declare
  v_actor uuid:=auth.uid();
  v_stage platform_private.wk100_governed_staged_editions_v1%rowtype;
  v_publication platform_private.wk100_governed_publications_v1%rowtype;
  v_edition public.wk_chart_editions_v2%rowtype;
  v_prior platform_private.wk100_governed_withdrawals_v1%rowtype;
begin
  if v_actor is null or not public.current_user_has_capability('publish_charts')
     or not public.current_user_has_capability('manage_charts') then
    raise exception using errcode='42501',
      message='WK100 withdrawal requires active publisher and chart steward';
  end if;
  if p_week is null or extract(isodow from p_week)<>1
     or coalesce(p_proposal_sha256,'') !~ '^[a-f0-9]{64}$'
     or length(trim(coalesce(p_reason,''))) not between 20 and 1000 then
    raise exception 'WK100 withdrawal requires exact week, evidence digest and reason';
  end if;
  select * into strict v_stage from platform_private.wk100_governed_staged_editions_v1
    where program_id='top100' and week_start_eat=p_week for update;
  select * into strict v_publication from platform_private.wk100_governed_publications_v1
    where edition_id=v_stage.edition_id;
  select * into strict v_edition from public.wk_chart_editions_v2
    where id=v_stage.edition_id and program_id='top100' for update;
  if v_stage.proposal_sha256 is distinct from p_proposal_sha256
     or v_publication.published_by::text is distinct from v_edition.published_by
     or v_edition.published_at is null
     or v_publication.published_at is null
     or v_edition.edition_date is distinct from (p_week + 7)
     or v_edition.period_end is distinct from (p_week + 6)
     or v_edition.entry_count is distinct from 100
     or v_edition.chart_size is distinct from 100
     or (select count(*) from public.wk_chart_entries_v2 e where e.edition_id=v_edition.id) <> 100
     or v_publication.proposal_sha256 is distinct from p_proposal_sha256
     or v_publication.approved_review_id is distinct from v_stage.approval_id
     or v_edition.period_start is distinct from p_week
     or v_edition.rule_set_snapshot->>'proposal_sha256' is distinct from p_proposal_sha256
  then
    raise exception 'WK100 withdrawal cannot change sealed publication identity';
  end if;
  select * into v_prior from platform_private.wk100_governed_withdrawals_v1
    where edition_id=v_stage.edition_id;
  if found then
    if v_prior.proposal_sha256 is distinct from p_proposal_sha256
       or v_prior.reason is distinct from trim(p_reason)
       or v_prior.withdrawn_by is distinct from v_actor
       or v_prior.publication_id is distinct from v_publication.id
       or v_edition.status is distinct from 'withdrawn' then
      raise exception using errcode='23505',
        message='WK100 conflicting withdrawal replay';
    end if;
    return v_stage.edition_id;
  end if;
  if v_edition.status is distinct from 'published' then
    raise exception using errcode='42501',
      message='WK100 only a currently published Edition can be withdrawn';
  end if;
  insert into platform_private.wk100_governed_withdrawals_v1
    (week_start_eat,edition_id,publication_id,proposal_sha256,reason,withdrawn_by,authorized_tx)
  values (p_week,v_stage.edition_id,v_publication.id,p_proposal_sha256,trim(p_reason),v_actor,txid_current());
  update public.wk_chart_editions_v2
    set status='withdrawn',updated_at=clock_timestamp()
    where id=v_stage.edition_id and program_id='top100' and status='published';
  if not found then
    raise exception 'WK100 governed withdrawal status transition failed';
  end if;
  return v_stage.edition_id;
end;
$withdraw$;
revoke execute on function public.wk100_withdraw_governed_weekly_edition_v1(date,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_withdraw_governed_weekly_edition_v1(date,text,text)
  to authenticated;

comment on table platform_private.wk100_governed_withdrawals_v1 is
  'Immutable WK100 withdrawal receipt; original publication and source evidence retained.';
comment on function public.wk100_withdraw_governed_weekly_edition_v1(date,text,text) is
  'Publisher plus Chart Steward: transaction-bound withdrawal, exact week and digest.';

commit;
