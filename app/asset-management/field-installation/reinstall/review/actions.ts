"use server";

import { redirect } from "next/navigation";
import { createHardwareClient } from "@/lib/hardware-supabase";
import { resolvePreviewHardwareIdentity } from "@/lib/resolve-preview-hardware-identity";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSTALLATION_ID = /^INS[0-9]{5}$/;
const LOCATION_ID = /^LOC[0-9]{5}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type ReinstallationReceipt = {
  workflow?: string;
  schema_version?: number;
  idempotency_key?: string;
  source_installation_id?: string;
  destination_installation_id?: string;
  destination_location_id?: string;
  destination_location_name?: string;
  destination_client_id?: string;
  asset_count?: number;
  location_created?: boolean;
  replayed?: boolean;
  confirmed_by?: string;
  identity_bridge?: {
    identity_source?: string;
    external_user_id?: string;
  };
};

function value(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function nullable(text: string) {
  return text.length > 0 ? text : null;
}

function fail(message: string): never {
  throw new Error(`Re-installation confirmation stopped safely: ${message}. No further action was taken.`);
}

function allowedEmail(email: string) {
  return (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export async function confirmReinstallation(formData: FormData) {
  if (
    ["externalUserId", "externalEmail", "hardwareUserId", "userId", "email"].some(
      (name) => formData.has(name),
    )
  ) {
    fail("browser-supplied identity values are forbidden");
  }

  const sourceInstallationId = value(formData, "sourceInstallationId");
  const destinationClientId = value(formData, "destinationClientId");
  const destinationMode = value(formData, "destinationMode");
  const destinationLocationId = value(formData, "destinationLocationId");
  const idempotencyKey = value(formData, "idempotencyKey");
  const effectiveDate = value(formData, "effectiveDate");
  const reason = value(formData, "reason");
  const notes = value(formData, "notes");
  const crop = value(formData, "crop");
  const ftpId = value(formData, "ftpId");
  const loggerId = value(formData, "loggerId");
  const loggerType = value(formData, "loggerType");
  const simCard = value(formData, "simCard");
  const otherSensors = value(formData, "otherSensors");

  if (!INSTALLATION_ID.test(sourceInstallationId)) fail("the source installation is invalid");
  if (!/^CLI[0-9]{5}$/.test(destinationClientId)) fail("the destination client is invalid");
  if (!UUID.test(idempotencyKey)) fail("the idempotency key is missing or invalid");
  if (!DATE.test(effectiveDate)) fail("the effective date is missing or invalid");
  if (!reason || reason.length > 200) fail("the reason is missing or too long");
  if (notes.length > 1000 || crop.length > 120 || ftpId.length > 120 || loggerId.length > 120) {
    fail("one or more installation details are too long");
  }
  if (!["", "Harvest", "Sentek"].includes(loggerType)) fail("the logger type is invalid");
  if (simCard.length > 120 || otherSensors.length > 500) fail("one or more installation details are too long");
  if (!["existing", "new"].includes(destinationMode)) fail("the destination mode is invalid");

  const projectTracker = await createProjectTrackerClient();
  const { data: { user }, error: userError } = await projectTracker.auth.getUser();
  if (userError || !user) redirect("/login?next=/asset-management/field-installation/reinstall/review");

  const sessionEmail = user.email?.trim().toLowerCase() ?? "";
  if (!sessionEmail || !allowedEmail(sessionEmail)) fail("the signed-in email is not approved");

  const identity = await resolvePreviewHardwareIdentity({ userId: user.id, email: user.email });
  const hardware = createHardwareClient();

  const payload: Record<string, unknown> = {
    schema_version: 1,
    idempotency_key: idempotencyKey,
    source_installation_id: sourceInstallationId,
    destination_client_id: destinationClientId,
    effective_date: effectiveDate,
    reason,
    notes: nullable(notes),
    installation: {
      installation_type: "Reinstallation",
      crop: nullable(crop),
      ftp_id: nullable(ftpId),
      logger_id: nullable(loggerId),
      logger_type: nullable(loggerType),
      sim_card: nullable(simCard),
      other_sensors: nullable(otherSensors),
    },
  };

  if (destinationMode === "existing") {
    if (!LOCATION_ID.test(destinationLocationId)) fail("the existing destination location is invalid");
    payload.destination_location_id = destinationLocationId;
  } else {
    const locationName = value(formData, "newLocationName");
    const region = value(formData, "newLocationRegion") || "Canterbury";
    const locationNotes = value(formData, "newLocationNotes");
    const latitude = value(formData, "newLocationLatitude");
    const longitude = value(formData, "newLocationLongitude");

    if (!locationName || locationName.length > 200) fail("the proposed location name is missing or invalid");
    if (region.length > 120 || locationNotes.length > 1000) fail("the proposed location details are too long");
    if (Boolean(latitude) !== Boolean(longitude)) fail("latitude and longitude must both be supplied or both omitted");

    payload.proposed_location = {
      location_name: locationName,
      region,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      notes: nullable(locationNotes),
    };
  }

  const { data, error } = await hardware.rpc("confirm_reinstallation_bridge", {
    p_external_user_id: identity.externalUserId,
    p_external_email: identity.externalEmail,
    p_payload: payload,
  });

  if (error) {
    console.error("Preview re-installation bridge failed safely", { code: error.code });
    fail(error.message || "the Preview bridge rejected the request");
  }

  const receipt = data as ReinstallationReceipt | null;
  if (!receipt || receipt.workflow !== "confirm_reinstallation") fail("the Preview bridge returned an invalid receipt");
  if (receipt.schema_version !== 1 || receipt.idempotency_key !== idempotencyKey) fail("the Preview bridge returned a mismatched receipt");
  if (receipt.source_installation_id !== sourceInstallationId) fail("the Preview bridge returned a different source installation");
  if (!receipt.destination_installation_id || !INSTALLATION_ID.test(receipt.destination_installation_id)) fail("the destination installation was not returned");
  if (!receipt.destination_location_id || !LOCATION_ID.test(receipt.destination_location_id)) fail("the destination location was not returned");
  if (!receipt.asset_count || receipt.asset_count < 1) fail("the receipt contains no moved assets");
  if (receipt.confirmed_by !== identity.hardwareUserId) fail("the receipt Hardware identity is incorrect");
  if (
    receipt.identity_bridge?.identity_source !== "project_tracker" ||
    receipt.identity_bridge.external_user_id !== identity.externalUserId
  ) {
    fail("the receipt identity attribution is incomplete or incorrect");
  }
  if (destinationMode === "new" && receipt.location_created !== true) fail("the proposed location was not reported as created");
  if (destinationMode === "existing" && receipt.location_created !== false) fail("the existing-location result was inconsistent");

  redirect(
    `/asset-management/installation/${encodeURIComponent(receipt.destination_installation_id)}` +
      `?previewReinstallation=success` +
      `&replayed=${receipt.replayed ? "1" : "0"}` +
      `&idempotencyKey=${encodeURIComponent(idempotencyKey)}`,
  );
}
