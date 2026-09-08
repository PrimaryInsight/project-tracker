import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createHardwareClient() {
  const hardwareUrl = process.env.HARDWARE_SUPABASE_URL;
  const hardwareSecretKey =
    process.env.HARDWARE_SUPABASE_SECRET_KEY;

  if (!hardwareUrl) {
    throw new Error(
      "HARDWARE_SUPABASE_URL is not configured."
    );
  }

  if (!hardwareSecretKey) {
    throw new Error(
      "HARDWARE_SUPABASE_SECRET_KEY is not configured."
    );
  }

  return createClient(
    hardwareUrl,
    hardwareSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}