# WAKILISHA Auth + Review Queue Closure Runbook

This runbook closes the current operational loop in the right order:

1. Bootstrap the first Supabase admin user.
2. Apply and verify auth migrations.
3. Deploy admin user operations.
4. Close the Phase 0–6 import/review queue implementation.
5. Smoke-test public and admin auth paths.

## 0. Required values

Prepare these values before starting:

```bash
export DATABASE_URL="postgresql://..."
export RUN_ID="<WORDPRESS_INGESTION_RUN_UUID>"
export ADMIN_EMAIL="admin@wakilisha.africa"
export ADMIN_DISPLAY_NAME="WAKILISHA Admin"
export AUTH_USER_UUID="<SUPABASE_AUTH_USER_UUID>"
```

## 1. Create the first admin user in Supabase

### 1.1 Create the user

In Supabase Dashboard:

1. Open Authentication → Users.
2. Click Add user.
3. Enter the admin email and password.
4. Confirm the user if email confirmation is enabled.
5. Copy the auth user UUID.

### 1.2 Apply the durable admin assignment

Run this in Supabase SQL Editor after replacing values:

```sql
insert into public.user_profiles (
  user_id,
  email,
  display_name,
  status,
  created_at,
  updated_at
)
values (
  '<AUTH_USER_UUID>',
  'admin@wakilisha.africa',
  'WAKILISHA Admin',
  'active',
  now(),
  now()
)
on conflict (user_id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  status = 'active',
  updated_at = now();

insert into public.user_role_assignments (
  user_id,
  role_key,
  status,
  assigned_by,
  assigned_at,
  notes,
  created_at,
  updated_at
)
values (
  '<AUTH_USER_UUID>',
  'administrator',
  'active',
  '<AUTH_USER_UUID>',
  now(),
  'Initial bootstrap administrator.',
  now(),
  now()
)
on conflict (user_id, role_key) do update set
  status = 'active',
  assigned_by = excluded.assigned_by,
  assigned_at = now(),
  notes = excluded.notes,
  updated_at = now();
```

### 1.3 Verify admin assignment

```sql
select
  up.user_id,
  up.email,
  up.display_name,
  up.status as profile_status,
  ura.role_key,
  ura.status as role_status
from public.user_profiles up
join public.user_role_assignments ura on ura.user_id = up.user_id
where up.user_id = '<AUTH_USER_UUID>';
```

Expected:

```txt
role_key = administrator
profile_status = active
role_status = active
```

## 2. Verify auth schema is present

Run:

```sql
select to_regclass('public.user_profiles') as user_profiles;
select to_regclass('public.role_definitions') as role_definitions;
select to_regclass('public.capability_definitions') as capability_definitions;
select to_regclass('public.role_capabilities') as role_capabilities;
select to_regclass('public.user_role_assignments') as user_role_assignments;
select to_regclass('public.user_access_scopes') as user_access_scopes;
select to_regclass('public.admin_audit_events') as admin_audit_events;
select to_regclass('public.admin_user_invites') as admin_user_invites;
select to_regclass('public.admin_account_recovery_events') as admin_account_recovery_events;
```

Verify role seed:

```sql
select role_key, label, priority
from public.role_definitions
order by priority asc, role_key asc;
```

Verify subscriber default capability:

```sql
select rc.role_key, rc.capability_key
from public.role_capabilities rc
where rc.role_key = 'subscriber'
order by rc.capability_key;
```

Expected subscriber capabilities include:

```txt
contribute_lyrics
follow_artists
follow_charts
manage_own_profile
manage_public_profile
save_content
view_public_account
```

## 3. Deploy admin user operations edge function

From local/dev environment with Supabase CLI configured:

```bash
supabase secrets set SUPABASE_URL="..."
supabase secrets set SUPABASE_ANON_KEY="..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."

supabase functions deploy admin-user-ops
```

This is required for:

```txt
invite user by email
send password reset email
server-side role/scope assignment during invite
recovery audit events
```

## 4. Build and deploy app code

```bash
git pull
npm install
npm run build
```

If build passes, deploy/reload app runtime as appropriate for the server:

```bash
sudo systemctl reload nginx
```

If using PM2 for the API process:

```bash
pm2 restart wakilisha-v2-api
```

## 5. Close Phase 0–6 review/import queue loop

Use the real ingestion run UUID.

### 5.1 Promote canonical registry/content records

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:promote-wordpress-registry -- --job "$RUN_ID"
```

### 5.2 Resolve artist records

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:resolve-wordpress-artists -- --job "$RUN_ID"
```

### 5.3 Promote artist-to-artist relationships

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:promote-wordpress-artist-relationships -- --job "$RUN_ID"
```

### 5.4 Resolve WP term relationships

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:resolve-wordpress-term-relationships -- --job "$RUN_ID"
```

### 5.5 Classify postmeta/custom fields

Dry run first:

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:classify-wordpress-postmeta -- --job "$RUN_ID" --dry-run
```

Classify:

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:classify-wordpress-postmeta -- --job "$RUN_ID"
```

Apply safe metadata only after reviewing the dictionary:

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:classify-wordpress-postmeta -- --job "$RUN_ID" --apply-safe
```

### 5.6 Operationalize media assets

Dry run first:

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:operationalize-wordpress-media -- --job "$RUN_ID" --dry-run
```

Create operational media rows:

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:operationalize-wordpress-media -- --job "$RUN_ID"
```

Apply public image fields:

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:operationalize-wordpress-media -- --job "$RUN_ID" --apply-public-fields
```

### 5.7 Run UI debt audit

```bash
DATABASE_URL="$DATABASE_URL" npm run imports:audit-ui-debt
```

## 6. Verify review queue command center data

Run these SQL checks:

```sql
select entity_type, status, count(*)
from public.entity_resolution_decisions
group by entity_type, status
order by count(*) desc;

select artifact_type, review_status, count(*)
from public.wk_import_review_artifacts
group by artifact_type, review_status
order by count(*) desc;

select field_group, promotion_policy, count(*)
from public.wp_postmeta_field_dictionary
group by field_group, promotion_policy
order by count(*) desc;

select entity_type, role, status, count(*)
from public.wk_media_assets
group by entity_type, role, status
order by count(*) desc;

select target_entity, target_status, count(*)
from public.wk_import_staging_records
group by target_entity, target_status
order by count(*) desc;

select severity, count(*)
from public.ui_debt_audit_items
group by severity
order by severity;
```

Then open:

```txt
/admin/review/queue
```

Expected:

```txt
Resolution decisions visible
Import artifacts visible
Postmeta dictionary visible
Media rows visible
Staging summary visible
Promotion events visible
```

## 7. Auth smoke tests

### 7.1 Public auth path

Open:

```txt
/auth
```

Test:

```txt
public signup
public login
profile access
subscriber role assignment
```

Verify in SQL:

```sql
select up.email, ura.role_key, ura.status
from public.user_profiles up
join public.user_role_assignments ura on ura.user_id = up.user_id
where up.email = '<PUBLIC_TEST_EMAIL>';
```

Expected:

```txt
role_key = subscriber
status = active
```

### 7.2 Admin auth path

Open:

```txt
/admin/login
```

Test:

```txt
admin login succeeds
/admin opens
/admin/users opens
/admin/review/queue opens
/admin/settings opens
/admin/settings/charts/dashboard opens
```

### 7.3 Subscriber cannot enter admin

With a subscriber-only account, open:

```txt
/admin
/admin/users
/admin/settings
/admin/settings/charts/dashboard
```

Expected:

```txt
redirects to /admin/login or shows access denied
no Admin Studio access
```

### 7.4 Admin users console actions

From `/admin/users`, test:

```txt
invite user by email
assign editor role
assign chart_editor_regional role
assign market scope
send password reset
suspend user
verify audit row appears
```

Verify audit:

```sql
select event_type, target_table, target_record_id, message, created_at
from public.admin_audit_events
order by created_at desc
limit 30;
```

## 8. Closure criteria

Close this phase only when all are true:

```txt
Build passes
All auth migrations applied
First admin can log in at /admin/login
Subscriber signup defaults to subscriber
Subscriber cannot access admin
Admin can access /admin/users
Edge function deploy works
Invite user works
Password reset works
Phase 0–6 scripts run against real RUN_ID
/admin/review/queue shows live operational data
UI debt audit snapshot exists
```
