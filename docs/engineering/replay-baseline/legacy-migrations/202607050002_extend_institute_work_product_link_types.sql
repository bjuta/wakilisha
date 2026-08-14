alter table public.institute_work_product_links
  drop constraint if exists institute_work_product_links_product_type_check;

alter table public.institute_work_product_links
  add constraint institute_work_product_links_product_type_check
  check (
    product_type in (
      'article',
      'playlist',
      'registry_suggestion',
      'registry_correction',
      'registry_merge',
      'registry_relationship',
      'registry_provider_update'
    )
  );
