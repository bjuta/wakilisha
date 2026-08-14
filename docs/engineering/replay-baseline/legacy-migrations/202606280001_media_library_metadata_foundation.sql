create extension if not exists pgcrypto;

create table if not exists public.media_folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.media_folders(id) on delete set null,
  slug text not null,
  name text not null,
  path text not null unique,
  purpose text not null default 'general',
  description text,
  color text,
  icon text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_folders_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint media_folders_path_format check (path ~ '^[a-z0-9][a-z0-9/-]*$'),
  constraint media_folders_purpose_check check (
    purpose in (
      'general',
      'magazine',
      'charts',
      'artists',
      'downloads',
      'press_kits',
      'brand_assets',
      'profiles',
      'system'
    )
  )
);

create unique index if not exists media_folders_parent_slug_idx
  on public.media_folders (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

create index if not exists media_folders_parent_id_idx on public.media_folders(parent_id);
create index if not exists media_folders_purpose_idx on public.media_folders(purpose);
create index if not exists media_folders_sort_idx on public.media_folders(sort_order, name);

alter table public.registry_media_assets
  add column if not exists folder_id uuid references public.media_folders(id) on delete set null,
  add column if not exists file_kind text,
  add column if not exists asset_purpose text,
  add column if not exists display_filename text,
  add column if not exists original_filename text,
  add column if not exists file_extension text,
  add column if not exists file_size_bytes bigint,
  add column if not exists content_date date,
  add column if not exists rights_status text not null default 'unknown',
  add column if not exists credit_text text,
  add column if not exists country_code text,
  add column if not exists language_code text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists internal_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'registry_media_assets_file_kind_check'
  ) then
    alter table public.registry_media_assets
      add constraint registry_media_assets_file_kind_check check (
        file_kind is null or file_kind in (
          'image',
          'document',
          'audio',
          'video',
          'archive',
          'other'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'registry_media_assets_asset_purpose_check'
  ) then
    alter table public.registry_media_assets
      add constraint registry_media_assets_asset_purpose_check check (
        asset_purpose is null or asset_purpose in (
          'general',
          'article_hero',
          'article_inline',
          'chart_artwork',
          'artist_photo',
          'release_artwork',
          'track_artwork',
          'downloadable',
          'press_kit',
          'brand_asset',
          'profile_media',
          'social_card',
          'system'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'registry_media_assets_rights_status_check'
  ) then
    alter table public.registry_media_assets
      add constraint registry_media_assets_rights_status_check check (
        rights_status in (
          'unknown',
          'owned',
          'licensed',
          'public_domain',
          'fair_use',
          'needs_clearance',
          'restricted'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'registry_media_assets_file_size_bytes_check'
  ) then
    alter table public.registry_media_assets
      add constraint registry_media_assets_file_size_bytes_check check (
        file_size_bytes is null or file_size_bytes >= 0
      );
  end if;
end $$;

create index if not exists registry_media_assets_folder_id_idx
  on public.registry_media_assets(folder_id);

create index if not exists registry_media_assets_file_kind_idx
  on public.registry_media_assets(file_kind);

create index if not exists registry_media_assets_asset_purpose_idx
  on public.registry_media_assets(asset_purpose);

create index if not exists registry_media_assets_content_date_idx
  on public.registry_media_assets(content_date);

create index if not exists registry_media_assets_rights_status_idx
  on public.registry_media_assets(rights_status);

create index if not exists registry_media_assets_file_extension_idx
  on public.registry_media_assets(file_extension);

create index if not exists registry_media_assets_tags_idx
  on public.registry_media_assets using gin(tags);

insert into public.media_folders (slug, name, path, purpose, description, sort_order, is_system)
values
  ('magazine', 'Magazine', 'magazine', 'magazine', 'Editorial and magazine images.', 10, true),
  ('charts', 'Charts', 'charts', 'charts', 'Chart artwork and chart-related media.', 20, true),
  ('artists', 'Artists', 'artists', 'artists', 'Artist photos and artist-related media.', 30, true),
  ('downloads', 'Downloads', 'downloads', 'downloads', 'PDFs, guides, reports, and downloadable files.', 40, true),
  ('press-kits', 'Press Kits', 'press-kits', 'press_kits', 'Press packs and release materials.', 50, true),
  ('brand-assets', 'Brand Assets', 'brand-assets', 'brand_assets', 'WAKILISHA logos, brand files, and reusable visual assets.', 60, true),
  ('profiles', 'Profiles', 'profiles', 'profiles', 'Profile avatars, covers, and account media.', 70, true),
  ('system', 'System', 'system', 'system', 'System-generated media and operational assets.', 90, true)
on conflict (path) do update set
  name = excluded.name,
  purpose = excluded.purpose,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_system = excluded.is_system,
  updated_at = now();

update public.registry_media_assets
set
  file_kind = coalesce(
    file_kind,
    case
      when mime_type ilike 'image/%' or media_kind = 'image' then 'image'
      when mime_type = 'application/pdf' then 'document'
      when mime_type ilike 'audio/%' then 'audio'
      when mime_type ilike 'video/%' then 'video'
      when mime_type in ('application/zip', 'application/x-zip-compressed') then 'archive'
      else 'other'
    end
  ),
  asset_purpose = coalesce(
    asset_purpose,
    case
      when media_kind = 'external_chart_entry_artwork' or source_kind = 'external_chart_entry_artwork' then 'chart_artwork'
      when media_kind = 'external_artist_image_postmeta' or source_kind = 'external_artist_image_postmeta' then 'artist_photo'
      when source_entity = 'admin_upload' then 'general'
      else 'general'
    end
  ),
  display_filename = coalesce(display_filename, title, slug),
  original_filename = coalesce(original_filename, metadata->>'file_name'),
  file_size_bytes = coalesce(
    file_size_bytes,
    case
      when coalesce(metadata->>'file_size', '') ~ '^[0-9]+$'
        then (metadata->>'file_size')::bigint
      else null
    end
  ),
  file_extension = coalesce(
    file_extension,
    nullif(
      substring(
        lower(coalesce(metadata->>'file_name', storage_path, url, ''))
        from '\.([a-z0-9]+)(\?|$)'
      ),
      ''
    )
  )
where
  file_kind is null
  or asset_purpose is null
  or display_filename is null
  or original_filename is null
  or file_size_bytes is null
  or file_extension is null;

alter table public.media_folders enable row level security;

drop policy if exists media_folders_media_read on public.media_folders;
create policy media_folders_media_read
  on public.media_folders
  for select
  to authenticated
  using (
    public.current_user_has_capability('upload_media')
    or public.current_user_has_capability('manage_media_library')
    or public.current_user_is_administrator()
  );

drop policy if exists media_folders_media_insert on public.media_folders;
create policy media_folders_media_insert
  on public.media_folders
  for insert
  to authenticated
  with check (
    public.current_user_has_capability('manage_media_library')
    or public.current_user_is_administrator()
  );

drop policy if exists media_folders_media_update on public.media_folders;
create policy media_folders_media_update
  on public.media_folders
  for update
  to authenticated
  using (
    public.current_user_has_capability('manage_media_library')
    or public.current_user_is_administrator()
  )
  with check (
    public.current_user_has_capability('manage_media_library')
    or public.current_user_is_administrator()
  );

drop policy if exists media_folders_media_delete on public.media_folders;
create policy media_folders_media_delete
  on public.media_folders
  for delete
  to authenticated
  using (
    public.current_user_has_capability('manage_media_library')
    or public.current_user_is_administrator()
  );

grant select, insert, update, delete on public.media_folders to authenticated;

comment on table public.media_folders is 'Admin-managed logical folder tree for WAKILISHA media. This is metadata, not a raw storage browser.';
comment on column public.registry_media_assets.folder_id is 'Logical admin folder. Moving folders must not break public file URLs.';
comment on column public.registry_media_assets.file_kind is 'Broad file class used for filtering: image, document, audio, video, archive, other.';
comment on column public.registry_media_assets.asset_purpose is 'Editorial/admin purpose such as article_hero, chart_artwork, artist_photo, downloadable, press_kit.';
comment on column public.registry_media_assets.content_date is 'The date the asset is culturally/editorially about, separate from upload date.';
comment on column public.registry_media_assets.tags is 'Admin search tags for media discoverability.';
