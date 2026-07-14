import fs from "node:fs";
import path from "node:path";

const migrationDirectory =
  "supabase/migrations";

const migrationFiles = fs
  .readdirSync(migrationDirectory)
  .filter((file) =>
    file.endsWith(
      "_phase_0a_security_invoker_views.sql",
    )
  );

if (migrationFiles.length !== 1) {
  throw new Error(
    `Expected one Phase 0A view migration, found ${migrationFiles.length}`,
  );
}

const migrationPath = path.join(
  migrationDirectory,
  migrationFiles[0],
);

const source = fs.readFileSync(
  migrationPath,
  "utf8",
);

const requiredFragments = [
  "guides_public_field_guide_read",
  "for select",
  "to anon, authenticated",
  "status = 'published'",
  "metadata ->> 'post_type' = 'wk_field_guide'",
  "alter view public.registry_release_tracklists",
  "alter view public.wk_guides",
  "security_invoker = true",
];

for (const fragment of requiredFragments) {
  if (
    !source
      .toLowerCase()
      .includes(fragment.toLowerCase())
  ) {
    throw new Error(
      `Migration is missing: ${fragment}`,
    );
  }
}

const forbiddenFragments = [
  "grant select on public.registry_release_tracklists to anon",
  "grant all",
  "disable row level security",
  "security definer",
  "create or replace view",
  "drop view",
];

for (const fragment of forbiddenFragments) {
  if (
    source
      .toLowerCase()
      .includes(fragment.toLowerCase())
  ) {
    throw new Error(
      `Migration contains forbidden scope: ${fragment}`,
    );
  }
}

console.log(
  "PASS: Phase 0A view migration is narrow and preserves the existing view definitions and grants.",
);
