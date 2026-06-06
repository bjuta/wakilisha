import type { AccessScope, Capability, UserRole, UserRoleRecord } from "@/services/userRoles";
import { userCan } from "@/services/userRoles";

export type ScopeRequirement = {
  scopeType?: "global" | "market" | "country" | "region" | "series" | "vertical" | "entity_type" | string;
  scopeValue?: string | null;
  requireEdit?: boolean;
  requirePublish?: boolean;
};

export function userHasCapability(roleRecord: UserRoleRecord | null | undefined, capability: Capability): boolean {
  if (!roleRecord) return false;
  if (roleRecord.capabilities?.includes(capability)) return true;
  return userCan(roleRecord.role, capability);
}

export function scopeMatches(scope: AccessScope, requirement: ScopeRequirement): boolean {
  if (scope.status && scope.status !== "active") return false;
  if (requirement.requirePublish && !scope.can_publish) return false;
  if (requirement.requireEdit && !scope.can_edit) return false;
  if (scope.scope_type === "global") return true;
  if (!requirement.scopeType || !requirement.scopeValue) return false;
  return scope.scope_type === requirement.scopeType && scope.scope_value === requirement.scopeValue;
}

export function userHasScope(roleRecord: UserRoleRecord | null | undefined, requirement: ScopeRequirement): boolean {
  if (!roleRecord) return false;
  if (roleRecord.roles?.includes("administrator") || roleRecord.role === "administrator") return true;
  if (roleRecord.capabilities?.includes("manage_settings")) return true;
  return (roleRecord.scopes ?? []).some((scope) => scopeMatches(scope, requirement));
}

export function userCanInScope(roleRecord: UserRoleRecord | null | undefined, capability: Capability, requirement: ScopeRequirement = {}): boolean {
  if (!userHasCapability(roleRecord, capability)) return false;
  if (!requirement.scopeType && !requirement.scopeValue) return true;
  return userHasScope(roleRecord, requirement);
}

export function filterByScope<T extends Record<string, unknown>>(
  rows: T[],
  roleRecord: UserRoleRecord | null | undefined,
  options: {
    scopeType: ScopeRequirement["scopeType"];
    scopeValueKey: keyof T;
    requireEdit?: boolean;
    requirePublish?: boolean;
  },
): T[] {
  if (!roleRecord) return [];
  if (roleRecord.roles?.includes("administrator") || roleRecord.role === "administrator") return rows;
  if (roleRecord.capabilities?.includes("manage_settings")) return rows;
  return rows.filter((row) => userHasScope(roleRecord, {
    scopeType: options.scopeType,
    scopeValue: String(row[options.scopeValueKey] ?? ""),
    requireEdit: options.requireEdit,
    requirePublish: options.requirePublish,
  }));
}

export function roleLooksAdminCapable(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  return userCan(role, "view_dashboard") || userCan(role, "view_admin_readonly");
}
