import "server-only";

import { createHardwareClient } from "./hardware-supabase";

export type ControlledAuthTestResult = {
  projectTrackerSessionPresent: boolean;
  verifiedEmailPresent: boolean;
  identityMappingFound: boolean;
  identitySourceCorrect: boolean;
  mappedEmailMatchesSession: boolean;
  hardwareIdentityMapped: boolean;
  hardwareAuthUserExists: boolean;
  activeHardwareAdministrator: boolean;
  identityValuesExposed: false;
  workflowCalled: false;
  databaseWritesPerformed: false;
  overallPassed: boolean;
  safeMessage: string;
};

type ProjectTrackerIdentity = {
  userId: string;
  email: string | null | undefined;
};

type MappedHardwareIdentity = {
  externalUserId: string;
  externalEmail: string;
  hardwareUserId: string;
};

export async function resolveMappedHardwareIdentity(
  identity: ProjectTrackerIdentity,
): Promise<MappedHardwareIdentity> {
  const externalUserId = identity.userId.trim();
  const externalEmail = identity.email?.trim().toLowerCase() ?? "";
  if (!externalUserId || !externalEmail) {
    throw new Error("The signed-in Project Tracker identity is incomplete.");
  }

  const hardware = createHardwareClient();
  const { data: mappings, error } = await hardware
    .from("external_staff_identity_map")
    .select("external_user_id, external_email, hardware_user_id, identity_source")
    .eq("external_user_id", externalUserId)
    .eq("external_email", externalEmail)
    .eq("identity_source", "project_tracker")
    .eq("active", true)
    .limit(2);

  if (error) {
    console.error("Mapped identity resolver: mapping lookup failed", { code: error.code });
    throw new Error("The preview identity mapping could not be verified.");
  }
  if (!mappings || mappings.length !== 1) {
    throw new Error("Exactly one active Project Tracker identity mapping is required.");
  }

  const mapping = mappings[0];
  if (
    mapping.external_user_id !== externalUserId ||
    mapping.external_email?.trim().toLowerCase() !== externalEmail ||
    mapping.identity_source !== "project_tracker" ||
    !mapping.hardware_user_id
  ) {
    throw new Error("The mapped identity did not pass the server-side safety checks.");
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
    throw new Error("The mapped Hardware Auth user could not be verified.");
  }
  if (roleError || !roles || roles.length !== 1) {
    throw new Error("The mapped Hardware user is not exactly one active administrator.");
  }

  return { externalUserId, externalEmail, hardwareUserId: mapping.hardware_user_id };
}

export async function runControlledAuthTest(
  identity: ProjectTrackerIdentity,
): Promise<ControlledAuthTestResult> {
  const normalizedSessionEmail = identity.email?.trim().toLowerCase() ?? "";
  const baseResult = {
    projectTrackerSessionPresent: Boolean(identity.userId),
    verifiedEmailPresent: normalizedSessionEmail.length > 0,
    identityMappingFound: false,
    identitySourceCorrect: false,
    mappedEmailMatchesSession: false,
    hardwareIdentityMapped: false,
    hardwareAuthUserExists: false,
    activeHardwareAdministrator: false,
    identityValuesExposed: false as const,
    workflowCalled: false as const,
    databaseWritesPerformed: false as const,
  };

  if (!identity.userId || !normalizedSessionEmail) {
    return { ...baseResult, overallPassed: false, safeMessage: "The signed-in Project Tracker identity is incomplete." };
  }

  try {
    await resolveMappedHardwareIdentity(identity);
    return {
      ...baseResult,
      identityMappingFound: true,
      identitySourceCorrect: true,
      mappedEmailMatchesSession: true,
      hardwareIdentityMapped: true,
      hardwareAuthUserExists: true,
      activeHardwareAdministrator: true,
      overallPassed: true,
      safeMessage: "The Project Tracker identity was safely recognised by the Hardware Database preview bridge.",
    };
  } catch (error) {
    console.error("Controlled auth test failed safely", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      ...baseResult,
      overallPassed: false,
      safeMessage: "The controlled authentication test did not pass. No workflow was called and no database write was performed.",
    };
  }
}
