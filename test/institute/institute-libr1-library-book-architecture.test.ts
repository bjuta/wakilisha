import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "src/pages/library/page.tsx"), "utf8");
const service = readFileSync(resolve(process.cwd(), "src/services/libraryService.ts"), "utf8");

describe("LIBR.1 Library book architecture", () => {
  it("models the Library as books instead of a content shelf", () => {
    expect(service).toContain("export interface LibraryBook");
    expect(service).toContain("getLibraryBooks");
    expect(service).toContain("book-one");
    expect(service).toContain("book-two");
    expect(service).toContain("book-three");

    expect(page).toContain("The Library is not a shelf.");
    expect(page).toContain("Start here");
    expect(page).toContain("Reading order");
    expect(page).toContain("Read the method before the memory.");
  });

  it("shows Book One, Book Two, and Book Three as actual books", () => {
    expect(service).toContain("The WAKILISHA Constitution");
    expect(service).toContain("WAKILISHA Becomes the Institute");
    expect(service).toContain("Inquiry Operating System");

    expect(page).toContain("What this book governs");
    expect(page).toContain("Decisions and surfaces shaped");
    expect(page).toContain("Read {book.label} in order");
  });

  it("keeps public, internal, draft, and restraint visible", () => {
    expect(service).toContain('LibraryBookStatus = "public" | "internal" | "draft"');
    expect(page).toContain("Restraint");
    expect(page).toContain("public");
    expect(page).toContain("internal");
    expect(page).toContain("This book is visible as architecture, but its chapters are not public yet.");
  });

  it("connects the Library to Institute decisions and surfaces", () => {
    expect(service).toContain("Inquiry Workbench method");
    expect(service).toContain("Evidence Room restraint");
    expect(service).toContain("Contributor Desk");
    expect(service).toContain("Relationship Curator");
    expect(service).toContain("Future public Inquiry surfaces");
  });

  it("does not add SQL, AI, embeddings, public Inquiry pages, or unsafe punctuation", () => {
    const combined = [page, service].join("\\n");

    expect(combined).not.toContain("supabase");
    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(combined).not.toContain("/inquiries/");
    expect(combined).not.toContain("public Inquiry page");
    expect(combined).not.toMatch(/[—–]/);
  });
});
