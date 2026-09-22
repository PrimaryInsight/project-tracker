import { createElement as h, type ReactNode } from "react";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";
import { confirmPreviewExistingLocationInstallation } from "./actions";

export const dynamic = "force-dynamic";

type Value = string | string[] | undefined;
type Params = Record<string, Value>;
type PageProps = { searchParams: Promise<Params> };
type Asset = {
  stock_item_id: string;
  product_description?: string | null;
  product_serial?: string | null;
  lifecycle_status?: string | null;
  status?: string | null;
  warehouse?: string | null;
};

const page = "min-h-screen bg-slate-100 text-slate-900";
const wrap = "mx-auto max-w-5xl px-3 py-5 sm:px-5 sm:py-8";
const card = "mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const input = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

function one(value: Value): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function text(value: unknown, fallback = "Not recorded"): string {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function hidden(name: string, value: string) {
  return h("input", { type: "hidden", name, value });
}

function field(label: string, value: ReactNode) {
  return h(
    "div",
    { className: "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" },
    h("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500" }, label),
    h("div", { className: "mt-1 text-sm font-semibold" }, value),
  );
}

function query(params: Params): string {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (["reviewAssets", "detail", "q"].includes(key)) continue;
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    for (const value of values) {
      if (value !== "") next.append(key, value);
    }
  }
  return next.toString();
}

function block(title: string, message: string, returnHref: string) {
  return h(
    "main",
    { className: page },
    h(
      "div",
      { className: wrap },
      h(
        "section",
        { className: `${card} border-red-300 bg-red-50` },
        h("h1", { className: "text-xl font-bold text-red-900" }, title),
        h("p", { className: "mt-2 text-sm text-red-900" }, message),
        h(
          "a",
          { href: returnHref, className: "mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white" },
          "Return to Asset Selection",
        ),
      ),
    ),
  );
}

export default async function InstallationConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tracker = await createProjectTrackerClient();
  const { data: { user } } = await tracker.auth.getUser();
  if (!user) redirect("/login?next=/asset-management/field-installation/confirmation");

  const clientId = one(params.clientId).trim();
  const locationMode = one(params.locationMode).trim();
  const locationId = one(params.locationId).trim();
  const selectedIds = Array.from(
    new Set(one(params.selected).split(",").map((value) => value.trim()).filter(Boolean)),
  );
  const installationStatus = one(params.installationStatus).trim();
  const installationDate = one(params.installationDate).trim();
  const assetSelectionUrl = `/asset-management/field-installation/assets?${query(params)}#selected-assets`;

  if (locationMode !== "existing") {
    return block("Confirmation blocked", "New-location workflows remain disabled for this preview test.", assetSelectionUrl);
  }
  if (selectedIds.length !== 1) {
    return block("Confirmation blocked", "The first preview test requires exactly one selected asset.", assetSelectionUrl);
  }
  if (installationStatus !== "Completed") {
    return block("Confirmation blocked", "The first preview test requires a Completed installation.", assetSelectionUrl);
  }

  const hardware = createHardwareClient();
  const [clientResult, locationResult, assetResult, assignmentResult] = await Promise.all([
    hardware
      .from("clients")
      .select("client_id,client_name,status")
      .eq("client_id", clientId)
      .eq("status", "Active")
      .maybeSingle(),
    hardware
      .from("locations")
      .select("location_id,location_name,client_id,status,region")
      .eq("location_id", locationId)
      .eq("client_id", clientId)
      .eq("status", "Active")
      .maybeSingle(),
    hardware
      .from("stock_items")
      .select("stock_item_id,product_id,product_serial,lifecycle_status,status,warehouse")
      .eq("stock_item_id", selectedIds[0])
      .maybeSingle(),
    hardware
      .from("installation_assets")
      .select("installation_asset_id", { count: "exact", head: true })
      .eq("stock_item_id", selectedIds[0]),
  ]);

  if (clientResult.error || !clientResult.data) {
    return block("Confirmation blocked", "The active client could not be verified.", assetSelectionUrl);
  }
  if (locationResult.error || !locationResult.data) {
    return block("Confirmation blocked", "The active existing location could not be verified for the selected client.", assetSelectionUrl);
  }
  if (assetResult.error || !assetResult.data) {
    if (assetResult.error) {
      console.error("Stage 5 stock verification failed", { code: assetResult.error.code });
    }
    return block("Confirmation blocked", "The selected stock item could not be verified.", assetSelectionUrl);
  }
  if (assignmentResult.error) {
    console.error("Stage 5 assignment verification failed", { code: assignmentResult.error.code });
    return block("Confirmation blocked", "The selected stock item's assignment state could not be verified.", assetSelectionUrl);
  }

  const asset = assetResult.data as Asset;
  const eligible =
    asset.lifecycle_status === "In Stock" &&
    asset.status === "Active" &&
    ["Otago", "Canterbury"].includes(String(asset.warehouse)) &&
    assignmentResult.count === 0;

  if (!eligible) {
    return block(
      "Confirmation blocked",
      "The selected asset is not Active / In Stock in Otago or Canterbury, or already has an assignment.",
      assetSelectionUrl,
    );
  }

  const idempotencyKey = randomUUID();

  return h(
    "main",
    { className: page },
    h(
      "div",
      { className: wrap },
      h(
        "header",
        { className: "rounded-xl bg-slate-800 p-5 text-white" },
        h("p", { className: "text-xs font-bold uppercase tracking-wider text-amber-300" }, "Preview write test"),
        h("h1", { className: "mt-1 text-2xl font-bold" }, "Stage 5: Guarded Final Confirmation"),
        h("p", { className: "mt-2 text-sm text-slate-200" }, "Exactly one existing-location installation will be submitted to the preview bridge."),
      ),
      h(
        "section",
        { className: `${card} border-amber-300 bg-amber-50` },
        h("p", { className: "font-bold text-amber-900" }, "This button performs a database write in PREVIEW."),
        h("p", { className: "mt-1 text-sm text-amber-900" }, "Check the client, location, asset, date, role and arrangement carefully before submitting once."),
      ),
      h(
        "section",
        { className: card },
        h("h2", { className: "text-xl font-bold" }, "Verified records"),
        h(
          "div",
          { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" },
          field("Client", text(clientResult.data.client_name, clientId)),
          field("Location", text(locationResult.data.location_name, locationId)),
          field("Region", text(locationResult.data.region)),
          field("Stock item", asset.stock_item_id),
          field("Product", text((assetResult.data as { product_id?: string | null }).product_id)),
          field("Serial", text(asset.product_serial)),
          field("Warehouse", text(asset.warehouse)),
          field("Lifecycle", text(asset.lifecycle_status)),
          field("Installation date", installationDate),
        ),
      ),
      h(
        "form",
        { action: confirmPreviewExistingLocationInstallation, className: `${card} border-2 border-emerald-400` },
        hidden("idempotencyKey", idempotencyKey),
        hidden("clientId", clientId),
        hidden("locationMode", locationMode),
        hidden("locationId", locationId),
        hidden("stockItemId", selectedIds[0]),
        hidden("installationStatus", installationStatus),
        hidden("installationDate", installationDate),
        hidden("installationType", one(params.installationType)),
        hidden("crop", one(params.crop)),
        hidden("ftpId", one(params.ftpId)),
        hidden("loggerId", one(params.loggerId)),
        hidden("loggerType", one(params.loggerType)),
        hidden("simCard", one(params.simCard)),
        hidden("otherSensors", one(params.otherSensors)),
        hidden("installationNotes", one(params.installationNotes)),
        h("h2", { className: "text-xl font-bold" }, "Required asset details"),
        h(
          "div",
          { className: "mt-4 grid gap-4 sm:grid-cols-2" },
          h(
            "label",
            { className: "text-sm font-semibold" },
            "Asset role",
            h(
              "select",
              { name: "assetRole", required: true, defaultValue: "", className: `${input} mt-1` },
              h("option", { value: "", disabled: true }, "Select one"),
              ...["Probe", "DTU", "ITU", "LRR", "Logger", "Weather Station", "Other Asset"].map((value) =>
                h("option", { key: value, value }, value),
              ),
            ),
          ),
          h(
            "label",
            { className: "text-sm font-semibold" },
            "Asset arrangement",
            h(
              "select",
              { name: "assetArrangement", required: true, defaultValue: "", className: `${input} mt-1` },
              h("option", { value: "", disabled: true }, "Select one"),
              h("option", { value: "Customer Owned" }, "Customer Owned"),
              h("option", { value: "Lease Item" }, "Lease Item"),
            ),
          ),
          h(
            "label",
            { className: "text-sm font-semibold sm:col-span-2" },
            "Asset notes (optional)",
            h("textarea", { name: "assetNotes", rows: 3, className: `${input} mt-1` }),
          ),
        ),
        h("p", { className: "mt-4 text-xs text-slate-500" }, `Preview idempotency key: ${idempotencyKey}`),
        h(
          "div",
          { className: "mt-4 flex flex-wrap gap-2" },
          h("a", { href: assetSelectionUrl, className: "inline-flex min-h-12 items-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800" }, "Back to Asset Selection"),
          h("button", { type: "submit", className: "inline-flex min-h-12 items-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800" }, "Confirm ONE Preview Installation"),
        ),
      ),
    ),
  );
}
