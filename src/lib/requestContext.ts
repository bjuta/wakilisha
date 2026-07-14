export type StructuredRequestFailure = {
  event: "request_failure";
  requestId: string;
  upstreamRequestId: string | null;
  url: string;
  method: string;
  status: number | null;
  durationMs: number;
  message: string;
  occurredAt: string;
};

function requestUrl(
  input: RequestInfo | URL,
): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

export function createRequestId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID ===
      "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join("-");
}

export function reportRequestFailure(
  failure: StructuredRequestFailure,
): void {
  console.error(
    "[wakilisha-request-error]",
    JSON.stringify(failure),
  );
}

export function createInstrumentedFetch(
  baseFetch: typeof fetch =
    globalThis.fetch.bind(globalThis),
): typeof fetch {
  return (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const requestId = createRequestId();
    const startedAt = Date.now();
    const url = requestUrl(input);

    const method =
      init?.method ??
      (
        input instanceof Request
          ? input.method
          : "GET"
      );

    try {
      const response = await baseFetch(
        input,
        init,
      );

      const durationMs =
        Date.now() - startedAt;

      if (!response.ok) {
        reportRequestFailure({
          event: "request_failure",
          requestId,
          upstreamRequestId:
            response.headers.get(
              "sb-request-id",
            ) ??
            response.headers.get(
              "x-request-id",
            ),
          url,
          method,
          status: response.status,
          durationMs,
          message:
            response.statusText ||
            `HTTP ${response.status}`,
          occurredAt:
            new Date().toISOString(),
        });
      }

      return response;
    } catch (error) {
      reportRequestFailure({
        event: "request_failure",
        requestId,
        upstreamRequestId: null,
        url,
        method,
        status: null,
        durationMs:
          Date.now() - startedAt,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        occurredAt:
          new Date().toISOString(),
      });

      throw error;
    }
  }) as typeof fetch;
}
