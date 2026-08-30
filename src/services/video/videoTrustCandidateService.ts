import { supabase } from "@/lib/supabase";
import type { TrustAttachmentOption } from "@/components/design-system/trust/TrustAttachmentPicker";

type RpcResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

export interface VideoTrustCandidateBundle {
  credits: TrustAttachmentOption[];
  citations: TrustAttachmentOption[];
}

const EMPTY: VideoTrustCandidateBundle = {
  credits: [],
  citations: [],
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function fetchVideoTrustCandidates(): Promise<VideoTrustCandidateBundle> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
  ) => Promise<RpcResult>;

  const { data, error } = await rpc(
    "list_video_trust_attachment_candidates",
  );

  if (error?.code === "42501") return EMPTY;
  if (error) {
    throw new Error(error.message || "Video Trust records could not load.");
  }

  const root = record(data);

  return {
    credits: array(root.credits)
      .map((value) => {
        const row = record(value);
        return {
          id: text(row.id),
          label: text(row.display_name),
          detail: text(row.role_label) || text(row.credit_role),
        };
      })
      .filter((option) => option.id && option.label),
    citations: array(root.citations)
      .map((value) => {
        const row = record(value);
        return {
          id: text(row.id),
          label: text(row.label) || text(row.source_title),
          detail: text(row.locator_label),
        };
      })
      .filter((option) => option.id && option.label),
  };
}
