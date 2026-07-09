import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "https://rvnfudoqiseujbwzjqfo.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/** Bucket name for all Sineas video/image uploads. Reads from SUPABASE_BUCKET_NAME env var. */
export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET_NAME ?? "sineas-videos";

export async function ensureBucketExists(bucketName: string = SUPABASE_BUCKET) {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) throw listError;

    const exists = buckets.some((b) => b.name === bucketName);
    if (!exists) {
      console.log(`Creating Supabase Storage bucket: ${bucketName}...`);
      // Create bucket with default public: true. We do NOT hardcode a small fileSizeLimit
      // here to allow the developer to increase it via Supabase Dashboard Settings
      // without this code resetting it on every restart/request.
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
      });
      if (createError) throw createError;
      console.log(`Bucket ${bucketName} created successfully!`);
    } else {
      // Bucket exists, do nothing so we preserve any custom file size limits
      // configured in the Supabase Dashboard.
      console.log(`Bucket ${bucketName} already exists.`);
    }
  } catch (err) {
    console.error(`Failed to ensure bucket ${bucketName} exists:`, err);
  }
}
