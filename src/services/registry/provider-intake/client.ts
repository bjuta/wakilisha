import type {
  CreateReleaseShellResult,
  IntakeCreateInput,
  IntakeSearchInput,
  ProviderInspectResponse,
  ProviderSearchResponse,
} from "./types";

const INTAKE_API_BASE = "/__wakilisha-v2-api/api/v1/registry";

function isJsonContentType(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("application/json");
}

function apiUnavailableError(): Error {
  return new Error("Provider intake API is unavailable. Check that the registry admin server is running.");
}

export async function searchProviderCatalogue(
  input: IntakeSearchInput,
): Promise<ProviderSearchResponse> {
  const params = new URLSearchParams({
    provider: input.provider,
    q: input.query,
    type: input.entityType,
    storefront: input.storefront,
    limit: String(input.limit ?? 25),
  });

  const response = await fetch(`${INTAKE_API_BASE}/provider-search?${params.toString()}`, {
    method: "GET",
  });

  if (!isJsonContentType(response)) {
    throw apiUnavailableError();
  }

  const payload = (await response.json()) as {
    data?: ProviderSearchResponse;
    message?: string;
  } & Partial<ProviderSearchResponse>;

  if (!response.ok) {
    throw new Error(payload.message ?? "Provider search failed.");
  }

  const result = (payload.data ?? payload) as ProviderSearchResponse;

  if (result.error) {
    throw new Error(result.error);
  }

  return result;
}

export async function inspectProviderEntity(
  provider: string,
  providerEntityType: string,
  providerEntityId: string,
  storefront: string,
): Promise<ProviderInspectResponse> {
  const response = await fetch(`${INTAKE_API_BASE}/provider-search/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, providerEntityType, providerEntityId, storefront }),
  });

  if (!isJsonContentType(response)) {
    throw apiUnavailableError();
  }

  const payload = (await response.json()) as {
    data?: ProviderInspectResponse;
    message?: string;
  } & Partial<ProviderInspectResponse>;

  if (!response.ok) {
    throw new Error(payload.message ?? "Provider inspect failed.");
  }

  return (payload.data ?? payload) as ProviderInspectResponse;
}

export async function createReleaseShellFromProvider(
  input: IntakeCreateInput,
): Promise<CreateReleaseShellResult> {
  const response = await fetch(`${INTAKE_API_BASE}/release-shells/intake/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!isJsonContentType(response)) {
    throw apiUnavailableError();
  }

  const payload = (await response.json()) as {
    data?: CreateReleaseShellResult;
    message?: string;
  } & Partial<CreateReleaseShellResult>;

  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to create release shell from provider result.");
  }

  return (payload.data ?? payload) as CreateReleaseShellResult;
}

export async function attachProviderResultToShell(
  input: IntakeCreateInput & { targetRegistryEntityId: string },
): Promise<CreateReleaseShellResult> {
  const response = await fetch(`${INTAKE_API_BASE}/release-shells/intake/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!isJsonContentType(response)) {
    throw apiUnavailableError();
  }

  const payload = (await response.json()) as {
    data?: CreateReleaseShellResult;
    message?: string;
  } & Partial<CreateReleaseShellResult>;

  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to attach provider result to existing shell.");
  }

  return (payload.data ?? payload) as CreateReleaseShellResult;
}

export async function backfillExistingRelease(
  input: IntakeCreateInput & { targetRegistryEntityId: string },
): Promise<CreateReleaseShellResult> {
  const response = await fetch(`${INTAKE_API_BASE}/release-shells/intake/backfill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      mode: "backfill_existing_release",
    }),
  });

  if (!isJsonContentType(response)) {
    throw apiUnavailableError();
  }

  const payload = (await response.json()) as {
    data?: CreateReleaseShellResult;
    message?: string;
  } & Partial<CreateReleaseShellResult>;

  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to backfill existing release from provider result.");
  }

  return (payload.data ?? payload) as CreateReleaseShellResult;
}

export type ProviderConnectionTestResult = {
  provider: string;
  storefront: string;
  status: "connected" | "failed" | "unavailable" | "unknown";
  latencyMs?: number;
  resultCount?: number;
  error?: string;
  testedAt: string;
};

export async function testProviderConnection(
  provider: string,
  storefront: string,
): Promise<ProviderConnectionTestResult> {
  const params = new URLSearchParams({ provider, storefront });
  const response = await fetch(`${INTAKE_API_BASE}/provider-search/test-connection?${params.toString()}`, {
    method: "GET",
  });

  if (!isJsonContentType(response)) {
    throw apiUnavailableError();
  }

  const payload = (await response.json()) as {
    data?: ProviderConnectionTestResult;
  } & Partial<ProviderConnectionTestResult>;

  return (payload.data ?? payload) as ProviderConnectionTestResult;
}