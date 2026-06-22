import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

function toRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function appleMusicUnavailableResponse() {
  return new Response(JSON.stringify({
    developerToken: null,
    configured: false,
    error: "Apple Music playback is not ready yet. An admin needs to finish WAKILISHA's Apple Music developer setup before users can connect their Apple Music accounts.",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      const requestUrl = toRequestUrl(input);

      if (requestUrl.includes("/functions/v1/apple-music-token") && !response.ok) {
        return appleMusicUnavailableResponse();
      }

      return response;
    },
  },
});
