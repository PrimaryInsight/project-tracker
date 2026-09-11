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
  client_id?: string | null;
  client_name?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  current_position?: string | null;
};

const page = "min-h-screen bg-slate-100 text-slate-900";
const wrap = "mx-auto max-w-5xl px-3 py-5 sm:px-5 sm:py-8";
const card = "mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const label = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50";
const primary = "inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900";

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

function query(params: Params, changes: Record<string, string | null> = {}) {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    for (const value of values) if (value !== "") next.append(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    next.delete(key);
    if (value) next.set(key, value);
  }
  return next.toString();
}

function hidden(params: Params, omit: string[] = []) {
  const inputs: ReactNode[] = [];
  for (const [key, raw] of Object.entries(params)) {
    if (omit.includes(key)) continue;
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    values.forEach((value, index) => inputs.push(
      h("input", { key: `${key}-${index}`, type: "hidden", name: key, value })
    ));
  }
  return inputs;
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

function score(asset: Asset, search: string) {
  const values = [
    asset.stock_item_id,
    asset.product_serial,
    asset.serial_number,
    asset.product_code,
    asset.product_id,
    asset.product_description,
    asset.product_category,
    asset.warehouse,
  ].map(value => String(value ?? "").trim().toLowerCase());
  if (values[0] === search) return 0;
  if (values[1] === search || values[2] === search) return 1;
  if (values[3] === search || values[4] === search) return 2;
  if (values[0].startsWith(search)) return 3;
  if (values[1].startsWith(search) || values[2].startsWith(search)) return 4;
  if (available(asset)) return 5;
  return 6;
}

function errorPage(title: string, message: string) {
  return h("main", { className: page }, h("div", { className: wrap },
    h("section", { className: card },
      h("h1", { className: "text-2xl font-bold" }, title),
      h("p", { className: "mt-3 text-red-700" }, message),
      h("a", { href: "/asset-management/field-installation/details", className: `${button} mt-5` }, "Back to Installation Details")
    )
  ));
}

export default async function AssetSelectionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tracker = await createProjectTrackerClient();
  const { data: { user } } = await tracker.auth.getUser();
  if (!user) redirect("/login");

  const clientId = one(params.clientId).trim();
  const locationMode = one(params.locationMode).trim();
  const locationId = one(params.locationId).trim();
  const searchText = one(params.q).trim();
  const search = searchText.toLowerCase();
  const review = one(params.reviewAssets) === "yes";
  const detailId = one(params.detail).trim();
  const selected = Array.from(new Set(one(params.selected).split(",").map(value => value.trim()).filter(Boolean)));

  const hardware = createHardwareClient();
  const [clientResult, locationResult, assetResult] = await Promise.all([
    clientId ? hardware.from("clients").select("*").eq("client_id", clientId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    locationMode === "existing" && locationId
      ? hardware.from("locations").select("*").eq("location_id", locationId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    hardware.from("stock_items").select("*").order("stock_item_id", { ascending: true })
  ]);

  if (clientResult.error) return errorPage("Client read failed", clientResult.error.message);
  if (locationResult.error) return errorPage("Location read failed", locationResult.error.message);
  if (assetResult.error) return errorPage("Stock read failed", assetResult.error.message);

  const client = clientResult.data as Row | null;
  const location = locationResult.data as Row | null;
  const assets = (assetResult.data ?? []) as Asset[];
  const chosen = selected.map(id => assets.find(asset => asset.stock_item_id === id)).filter((asset): asset is Asset => Boolean(asset));

  const matches = search
    ? assets
        .filter(asset => [
          asset.stock_item_id, asset.product_id, asset.product_code,
          asset.product_description, asset.product_category,
          asset.product_serial, asset.serial_number, asset.warehouse
        ].some(value => String(value ?? "").toLowerCase().includes(search)))
        .sort((a, b) => score(a, search) - score(b, search) || a.stock_item_id.localeCompare(b.stock_item_id))
        .slice(0, 20)
    : [];

  const locationName = locationMode === "existing"
    ? text(location?.location_name, locationId || "Not selected")
    : text(one(params.newLocationName), "Proposed location not named");
  const locationType = locationMode === "existing" ? text(location?.location_type) : text(one(params.newLocationType));
  const region = locationMode === "existing" ? text(location?.region) : text(one(params.newRegion));
  const detailsHref = `/asset-management/field-installation/details?${query(params, { q: null, selected: null, detail: null, reviewAssets: null })}`;
  const confirmationHref = `/asset-management/field-installation/confirmation?${query(params, { q: null, detail: null, reviewAssets: null })}`;

  return h("main", { className: page }, h("div", { className: wrap },
    h("nav", { className: "flex flex-wrap gap-2 text-sm" },
      h("a", { href: "/asset-management", className: "font-semibold text-slate-700 hover:underline" }, "Asset Management"),
      h("span", null, "/"),
      h("a", { href: "/asset-management/field-installation", className: "font-semibold text-slate-700 hover:underline" }, "Field Installation"),
      h("span", null, "/ Stage 4")
    ),

    h("header", { className: "mt-4 rounded-xl bg-slate-800 p-5 text-white" },
      h("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-300" }, "Preview only"),
      h("h1", { className: "mt-1 text-2xl font-bold sm:text-3xl" }, "Stage 4: Select Assets"),
      h("p", { className: "mt-2 text-sm text-slate-200" }, "Search, add and review proposed assets. No Hardware Database records are changed.")
    ),

    h("section", { className: `${card} border-amber-300 bg-amber-50` },
      h("p", { className: "text-sm font-semibold text-amber-900" }, "Preview protection: no inserts, updates, deletes, reservations, RPC calls or workflow-function calls.")
    ),

    h("section", { className: card },
      h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
        h("h2", { className: "text-lg font-bold" }, "Installation"),
        h("a", { href: detailsHref, className: button }, "Back to Details")
      ),
      h("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
        field("Client", text(client?.client_name, clientId || "Not selected")),
        field(locationMode === "existing" ? "Location" : "Proposed location", locationName),
        field("Date", text(one(params.installationDate))),
        field("Type", text(one(params.installationType)))
      ),
      h("details", { className: "mt-3" },
        h("summary", { className: "cursor-pointer text-sm font-semibold text-slate-700" }, "Show more installation details"),
        h("div", { className: "mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
          field("Client ID", text(clientId)),
          field("Location ID", locationMode === "existing" ? text(locationId) : "Not created"),
          field("Location type", locationType),
          field("Region", region),
          field("Status", text(one(params.installationStatus))),
          field("Crop", text(one(params.crop))),
          field("Logger ID", text(one(params.loggerId))),
          field("Logger type", text(one(params.loggerType)))
        )
      )
    ),

    h("section", { className: card, id: "asset-search" },
      h("h2", { className: "text-xl font-bold" }, "Search or scan an asset"),
      h("p", { className: "mt-1 text-sm text-slate-600" }, "Enter a Stock Item ID, serial number, product code or description."),
      h("form", { method: "get", className: "mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" },
        ...hidden(params, ["q", "detail", "reviewAssets"]),
        h("input", {
          name: "q",
          defaultValue: searchText,
          autoFocus: true,
          autoComplete: "off",
          placeholder: "Example: STK00005, C389 or FP2",
          className: "min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base"
        }),
        h("button", { type: "submit", className: primary }, "Search Stock")
      ),
      h("div", { className: "mt-3 flex flex-wrap gap-2" },
        searchText ? h("a", {
          href: `/asset-management/field-installation/assets?${query(params, { q: null, detail: null, reviewAssets: null })}#asset-search`,
          className: button
        }, "Clear Search") : null,
        h("button", {
          type: "button",
          disabled: true,
          title: "Barcode and QR scanning will be added in the separate Field Mode.",
          className: "inline-flex min-h-11 items-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500"
        }, "Scan: Field Mode")
      )
    ),

    h("section", { className: `${card} ${chosen.length ? "border-emerald-400" : ""}`, id: "selected-assets" },
      h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
        h("div", null,
          h("h2", { className: "text-xl font-bold" }, "Selected assets"),
          h("p", { className: "mt-1 text-sm text-slate-600" }, chosen.length ? `${chosen.length} asset${chosen.length === 1 ? "" : "s"} selected` : "No assets selected yet")
        ),
        chosen.length ? h("a", {
          href: `/asset-management/field-installation/assets?${query(params, { q: null, detail: null, reviewAssets: "yes" })}#review`,
          className: primary
        }, "Review Installation and Assets") : null
      ),
      chosen.length ? h("div", { className: "mt-4 grid gap-3" }, ...chosen.map(asset => {
        const remaining = selected.filter(id => id !== asset.stock_item_id);
        return h("article", { key: asset.stock_item_id, className: "rounded-lg border border-emerald-300 bg-emerald-50 p-4" },
          h("div", { className: "flex flex-col justify-between gap-3 sm:flex-row sm:items-center" },
            h("div", null,
              h("strong", { className: "text-lg" }, asset.stock_item_id),
              h("p", { className: "font-semibold" }, assetName(asset)),
              h("p", { className: "mt-1 text-sm text-slate-600" }, `Serial: ${assetSerial(asset)} | ${text(asset.warehouse)} | ${statusText(asset)}`)
            ),
            h("a", {
              href: `/asset-management/field-installation/assets?${query(params, { selected: remaining.join(","), q: null, detail: null, reviewAssets: null })}#selected-assets`,
              className: button
            }, "Remove")
          )
        );
      })) : h("p", { className: "mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600" }, "Search for an asset below, then select Add Asset.")
    ),

    h("section", { className: card, id: "results" },
      h("div", { className: "flex flex-wrap items-center justify-between gap-2" },
        h("h2", { className: "text-xl font-bold" }, "Matching results"),
        searchText ? h("span", { className: "rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold" }, `${matches.length} shown`) : null
      ),
      !searchText
        ? h("p", { className: "mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600" }, "No stock list is displayed until a search is entered.")
        : matches.length === 0
          ? h("p", { className: "mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900" }, `No stock records matched “${searchText}”.`)
          : h("div", { className: "mt-4 grid gap-3" }, ...matches.map(asset => {
              const isSelected = selected.includes(asset.stock_item_id);
              const canSelect = available(asset);
              const nextSelected = Array.from(new Set([...selected, asset.stock_item_id]));
              const showDetail = detailId === asset.stock_item_id;
              return h("article", { key: asset.stock_item_id, className: `rounded-xl border p-4 ${isSelected ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}` },
                h("div", { className: "flex flex-col justify-between gap-4 sm:flex-row" },
                  h("div", { className: "min-w-0" },
                    h("div", { className: "flex flex-wrap items-center gap-2" },
                      h("strong", { className: "text-lg" }, asset.stock_item_id),
                      h("span", { className: `rounded-full px-2 py-1 text-xs font-bold ${canSelect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}` }, canSelect ? "Available" : `Unavailable: ${statusText(asset)}`)
                    ),
                    h("p", { className: "mt-1 font-semibold" }, assetName(asset)),
                    h("p", { className: "mt-1 text-sm text-slate-600" }, `Serial: ${assetSerial(asset)} | Warehouse: ${text(asset.warehouse)} | Status: ${statusText(asset)}`)
                  ),
                  h("div", { className: "flex shrink-0 flex-wrap gap-2" },
                    h("a", {
                      href: `/asset-management/field-installation/assets?${query(params, { detail: showDetail ? null : asset.stock_item_id, reviewAssets: null })}#${encodeURIComponent(asset.stock_item_id)}`,
                      className: button
                    }, showDetail ? "Hide Details" : "More Details"),
                    isSelected
                      ? h("span", { className: "inline-flex min-h-11 items-center rounded-lg bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800" }, "Selected")
                      : canSelect
                        ? h("a", {
                            href: `/asset-management/field-installation/assets?${query(params, { selected: nextSelected.join(","), q: null, detail: null, reviewAssets: null })}#selected-assets`,
                            className: primary
                          }, "Add Asset")
                        : h("span", { className: "inline-flex min-h-11 items-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500" }, "Not Selectable")
                  )
                ),
                showDetail ? h("div", { className: "mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3", id: asset.stock_item_id },
                  h("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
                    field("Product ID", text(asset.product_id)),
                    field("Product code", text(asset.product_code)),
                    field("Category", text(asset.product_category)),
                    field("Serial", assetSerial(asset)),
                    field("Lifecycle", statusText(asset)),
                    field("Classification", text(asset.asset_classification)),
                    field("Warehouse", text(asset.warehouse)),
                    field("Current position", text(asset.current_position)),
                    field("Client", text(asset.client_name || asset.client_id)),
                    field("Location", text(asset.location_name || asset.location_id)),
                    field("Installation", text(asset.installation_id))
                  ),
                  h("a", {
                    href: `/asset-management/stock/${encodeURIComponent(asset.stock_item_id)}`,
                    target: "_blank",
                    rel: "noreferrer",
                    className: `${button} mt-3`
                  }, "Open Full Stock Record in New Tab")
                ) : null
              );
            }))
    ),

    review ? h("section", { className: `${card} border-2 border-emerald-400 bg-emerald-50`, id: "review" },
      h("h2", { className: "text-xl font-bold text-emerald-900" }, "Review installation and selected assets"),
      chosen.length === 0
        ? h("p", { className: "mt-3 text-sm text-amber-900" }, "No assets are selected.")
        : h("div", null,
            h("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
              field("Client", text(client?.client_name, clientId)),
              field("Location", locationName),
              field("Installation date", text(one(params.installationDate))),
              field("Installation type", text(one(params.installationType)))
            ),
            h("ol", { className: "mt-4 grid gap-2" }, ...chosen.map((asset, index) =>
              h("li", { key: asset.stock_item_id, className: "rounded-lg border border-emerald-300 bg-white p-3 text-sm" }, `${index + 1}. ${asset.stock_item_id} | ${assetName(asset)} | Serial ${assetSerial(asset)}`)
            )),
            h("p", { className: "mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900" }, "Nothing has been saved. Stock remains unchanged and no installation, installation asset or asset event has been created."),
            h("div", { className: "mt-4 flex flex-wrap gap-2" },
              h("a", { href: `/asset-management/field-installation/assets?${query(params, { reviewAssets: null })}#asset-search`, className: button }, "Add or Change Assets"),
              h("a", { href: confirmationHref, className: primary }, "Continue to Final Confirmation")
            )
          )
    ) : null,

    h("footer", { className: "mt-6 text-center text-xs text-slate-500" }, "Stage 4 preview | Hardware Database read access only")
  ));
}
