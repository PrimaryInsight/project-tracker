"use server";

import { redirect } from "next/navigation";

import { createHardwareProductionClient } from "@/lib/hardware-production-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

const APPROVED_PROJECT_TRACKER_USER_ID =
  "c28dae03-2123-4f5b-9ccb-c2b224b2814a";
const APPROVED_HARDWARE_USER_ID =
  "179f69dd-9203-4428-924d-1ee2c6d36de3";
const APPROVED_EMAIL = "office@primaryinsight.co.nz";
const APPROVED_PRODUCT_ID = "PRD0027";
const APPROVED_SERIAL = "125899";
const APPROVED_WAREHOUSE = "Canterbury";
const APPROVED_DATE_RECEIVED = "2026-09-29";
const APPROVED_STOCK_BASELINE = 791;
const RECEIPT_ENABLE_VALUE = "PRD0027-125899-CANTERBURY-2026-09-29";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOCK_ID = /^STK[0-9]{5}$/;

const FORBIDDEN_BROWSER_FIELDS = [
  "externalUserId",
  "externalEmail",
  "hardwareUserId",
  "userId",
  "email",
  "createdBy",
  "created_by",
  "stockItemId",
  "stock_item_id",
  "assetEventId",
  "asset_event_id",
  "lifecycleStatus",
  "lifecycle_status",
  "assetClassification",
  "asset_classification",
  "status",
  "source",
] as const;

type Receipt = {
  ok?: boolean;
  schema_version?: number;
  idempotency_key?: string;
  replayed?: boolean;
  received_by?: { user_id?: string };
  stock_item?: {
    stock_item_id?: string;
    product_id?: string;
    product_serial?: string;
    date_received?: string | null;
    lifecycle_status?: string;
    asset_classification?: string;
    warehouse?: string;
    status?: string;
  };
  event?: {
    event_type?: string;
    source?: string;
    created_by?: string;
  };
  deltas?: {
    stock_items?: number;
    asset_events?: number;
  };
  identity_bridge?: {
    identity_source?: string;
    external_user_id?: string;
  };
};

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function fail(message: string): never {
  throw new Error(`Production stock receipt blocked: ${message}`);
}

export async function confirmControlledProductionStockReceipt(
  formData: FormData,
) {
  if (
    process.env.HARDWARE_PRODUCTION_RECEIPT_ENABLED !==
    RECEIPT_ENABLE_VALUE
  ) {
    fail("the controlled Production receipt gate is disabled");
  }

  if (FORBIDDEN_BROWSER_FIELDS.some((name) => formData.has(name))) {
    fail("browser-supplied identity or server-controlled values are forbidden");
  }

  const idempotencyKey = value(formData, "idempotencyKey");
  const productId = value(formData, "productId").toUpperCase();
  const productSerial = value(formData, "serial");
  const warehouse = value(formData, "warehouse");
  const dateReceived = value(formData, "dateReceived");

  if (!UUID.test(idempotencyKey)) {
    fail("the idempotency key is missing or invalid");
  }

  if (
    productId !== APPROVED_PRODUCT_ID ||
    productSerial !== APPROVED_SERIAL ||
    warehouse !== APPROVED_WAREHOUSE ||
    dateReceived !== APPROVED_DATE_RECEIVED
  ) {
    fail("the submitted values do not match the approved controlled receipt");
  }

  const projectTracker = await createProjectTrackerClient();
  const {
    data: { user },
    error: userError,
  } = await projectTracker.auth.getUser();

  if (userError || !user) {
    redirect(
      "/login?next=/asset-management/stock/receive/production-controlled",
    );
  }

  const signedInEmail = user.email?.trim().toLowerCase() ?? "";
  if (
    user.id !== APPROVED_PROJECT_TRACKER_USER_ID ||
    signedInEmail !== APPROVED_EMAIL
  ) {
    fail("the signed-in Project Tracker identity is not approved");
  }

  const allowedEmails = (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedEmails.includes(signedInEmail)) {
    fail("the signed-in email is not in the approved Hardware staff list");
  }

  const hardware = createHardwareProductionClient();

  const [productResult, serialResult, stockBaselineResult,
    idempotencyBaselineResult, mappingResult] =
    await Promise.all([
      hardware
        .from("products")
        .select("product_id,product_description,status")
        .eq("product_id", APPROVED_PRODUCT_ID)
        .eq("status", "Active")
        .maybeSingle(),
      hardware
        .from("stock_items")
        .select("stock_item_id,product_id,product_serial")
        .eq("product_serial", APPROVED_SERIAL),
      hardware
        .from("stock_items")
        .select("*", { count: "exact", head: true }),
      hardware
        .from("workflow_idempotency")
        .select("*", { count: "exact", head: true })
        .eq("workflow_name", "receive_stock_item"),
      hardware
        .from("external_staff_identity_map")
        .select(
          "identity_source,external_user_id,external_email,hardware_user_id,active",
        )
        .eq("identity_source", "project_tracker")
        .eq("external_user_id", APPROVED_PROJECT_TRACKER_USER_ID)
        .eq("external_email", APPROVED_EMAIL)
        .eq("hardware_user_id", APPROVED_HARDWARE_USER_ID)
        .eq("active", true)
        .maybeSingle(),
    ]);

  if (
    productResult.error ||
    !productResult.data ||
    productResult.data.product_description !==
      "Sentek D&D RS232 Moisture 90cm"
  ) {
    fail("the approved active product could not be independently verified");
  }

  if (serialResult.error || !serialResult.data) {
    fail("serial-number usage could not be independently verified");
  }

  if (serialResult.data.length !== 0) {
    fail("serial 125899 now exists in Production; no receipt was attempted");
  }

  if (
    stockBaselineResult.error ||
    stockBaselineResult.count !== APPROVED_STOCK_BASELINE
  ) {
    fail("the Production stock baseline is no longer 791");
  }

  if (
    idempotencyBaselineResult.error ||
    idempotencyBaselineResult.count !== 0
  ) {
    fail("the Production receipt idempotency baseline is no longer zero");
  }

  if (mappingResult.error || !mappingResult.data) {
    fail("the verified Production identity mapping is missing");
  }

  const payload = {
    schema_version: 1,
    idempotency_key: idempotencyKey,
    product_id: APPROVED_PRODUCT_ID,
    product_serial: APPROVED_SERIAL,
    warehouse: APPROVED_WAREHOUSE,
    date_received: APPROVED_DATE_RECEIVED,
    main_board_serial: null,
    solar_board_serial: null,
    modem_board_serial: null,
    modem_type: null,
    imei: null,
    notes: null,
  };

  const { data, error } = await hardware.rpc(
    "receive_stock_item_bridge",
    {
      p_external_user_id: APPROVED_PROJECT_TRACKER_USER_ID,
      p_external_email: APPROVED_EMAIL,
      p_payload: payload,
    },
  );

  if (error) {
    console.error("Controlled Production stock receipt bridge failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    fail("the Hardware Production bridge rejected the receipt request");
  }

  const receipt = data as Receipt | null;
  const stockItem = receipt?.stock_item;
  const event = receipt?.event;
  const stockItemId = stockItem?.stock_item_id;

  if (!receipt?.ok || receipt.schema_version !== 1) {
    fail("the bridge returned an invalid receipt");
  }
  if (receipt.idempotency_key !== idempotencyKey) {
    fail("the bridge returned a different idempotency key");
  }
  if (!stockItemId || !STOCK_ID.test(stockItemId)) {
    fail("the bridge did not return a valid stock item ID");
  }
  if (
    stockItem.product_id !== APPROVED_PRODUCT_ID ||
    stockItem.product_serial !== APPROVED_SERIAL ||
    stockItem.warehouse !== APPROVED_WAREHOUSE ||
    stockItem.lifecycle_status !== "In Stock" ||
    stockItem.asset_classification !== "Company Owned" ||
    stockItem.status !== "Active"
  ) {
    fail("the returned stock values do not match the approved receipt");
  }
  if (
    event?.event_type !== "Received" ||
    event.source !== "Web Form" ||
    event.created_by !== APPROVED_HARDWARE_USER_ID
  ) {
    fail("the returned event attribution is incomplete or incorrect");
  }
  if (
    receipt.received_by?.user_id !== APPROVED_HARDWARE_USER_ID ||
    receipt.identity_bridge?.identity_source !== "project_tracker" ||
    receipt.identity_bridge.external_user_id !==
      APPROVED_PROJECT_TRACKER_USER_ID
  ) {
    fail("the returned identity attribution is incomplete or incorrect");
  }
  if (
    receipt.deltas?.stock_items !== 1 ||
    receipt.deltas.asset_events !== 1
  ) {
    fail("the receipt did not confirm exactly one stock item and one event");
  }

  redirect(
    "/asset-management/stock/receive/production-controlled" +
      `?success=1&stockItemId=${encodeURIComponent(stockItemId)}` +
      `&replayed=${receipt.replayed ? "1" : "0"}` +
      `&idempotencyKey=${encodeURIComponent(idempotencyKey)}`,
  );
}
