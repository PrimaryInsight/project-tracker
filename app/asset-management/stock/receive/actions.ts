"use server";

import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareProductionClient } from "@/lib/hardware-production-supabase";
import { resolveMappedHardwareIdentity } from "@/lib/get-mapped-hardware-identity";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_ID = /^PRD[0-9]{4}$/;
const STOCK_ID = /^STK[0-9]{5}$/;
const WAREHOUSES = new Set(["Canterbury", "Otago"]);
const MAX_SERIAL_LENGTH = 200;

const FORBIDDEN_BROWSER_FIELDS = [
  "externalUserId", "externalEmail", "hardwareUserId", "userId", "email",
  "createdBy", "created_by", "stockItemId", "stock_item_id", "assetEventId",
  "asset_event_id", "lifecycleStatus", "lifecycle_status", "assetClassification",
  "asset_classification", "status", "source",
] as const;

type ProductRow = {
  product_id: string;
  product_description: string | null;
  manufacturer: string | null;
  product_category: string | null;
  status: string;
};

type Receipt = {
  ok?: boolean;
  schema_version?: number;
  idempotency_key?: string;
  replayed?: boolean;
  received_by?: { user_id?: string; display_name?: string | null };
  stock_item?: {
    stock_item_id?: string; product_id?: string; product_description?: string | null;
    product_serial?: string; date_received?: string | null; lifecycle_status?: string;
    asset_classification?: string; warehouse?: string; status?: string;
  };
  event?: { asset_event_id?: string; event_type?: string; source?: string; created_by?: string };
  deltas?: { stock_items?: number; asset_events?: number };
  identity_bridge?: { identity_source?: string; external_user_id?: string };
};

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}
function fail(message: string): never { throw new Error(`Production stock receipt blocked: ${message}`); }
function localToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function isSelectableProduct(product: ProductRow): boolean {
  const description = (product.product_description ?? "").toLowerCase();
  const manufacturer = (product.manufacturer ?? "").toLowerCase();
  const category = (product.product_category ?? "").toLowerCase();
  return product.product_id !== "PRD9001" && manufacturer !== "synthetic" && category !== "test equipment" && !description.includes("preview test") && !description.includes("synthetic test");
}

export async function confirmProductionStockReceipt(formData: FormData) {
  if (FORBIDDEN_BROWSER_FIELDS.some((name) => formData.has(name))) fail("browser-supplied identity or server-controlled values are forbidden");
  const tracker = await createProjectTrackerClient();
  const { data: { user }, error: userError } = await tracker.auth.getUser();
  if (userError || !user) redirect("/login?next=/asset-management/stock/receive");
  const identity = await resolveMappedHardwareIdentity({ userId: user.id, email: user.email });

  const productId = value(formData, "productId").toUpperCase();
  const productSerial = value(formData, "serial");
  const warehouse = value(formData, "warehouse");
  const idempotencyKey = value(formData, "idempotencyKey");
  const dateReceived = value(formData, "dateReceived") || localToday();
  if (!PRODUCT_ID.test(productId)) fail("invalid product ID");
  if (!productSerial) fail("serial number is required");
  if (productSerial.length > MAX_SERIAL_LENGTH) fail(`serial number exceeds ${MAX_SERIAL_LENGTH} characters`);
  if (!WAREHOUSES.has(warehouse)) fail("warehouse must be Canterbury or Otago");
  if (!UUID.test(idempotencyKey)) fail("invalid idempotency key");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateReceived) || dateReceived > localToday()) fail("date received is missing, invalid, or in the future");

  const hardware = createHardwareProductionClient();
  const [productResult, duplicateResult, serialResult, mappingResult] = await Promise.all([
    hardware.from("products").select("product_id,product_description,manufacturer,product_category,status").eq("product_id", productId).eq("status", "Active").maybeSingle(),
    hardware.from("stock_items").select("stock_item_id,product_id,product_serial").eq("product_id", productId).ilike("product_serial", productSerial).limit(1),
    hardware.from("stock_items").select("stock_item_id,product_id,product_serial").ilike("product_serial", productSerial),
    hardware.from("external_staff_identity_map").select("identity_source,external_user_id,external_email,hardware_user_id,active").eq("identity_source", "project_tracker").eq("external_user_id", identity.externalUserId).eq("external_email", identity.externalEmail).eq("hardware_user_id", identity.hardwareUserId).eq("active", true).maybeSingle(),
  ]);
  if (productResult.error || !productResult.data) fail("active controlled product could not be independently verified");
  const product = productResult.data as ProductRow;
  if (!isSelectableProduct(product)) fail("synthetic or test products cannot be received");
  if (duplicateResult.error || !duplicateResult.data) fail("exact duplicate state could not be independently verified");
  const exactDuplicateExists = duplicateResult.data.length > 0;
  if (serialResult.error || !serialResult.data) fail("serial-number usage could not be independently verified");
  if (mappingResult.error || !mappingResult.data) fail("the verified Production identity mapping is missing or inactive");
  const sameSerialDifferentProduct = serialResult.data.some((item) => String(item.product_id) !== productId);

  const payload = {
    schema_version: 1, idempotency_key: idempotencyKey, product_id: productId,
    product_serial: productSerial, warehouse, date_received: dateReceived,
    main_board_serial: null, solar_board_serial: null, modem_board_serial: null,
    modem_type: null, imei: null,
    notes: sameSerialDifferentProduct ? "Serial also exists under a different controlled product type; warning reviewed during receipt." : null,
  };
  const { data, error } = await hardware.rpc("receive_stock_item_bridge", {
    p_external_user_id: identity.externalUserId, p_external_email: identity.externalEmail, p_payload: payload,
  });
  if (error) {
    console.error("Production stock receipt bridge failed", { code: error.code, message: error.message, details: error.details, hint: error.hint, exactDuplicateExists });
    fail("the Hardware Production bridge rejected the receipt request");
  }

  const receipt = data as Receipt | null;
  const stockItem = receipt?.stock_item;
  const event = receipt?.event;
  const stockItemId = stockItem?.stock_item_id;
  if (!receipt?.ok || receipt.schema_version !== 1) fail("the Production bridge returned an invalid receipt");
  if (receipt.idempotency_key !== idempotencyKey) fail("the Production bridge returned a different idempotency key");
  if (!stockItemId || !STOCK_ID.test(stockItemId)) fail("the Production bridge did not return a valid stock item ID");
  if (stockItem.product_id !== productId || stockItem.product_serial !== productSerial || stockItem.warehouse !== warehouse || stockItem.lifecycle_status !== "In Stock" || stockItem.asset_classification !== "Company Owned" || stockItem.status !== "Active") fail("the Production bridge stock values did not match the confirmed receipt");
  if (event?.event_type !== "Received" || event.source !== "Web Form" || event.created_by !== identity.hardwareUserId) fail("the Production bridge event attribution was incomplete or incorrect");
  if (receipt.received_by?.user_id !== identity.hardwareUserId || receipt.identity_bridge?.identity_source !== "project_tracker" || receipt.identity_bridge.external_user_id !== identity.externalUserId) fail("the Production bridge identity attribution was incomplete or incorrect");
  if (receipt.deltas?.stock_items !== 1 || receipt.deltas.asset_events !== 1) fail("the Production bridge did not confirm exactly one stock item and one event");

  redirect(`/asset-management/stock/${encodeURIComponent(stockItemId)}?productionReceipt=success&replayed=${receipt.replayed ? "1" : "0"}&idempotencyKey=${encodeURIComponent(idempotencyKey)}`);
}
