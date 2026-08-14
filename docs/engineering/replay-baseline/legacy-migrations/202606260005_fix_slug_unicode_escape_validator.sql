create or replace function public.validate_slug_encoding()
returns trigger
language plpgsql
as $function$
begin
  -- Reject URL-encoded characters (%xx patterns like %c2%b3)
  if new.slug ~ '%[0-9a-fA-F]{2}' then
    raise exception 'Slug contains URL-encoded characters: %', new.slug;
  end if;

  -- Reject literal Unicode escape sequences like \u00e9.
  -- Do not reject ordinary words like "kudade".
  if new.slug ~ E'\\\\u[0-9a-fA-F]{4}' then
    raise exception 'Slug contains Unicode escape sequences: %', new.slug;
  end if;

  -- Reject any raw bytes / non-printable characters.
  if new.slug ~ '[\x00-\x1F\x7F]' then
    raise exception 'Slug contains control characters: %', new.slug;
  end if;

  return new;
end;
$function$;
