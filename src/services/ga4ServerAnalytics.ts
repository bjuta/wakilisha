import { supabase } from "@/lib/supabase";

const CLIENT_ID_KEY = "wk_ga4_mp_client_id";

function getClientId(): string {
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    window.localStorage.setItem(CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export async function sendServerGa4PageView(input: {
  pagePath: string;
  pageTitle: string;
  pageUrl: string;
}) {
  try {
    await supabase.functions.invoke("ga4-measurement-protocol", {
      body: {
        event_name: "page_view",
        page_path: input.pagePath,
        page_title: input.pageTitle,
        page_url: input.pageUrl,
        client_id: getClientId(),
        engagement_time_msec: 100,
      },
    });
  } catch (error) {
    console.warn("[GA4 Measurement Protocol] page_view delivery failed", error);
  }
}
