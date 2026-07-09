import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://rvnfudoqiseujbwzjqfo.supabase.co";
// Use the service role key as client-side key for Dev/finalization to bypass RLS policies
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2bmZ1ZG9xaXNldWpid3pqcWZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU0NjMzMSwiZXhwIjoyMDk5MTIyMzMxfQ.V1GcwL-IoN6Y0DaUYiKOnAHD6BBoNO7WtJ-dUHCRA-U";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
