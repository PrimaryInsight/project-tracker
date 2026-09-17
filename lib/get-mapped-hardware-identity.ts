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

export async function runControlledAuthTest(
  identity: ProjectTrackerIdentity,
): Promise<ControlledAuthTestResult> {
  const hardware = createHardwareClient();
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
    return {
      ...baseResult,
      overallPassed: false,
      safeMessage: "The signed-in Project Tracker identity is incomplete.",
    };
  }

  // Diagnostic lookup by normalized email. The UUIDs are used only for a
  // server-side equality check and are never returned to the browser page.
  const { data: mappings, error: mappingError } = await hardware
    .from("external_staff_identity_map")
    .select(
      "external_user_id, external_email, hardware_user_id, identity_source",
    )
    .eq("external_email", normalizedSessionEmail)
    .eq("identity_source", "project_tracker")
    .eq("active", true)
    .limit(2);

  if (mappingError) {
    console.error("Controlled auth test: mapping lookup failed", {
      code: mappingError.code,
    });
    return {
      ...baseResult,
      overallPassed: false,
      safeMessage: "The preview identity mapping could not be verified.",
    };
  }

  if (!mappings || mappings.length !== 1) {
    return {
      ...baseResult,
      identityMappingFound: mappings?.length === 1,
      overallPassed: false,
      safeMessage:
        mappings && mappings.length > 1
          ? "More than one active mapping exists for the signed-in email. Testing stopped safely."
          : "No active identity mapping was found for the signed-in email.",
    };
  }

  const mapping = mappings[0];
  const normalizedMappedEmail = mapping.external_email?.trim().toLowerCase() ?? "";
  const identitySourceCorrect = mapping.identity_source === "project_tracker";
  const mappedEmailMatchesSession =
    normalizedMappedEmail.length > 0 &&
    normalizedMappedEmail === normalizedSessionEmail;
  const projectTrackerUuidMatchesSession =
    mapping.external_user_id === identity.userId;
  const hardwareIdentityMapped = Boolean(mapping.hardware_user_id);

  if (!projectTrackerUuidMatchesSession) {
    return {
      ...baseResult,
      identityMappingFound: true,
      identitySourceCorrect,
      mappedEmailMatchesSession,
      hardwareIdentityMapped,
      overallPassed: false,
      safeMessage:
        "The mapping email matches, but the stored Project Tracker identity does not match the current signed-in session. No identity values were displayed.",
    };
  }

  if (
    !identitySourceCorrect ||
    !mappedEmailMatchesSession ||
    !hardwareIdentityMapped
  ) {
    return {
      ...baseResult,
      identityMappingFound: true,
      identitySourceCorrect,
      mappedEmailMatchesSession,
      hardwareIdentityMapped,
      overallPassed: false,
      safeMessage: "The mapped identity did not pass the controlled safety checks.",
    };
  }

  const { data: hardwareUserResult, error: hardwareUserError } =
    await hardware.auth.admin.getUserById(mapping.hardware_user_id);

  const hardwareAuthUserExists =
    !hardwareUserError && Boolean(hardwareUserResult.user);

  if (hardwareUserError) {
    console.error("Controlled auth test: Hardware Auth lookup failed", {
      name: hardwareUserError.name,
      status: hardwareUserError.status,
    });
  }

  const { data: roles, error: roleError } = await hardware
    .from("app_user_roles")
    .select("role")
    .eq("user_id", mapping.hardware_user_id)
    .eq("active", true)
    .eq("role", "administrator")
    .limit(2);

  if (roleError) {
    console.error("Controlled auth test: role lookup failed", {
      code: roleError.code,
    });
  }

  const activeHardwareAdministrator =
    !roleError && Array.isArray(roles) && roles.length === 1;

  const overallPassed =
    baseResult.projectTrackerSessionPresent &&
    baseResult.verifiedEmailPresent &&
    projectTrackerUuidMatchesSession &&
    identitySourceCorrect &&
    mappedEmailMatchesSession &&
    hardwareIdentityMapped &&
    hardwareAuthUserExists &&
    activeHardwareAdministrator;

  return {
    ...baseResult,
    identityMappingFound: true,
    identitySourceCorrect,
    mappedEmailMatchesSession,
    hardwareIdentityMapped,
    hardwareAuthUserExists,
    activeHardwareAdministrator,
    overallPassed,
    safeMessage: overallPassed
      ? "The Project Tracker identity was safely recognised by the Hardware Database preview bridge."
      : "The controlled authentication test did not pass. No workflow was called and no database write was performed.",
  };
}
