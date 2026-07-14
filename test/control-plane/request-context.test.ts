import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createInstrumentedFetch,
} from "../../src/lib/requestContext";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request context", () => {
  it(
    "records structured non-success responses",
    async () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(
          () => undefined,
        );

      const baseFetch = vi.fn(
        async () =>
          new Response("unavailable", {
            status: 503,
            statusText:
              "Service Unavailable",
            headers: {
              "sb-request-id":
                "upstream-123",
            },
          }),
      ) as unknown as typeof fetch;

      const response =
        await createInstrumentedFetch(
          baseFetch,
        )(
          "https://example.test/resource",
          {
            method: "POST",
          },
        );

      expect(response.status).toBe(503);
      expect(errorSpy)
        .toHaveBeenCalledTimes(1);

      const payload = JSON.parse(
        String(
          errorSpy.mock.calls[0]?.[1],
        ),
      );

      expect(payload.event)
        .toBe("request_failure");
      expect(payload.requestId)
        .toBeTruthy();
      expect(payload.upstreamRequestId)
        .toBe("upstream-123");
      expect(payload.method)
        .toBe("POST");
      expect(payload.status)
        .toBe(503);
    },
  );

  it(
    "records and rethrows network failures",
    async () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(
          () => undefined,
        );

      const baseFetch = vi.fn(
        async () => {
          throw new Error("network down");
        },
      ) as unknown as typeof fetch;

      await expect(
        createInstrumentedFetch(
          baseFetch,
        )(
          "https://example.test/resource",
        ),
      ).rejects.toThrow("network down");

      const payload = JSON.parse(
        String(
          errorSpy.mock.calls[0]?.[1],
        ),
      );

      expect(payload.event)
        .toBe("request_failure");
      expect(payload.status)
        .toBeNull();
      expect(payload.message)
        .toBe("network down");
    },
  );
});
