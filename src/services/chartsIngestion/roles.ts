/**
 * Chart Ingestion Role System
 * Defines permission matrix for 5 roles across the ingestion workflow.
 * Mirrors the expected WordPress capability system.
 */

export type UserRole =
  | "admin"
  | "editor_in_chief"
  | "chart_editor"
  | "contributor"
  | "viewer";

export interface RolePermission {
  role: UserRole;
  label: string;
  description: string;
  capabilities: Record<string, boolean>;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermission> = {
  admin: {
    role: "admin",
    label: "Admin",
    description: "Full system access. Can create, review, draft, publish, and override.",
    capabilities: {
      create_job: true,
      delete_job: true,
      add_source: true,
      remove_source: true,
      fetch_sources: true,
      review_candidates: true,
      approve_matches: true,
      rematch: true,
      mark_new_entity: true,
      resolve_issues: true,
      override_high_issues: true,
      apply_rank_override: true,
      create_draft: true,
      publish_edition: true,
      view_integration_map: true,
      run_preflight: true,
      simulate_failures: true,
      reset_demo: true,
      cancel_job: true,
      retry_job: true,
    },
  },
  editor_in_chief: {
    role: "editor_in_chief",
    label: "Editor-in-Chief",
    description: "Can ingest, review, draft, publish, and override issues.",
    capabilities: {
      create_job: true,
      delete_job: false,
      add_source: true,
      remove_source: true,
      fetch_sources: true,
      review_candidates: true,
      approve_matches: true,
      rematch: true,
      mark_new_entity: true,
      resolve_issues: true,
      override_high_issues: true,
      apply_rank_override: true,
      create_draft: true,
      publish_edition: true,
      view_integration_map: true,
      run_preflight: true,
      simulate_failures: false,
      reset_demo: false,
      cancel_job: true,
      retry_job: true,
    },
  },
  chart_editor: {
    role: "chart_editor",
    label: "Chart Editor",
    description: "Can ingest, review, and draft. Cannot publish or override high issues.",
    capabilities: {
      create_job: true,
      delete_job: false,
      add_source: true,
      remove_source: true,
      fetch_sources: true,
      review_candidates: true,
      approve_matches: true,
      rematch: true,
      mark_new_entity: true,
      resolve_issues: true,
      override_high_issues: false,
      apply_rank_override: true,
      create_draft: true,
      publish_edition: false,
      view_integration_map: true,
      run_preflight: true,
      simulate_failures: false,
      reset_demo: false,
      cancel_job: false,
      retry_job: false,
    },
  },
  contributor: {
    role: "contributor",
    label: "Contributor",
    description: "Can add manual or CSV sources only. No draft, publish, or review.",
    capabilities: {
      create_job: false,
      delete_job: false,
      add_source: true,
      remove_source: false,
      fetch_sources: false,
      review_candidates: false,
      approve_matches: false,
      rematch: false,
      mark_new_entity: false,
      resolve_issues: false,
      override_high_issues: false,
      apply_rank_override: false,
      create_draft: false,
      publish_edition: false,
      view_integration_map: true,
      run_preflight: false,
      simulate_failures: false,
      reset_demo: false,
      cancel_job: false,
      retry_job: false,
    },
  },
  viewer: {
    role: "viewer",
    label: "Viewer",
    description: "Read-only access across all screens.",
    capabilities: {
      create_job: false,
      delete_job: false,
      add_source: false,
      remove_source: false,
      fetch_sources: false,
      review_candidates: false,
      approve_matches: false,
      rematch: false,
      mark_new_entity: false,
      resolve_issues: false,
      override_high_issues: false,
      apply_rank_override: false,
      create_draft: false,
      publish_edition: false,
      view_integration_map: true,
      run_preflight: false,
      simulate_failures: false,
      reset_demo: false,
      cancel_job: false,
      retry_job: false,
    },
  },
};

const ROLE_STORAGE_KEY = "wkcharts_current_role";

export function getCurrentRole(): UserRole {
  try {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY);
    if (stored && stored in ROLE_PERMISSIONS) {
      return stored as UserRole;
    }
  } catch {
    // ignore
  }
  return "admin";
}

export function setCurrentRole(role: UserRole): void {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  } catch {
    // ignore
  }
}

export function hasCapability(role: UserRole, capability: string): boolean {
  return ROLE_PERMISSIONS[role]?.capabilities[capability] ?? false;
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_PERMISSIONS[role]?.label ?? role;
}

export function getRoleDescription(role: UserRole): string {
  return ROLE_PERMISSIONS[role]?.description ?? "";
}

export function getDisabledReason(role: UserRole, capability: string): string {
  if (hasCapability(role, capability)) return "";

  const roleLabel = ROLE_PERMISSIONS[role]?.label ?? role;

  const reasons: Record<string, string> = {
    publish_edition: `You need ${roleLabel === "Chart Editor" ? "publish_wakilisha_charts" : "admin"} permission to publish editions.`,
    override_high_issues: `You need ${roleLabel === "Chart Editor" ? "override_high_issues" : "admin"} permission to override high severity issues.`,
    create_draft: `You need chart_editor or higher role to create draft editions.`,
    approve_matches: `You need chart_editor or higher role to approve canonical matches.`,
    add_source: `You need contributor or higher role to add sources.`,
    remove_source: `You need chart_editor or higher role to remove sources.`,
    fetch_sources: `You need chart_editor or higher role to fetch sources.`,
    simulate_failures: `Simulation controls are admin-only.`,
    reset_demo: `Reset demo is admin-only.`,
  };

  return reasons[capability] ?? `You do not have ${capability} permission as ${roleLabel}.`;
}

export const ALL_ROLES: UserRole[] = [
  "admin",
  "editor_in_chief",
  "chart_editor",
  "contributor",
  "viewer",
];