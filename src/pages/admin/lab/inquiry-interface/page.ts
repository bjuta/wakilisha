import { createElement, useState } from "react";
import { useAdminUser } from "@/hooks/useAdminUser";
import { roleCanAccessAdmin } from "@/services/userRoles";
import { seedInquiry } from "./seed";

export default function AdminInquiryInterfacePage() {
  const user = useAdminUser();
  const [question, setQuestion] = useState(seedInquiry.question);

  if (user.loading || !user.id || !roleCanAccessAdmin(user.role)) {
    return createElement("div", { className: "p-6 text-wk-text" }, "Admin access needed");
  }

  return createElement(
    "div",
    { className: "space-y-6" },
    createElement(
      "section",
      { className: "rounded-3xl border border-wk-border bg-wk-surface p-6" },
      createElement("div", { className: "text-[11px] font-black uppercase tracking-wider text-wk-brand" }, "Inquiry Lab"),
      createElement("h1", { className: "mt-2 text-[26px] font-black tracking-tight text-wk-text" }, seedInquiry.inquiryId),
      createElement("p", { className: "mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted" }, seedInquiry.title),
    ),
    createElement(
      "section",
      { className: "rounded-2xl border border-wk-border bg-wk-surface p-5" },
      createElement("label", { className: "text-[12px] font-black uppercase tracking-wider text-wk-text-muted" }, "Question"),
      createElement("textarea", {
        value: question,
        onChange: (event: { target: { value: string } }) => setQuestion(event.target.value),
        className: "mt-3 min-h-28 w-full rounded-xl border border-wk-border bg-wk-bg p-4 text-sm text-wk-text outline-none focus:border-wk-brand",
      }),
    ),
    createElement(
      "section",
      { className: "rounded-2xl border border-wk-border bg-wk-surface p-5" },
      createElement("h2", { className: "text-[15px] font-black text-wk-text" }, "Current Understanding"),
      createElement("p", { className: "mt-2 text-[13px] leading-6 text-wk-text-muted" }, seedInquiry.currentUnderstanding.safeToSay),
    ),
  );
}
