import { supabase } from "@/lib/supabase";
import type {
  CreateReleaseShellResult,
  IntakeCreateInput,
  IntakeSearchInput,
  ProviderInspectResponse,
  ProviderSearchResponse,
} from "./types";

function edgeFunctionError(err: unknown): Error {
  const message = err instanceof Error ? err.message : "Provider intake API call failed.";
  return new Error(message);
}

function extractBodyError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const body = data as Record<string, unknown>;
  if (typeof body.error === "string" && body.error) return body.error;
  if (typeof body.detail === "string" && body.detail) return "Internal error: " + body.detail;
  return null;
}

export async function searchProviderCatalogue(
  input: IntakeSearchInput,
): Promise<ProviderSearchResponse> {
  const { data, error } = await supabase.functions.invoke("provider-intake-api", {
    body: {
      route: "search",
      provider: input.provider,
      storefront: input.storefront,
      entityType: input.entityType,
      query: input.query,
      limit: input.limit ?? 25,
    },
  });

  const bodyErr = extractBodyError(data);
  if (bodyErr) throw new Error(bodyErr);
  if (error) throw edgeFunctionError(error);

  return data as ProviderSearchResponse;
}

export async function inspectProviderEntity(
  provider: string,
  providerEntityType: string,
  providerEntityId: string,
  storefront: string,
): Promise<ProviderInspectResponse> {
  const { data, error } = await supabase.functions.invoke("provider-intake-api", {
    body: {
      route: "inspect",
      provider,
      providerEntityType,
      providerEntityId,
      storefront,
    },
  });

  const bodyErr = extractBodyError(data);
  if (bodyErr) throw new Error(bodyErr);
  if (error) throw edgeFunctionError(error);

  return data as ProviderInspectResponse;
}

export async function createReleaseShellFromProvider(
  input: IntakeCreateInput,
): Promise<CreateReleaseShellResult> {
  const { data, error } = await supabase.functions.invoke("provider-intake-api", {
    body: {
      route: "create-shell",
      ...input,
    },
  });

  // Check the response body for a structured error FIRST (edge function returns 200 even for errors now)
  const bodyErr = extractBodyError(data);
  if (bodyErr) throw new Error(bodyErr);
  if (error) throw edgeFunctionError(error);

  return data as CreateReleaseShellResult;
}

export async function attachProviderResultToShell(
  input: IntakeCreateInput & { targetRegistryEntityId: string },
): Promise<CreateReleaseShellResult> {
  const { data, error } = await supabase.functions.invoke("provider-intake-api", {
    body: {
      route: "attach-shell",
      ...input,
    },
  });

  const bodyErr = extractBodyError(data);
  if (bodyErr) throw new Error(bodyErr);
  if (error) throw edgeFunctionError(error);

  return data as CreateReleaseShellResult;
}

export async function refreshReleaseShell(
  input: IntakeCreateInput,
): Promise<CreateReleaseShellResult> {
  const { data, error } = await supabase.functions.invoke("provider-intake-api", {
    body: {
      route: "refresh-shell",
      ...input,
    },
  });

  const bodyErr = extractBodyError(data);
  if (bodyErr) throw new Error(bodyErr);
  if (error) throw edgeFunctionError(error);

  return data as CreateReleaseShellResult;
}

export async function backfillExistingRelease(
  input: IntakeCreateInput & { targetRegistryEntityId: string },
): Promise<CreateReleaseShellResult> {
  const { data, error } = await supabase.functions.invoke("provider-intake-api", {
    body: {
      route: "backfill",
      ...input,
      mode: "backfill_existing_release",
    },
  });

  const bodyErr = extractBodyError(data);
  if (bodyErr) throw new Error(bodyErr);
  if (error) throw edgeFunctionError(error);

  return data as CreateReleaseShellResult;
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
  const { data, error } = await supabase.functions.invoke("provider-intake-api", {
    body: {
      route: "test-connection",
      provider,
      storefront,
    },
  });

  const bodyErr = extractBodyError(data);
  if (bodyErr) throw new Error(bodyErr);
  if (error) throw edgeFunctionError(error);

  return data as ProviderConnectionTestResult;
}