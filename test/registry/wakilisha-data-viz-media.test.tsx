import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WkRecordingArtwork, validateWkArtworkUrl } from "../../src/components/data-viz/WkRecordingArtwork";
import { WkZonedTimestamp, formatWkZonedTimestamp } from "../../src/components/data-viz/WkZonedTimestamp";

describe("WAKILISHA source-bound visual media", () => {
  it("accepts only approved HTTPS source artwork hosts", () => {
    expect(validateWkArtworkUrl("https://is1-ssl.mzstatic.com/image/sample.png"))
      .toBe("https://is1-ssl.mzstatic.com/image/sample.png");
    expect(validateWkArtworkUrl("https://i.scdn.co/image/test")).toBe("https://i.scdn.co/image/test");
    for (const input of ["http://i.scdn.co/image/test", "https://malicious.example/cover",
      "https://i.scdn.co.evil.example/p", "javascript:alert(1)", "file:///cover.jpg", null]) {
      expect(validateWkArtworkUrl(input)).toBeNull();
    }
  });
  it("renders a deliberate neutral visual when no authorized artwork exists", () => {
    const html = renderToStaticMarkup(<WkRecordingArtwork url={null} title="DESIRE" />);
    expect(html).toContain('data-wk-artwork-state="unavailable"');
    expect(html).toContain("Artwork unavailable");
    expect(html).not.toContain("<img");
  });
  it("renders a verified provider image with accessible name and lazy loading", () => {
    const html = renderToStaticMarkup(<WkRecordingArtwork
      url="https://i.scdn.co/image/test" title="DESIRE" />);
    expect(html).toContain("Artwork for DESIRE");
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerPolicy="no-referrer"');
  });
});

describe("WAKILISHA IANA time presentation", () => {
  it("formats the UTC instant into Nairobi time without UTC-local ambiguity", () => {
    const result = formatWkZonedTimestamp("2026-10-12T04:30:00Z", "Africa/Nairobi");
    expect(result).toBeTruthy();
    expect(result).toMatch(/7:30|07:30/);
    expect(result).not.toContain("Time unavailable");
  });
  it("fails closed for naive, invalid or unsupported time zones", () => {
    expect(formatWkZonedTimestamp("2026-10-12T04:30:00", "Africa/Nairobi")).toBeNull();
    expect(formatWkZonedTimestamp("not-a-date", "Africa/Nairobi")).toBeNull();
    expect(formatWkZonedTimestamp("2026-10-12T04:30:00Z", "Invalid/Timezone")).toBeNull();
  });
  it("renders the original instant in accessible HTML time metadata", () => {
    const html = renderToStaticMarkup(
      <WkZonedTimestamp value="2026-10-12T04:30:00Z" timeZone="Africa/Nairobi" />,
    );
    expect(html).toContain('dateTime="2026-10-12T04:30:00Z"');
    expect(html).not.toContain("Time unavailable");
  });
});
