import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202606300006_institute_pr3_inquiry_workbench.sql"),
  "utf8",
);

const service = readFileSync(
  resolve(process.cwd(), "src/services/institute/instituteService.ts"),
  "utf8",
);

const types = readFileSync(
  resolve(process.cwd(), "src/services/institute/instituteTypes.ts"),
  "utf8",
);

const router = readFileSync(resolve(process.cwd(), "src/router/config.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminShell.tsx"), "utf8");
const listPage = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/inquiries/page.tsx"), "utf8");
const detailPage = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/inquiries/detail/page.tsx"), "utf8");

describe("Institute PR3 Inquiry Workbench Admin", () => {
  it("adds the inquiry entity link table with RLS", () => {
    expect(migration).toContain("create table if not exists public.inquiry_entities");
    expect(migration).toContain("references public.inquiries(id)");
    expect(migration).toContain("references public.cultural_entities(id)");
    expect(migration).toContain("alter table public.inquiry_entities enable row level security");
    expect(migration).toContain("public.institute_can_read()");
    expect(migration).toContain("public.institute_can_manage()");
  });

  it("adds inquiry update and entity link service helpers", () => {
    expect(service).toContain("updateInquiry");
    expect(service).toContain("listInquiryEntityLinks");
    expect(service).toContain("linkEntityToInquiry");
    expect(service).toContain("unlinkEntityFromInquiry");
    expect(types).toContain("InquiryEntityLink");
    expect(types).toContain("CreateInquiryEntityLinkInput");
  });

  it("registers Inquiry Workbench routes in admin", () => {
    expect(router).toContain("AdminInstituteInquiriesPage");
    expect(router).toContain("AdminInstituteInquiryDetailPage");
    expect(router).toContain('{ path: "inquiries", element: <AdminInstituteInquiriesPage /> }');
    expect(router).toContain('{ path: "inquiries/:inquiryId", element: <AdminInstituteInquiryDetailPage /> }');
    expect(shell).toContain('/admin/institute/inquiries');
    expect(shell).toContain('label: "Inquiries"');
  });

  it("supports official PR3 workbench actions without AI", () => {
    expect(listPage).toContain("createInquiry");
    expect(listPage).toContain("listInquiries");
    expect(detailPage).toContain("updateInquiry");
    expect(detailPage).toContain("createInquiryNote");
    expect(detailPage).toContain("linkEntityToInquiry");
    expect(detailPage).toContain("known_known");
    expect(detailPage).toContain("known_unknown");
    expect(detailPage).not.toContain("createAiRun");
    expect(detailPage).not.toContain("embedding");
    expect(detailPage).not.toContain("reviewSurfaceDraft");
  });

  it("does not add public publishing or live AI execution", () => {
    const combined = [migration, service, listPage, detailPage].join("\n");
    expect(combined).not.toContain("openai");
    expect(combined).not.toContain("anthropic");
    expect(combined).not.toContain("chat.completions");
    expect(combined).not.toContain('path: "/institute"');
    expect(combined).not.toContain('to="/institute"');
  });
});
