# Archived legacy migration trees

These SQL files are historical migration and seed artifacts.

They are not part of the executable Supabase migration chain and must never be applied automatically.

The only authoritative deployable migration directory is:

`supabase/migrations`

Historical tooling may write generated SQL only beneath:

`archive/legacy-migrations/generated`

Any production schema change must be represented by a new immutable migration in `supabase/migrations`, applied to production, followed by regeneration of the committed database types.
