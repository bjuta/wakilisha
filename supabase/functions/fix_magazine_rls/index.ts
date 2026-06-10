import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: string[] = [];

  const allSql = `
DO $$ BEGIN
  -- Drop old wide-open policies on magazine tables
  DROP POLICY IF EXISTS "Allow authenticated users to insert issues" ON wk_magazine_issues;
  DROP POLICY IF EXISTS "Allow authenticated users to update issues" ON wk_magazine_issues;
  DROP POLICY IF EXISTS "Allow authenticated users to delete issues" ON wk_magazine_issues;
  DROP POLICY IF EXISTS "Allow authenticated users to select issues" ON wk_magazine_issues;
  DROP POLICY IF EXISTS "Allow authenticated users to insert sections" ON wk_magazine_issue_sections;
  DROP POLICY IF EXISTS "Allow authenticated users to update sections" ON wk_magazine_issue_sections;
  DROP POLICY IF EXISTS "Allow authenticated users to delete sections" ON wk_magazine_issue_sections;
  DROP POLICY IF EXISTS "Allow authenticated users to select sections" ON wk_magazine_issue_sections;
  DROP POLICY IF EXISTS "Allow authenticated users to insert entities" ON wk_magazine_issue_entities;
  DROP POLICY IF EXISTS "Allow authenticated users to update entities" ON wk_magazine_issue_entities;
  DROP POLICY IF EXISTS "Allow authenticated users to delete entities" ON wk_magazine_issue_entities;
  DROP POLICY IF EXISTS "Allow authenticated users to select entities" ON wk_magazine_issue_entities;
  DROP POLICY IF EXISTS "Authenticated users can update ingestion runs" ON wk_ingestion_runs;
  DROP POLICY IF EXISTS "Authenticated users can update registry review resolution" ON registry_review_items;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
  `;

  try {
    const { error } = await supabase.rpc("exec_sql", { sql_text: allSql });
    if (error) {
      results.push(`Phase 1 DROP error: ${error.message}`);
    } else {
      results.push("Phase 1 DROP succeeded");
    }
  } catch (e: any) {
    results.push(`Phase 1 DROP exception: ${e.message}`);
  }

  const createBlock = `
DO $$ BEGIN
  -- Magazine issues
  CREATE POLICY "wk_magazine_issues_admin_insert" ON wk_magazine_issues FOR INSERT TO authenticated WITH CHECK (current_user_has_capability('edit_own_articles') OR current_user_is_administrator());
  CREATE POLICY "wk_magazine_issues_admin_update" ON wk_magazine_issues FOR UPDATE TO authenticated USING (current_user_has_capability('edit_own_articles') OR current_user_is_administrator()) WITH CHECK (current_user_has_capability('edit_own_articles') OR current_user_is_administrator());
  CREATE POLICY "wk_magazine_issues_admin_delete" ON wk_magazine_issues FOR DELETE TO authenticated USING (current_user_has_capability('delete_articles') OR current_user_is_administrator());
  -- Magazine sections
  CREATE POLICY "wk_magazine_issue_sections_admin_insert" ON wk_magazine_issue_sections FOR INSERT TO authenticated WITH CHECK (current_user_has_capability('edit_own_articles') OR current_user_is_administrator());
  CREATE POLICY "wk_magazine_issue_sections_admin_update" ON wk_magazine_issue_sections FOR UPDATE TO authenticated USING (current_user_has_capability('edit_own_articles') OR current_user_is_administrator()) WITH CHECK (current_user_has_capability('edit_own_articles') OR current_user_is_administrator());
  CREATE POLICY "wk_magazine_issue_sections_admin_delete" ON wk_magazine_issue_sections FOR DELETE TO authenticated USING (current_user_has_capability('delete_articles') OR current_user_is_administrator());
  -- Magazine entities
  CREATE POLICY "wk_magazine_issue_entities_admin_insert" ON wk_magazine_issue_entities FOR INSERT TO authenticated WITH CHECK (current_user_has_capability('edit_own_articles') OR current_user_is_administrator());
  CREATE POLICY "wk_magazine_issue_entities_admin_update" ON wk_magazine_issue_entities FOR UPDATE TO authenticated USING (current_user_has_capability('edit_own_articles') OR current_user_is_administrator()) WITH CHECK (current_user_has_capability('edit_own_articles') OR current_user_is_administrator());
  CREATE POLICY "wk_magazine_issue_entities_admin_delete" ON wk_magazine_issue_entities FOR DELETE TO authenticated USING (current_user_has_capability('delete_articles') OR current_user_is_administrator());
  -- Ingestion runs admin UPDATE
  CREATE POLICY "wk_ingestion_runs_admin_update" ON wk_ingestion_runs FOR UPDATE TO authenticated USING (current_user_has_capability('manage_imports') OR current_user_is_administrator()) WITH CHECK (current_user_has_capability('manage_imports') OR current_user_is_administrator());
  -- Import staging records write policies
  CREATE POLICY "wk_import_staging_records_admin_insert" ON wk_import_staging_records FOR INSERT TO authenticated WITH CHECK (current_user_has_capability('manage_imports') OR current_user_is_administrator());
  CREATE POLICY "wk_import_staging_records_admin_update" ON wk_import_staging_records FOR UPDATE TO authenticated USING (current_user_has_capability('manage_imports') OR current_user_is_administrator()) WITH CHECK (current_user_has_capability('manage_imports') OR current_user_is_administrator());
  CREATE POLICY "wk_import_staging_records_admin_delete" ON wk_import_staging_records FOR DELETE TO authenticated USING (current_user_has_capability('manage_imports') OR current_user_is_administrator());
  -- Review items admin-gated
  CREATE POLICY "registry_review_items_admin_update" ON registry_review_items FOR UPDATE TO authenticated USING (current_user_has_capability('manage_review_queue') OR current_user_is_administrator()) WITH CHECK (current_user_has_capability('manage_review_queue') OR current_user_is_administrator());
  CREATE POLICY "registry_review_items_admin_insert" ON registry_review_items FOR INSERT TO authenticated WITH CHECK (current_user_has_capability('manage_review_queue') OR current_user_is_administrator());
  CREATE POLICY "registry_review_items_admin_delete" ON registry_review_items FOR DELETE TO authenticated USING (current_user_has_capability('manage_review_queue') OR current_user_is_administrator());
  -- Release shells write policies
  CREATE POLICY "registry_release_shells_admin_insert" ON registry_release_shells FOR INSERT TO authenticated WITH CHECK (current_user_has_capability('manage_registry') OR current_user_is_administrator());
  CREATE POLICY "registry_release_shells_admin_update" ON registry_release_shells FOR UPDATE TO authenticated USING (current_user_has_capability('manage_registry') OR current_user_is_administrator()) WITH CHECK (current_user_has_capability('manage_registry') OR current_user_is_administrator());
  CREATE POLICY "registry_release_shells_admin_delete" ON registry_release_shells FOR DELETE TO authenticated USING (current_user_has_capability('manage_registry') OR current_user_is_administrator());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in create block: %', SQLERRM;
END $$;
  `;

  try {
    const { error } = await supabase.rpc("exec_sql", { sql_text: createBlock });
    if (error) {
      results.push(`Phase 2 CREATE error: ${error.message}`);
    } else {
      results.push("Phase 2 CREATE succeeded");
    }
  } catch (e: any) {
    results.push(`Phase 2 CREATE exception: ${e.message}`);
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
