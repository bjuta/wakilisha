const FORM_HANDLER_URL = "https://pgzizndxdyhqmtyywjmt.supabase.co/functions/v1/form-handler";

export type FormType =
  | "newsletter"
  | "contact"
  | "guide_download"
  | "dakar_follow"
  | "lyrics_contribution";

export interface FormResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface FormSubmissionData {
  form_type: FormType;
  [key: string]: string;
}

export async function submitForm(data: FormSubmissionData): Promise<FormResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    params.append(key, value);
  }

  const response = await fetch(FORM_HANDLER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const result: FormResult = await response.json();

  if (!response.ok || !result.success) {
    return {
      success: false,
      error: result.error ?? "Something went wrong. Please try again.",
    };
  }

  return result;
}