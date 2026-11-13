import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const media = fs.readFileSync("ops/media-processor/worker.py", "utf8");
const legal = fs.readFileSync("ops/legal-disclosure-worker/worker.py", "utf8");

describe("13 November 2026 worker PostgREST failure backpressure", () => {
  it("bounds poll RPC deadlines and applies exponential retry delay without changing job contracts", () => {
    for (const source of [media, legal]) {
      expect(source).toContain("timeout_seconds=10,");
      expect(source).toContain("def retry_backoff_seconds(consecutive_failures):");
      expect(source).toContain("consecutive_failures += 1");
      expect(source).toContain("time.sleep(delay)");
      expect(source).toContain("max(POLL_SECONDS, 2)");
    }
    expect(media).toContain('"recover_expired_media_processing_jobs_v1"');
    expect(media).toContain('"claim_media_processing_jobs_v1"');
    expect(legal).toContain('"recover_expired_messages_legal_disclosure_jobs_v1"');
    expect(legal).toContain('"claim_messages_legal_disclosure_jobs_v1"');
    expect(legal).toContain("initial_recovery_pending = True");
    expect(legal).not.toContain("    recover_expired_jobs(force=True)\n    while True:");
  });

  it("simulates 503 responses without a network call and proves bounded startup recovery", () => {
    const program = String.raw`import importlib.util
import io
import urllib.error

for file, kind in [
    ("ops/media-processor/worker.py", "media"),
    ("ops/legal-disclosure-worker/worker.py", "legal"),
]:
    spec = importlib.util.spec_from_file_location("wk_" + kind, file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    # The harness never uses a real Supabase URL or service key.
    # URL construction happens before the mocked urlopen is invoked.
    mod.SUPABASE_URL = "https://supabase.invalid"
    mod.SERVICE_KEY = "offline-test-only"

    for attempt in range(1, 13):
        delay = mod.retry_backoff_seconds(attempt)
        base = min(120.0, max(mod.POLL_SECONDS, 2) * (2 ** min(attempt, 6)))
        assert base <= delay <= 120, (kind, attempt, delay)
    assert mod.retry_backoff_seconds(12) <= 120

    observed = []
    def return_503(request, timeout):
        assert request.full_url == "https://supabase.invalid/rest/v1/rpc/recover_test"
        observed.append(timeout)
        raise urllib.error.HTTPError(
            request.full_url, 503, "Unavailable", {},
            io.BytesIO(b'{"error":"unavailable"}'),
        )
    mod.urllib.request.urlopen = return_503
    try:
        mod.rpc("recover_test", {}, timeout_seconds=10)
        raise AssertionError("503 was incorrectly treated as success")
    except (mod.RetryableProcessingError if kind == "media" else mod.RetryableDisclosureError):
        pass
    assert observed == [10], (kind, observed)

    if kind == "legal":
        mod.require_runtime = lambda: None
        mod.log = lambda *args, **kwargs: None
        attempts = []
        def recovery(force=False):
            attempts.append(force)
            raise mod.RetryableDisclosureError("503")
        mod.recover_expired_jobs = recovery
        sleeps = []
        def interrupt_after_backoff(seconds):
            sleeps.append(seconds)
            raise KeyboardInterrupt()
        mod.time.sleep = interrupt_after_backoff
        try:
            mod.main()
            raise AssertionError("Legal worker exited before retrying")
        except KeyboardInterrupt:
            pass
        assert attempts == [True], attempts
        assert len(sleeps) == 1 and sleeps[0] >= 10, sleeps
print("WORKER_BACKPRESSURE_OFFLINE_PASS")
`;
    const result = spawnSync("python3", ["-c", program], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 12000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("WORKER_BACKPRESSURE_OFFLINE_PASS");
  });
});
