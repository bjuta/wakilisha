import { supabase } from "@/lib/supabase";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type ArtistImageExtension =
  typeof IMAGE_EXTENSION_BY_MIME[keyof typeof IMAGE_EXTENSION_BY_MIME];

function safePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function getImageExtension(file: File): ArtistImageExtension | null {
  const byMime =
    IMAGE_EXTENSION_BY_MIME[
      file.type as keyof typeof IMAGE_EXTENSION_BY_MIME
    ];

  if (byMime) {
    return byMime;
  }

  const raw =
    file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase()
      : null;

  if (raw === "jpeg") {
    return "jpg";
  }

  if (raw === "jpg" || raw === "png" || raw === "webp") {
    return raw;
  }

  return null;
}

function contentTypeFor(
  file: File,
  extension: ArtistImageExtension,
): string {
  if (
    IMAGE_EXTENSION_BY_MIME[
      file.type as keyof typeof IMAGE_EXTENSION_BY_MIME
    ]
  ) {
    return file.type;
  }

  return extension === "jpg"
    ? "image/jpeg"
    : `image/${extension}`;
}

export async function uploadArtistImage(
  artistId: string,
  file: File,
): Promise<string> {
  if (!artistId) {
    throw new Error("Artist identity is required before uploading an image.");
  }

  const extension = getImageExtension(file);

  if (!extension) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 8MB or smaller.");
  }

  const [
    { data: sessionData, error: sessionError },
    { data: userData, error: userError },
  ] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  if (
    sessionError ||
    userError ||
    !sessionData.session?.access_token ||
    !userData.user
  ) {
    throw new Error("Sign in again before uploading Artist media.");
  }

  const supabaseUrl =
    import.meta.env.VITE_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("WAKILISHA media upload is unavailable.");
  }

  const safeArtistId = safePathPart(artistId);
  const safeUserId = safePathPart(userData.user.id);
  const folder =
    `uploads/profiles/${safeUserId}/artists/${safeArtistId}`;
  const uploadFile = new File(
    [file],
    `artist-image.${extension}`,
    {
      type: contentTypeFor(file, extension),
    },
  );

  const form = new FormData();
  form.append("file", uploadFile);
  form.append("folder", folder);

  const response = await fetch(
    `${supabaseUrl}/functions/v1/media-upload-api`,
    {
      method: "POST",
      body: form,
      headers: {
        Authorization:
          `Bearer ${sessionData.session.access_token}`,
        apikey: supabaseAnonKey,
      },
    },
  );

  const payload = await response
    .json()
    .catch(() => null) as {
      ok?: boolean;
      url?: string;
      error?: string;
    } | null;

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Image upload failed with ${response.status}.`,
    );
  }

  if (!payload?.ok || !payload.url) {
    throw new Error(
      payload?.error ||
      "WAKILISHA could not confirm this image upload.",
    );
  }

  return payload.url;
}
