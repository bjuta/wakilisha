-- WAKILISHA Auth Phase 1b: future-facing audience, customer, partner, and membership roles.
-- This extends the admin/editor/chart role substrate so auth does not need another redesign later.

insert into public.role_definitions (role_key, label, description, priority) values
  ('customer', 'Customer', 'Authenticated customer account for purchases, subscriptions, saved preferences, and future commerce flows.', 120),
  ('subscriber', 'Subscriber', 'Newsletter/member account with saved content, alerts, preferences, and gated lightweight access.', 130),
  ('member', 'Member', 'WAKILISHA community member with profile, saved charts, collections, comments, and member-only experiences.', 125),
  ('premium_member', 'Premium Member', 'Paid or elevated member with premium content/product access once monetization is enabled.', 118),
  ('artist_claimant', 'Artist Claimant', 'Artist or representative requesting access to claim/manage an artist profile.', 110),
  ('artist_manager', 'Artist Manager', 'Approved representative who can submit artist-profile updates and media for review.', 105),
  ('label_partner', 'Label Partner', 'Label-side partner with scoped label/release submission and reporting access.', 100),
  ('chart_partner', 'Chart Partner', 'External chart/data partner with scoped upload, QA, or reporting access.', 98),
  ('brand_partner', 'Brand Partner', 'Commercial partner/sponsor with scoped campaign, report, and asset-review access.', 115),
  ('research_partner', 'Research Partner', 'Academic/research partner with read/export access to approved datasets and reports.', 116),
  ('support_agent', 'Support Agent', 'Support operator for customer/member/account assistance without full admin access.', 65),
  ('moderator', 'Moderator', 'Community/content moderator for comments, submissions, and user-generated content queues.', 60),
  ('analyst', 'Analyst', 'Read-only analytics/reporting user across approved operational dashboards.', 75),
  ('developer', 'Developer', 'Technical operator with integration, QA, audit, and diagnostics access but not default content ownership.', 25)
on conflict (role_key) do update set
  label = excluded.label,
  description = excluded.description,
  priority = excluded.priority,
  updated_at = now();

insert into public.capability_definitions (capability_key, label, domain, description) values
  ('view_public_account', 'View public account', 'account', 'Access the authenticated public account area.'),
  ('manage_own_profile', 'Manage own profile', 'account', 'Edit own profile, preferences, and identity information.'),
  ('manage_own_preferences', 'Manage own preferences', 'account', 'Manage saved preferences, notifications, and personalization.'),
  ('save_content', 'Save content', 'audience', 'Save articles, charts, tracks, artists, and collections.'),
  ('follow_entities', 'Follow entities', 'audience', 'Follow artists, labels, genres, charts, and verticals.'),
  ('comment_public', 'Comment publicly', 'community', 'Comment or react where community features are enabled.'),
  ('moderate_community', 'Moderate community', 'community', 'Moderate comments, submissions, and UGC queues.'),
  ('view_gated_content', 'View gated content', 'membership', 'View subscriber/member gated content.'),
  ('view_premium_content', 'View premium content', 'membership', 'View premium paid/elevated member content.'),
  ('manage_subscription', 'Manage subscription', 'membership', 'Manage own subscription/billing status through integrated billing.'),
  ('view_customer_orders', 'View customer orders', 'commerce', 'View own orders, purchases, receipts, or future marketplace activity.'),
  ('manage_customer_orders', 'Manage customer orders', 'commerce', 'Support/admin handling of customer order issues.'),
  ('submit_artist_claim', 'Submit artist claim', 'artist_portal', 'Submit a request to claim an artist profile.'),
  ('manage_claimed_artist_profile', 'Manage claimed artist profile', 'artist_portal', 'Submit updates for an approved claimed artist profile.'),
  ('submit_artist_media', 'Submit artist media', 'artist_portal', 'Submit artist images, videos, and press assets for review.'),
  ('submit_label_updates', 'Submit label updates', 'partner_portal', 'Submit label/release updates for review.'),
  ('view_partner_reports', 'View partner reports', 'partner_portal', 'View scoped partner reports and dashboards.'),
  ('submit_chart_data', 'Submit chart data', 'partner_portal', 'Submit scoped chart/source data for review.'),
  ('view_research_exports', 'View research exports', 'research', 'View approved research datasets and exports.'),
  ('export_research_data', 'Export research data', 'research', 'Export approved research datasets.'),
  ('view_analytics', 'View analytics', 'analytics', 'View approved analytics/reporting dashboards.'),
  ('view_support_console', 'View support console', 'support', 'View support console.'),
  ('manage_support_cases', 'Manage support cases', 'support', 'Handle support cases and account issues.'),
  ('view_developer_tools', 'View developer tools', 'developer', 'View developer tools, diagnostics, API QA, and integration status.'),
  ('manage_developer_tools', 'Manage developer tools', 'developer', 'Manage developer/integration tooling where enabled.')
on conflict (capability_key) do update set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description,
  updated_at = now();

with role_caps(role_key, capability_key) as (
  values
    ('customer', 'view_public_account'), ('customer', 'manage_own_profile'), ('customer', 'manage_own_preferences'), ('customer', 'save_content'), ('customer', 'follow_entities'), ('customer', 'view_customer_orders'), ('customer', 'manage_subscription'),
    ('subscriber', 'view_public_account'), ('subscriber', 'manage_own_profile'), ('subscriber', 'manage_own_preferences'), ('subscriber', 'save_content'), ('subscriber', 'follow_entities'), ('subscriber', 'view_gated_content'),
    ('member', 'view_public_account'), ('member', 'manage_own_profile'), ('member', 'manage_own_preferences'), ('member', 'save_content'), ('member', 'follow_entities'), ('member', 'comment_public'), ('member', 'view_gated_content'),
    ('premium_member', 'view_public_account'), ('premium_member', 'manage_own_profile'), ('premium_member', 'manage_own_preferences'), ('premium_member', 'save_content'), ('premium_member', 'follow_entities'), ('premium_member', 'comment_public'), ('premium_member', 'view_gated_content'), ('premium_member', 'view_premium_content'), ('premium_member', 'manage_subscription'),
    ('artist_claimant', 'view_public_account'), ('artist_claimant', 'manage_own_profile'), ('artist_claimant', 'submit_artist_claim'), ('artist_claimant', 'submit_artist_media'),
    ('artist_manager', 'view_public_account'), ('artist_manager', 'manage_own_profile'), ('artist_manager', 'manage_claimed_artist_profile'), ('artist_manager', 'submit_artist_media'), ('artist_manager', 'view_partner_reports'),
    ('label_partner', 'view_public_account'), ('label_partner', 'manage_own_profile'), ('label_partner', 'submit_label_updates'), ('label_partner', 'view_partner_reports'),
    ('chart_partner', 'view_public_account'), ('chart_partner', 'submit_chart_data'), ('chart_partner', 'view_partner_reports'),
    ('brand_partner', 'view_public_account'), ('brand_partner', 'view_partner_reports'),
    ('research_partner', 'view_public_account'), ('research_partner', 'view_research_exports'), ('research_partner', 'export_research_data'),
    ('support_agent', 'view_dashboard'), ('support_agent', 'view_support_console'), ('support_agent', 'manage_support_cases'), ('support_agent', 'view_admin_readonly'),
    ('moderator', 'view_dashboard'), ('moderator', 'view_review_queue'), ('moderator', 'manage_review_queue'), ('moderator', 'moderate_community'), ('moderator', 'view_admin_readonly'),
    ('analyst', 'view_dashboard'), ('analyst', 'view_analytics'), ('analyst', 'view_charts_admin'), ('analyst', 'view_registry'), ('analyst', 'view_review_queue'), ('analyst', 'view_admin_readonly'),
    ('developer', 'view_dashboard'), ('developer', 'view_developer_tools'), ('developer', 'manage_developer_tools'), ('developer', 'view_settings'), ('developer', 'manage_integrations'), ('developer', 'view_imports'), ('developer', 'view_charts_admin'), ('developer', 'view_admin_readonly')
)
insert into public.role_capabilities (role_key, capability_key)
select role_key, capability_key from role_caps
on conflict (role_key, capability_key) do nothing;
