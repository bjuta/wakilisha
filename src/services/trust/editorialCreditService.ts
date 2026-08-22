import { supabase } from "@/lib/supabase";

type JsonObject = Record<string, unknown>;

type RpcResult = {
  data: unknown;
  error: {
    message?: string;
  } | null;
};

export interface EditorialCreditRoleOption {
  creditRole: string;
  label: string;
}

export interface EditorialCreditPartyOption {
  partyKind: "person" | "organization";
  resourceId: string;
  displayName: string;
  canonicalPath: string;
  identityKind: string;
  availableCreditRoles: string[];
}

export interface EditorialCreditPickerOptions {
  canCreateCredit: boolean;
  roles: EditorialCreditRoleOption[];
  parties: EditorialCreditPartyOption[];
}

export interface EditorialCreditResolution {
  creditId: string;
  partyKind: "person" | "organization";
  partyResourceId: string;
  creditRole: string;
  displayName: string;
  publicSafe: boolean;
  created: boolean;
}

export interface EditorialCreditSelection {
  partyKind: "person" | "organization";
  partyResourceId: string;
  creditRole: string;
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bool(value: unknown): boolean {
  return value === true;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).filter(Boolean)
    : [];
}

function rpc(): (
  name: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult> {
  return supabase.rpc as unknown as (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResult>;
}

export async function fetchEditorialCreditPickerOptions(
  query: string | null = null,
  limit = 100,
): Promise<EditorialCreditPickerOptions> {
  const { data, error } = await rpc()(
    "list_editorial_credit_picker_options",
    {
      p_query: query?.trim() || null,
      p_limit: limit,
    },
  );

  if (error) {
    throw new Error(
      error.message || "Credit identities could not load.",
    );
  }

  const root = object(data);

  return {
    canCreateCredit: bool(root.can_create_credit),
    roles: array(root.roles)
      .map((value) => {
        const row = object(value);
        return {
          creditRole: text(row.credit_role),
          label: text(row.label),
        };
      })
      .filter((option) => option.creditRole && option.label),
    parties: array(root.parties)
      .map((value) => {
        const row = object(value);
        const partyKind =
          text(row.party_kind) === "organization"
            ? "organization"
            : "person";

        return {
          partyKind,
          resourceId: text(row.resource_id),
          displayName: text(row.display_name),
          canonicalPath: text(row.canonical_path),
          identityKind: text(row.identity_kind),
          availableCreditRoles: stringArray(
            row.available_credit_roles,
          ),
        } satisfies EditorialCreditPartyOption;
      })
      .filter(
        (option) =>
          option.resourceId &&
          option.displayName &&
          option.canonicalPath,
      ),
  };
}

export async function resolveEditorialCredit(
  selection: EditorialCreditSelection,
): Promise<EditorialCreditResolution> {
  const { data, error } = await rpc()(
    "resolve_editorial_credit",
    {
      p_party_kind: selection.partyKind,
      p_party_resource_id: selection.partyResourceId,
      p_credit_role: selection.creditRole,
      p_public_safe: true,
    },
  );

  if (error) {
    throw new Error(
      error.message || "Credit identity could not be resolved.",
    );
  }

  const row = object(data);
  const creditId = text(row.credit_id);

  if (!creditId) {
    throw new Error(
      "Credit identity resolution returned no governed Credit.",
    );
  }

  return {
    creditId,
    partyKind:
      text(row.party_kind) === "organization"
        ? "organization"
        : "person",
    partyResourceId: text(row.party_resource_id),
    creditRole: text(row.credit_role),
    displayName: text(row.display_name),
    publicSafe: bool(row.public_safe),
    created: bool(row.created),
  };
}
