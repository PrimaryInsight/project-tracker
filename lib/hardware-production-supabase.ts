import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createHardwareProductionClient() {
  const hardwareProductionUrl =
    process.env.HARDWARE_PRODUCTION_SUPABASE_URL;
  const hardwareProductionSecretKey =
    process.env.HARDWARE_PRODUCTION_SUPABASE_SECRET_KEY;

  if (!hardwareProductionUrl) {
    throw new Error(
      "HARDWARE_PRODUCTION_SUPABASE_URL is not configured.",
    );
  }

  if (!hardwareProductionSecretKey) {
    throw new Error(
      "HARDWARE_PRODUCTION_SUPABASE_SECRET_KEY is not configured.",
    );
  }

  return createClient(
    hardwareProductionUrl,
    hardwareProductionSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
