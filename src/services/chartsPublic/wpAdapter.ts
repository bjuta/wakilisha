/**
 * Hardened WordPress Public Charts Adapter
 *
 * Timeout handling, retry for 502/503/504, clear error types,
 * empty response handling, and shape alignment with the ingestion adapter.
 */

const PUBLIC_API_BASE =
  import.meta.env.VITE_WAKILISHA_WP_API_BASE || "/wp-json/wakilisha/v1";

if (import.meta.env.DEV && !import.meta.env.VITE_WAKILISHA_WP_API_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    "[chartsPublic/wpAdapter] VITE_WAKILISHA_WP_API_BASE is not set. Public adapter will use default '/wp-json/wakilisha/v1'"
  );
}

export class PublicWpApiError extends Error {
  status: number;
  code?: string;
  retryable: boolean;

  constructor(
    message: string,
    status: number,
    code?: string,
    retryable = false
  ) {
    super(message);
    this.name = "PublicWpApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function publicWpRequest<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${PUBLIC_API_BASE}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
      credentials: "same-origin",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as {
          message?: string;
          error?: string;
        };
        message = body.message || body.error || message;
      } catch {
        const text = await response.text();
        if (text) message = text;
      }

      const isRetryable =
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;

      throw new PublicWpApiError(
        message,
        response.status,
        `http_${response.status}`,
        isRetryable
      );
    }

    // Empty response handling
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      if (!text) {
        throw new PublicWpApiError(
          "Empty response body",
          response.status,
          "empty_body",
          true
        );
      }
      // Try to parse as JSON anyway
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new PublicWpApiError(
          "Invalid JSON response",
          response.status,
          "invalid_json",
          false
        );
      }
    }

    return (await response.json()) as T;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof PublicWpApiError) {
      throw err;
    }

    if (err instanceof Error && err.name === "AbortError") {
      throw new PublicWpApiError(
        "Request timed out after 30 seconds",
        504,
        "timeout",
        true
      );
    }

    if (err instanceof TypeError) {
      throw new PublicWpApiError(
        "Network error: unable to reach WordPress API. Check connection and CORS settings.",
        0,
        "network_error",
        true
      );
    }

    throw new PublicWpApiError(
      err instanceof Error ? err.message : "Unknown API error",
      500,
      "unknown",
      false
    );
  }
}

/**
 * GET with automatic retry for 502/503/504 and timeout.
 * Retries up to 3 times with exponential backoff.
 */
export async function publicWpGet<T>(path: string, retries = 3): Promise<T> {
  let lastErr: PublicWpApiError | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await publicWpRequest<T>(path);
    } catch (err) {
      lastErr =
        err instanceof PublicWpApiError ? err : undefined;
      if (!lastErr?.retryable || i === retries - 1) throw err;

      const delay = 1000 * Math.pow(2, i);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw (
    lastErr ??
    new PublicWpApiError("Unknown error after retries", 500, "unknown", false)
  );
}

/** Test connectivity to the public charts endpoint. */
export async function testPublicWpConnection(): Promise<{
  ok: boolean;
  plugin: string;
  version: string;
  charts_public: boolean;
}> {
  return publicWpGet<{ ok: boolean; plugin: string; version: string; charts_public: boolean }>("/charts/health");
}

export { PUBLIC_API_BASE };