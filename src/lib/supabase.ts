import {
  createClient,
} from "@supabase/supabase-js";
import {
  createInstrumentedFetch,
} from "@/lib/requestContext";

const supabaseUrl =
  import.meta.env
    .VITE_PUBLIC_SUPABASE_URL as string;

const supabaseKey =
  import.meta.env
    .VITE_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    global: {
      fetch: createInstrumentedFetch(),
    },
  },
);
