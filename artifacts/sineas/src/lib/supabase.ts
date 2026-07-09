import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://rvnfudoqiseujbwzjqfo.supabase.co";
// VITE_SUPABASE_ANON_KEY (or service key for dev) — set this in Vercel environment variables
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** Bucket name — must match what's in VITE_SUPABASE_BUCKET (Vercel env) or defaults to sineas-videos */
export const VITE_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET ?? "sineas-videos";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

