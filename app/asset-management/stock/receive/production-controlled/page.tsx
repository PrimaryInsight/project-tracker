import { randomUUID } from "node:crypto";
import { createElement as h } from "react";
import { redirect } from "next/navigation";

import { createHardwareProductionClient } from "@/lib/hardware-production-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { confirmControlledProductionStockReceipt } from "./actions";

export const dynamic = "force-dynamic";

type Value = string | string[] | undefined;
type PageProps = { searchParams: Promise<Record<string, Value>> };

const PROJECT_TRACKER_USER_ID =
  "c28dae03-2123-4f5b-9ccb-c2b224b2814a";
const HARDWARE_USER_ID =
  "179f69dd-9203-4428-924d-1ee2c6d36de3";
const OFFICE_EMAIL = "office@primaryinsight.co.nz";
const PRODUCT_ID = "PRD0027";
const PRODUCT_DESCRIPTION = "Sentek D&D RS232 Moisture 90cm";
const SERIAL = "125899";
const WAREHOUSE = "Canterbury";
const DATE_RECEIVED = "2026-09-29";
const EXPECTED_STOCK_COUNT = 791;
const RECEIPT_ENABLE_VALUE = "PRD0027-125899-CANTERBURY-2026-09-29";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function one(value: Value): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ControlledProductionReceiptPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const success = one(params.success) === "1";
  const stockItemId = one(params.stockItemId);
  const requestedKey = one(params.idempotencyKey);
  const idempotencyKey = UUID.test(requestedKey) ? requestedKey : "";

  const projectTracker = await createProjectTrackerClient();
  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/asset-management/stock/receive/production-controlled",
    );
  }

  const signedInEmail = user.email?.trim().toLowerCase() ?? "";
  const allowedEmails = (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (
    user.id !== PROJECT_TRACKER_USER_ID ||
    signedInEmail !== OFFICE_EMAIL ||
    !allowedEmails.includes(signedInEmail)
  ) {
    return h(
      "main",
      { className: "min-h-screen bg-slate-100 px-6 py-10" },
      h(
        "section",
        { className: "mx-auto max-w-3xl rounded-xl border border-red-300 bg-white p-8" },
        h("h1", { className: "text-2xl font-bold text-red-800" }, "Production receipt access denied"),
      ),
    );
  }

  if (!success && !idempotencyKey) {
    redirect(
      "/asset-management/stock/receive/production-controlled" +
        `?idempotencyKey=${encodeURIComponent(randomUUID())}`,
    );
  }

  const hardware = createHardwareProductionClient();
  const [productResult, serialResult, stockCountResult,
    idempotencyResult, mappingResult] =
    await Promise.all([
      hardware
        .from("products")
        .select("product_id,product_description,status")
        .eq("product_id", PRODUCT_ID)
        .eq("status", "Active")
        .maybeSingle(),
      hardware
        .from("stock_items")
        .select("stock_item_id,product_id,product_serial")
        .eq("product_serial", SERIAL),
      hardware
        .from("stock_items")
        .select("*", { count: "exact", head: true }),
      hardware
        .from("workflow_idempotency")
        .select("*", { count: "exact", head: true })
        .eq("workflow_name", "receive_stock_item"),
      hardware
        .from("external_staff_identity_map")
        .select("hardware_user_id,active")
        .eq("identity_source", "project_tracker")
        .eq("external_user_id", PROJECT_TRACKER_USER_ID)
        .eq("external_email", OFFICE_EMAIL)
        .eq("hardware_user_id", HARDWARE_USER_ID)
        .eq("active", true)
        .maybeSingle(),
    ]);

  const productReady =
    !productResult.error &&
    productResult.data?.product_description === PRODUCT_DESCRIPTION;
  const serialAvailable =
    !serialResult.error &&
    Array.isArray(serialResult.data) &&
    serialResult.data.length === 0;
  const stockBaselineReady =
    !stockCountResult.error &&
    stockCountResult.count === EXPECTED_STOCK_COUNT;
  const workflowBaselineReady =
    !idempotencyResult.error &&
    idempotencyResult.count === 0;
  const mappingReady = !mappingResult.error && mappingResult.data !== null;
  const gateEnabled =
    process.env.HARDWARE_PRODUCTION_RECEIPT_ENABLED ===
    RECEIPT_ENABLE_VALUE;
  const allChecksPassed =
    productReady &&
    serialAvailable &&
    stockBaselineReady &&
    workflowBaselineReady &&
    mappingReady;
  const canSubmit = allChecksPassed && gateEnabled && !success;

  if (success) {
    return h(
      "main",
      { className: "min-h-screen bg-slate-100 px-4 py-8" },
      h(
        "section",
        { className: "mx-auto max-w-3xl rounded-xl border border-emerald-300 bg-white p-8 shadow-sm" },
        h("p", { className: "font-bold uppercase tracking-wide text-emerald-700" }, "Production receipt returned successfully"),
        h("h1", { className: "mt-2 text-3xl font-bold" }, stockItemId || "Stock item created"),
        h("p", { className: "mt-4 text-slate-700" }, "Do not submit again. Verify the Production database counts independently before any further action."),
        h("p", { className: "mt-3 break-all text-sm text-slate-600" }, `Idempotency key: ${idempotencyKey}`),
      ),
    );
  }

  const checks = [
    ["Active product", PRODUCT_DESCRIPTION, productReady],
    ["Serial unused", SERIAL, serialAvailable],
    ["Stock baseline", String(EXPECTED_STOCK_COUNT), stockBaselineReady],
    ["Receipt workflow baseline", "0 idempotency rows", workflowBaselineReady],
    ["Production identity mapping", "Exact active mapping", mappingReady],
    ["Controlled enable gate", gateEnabled ? "Enabled" : "Disabled", gateEnabled],
  ] as const;

  return h(
    "main",
    { className: "min-h-screen bg-slate-100 px-4 py-8 text-slate-900" },
    h(
      "div",
      { className: "mx-auto max-w-4xl" },
      h("p", { className: "font-bold uppercase tracking-wide text-red-700" }, "Production controlled receipt"),
      h("h1", { className: "mt-2 text-3xl font-bold" }, "Final Review"),
      h("p", { className: "mt-2 text-slate-600" }, "This route is locked to one approved physical stock item."),
      h(
        "section",
        { className: "mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" },
        h("dl", { className: "grid gap-4 sm:grid-cols-2" },
          ...[
            ["Product", PRODUCT_DESCRIPTION],
            ["Product ID", PRODUCT_ID],
            ["Serial number", SERIAL],
            ["Warehouse", WAREHOUSE],
            ["Date received", "29 September 2026"],
            ["Lifecycle status", "In Stock"],
            ["Classification", "Company Owned"],
            ["Operational status", "Active"],
          ].map(([label, displayedValue]) =>
            h("div", { key: label, className: "rounded-lg bg-slate-50 p-4" },
              h("dt", { className: "text-xs font-bold uppercase tracking-wide text-slate-500" }, label),
              h("dd", { className: "mt-1 font-bold" }, displayedValue),
            ),
          ),
        ),
        h("div", { className: "mt-6 grid gap-2" },
          ...checks.map(([label, actual, passed]) =>
            h("div", { key: label, className: passed ? "rounded-lg bg-emerald-50 p-3 text-emerald-900" : "rounded-lg bg-amber-50 p-3 text-amber-950" },
              h("span", { className: "font-semibold" }, `${label}: `),
              h("span", null, `${actual} | ${passed ? "Passed" : "Stopped"}`),
            ),
          ),
        ),
        h("div", { className: "mt-5 rounded-lg border border-slate-300 bg-slate-50 p-4" },
          h("p", { className: "text-xs font-bold uppercase tracking-wide text-slate-500" }, "Idempotency key"),
          h("code", { className: "mt-2 block break-all text-sm" }, idempotencyKey),
        ),
        h("form", { action: confirmControlledProductionStockReceipt, className: "mt-6" },
          h("input", { type: "hidden", name: "productId", value: PRODUCT_ID }),
          h("input", { type: "hidden", name: "serial", value: SERIAL }),
          h("input", { type: "hidden", name: "warehouse", value: WAREHOUSE }),
          h("input", { type: "hidden", name: "dateReceived", value: DATE_RECEIVED }),
          h("input", { type: "hidden", name: "idempotencyKey", value: idempotencyKey }),
          h("button", {
            type: "submit",
            disabled: !canSubmit,
            className: canSubmit
              ? "min-h-12 w-full rounded-lg bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-800"
              : "min-h-12 w-full cursor-not-allowed rounded-lg bg-slate-300 px-5 py-3 font-bold text-slate-600",
            "aria-disabled": String(!canSubmit),
          }, canSubmit ? "Confirm One Production Receipt" : "Production Receipt Disabled"),
        ),
        h("p", { className: "mt-4 text-sm text-slate-600" }, "The button remains disabled unless every live Production check passes and the exact server-only enable value is present."),
      ),
    ),
  );
}
