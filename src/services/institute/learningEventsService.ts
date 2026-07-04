import { supabase } from "@/lib/supabase";

// Learning events are the Institute's memory of how understanding changed.
// They are best-effort: a missing event must never block the human's work,
// because the versioned records themselves remain the primary trail.

export async function logLearningEvent(
  inquiryId: string,
  eventType: string,
  eventLabel: string,
  beforeValue: Record<string, unknown>,
  afterValue: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from("institute_events").insert({
    inquiry_id: inquiryId,
    actor_id: data?.user?.id ?? null,
    event_type: eventType,
    event_label: eventLabel,
    before_value: beforeValue,
    after_value: afterValue,
    metadata,
  });
  if (error) console.error("[instituteLearning] event not saved:", error.message);
}
