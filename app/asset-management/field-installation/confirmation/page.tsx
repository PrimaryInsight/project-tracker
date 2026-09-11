import { createElement as h, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type Value = string | string[] | undefined;
type Params = Record<string, Value>;
type PageProps = { searchParams: Promise<Params> };
type Row = Record<string, unknown>;
type Asset = Row & {
  stock_item_id: string;
  product_id?: string | null;
  product_code?: string | null;
  product_description?: string | null;
  product_category?: string | null;
  product_serial?: string | null;
  serial_number?: string | null;
  lifecycle_status?: string | null;
  current_status?: string | null;
  asset_classification?: string | null;
  warehouse?: string | null;
  status?: string | null;
  installation_id?: string | null;
};

const page = "min-h-screen bg-slate-100 text-slate-900";
const wrap = "mx-auto max-w-5xl px-3 py-5 sm:px-5 sm:py-8";
const card = "mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const label = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50";

function one(value: Value): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function text(value: unknown, fallback = "Not recorded"): string {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function field(name: string, value: ReactNode) {
  return h("div", { className: "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" },
    h("p", { className: label }, name),
    h("div", { className: "mt-1 break-words text-sm font-semibold" }, value)
  );
}

function query(params: Params) {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (["reviewAssets", "detail", "q"].includes(key)) continue;
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    for (const value of values) if (value !== "") next.append(key, value);
  }
  return next.toString();
}

function assetName(asset: Asset) {
  return text(asset.product_description || asset.product_code || asset.product_id, "Product not recorded");
}

function assetSerial(asset: Asset) {
  return text(asset.product_serial || asset.serial_number);
}

function statusText(asset: Asset) {
  return text(asset.lifecycle_status || asset.current_status || asset.status);
}

function available(asset: Asset) {
  const status = statusText(asset).toLowerCase();
  return !asset.installation_id && !status.includes("installed") && !status.includes("retired") && !status.includes("lost") && !status.includes("broken");
}

function messagePage(title: string, message: string, href: string) {
  return h("main", { className: page }, h("div", { className: wrap },
    h("section", { className: card },
      h("h1", { className: "text-2xl font-bold" }, title),
      h("p", { className: "mt-3 text-sm text-slate-700" }, message),
      h("a", { href, className: `${button} mt-5` }, "Return to Asset Selection")
    )
  ));
}

export default async function InstallationConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tracker = await createProjectTrackerClient();
  const { data: { user } } = await tracker.auth.getUser();
  if (!user) redirect("/login?next=/asset-management/field-installation/confirmation");

  const allowedEmails = (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  const signedInEmail = user.email?.trim().toLowerCase() ?? "";
  if (!signedInEmail || !allowedEmails.includes(signedInEmail)) {
    return messagePage("Hardware Database access denied", "The signed-in email is not in the approved Hardware Database staff list.", "/asset-management");
  }

  const clientId = one(params.clientId).trim();
  const locationMode = one(params.locationMode).trim();
  const locationId = one(params.locationId).trim();
  const selectedIds = Array.from(new Set(one(params.selected).split(",").map(value => value.trim()).filter(Boolean)));
  const assetSelectionUrl = `/asset-management/field-installation/assets?${query(params)}#selected-assets`;

  if (!clientId || !["existing", "new"].includes(locationMode) || selectedIds.length === 0) {
    return messagePage("Confirmation details incomplete", "Return to Asset Selection and confirm the client, location, installation details and at least one selected asset.", assetSelectionUrl);
  }

  const hardware = createHardwareClient();
  const [clientResult, locationResult, assetsResult] = await Promise.all([
    hardware.from("clients").select("*").eq("client_id", clientId).maybeSingle(),
    locationMode === "existing" && locationId
      ? hardware.from("locations").select("*").eq("location_id", locationId).eq("client_id", clientId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    hardware.from("stock_items").select("*").in("stock_item_id", selectedIds).order("stock_item_id", { ascending: true })
  ]);

  if (clientResult.error) return messagePage("Client read failed", clientResult.error.message, assetSelectionUrl);
  if (locationResult.error) return messagePage("Location read failed", locationResult.error.message, assetSelectionUrl);
  if (assetsResult.error) return messagePage("Asset read failed", assetsResult.error.message, assetSelectionUrl);

  const client = clientResult.data as Row | null;
  const location = locationResult.data as Row | null;
  const loadedAssets = (assetsResult.data ?? []) as Asset[];
  const assets = selectedIds.map(id => loadedAssets.find(asset => asset.stock_item_id === id)).filter((asset): asset is Asset => Boolean(asset));
  const missingIds = selectedIds.filter(id => !assets.some(asset => asset.stock_item_id === id));
  const unavailableAssets = assets.filter(asset => !available(asset));

  const locationName = locationMode === "existing"
    ? text(location?.location_name, locationId || "Not selected")
    : text(one(params.newLocationName), "Proposed location not named");
  const locationType = locationMode === "existing" ? text(location?.location_type) : text(one(params.newLocationType));
  const region = locationMode === "existing" ? text(location?.region) : text(one(params.newRegion));
  const coordinates = locationMode === "existing"
    ? location?.latitude !== null && location?.latitude !== undefined && location?.longitude !== null && location?.longitude !== undefined
      ? `${location.latitude}, ${location.longitude}`
      : "Not recorded"
    : one(params.newLatitude) || one(params.newLongitude)
      ? `${text(one(params.newLatitude))}, ${text(one(params.newLongitude))}`
      : "Not recorded";

  const installationStatus = one(params.installationStatus).trim();
  const installationDate = one(params.installationDate).trim();
  const installationType = one(params.installationType).trim();
  const validationErrors: string[] = [];
  if (!client) validationErrors.push("The selected client could not be found.");
  if (locationMode === "existing" && !location) validationErrors.push("The selected existing location could not be found.");
  if (locationMode === "new" && !one(params.newLocationName).trim()) validationErrors.push("The proposed location name is missing.");
  if (!installationDate) validationErrors.push("The installation date is missing.");
  if (!installationStatus) validationErrors.push("The installation status is missing.");
  if (missingIds.length) validationErrors.push(`Selected stock records could not be loaded: ${missingIds.join(", ")}.`);
  if (unavailableAssets.length) validationErrors.push(`Selected assets are no longer available: ${unavailableAssets.map(asset => assetSerial(asset)).join(", ")}.`);
  const readyForFutureConfirmation = validationErrors.length === 0;

  return h("main", { className: page }, h("div", { className: wrap },
    h("nav", { className: "flex flex-wrap gap-2 text-sm" },
      h("a", { href: "/asset-management", className: "font-semibold text-slate-700 hover:underline" }, "Asset Management"),
      h("span", null, "/"),
      h("a", { href: "/asset-management/field-installation", className: "font-semibold text-slate-700 hover:underline" }, "Field Installation"),
      h("span", null, "/ Stage 5")
    ),

    h("header", { className: "mt-4 rounded-xl bg-slate-800 p-5 text-white" },
      h("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-300" }, "Preview only"),
      h("h1", { className: "mt-1 text-2xl font-bold sm:text-3xl" }, "Stage 5: Final Confirmation"),
      h("p", { className: "mt-2 text-sm text-slate-200" }, "Review the proposed installation and database actions. Final production confirmation is not enabled.")
    ),

    h("section", { className: `${card} border-amber-300 bg-amber-50` },
      h("p", { className: "font-bold text-amber-900" }, "Preview protection"),
      h("p", { className: "mt-1 text-sm text-amber-900" }, "No location, installation, installation asset, stock status or asset event record will be created or changed on this page.")
    ),

    validationErrors.length ? h("section", { className: `${card} border-red-300 bg-red-50` },
      h("h2", { className: "text-lg font-bold text-red-900" }, "Confirmation blocked"),
      h("ul", { className: "mt-3 list-disc space-y-1 pl-5 text-sm text-red-900" }, ...validationErrors.map(error => h("li", { key: error }, error)))
    ) : h("section", { className: `${card} border-emerald-300 bg-emerald-50` },
      h("p", { className: "font-bold text-emerald-900" }, "Preview validation passed"),
      h("p", { className: "mt-1 text-sm text-emerald-900" }, "The current client, location, installation details and selected assets are ready for workflow testing. Nothing has been saved.")
    ),

    h("section", { className: card },
      h("h2", { className: "text-xl font-bold" }, "Client and location"),
      h("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
        field("Client", text(client?.client_name, clientId)),
        field("Client ID", clientId),
        field(locationMode === "existing" ? "Existing location" : "Proposed location", locationName),
        field("Location ID", locationMode === "existing" ? text(locationId) : "Not created"),
        field("Location type", locationType),
        field("Region", region),
        field("Coordinates", coordinates),
        field("Location source", locationMode === "existing" ? "Existing location" : "Proposed new location")
      ),
      locationMode === "new" ? h("p", { className: "mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" }, "The proposed location would need to be created as part of the future controlled workflow.") : null
    ),

    h("section", { className: card },
      h("h2", { className: "text-xl font-bold" }, "Installation details"),
      h("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
        field("Status", text(installationStatus)),
        field("Installation date", text(installationDate)),
        field("Installation type", text(installationType)),
        field("Crop", text(one(params.crop))),
        field("Logger ID", text(one(params.loggerId))),
        field("Logger type", text(one(params.loggerType))),
        field("FTP ID", text(one(params.ftpId))),
        field("SIM card", text(one(params.simCard))),
        field("Other sensors", text(one(params.otherSensors)))
      ),
      one(params.installationNotes).trim() ? h("div", { className: "mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" },
        h("p", { className: label }, "Installation notes"),
        h("p", { className: "mt-1 whitespace-pre-wrap text-sm" }, one(params.installationNotes))
      ) : null
    ),

    h("section", { className: card },
      h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
        h("h2", { className: "text-xl font-bold" }, "Selected assets"),
        h("span", { className: "rounded-full bg-slate-100 px-3 py-1 text-sm font-bold" }, `${assets.length} selected`)
      ),
      h("div", { className: "mt-4 grid gap-3" }, ...assets.map((asset, index) => {
        const canUse = available(asset);
        return h("article", { key: asset.stock_item_id, className: `rounded-xl border p-4 ${canUse ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}` },
          h("div", { className: "flex flex-col justify-between gap-3 sm:flex-row" },
            h("div", null,
              h("p", { className: label }, `Asset ${index + 1}`),
              h("h3", { className: "mt-1 text-xl font-bold" }, `Serial ${assetSerial(asset)}`),
              h("p", { className: "mt-1 font-semibold" }, assetName(asset)),
              h("p", { className: "mt-1 text-xs text-slate-600" }, `Stock reference: ${asset.stock_item_id}`)
            ),
            h("span", { className: `h-fit rounded-full px-3 py-1 text-xs font-bold ${canUse ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}` }, canUse ? "Available" : `Unavailable: ${statusText(asset)}`)
          ),
          h("div", { className: "mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
            field("Product ID", text(asset.product_id)),
            field("Category", text(asset.product_category)),
            field("Warehouse", text(asset.warehouse)),
            field("Classification", text(asset.asset_classification)),
            field("Current status", statusText(asset)),
            field("Current installation", text(asset.installation_id))
          )
        );
      }))
    ),

    h("section", { className: card },
      h("h2", { className: "text-xl font-bold" }, "Proposed future database actions"),
      h("p", { className: "mt-1 text-sm text-slate-600" }, "When production confirmation is enabled later, one controlled server-side workflow should perform these actions together:"),
      h("ol", { className: "mt-4 list-decimal space-y-2 pl-5 text-sm" },
        locationMode === "new" ? h("li", null, "Create the reviewed proposed location and assign its new Location ID.") : null,
        h("li", null, "Create the installation for the selected client and location."),
        h("li", null, "Recheck every selected asset immediately before writing."),
        h("li", null, "Create the installation-asset assignments."),
        h("li", null, "Update the selected stock items to their installed state and current assignment."),
        h("li", null, "Create asset-event history for audit and future workflow tracking."),
        h("li", null, "Return a clear success receipt containing the created record references.")
      )
    ),

    h("section", { className: `${card} border-2 ${readyForFutureConfirmation ? "border-emerald-400" : "border-red-400"}` },
      h("h2", { className: "text-xl font-bold" }, "Final confirmation"),
      h("p", { className: "mt-2 text-sm text-slate-700" }, readyForFutureConfirmation ? "Preview checks passed, but production writes remain intentionally disabled." : "Resolve the validation issues before this workflow can become eligible for production confirmation."),
      h("div", { className: "mt-4 flex flex-wrap gap-2" },
        h("a", { href: assetSelectionUrl, className: button }, "Back to Asset Selection"),
        h("button", { type: "button", disabled: true, className: "inline-flex min-h-11 cursor-not-allowed items-center rounded-lg bg-slate-300 px-4 py-2 text-sm font-bold text-slate-600" }, "Confirm Installation: Not Enabled")
      )
    ),

    h("footer", { className: "mt-6 text-center text-xs text-slate-500" }, "Stage 5 final confirmation preview | Hardware Database read access only")
  ));
}
