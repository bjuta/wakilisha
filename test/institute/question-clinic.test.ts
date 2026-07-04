import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CLINIC_ASSESSMENT_OPTIONS } from "../../src/services/institute/questionClinicService";

// assessment_state values allowed by the institute_question_versions check
// constraint (migration 202607020001, line 77).
const DB_ASSESSMENT_STATES = new Set([
  "raw_but_promising",
  "ready",
  "too_broad",
  "too_narrow",
  "loaded",
  "false_assumption",
  "too_speculative",
  "not_answerable_yet",
  "already_answered",
  "different_question",
  "should_fork",
  "should_merge",
  "should_pause",
]);

describe("clinic assessment taxonomy", () => {
  it("covers exactly the database enum, no more and no less", () => {
    const optionValues = new Set(CLINIC_ASSESSMENT_OPTIONS.map((option) => option.value));
    expect(optionValues).toEqual(DB_ASSESSMENT_STATES);
  });

  it("every option has a human label and hint without em dashes", () => {
    for (const option of CLINIC_ASSESSMENT_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(2);
      expect(option.hint.length).toBeGreaterThan(4);
      expect(option.label.includes("—")).toBe(false);
      expect(option.hint.includes("—")).toBe(false);
    }
  });
});

describe("copy audit", () => {
  const roots = [
    path.resolve(__dirname, "../../src/pages/admin/institute"),
    path.resolve(__dirname, "../../src/services/institute"),
    path.resolve(__dirname, "../../supabase/functions/institute-assistant"),
  ];

  const collect = (dir: string, files: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full, files);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
    return files;
  };

  it("no misspellings that reached production before ('qestion')", () => {
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of collect(root)) {
        if (/qestion/i.test(fs.readFileSync(file, "utf8"))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
