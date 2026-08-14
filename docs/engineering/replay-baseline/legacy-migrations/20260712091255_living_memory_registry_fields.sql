alter table public.registry_artists
  add column if not exists living_memory_editorial_opener text,
  add column if not exists living_memory_public_prompt text,
  add column if not exists living_memory_editorial_label text,
  add column if not exists living_memory_status text not null default 'draft',
  add column if not exists living_memory_updated_at timestamptz;

alter table public.registry_releases
  add column if not exists living_memory_editorial_opener text,
  add column if not exists living_memory_public_prompt text,
  add column if not exists living_memory_editorial_label text,
  add column if not exists living_memory_status text not null default 'draft',
  add column if not exists living_memory_updated_at timestamptz;

alter table public.registry_tracks
  add column if not exists living_memory_editorial_opener text,
  add column if not exists living_memory_public_prompt text,
  add column if not exists living_memory_editorial_label text,
  add column if not exists living_memory_status text not null default 'draft',
  add column if not exists living_memory_updated_at timestamptz;

comment on column public.registry_artists.living_memory_editorial_opener is 'WAKILISHA editorial text that opens the Living Memory surface.';
comment on column public.registry_artists.living_memory_public_prompt is 'Direct public question paired with the Living Memory opener.';
comment on column public.registry_artists.living_memory_editorial_label is 'Visible disclosure attached to WAKILISHA editorial opener text.';
comment on column public.registry_artists.living_memory_status is 'Editorial state for Living Memory content, such as draft or published.';
comment on column public.registry_artists.living_memory_updated_at is 'Last editorial update time for Living Memory content.';

comment on column public.registry_releases.living_memory_editorial_opener is 'WAKILISHA editorial text that opens the Living Memory surface.';
comment on column public.registry_releases.living_memory_public_prompt is 'Direct public question paired with the Living Memory opener.';
comment on column public.registry_releases.living_memory_editorial_label is 'Visible disclosure attached to WAKILISHA editorial opener text.';
comment on column public.registry_releases.living_memory_status is 'Editorial state for Living Memory content, such as draft or published.';
comment on column public.registry_releases.living_memory_updated_at is 'Last editorial update time for Living Memory content.';

comment on column public.registry_tracks.living_memory_editorial_opener is 'WAKILISHA editorial text that opens the Living Memory surface.';
comment on column public.registry_tracks.living_memory_public_prompt is 'Direct public question paired with the Living Memory opener.';
comment on column public.registry_tracks.living_memory_editorial_label is 'Visible disclosure attached to WAKILISHA editorial opener text.';
comment on column public.registry_tracks.living_memory_status is 'Editorial state for Living Memory content, such as draft or published.';
comment on column public.registry_tracks.living_memory_updated_at is 'Last editorial update time for Living Memory content.';;
