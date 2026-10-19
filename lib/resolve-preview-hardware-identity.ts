import "server-only";

import { createHardwareClient } from "@/lib/hardware-supabase";

type ProjectTrackerIdentity = {
  userId: string;
  email: string | null | undefined;
};

export type PreviewHardwareIdentity = {
  externalUserId: string;
  externalEmail: string;
  hardwareUserId: string;
};

export async function resolvePreviewHardwareIdentity(
  identity: ProjectTrackerIdentity,
): Promise<PreviewHardwareIdentity> {
  const externalUserId = identity.userId.trim();
  const externalEmail = identity.email?.trim().toLowerCase() ?? "";

  if (!externalUserId || !externalEmail) {
    throw new Error("The signed-in Project Tracker identity is incomplete.");
  }

  const hardware = createHardwareClient();
  const { data: mappings, error: mappingError } = await hardware
    .from("external_staff_identity_map")
    .select(
      "external_user_id, external_email, hardware_user_id, identity_source",
    )
    .eq("external_user_id", externalUserId)
    .eq("external_email", externalEmail)
    .eq("identity_source", "project_tracker")
    .eq("active", true)
    .limit(2);

  if (mappingError) {
    console.error("Preview Hardware identity mapping lookup failed", {
      code: mappingError.code,
    });
    throw new Error("The Preview Hardware identity mapping could not be verified.");
  }

  if (!mappings || mappings.length !== 1) {
    throw new Error(
      "Exactly one active Preview Project Tracker identity mapping is required.",
    );
  }

  const mapping = mappings[0];
  const mappedEmail = mapping.external_email?.trim().toLowerCase() ?? "";

  if (
    mapping.external_user_id !== externalUserId ||
    mappedEmail !== externalEmail ||
    mapping.identity_source !== "project_tracker" ||
    !mapping.hardware_user_id
  ) {
    throw new Error("The Preview Hardware identity mapping failed validation.");
  }

  const [{ data: hardwareUser, error: authError }, { data: roles, error: roleError }] =
    await Promise.all([
      hardware.auth.admin.getUserById(mapping.hardware_user_id),
      hardware
        .from("app_user_roles")
        .select("role")
        .eq("user_id", mapping.hardware_user_id)
        .eq("active", true)
        .eq("role", "administrator")
        .limit(2),
    ]);

  if (authError || !hardwareUser.user) {
    console.error("Preview mapped Hardware Auth user verification failed", {
      code: authError?.code,
    });
    throw new Error("The mapped Preview Hardware Auth user could not be verified.");
  }

  if (roleError || !roles || roles.length !== 1) {
    console.error("Preview mapped Hardware administrator verification failed", {
      code: roleError?.code,
    });
    throw new Error(
      "The mapped Preview Hardware user is not exactly one active administrator.",
    );
  }

  return {
    externalUserId,
    externalEmail,
    hardwareUserId: mapping.hardware_user_id,
  };
}
