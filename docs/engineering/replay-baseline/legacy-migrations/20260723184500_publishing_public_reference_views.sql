-- Provide browser-safe read surfaces for controlled Publishing references.
--
-- The operational tables remain in editorial. Authenticated browser clients
-- read only these narrow public views. The editorial schema does not need to
-- be exposed through PostgREST.

begin;

do $publishing_reference_views_preflight$
begin
  if to_regclass(
    'editorial.publishing_content_kinds'
  ) is null then
    raise exception
      'STOP: editorial.publishing_content_kinds does not exist';
  end if;

  if to_regclass(
    'editorial.publishing_channels'
  ) is null then
    raise exception
      'STOP: editorial.publishing_channels does not exist';
  end if;

  if to_regclass(
    'public.wk_publishing_workspace_items'
  ) is null then
    raise exception
      'STOP: Publishing workspace foundation view does not exist';
  end if;
end;
$publishing_reference_views_preflight$;

create or replace view
  public.wk_publishing_content_kinds
with (
  security_invoker = true,
  security_barrier = true
)
as
select
  kind,
  label,
  description,
  canonical_resource_kind,
  enabled,
  sort_order
from editorial.publishing_content_kinds;

comment on view
  public.wk_publishing_content_kinds is
  'Authenticated browser read surface for controlled Publishing content types.';

create or replace view
  public.wk_publishing_channels
with (
  security_invoker = true,
  security_barrier = true
)
as
select
  channel_key,
  label,
  description,
  enabled,
  sort_order
from editorial.publishing_channels;

comment on view
  public.wk_publishing_channels is
  'Authenticated browser read surface for controlled Publishing channels.';

revoke all
on public.wk_publishing_content_kinds,
   public.wk_publishing_channels
from public, anon, authenticated;

grant select
on public.wk_publishing_content_kinds,
   public.wk_publishing_channels
to authenticated, service_role;

commit;
