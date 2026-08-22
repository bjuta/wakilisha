import { useMemo, useState } from "react";

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

export interface EditorialCreditSelection {
  partyKind: "person" | "organization";
  partyResourceId: string;
  creditRole: string;
}

function identityLabel(
  party: EditorialCreditPartyOption,
): string {
  if (party.partyKind === "organization") {
    return "Organization";
  }

  if (party.identityKind === "registry_author") {
    return "Person · Registry Author";
  }

  if (party.identityKind === "user") {
    return "Person · WAKILISHA account";
  }

  if (party.identityKind === "external_contributor") {
    return "Person · External contributor";
  }

  return "Person";
}

export function EditorialCreditPicker({
  roles,
  parties,
  canCreateCredit,
  disabled = false,
  onAttach,
}: {
  roles: EditorialCreditRoleOption[];
  parties: EditorialCreditPartyOption[];
  canCreateCredit: boolean;
  disabled?: boolean;
  onAttach: (selection: EditorialCreditSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [partyResourceId, setPartyResourceId] =
    useState("");
  const [creditRole, setCreditRole] = useState("");

  const filteredParties = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    return parties
      .filter((party) =>
        [
          party.displayName,
          party.canonicalPath,
          identityLabel(party),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 8);
  }, [parties, query]);

  const selectedParty =
    parties.find(
      (party) => party.resourceId === partyResourceId,
    ) ?? null;

  const availableRoles = useMemo(() => {
    if (!selectedParty) return [];

    if (canCreateCredit) {
      return roles;
    }

    const allowed = new Set(
      selectedParty.availableCreditRoles,
    );
    return roles.filter((role) =>
      allowed.has(role.creditRole),
    );
  }, [canCreateCredit, roles, selectedParty]);

  const resolvedRole =
    availableRoles.some(
      (role) => role.creditRole === creditRole,
    )
      ? creditRole
      : availableRoles[0]?.creditRole ?? "";

  const canAttach =
    Boolean(selectedParty) && Boolean(resolvedRole);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
      <div>
        <div className="text-xs font-black text-wk-text">
          Add a Credit
        </div>
        <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">
          Choose the canonical Person or Organization, then describe
          what they did. WAKILISHA resolves the governed Credit record.
        </p>
      </div>

      <label className="block text-[11px] font-bold text-wk-text-muted">
        Find Person or Organization
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPartyResourceId("");
            setCreditRole("");
          }}
          disabled={disabled}
          placeholder="Search by name"
          className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-xs text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
          aria-controls="editorial-credit-search-results"
          aria-expanded={hasQuery && filteredParties.length > 0}
          autoComplete="off"
        />
      </label>

      {hasQuery ? (
        <div
          id="editorial-credit-search-results"
          className="overflow-hidden rounded-lg border border-wk-border bg-wk-surface"
        >
          {filteredParties.length > 0 ? (
            <div className="divide-y divide-wk-border" role="listbox" aria-label="Matching credited identities">
              {filteredParties.map((party) => {
                const selected = party.resourceId === partyResourceId;
                return (
                  <button
                    key={`${party.partyKind}:${party.resourceId}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled}
                    onClick={() => {
                      setPartyResourceId(party.resourceId);
                      setCreditRole("");
                      setQuery(party.displayName);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-wk-bg-subtle focus:bg-wk-bg-subtle focus:outline-none disabled:opacity-60"
                  >
                    <span className="block text-xs font-bold text-wk-text">
                      {party.displayName}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-wk-text-muted">
                      {identityLabel(party)} · {party.canonicalPath}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-2 text-[11px] text-wk-text-muted">
              No matching canonical identity.
            </p>
          )}
        </div>
      ) : null}

      {selectedParty ? (
        <div className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
          <div className="text-xs font-bold text-wk-text">
            {selectedParty.displayName}
          </div>
          <div className="mt-0.5 text-[10px] text-wk-text-muted">
            Selected · {identityLabel(selectedParty)} · {selectedParty.canonicalPath}
          </div>
        </div>
      ) : null}

      <label className="block text-[11px] font-bold text-wk-text-muted">
        Credit role
        <select
          value={resolvedRole}
          onChange={(event) => setCreditRole(event.target.value)}
          disabled={disabled || !selectedParty || availableRoles.length === 0}
          className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-xs text-wk-text disabled:opacity-60"
        >
          {availableRoles.length === 0 ? (
            <option value="">
              Choose an identity first
            </option>
          ) : null}
          {availableRoles.map((role) => (
            <option key={role.creditRole} value={role.creditRole}>
              {role.label}
            </option>
          ))}
        </select>
      </label>

      {!canCreateCredit && selectedParty && availableRoles.length === 0 ? (
        <p className="rounded-lg border border-wk-warning/25 bg-wk-warning-soft px-3 py-2 text-[10px] leading-4 text-wk-warning">
          This identity does not yet have a governed Credit you can attach.
          An Editor can create the missing role without exposing identity ids.
        </p>
      ) : null}

      <button
        type="button"
        disabled={disabled || !canAttach || !selectedParty}
        onClick={() => {
          if (!selectedParty || !resolvedRole) return;
          onAttach({
            partyKind: selectedParty.partyKind,
            partyResourceId: selectedParty.resourceId,
            creditRole: resolvedRole,
          });
        }}
        className="wk-button wk-button-ghost wk-button-sm disabled:opacity-50"
      >
        Add Credit
      </button>
    </div>
  );
}
