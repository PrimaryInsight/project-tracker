"use server";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";
import { resolveMappedHardwareIdentity } from "@/lib/get-mapped-hardware-identity";

const ARRANGEMENTS = new Set(["Customer Owned", "Lease Item"]);
const LOGGER_TYPES = new Set(["", "Sentek", "Harvest"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ID = /^CLI[0-9]{5}$/;
const LOCATION_ID = /^LOC[0-9]{5}$/;
const STOCK_ID = /^STK[0-9]{5}$/;
const MAX_ASSETS = 25;
type Product = { product_id: string; product_code?: string | null; product_description?: string | null; product_category?: string | null; product_family?: string | null };
function deriveRole(product: Product): string { const source = [product.product_description, product.product_category, product.product_family, product.product_code].map(value => String(value ?? "").toLowerCase()).join(" "); if (source.includes("lrr")) return "LRR"; if (source.includes("dtu")) return "DTU"; if (source.includes("itu")) return "ITU"; if (source.includes("weather")) return "Weather Station"; if (source.includes("probe") || source.includes("moisture") || source.includes("sensor")) return "Probe"; if (source.includes("logger")) return "Logger"; return "Other Asset"; }
function value(formData: FormData, name: string): string { return String(formData.get(name) ?? "").trim(); }
function nullable(input: string): string | null { const result = input.trim(); return result || null; }
function localToday(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function fail(message: string): never { throw new Error(`Preview confirmation blocked: ${message}`); }

export async function confirmPreviewExistingLocationInstallation(formData: FormData) {
  if (["externalUserId", "externalEmail", "hardwareUserId", "userId", "email"].some(name => formData.has(name))) fail("browser-supplied identity values are forbidden");
  const tracker = await createProjectTrackerClient();
  const { data: { user }, error: userError } = await tracker.auth.getUser();
  if (userError || !user) redirect("/login?next=/asset-management/field-installation");
  const identity = await resolveMappedHardwareIdentity({ userId: user.id, email: user.email });
  const locationMode = value(formData, "locationMode"), installationStatus = value(formData, "installationStatus"), clientId = value(formData, "clientId"), locationId = value(formData, "locationId"), installationDate = value(formData, "installationDate"), installationType = value(formData, "installationType") || "New", loggerType = value(formData, "loggerType"), idempotencyKey = value(formData, "idempotencyKey"), rawCount = value(formData, "assetCount");
  if (!/^[1-9][0-9]*$/.test(rawCount)) fail("invalid asset count");
  const assetCount = Number(rawCount);
  if (!Number.isSafeInteger(assetCount) || assetCount < 1 || assetCount > MAX_ASSETS) fail(`asset count must be between 1 and ${MAX_ASSETS}`);
  const submitted = Array.from({ length: assetCount }, (_, index) => ({ stockItemId: value(formData, `stockItemId_${index}`), arrangement: value(formData, `assetArrangement_${index}`) }));
  for (const [index, asset] of submitted.entries()) { if (!STOCK_ID.test(asset.stockItemId)) fail(`asset ${index + 1} has an invalid stock item ID`); if (!ARRANGEMENTS.has(asset.arrangement)) fail(`asset ${index + 1} has an unsupported arrangement`); }
  if (new Set(submitted.map(asset => asset.stockItemId)).size !== submitted.length) fail("duplicate stock items are not allowed");
  if (locationMode !== "existing") fail("new-location mode is not enabled");
  if (installationStatus !== "Completed") fail("this preview write requires Completed status");
  if (!CLIENT_ID.test(clientId) || !LOCATION_ID.test(locationId)) fail("invalid client or location ID");
  if (!UUID.test(idempotencyKey)) fail("invalid idempotency key");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(installationDate) || installationDate > localToday()) fail("installation date is missing, invalid, or in the future");
  if (!LOGGER_TYPES.has(loggerType)) fail("unsupported logger type");
  const hardware = createHardwareClient();
  const stockIds = submitted.map(asset => asset.stockItemId);
  const [clientResult, locationResult, stockResult, assignmentResult] = await Promise.all([
    hardware.from("clients").select("client_id,status").eq("client_id", clientId).eq("status", "Active").maybeSingle(),
    hardware.from("locations").select("location_id,client_id,status").eq("location_id", locationId).eq("client_id", clientId).eq("status", "Active").maybeSingle(),
    hardware.from("stock_items").select("stock_item_id,product_id,lifecycle_status,status,warehouse").in("stock_item_id", stockIds),
    hardware.from("installation_assets").select("stock_item_id").in("stock_item_id", stockIds)
  ]);
  if (clientResult.error || !clientResult.data) fail("active client could not be independently verified");
  if (locationResult.error || !locationResult.data) fail("active location belonging to the client could not be independently verified");
  if (stockResult.error || !stockResult.data || stockResult.data.length !== submitted.length) fail("selected stock items could not be independently verified");
  if (assignmentResult.error || !assignmentResult.data) fail("selected stock-item assignment state could not be independently verified");
  if (assignmentResult.data.length) fail("one or more selected stock items already have an installation assignment");
  const stockById = new Map(stockResult.data.map(stock => [String(stock.stock_item_id), stock]));
  for (const asset of submitted) { const stock = stockById.get(asset.stockItemId); if (!stock || stock.lifecycle_status !== "In Stock" || stock.status !== "Active" || !["Otago", "Canterbury"].includes(String(stock.warehouse))) fail(`${asset.stockItemId} is no longer eligible`); }
  const productIds = Array.from(new Set(stockResult.data.map(stock => String(stock.product_id))));
  const productResult = await hardware.from("products").select("product_id,product_code,product_description,product_category,product_family").in("product_id", productIds).eq("status", "Active");
  if (productResult.error || !productResult.data) fail("asset products could not be independently verified");
  const productById = new Map((productResult.data as Product[]).map(product => [product.product_id, product]));
  const payloadAssets = submitted.map(asset => { const stock = stockById.get(asset.stockItemId)!; const product = productById.get(String(stock.product_id)); if (!product) fail(`${asset.stockItemId} has no active product definition`); return { stock_item_id: asset.stockItemId, asset_role: deriveRole(product), asset_arrangement: asset.arrangement, installed_at: installationDate, notes: null }; });
  const payload = { schema_version: 1, idempotency_key: idempotencyKey, client_id: clientId, location_id: locationId, installation: { installation_date: installationDate, installation_type: installationType, crop: nullable(value(formData, "crop")), ftp_id: nullable(value(formData, "ftpId")), logger_id: nullable(value(formData, "loggerId")), logger_type: nullable(loggerType), sim_card: nullable(value(formData, "simCard")), other_sensors: nullable(value(formData, "otherSensors")), notes: nullable(value(formData, "installationNotes")) }, assets: payloadAssets };
  const { data, error } = await hardware.rpc("confirm_existing_location_installation_bridge", { p_external_user_id: identity.externalUserId, p_external_email: identity.externalEmail, p_payload: payload });
  if (error) { console.error("Preview installation bridge failed", { code: error.code, message: error.message }); fail("the Hardware Database bridge rejected the request"); }
  const receipt = data as { ok?: boolean; installation?: { installation_id?: string }; assets?: unknown[] } | null;
  const installationId = receipt?.installation?.installation_id;
  if (!receipt?.ok || !installationId) fail("the bridge returned an incomplete receipt");
  if (!Array.isArray(receipt.assets) || receipt.assets.length !== submitted.length) fail("the bridge receipt did not confirm every submitted asset");
  redirect(`/asset-management/installation/${encodeURIComponent(installationId)}?previewTest=success&idempotencyKey=${encodeURIComponent(idempotencyKey)}`);
}
