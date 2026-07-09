import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "https://rvnfudoqiseujbwzjqfo.supabase.co").trim();

/**
 * Strip any character outside printable ASCII (0x20–0x7E) to prevent
 * "String contains non ISO-8859-1 code point" errors in HTTP headers.
 * This happens when the key is pasted with invisible Unicode chars or newlines.
 */
function sanitizeKey(raw: string): string {
  return raw.trim().replace(/[^\x20-\x7E]/g, "");
}

const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabaseKey = sanitizeKey(rawKey);

if (!supabaseKey) {
  console.error("[Supabase] VITE_SUPABASE_ANON_KEY is empty — upload will fail. Set it in Vercel environment variables.");
} else if (rawKey !== supabaseKey) {
  console.warn("[Supabase] VITE_SUPABASE_ANON_KEY had non-ASCII characters — they were stripped automatically.");
}

/** Bucket name — reads from VITE_SUPABASE_BUCKET env var (default: sineas-videos) */
export const VITE_BUCKET = (import.meta.env.VITE_SUPABASE_BUCKET ?? "sineas-videos").trim();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

