import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  canCreateCredit,
  disabled = false,
  onSearch,
  onAttach,
}: {
  roles: EditorialCreditRoleOption[];
  canCreateCredit: boolean;
  disabled?: boolean;
  onSearch: (
    query: string,
  ) => Promise<EditorialCreditPartyOption[]>;
  onAttach: (selection: EditorialCreditSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EditorialCreditPartyOption[]>([]);
  const [selectedParty, setSelectedParty] =
    useState<EditorialCreditPartyOption | null>(null);
  const [creditRole, setCreditRole] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const needle = query.trim();

    if (
      disabled ||
      needle.length < 2 ||
      (
        selectedParty &&
        !showResults &&
        needle === selectedParty.displayName
      )
    ) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(() => {
      void onSearch(needle)
        .then((matches) => {
          if (requestSequence.current !== requestId) return;
          setResults(matches.slice(0, 8));
        })
        .catch((reason: unknown) => {
          if (requestSequence.current !== requestId) return;
          setResults([]);
          setSearchError(
            reason instanceof Error
              ? reason.message
              : "Credit identities could not be searched.",
          );
        })
        .finally(() => {
          if (requestSequence.current === requestId) {
            setSearching(false);
          }
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      if (requestSequence.current === requestId) {
        requestSequence.current += 1;
      }
    };
  }, [disabled, onSearch, query, selectedParty, showResults]);

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
  const hasSearch = query.trim().length >= 2;

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
            setSelectedParty(null);
            setCreditRole("");
            setShowResults(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2 && !selectedParty) {
              setShowResults(true);
            }
          }}
          disabled={disabled}
          placeholder="Search by name"
          className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-xs text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
          aria-controls="editorial-credit-search-results"
          aria-expanded={showResults && hasSearch}
          autoComplete="off"
        />
      </label>

      {showResults && hasSearch ? (
        <div
          id="editorial-credit-search-results"
          className="overflow-hidden rounded-lg border border-wk-border bg-wk-surface"
        >
          {searching ? (
            <p className="px-3 py-2 text-[11px] text-wk-text-muted">
              Searching canonical identities…
            </p>
          ) : searchError ? (
            <p className="px-3 py-2 text-[11px] text-wk-danger">
              {searchError}
            </p>
          ) : results.length > 0 ? (
            <div
              className="divide-y divide-wk-border"
              role="listbox"
              aria-label="Matching credited identities"
            >
              {results.map((party) => (
                <button
                  key={`${party.partyKind}:${party.resourceId}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={disabled}
                  onClick={() => {
                    setSelectedParty(party);
                    setCreditRole("");
                    setQuery(party.displayName);
                    setResults([]);
                    setShowResults(false);
                    setSearchError(null);
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
              ))}
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
