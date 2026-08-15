import { supabase } from "@/lib/supabase";
import type { PostActor } from "@/services/community/posts";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function extensionFor(file: File): "jpg" | "png" | "webp" | null {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  const raw = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : null;
  if (raw === "jpeg") return "jpg";
  return raw === "jpg" || raw === "png" || raw === "webp" ? raw : null;
}

export async function uploadPostImage(
  actor: Pick<PostActor, "type" | "id">,
  file: File,
): Promise<string> {
  const extension = extensionFor(file);
  if (!extension) throw new Error("Use a JPG, PNG, or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be 8MB or smaller.");

  const [
    { data: sessionData, error: sessionError },
    { data: userData, error: userError },
  ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  if (sessionError || userError || !sessionData.session?.access_token || !userData.user) {
    throw new Error("Sign in again before uploading Post media.");
  }

  const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("WAKILISHA media upload is unavailable.");
  }

  const folder =
    `uploads/profiles/${safePart(userData.user.id)}/posts/${actor.type}/${safePart(actor.id)}`;

  const uploadFile = new File([file], `post-image.${extension}`, {
    type: extension === "jpg" ? "image/jpeg" : `image/${extension}`,
  });

  const form = new FormData();
  form.append("file", uploadFile);
  form.append("folder", folder);

  const response = await fetch(`${supabaseUrl}/functions/v1/media-upload-api`, {
    method: "POST",
    body: form,
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabaseAnonKey,
    },
  });

  const payload = await response.json().catch(() => null) as {
    ok?: boolean; url?: string; error?: string;
  } | null;

  if (!response.ok || !payload?.ok || !payload.url) {
    throw new Error(payload?.error || `Image upload failed with ${response.status}.`);
  }
  return payload.url;
}
