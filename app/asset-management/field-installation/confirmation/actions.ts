"use server";

import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";
import { resolveMappedHardwareIdentity } from "@/lib/get-mapped-hardware-identity";

const ROLES = new Set(["Probe", "DTU", "ITU", "LRR", "Logger", "Weather Station", "Other Asset"]);
const ARRANGEMENTS = new Set(["Customer Owned", "Lease Item"]);
const LOGGER_TYPES = new Set(["", "Sentek", "Harvest"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ID = /^CLI[0-9]{5}$/;
const LOCATION_ID = /^LOC[0-9]{5}$/;
const STOCK_ID = /^STK[0-9]{5}$/;

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}
function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
function localToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function fail(message: string): never {
  throw new Error(`Preview confirmation blocked: ${message}`);
}

export async function confirmPreviewExistingLocationInstallation(formData: FormData) {
  const forbiddenIdentityFields = ["externalUserId", "externalEmail", "hardwareUserId", "userId", "email"];
  if (forbiddenIdentityFields.some((name) => formData.has(name))) {
    fail("browser-supplied identity values are forbidden");
  }

  const tracker = await createProjectTrackerClient();
  const { data: { user }, error: userError } = await tracker.auth.getUser();
  if (userError || !user) redirect("/login?next=/asset-management/field-installation");

  const identity = await resolveMappedHardwareIdentity({ userId: user.id, email: user.email });
  const locationMode = value(formData, "locationMode");
  const installationStatus = value(formData, "installationStatus");
  const clientId = value(formData, "clientId");
  const locationId = value(formData, "locationId");
  const stockItemId = value(formData, "stockItemId");
  const installationDate = value(formData, "installationDate");
  const installationType = value(formData, "installationType") || "New";
  const assetRole = value(formData, "assetRole");
  const assetArrangement = value(formData, "assetArrangement");
  const loggerType = value(formData, "loggerType");
  const idempotencyKey = value(formData, "idempotencyKey");

  if (locationMode !== "existing") fail("new-location mode is not enabled");
  if (installationStatus !== "Completed") fail("the first test requires Completed status");
  if (!CLIENT_ID.test(clientId)) fail("invalid client ID");
  if (!LOCATION_ID.test(locationId)) fail("invalid location ID");
  if (!STOCK_ID.test(stockItemId)) fail("invalid stock item ID");
  if (!UUID.test(idempotencyKey)) fail("invalid idempotency key");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(installationDate) || installationDate > localToday()) fail("installation date is missing, invalid, or in the future");
  if (!ROLES.has(assetRole)) fail("unsupported asset role");
  if (!ARRANGEMENTS.has(assetArrangement)) fail("unsupported asset arrangement");
  if (!LOGGER_TYPES.has(loggerType)) fail("unsupported logger type");

  const hardware = createHardwareClient();
  const [clientResult, locationResult, stockResult] = await Promise.all([
    hardware.from("clients").select("client_id,status").eq("client_id", clientId).eq("status", "Active").maybeSingle(),
    hardware.from("locations").select("location_id,client_id,status").eq("location_id", locationId).eq("client_id", clientId).eq("status", "Active").maybeSingle(),
    hardware.from("stock_items").select("stock_item_id,lifecycle_status,status,warehouse").eq("stock_item_id", stockItemId).maybeSingle(),
  ]);
  if (clientResult.error || !clientResult.data) fail("active client could not be independently verified");
  if (locationResult.error || !locationResult.data) fail("active location belonging to the client could not be independently verified");
  if (stockResult.error || !stockResult.data) fail("stock item could not be independently verified");
  if (stockResult.data.lifecycle_status !== "In Stock" || stockResult.data.status !== "Active" || !["Otago", "Canterbury"].includes(stockResult.data.warehouse)) {
    fail("stock item is no longer eligible");
  }

  const { count: assignmentCount, error: assignmentError } = await hardware
    .from("installation_assets")
    .select("installation_asset_id", { count: "exact", head: true })
    .eq("stock_item_id", stockItemId);
  if (assignmentError || assignmentCount !== 0) fail("stock item already has an installation assignment");

  const payload = {
    schema_version: 1,
    idempotency_key: idempotencyKey,
    client_id: clientId,
    location_id: locationId,
    installation: {
      installation_date: installationDate,
      installation_type: installationType,
      crop: nullable(value(formData, "crop")),
      ftp_id: nullable(value(formData, "ftpId")),
      logger_id: nullable(value(formData, "loggerId")),
      logger_type: nullable(loggerType),
      sim_card: nullable(value(formData, "simCard")),
      other_sensors: nullable(value(formData, "otherSensors")),
      notes: nullable(value(formData, "installationNotes")),
    },
    assets: [{
      stock_item_id: stockItemId,
      asset_role: assetRole,
      asset_arrangement: assetArrangement,
      installed_at: installationDate,
      notes: nullable(value(formData, "assetNotes")),
    }],
  };

  const { data, error } = await hardware.rpc("confirm_existing_location_installation_bridge", {
    p_external_user_id: identity.externalUserId,
    p_external_email: identity.externalEmail,
    p_payload: payload,
  });
  if (error) {
    console.error("Preview installation bridge failed", { code: error.code, message: error.message });
    fail("the Hardware Database bridge rejected the request");
  }

  const receipt = data as { ok?: boolean; installation?: { installation_id?: string }; idempotency_key?: string } | null;
  const installationId = receipt?.installation?.installation_id;
  if (!receipt?.ok || !installationId) fail("the bridge returned an incomplete receipt");

  redirect(`/asset-management/installation/${encodeURIComponent(installationId)}?previewTest=success&idempotencyKey=${encodeURIComponent(idempotencyKey)}`);
}
