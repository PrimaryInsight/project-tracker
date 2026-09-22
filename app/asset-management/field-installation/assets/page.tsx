import { createElement as h, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type Value = string | string[] | undefined;
type Params = Record<string, Value>;
type PageProps = { searchParams: Promise<Params> };
type Row = Record<string, unknown>;
type StockItem = Row & {
  stock_item_id: string;
  product_id: string;
  product_serial?: string | null;
  serial_number?: string | null;
  lifecycle_status?: string | null;
  current_status?: string | null;
  warehouse?: string | null;
  status?: string | null;
  installation_id?: string | null;
};
type Product = {
  product_id: string;
  product_code?: string | null;
  product_description?: string | null;
  product_category?: string | null;
  product_family?: string | null;
};
type Asset = StockItem & { product?: Product };

const page = "min-h-screen bg-slate-100 text-slate-900";
const wrap = "mx-auto max-w-5xl px-3 py-5 sm:px-5 sm:py-8";
const card = "mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const label = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50";
const primary = "inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900";
const input = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const ARRANGEMENTS = ["Customer Owned", "Lease Item"];

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
function hidden(params: Params, omit: string[] = [], forceCompleted = true) {
  const inputs: ReactNode[] = [];
  for (const [key, raw] of Object.entries(params)) {
    if (omit.includes(key) || (forceCompleted && key === "installationStatus")) continue;
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    values.forEach((value, index) => inputs.push(
      h("input", { key: `${key}-${index}`, type: "hidden", name: key, value })
    ));
  }
  if (forceCompleted) inputs.push(h("input", { key: "installationStatus", type: "hidden", name: "installationStatus", value: "Completed" }));
  return inputs;
}
function productFor(asset: Asset): Product | undefined {
  return asset.product;
}
function assetName(asset: Asset) {
  const product = productFor(asset);
  return text(product?.product_description || product?.product_code, "Product not recorded");
}
function assetSerial(asset: Asset) {
  return text(asset.product_serial || asset.serial_number);
}
function deriveRole(product?: Product): string {
  const source = [product?.product_description, product?.product_category, product?.product_family, product?.product_code]
    .map(value => String(value ?? "").toLowerCase()).join(" ");
  if (source.includes("lrr")) return "LRR";
  if (source.includes("dtu")) return "DTU";
  if (source.includes("itu")) return "ITU";
  if (source.includes("weather")) return "Weather Station";
  if (source.includes("probe") || source.includes("moisture") || source.includes("sensor")) return "Probe";
  if (source.includes("logger")) return "Logger";
  return "Other Asset";
}
function arrangement(params: Params, stockItemId: string): string {
  const current = one(params[`arr_${stockItemId}`]).trim();
  return ARRANGEMENTS.includes(current) ? current : "";
}
function statusText(asset: Asset) {
  return text(asset.lifecycle_status || asset.current_status || asset.status);
}
function available(asset: Asset) {
  return asset.lifecycle_status === "In Stock" && asset.status === "Active" &&
    ["Otago", "Canterbury"].includes(String(asset.warehouse)) && !asset.installation_id;
}
function score(asset: Asset, search: string) {
  const product = productFor(asset);
  const values = [asset.stock_item_id, asset.product_serial, asset.serial_number, product?.product_code,
    product?.product_description, product?.product_category, product?.product_family, asset.warehouse]
    .map(value => String(value ?? "").trim().toLowerCase());
  if (values[0] === search) return 0;
  if (values[1] === search || values[2] === search) return 1;
  if (values[3] === search) return 2;
  if (values[0].startsWith(search)) return 3;
  if (values[1].startsWith(search) || values[2].startsWith(search)) return 4;
  return available(asset) ? 5 : 6;
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
  const rawParams = await searchParams;
  const params: Params = { ...rawParams, installationStatus: "Completed" };
  const tracker = await createProjectTrackerClient();
  const { data: { user } } = await tracker.auth.getUser();
  if (!user) redirect("/login");

  const clientId = one(params.clientId).trim();
  const locationMode = one(params.locationMode).trim();
  const locationId = one(params.locationId).trim();
  const searchText = one(params.q).trim();
  const search = searchText.toLowerCase();
  const selected = Array.from(new Set(one(params.selected).split(",").map(value => value.trim()).filter(Boolean)));
  const hardware = createHardwareClient();

  const [clientResult, locationResult, stockResult] = await Promise.all([
    clientId ? hardware.from("clients").select("client_id,client_name,status").eq("client_id", clientId).eq("status", "Active").maybeSingle() : Promise.resolve({ data: null, error: null }),
    locationMode === "existing" && locationId
      ? hardware.from("locations").select("location_id,location_name,client_id,status,region").eq("location_id", locationId).eq("client_id", clientId).eq("status", "Active").maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    hardware.from("stock_items").select("*").order("stock_item_id", { ascending: true })
  ]);
  if (clientResult.error) return errorPage("Client read failed", clientResult.error.message);
  if (locationResult.error) return errorPage("Location read failed", locationResult.error.message);
  if (stockResult.error) return errorPage("Stock read failed", stockResult.error.message);

  const stock = (stockResult.data ?? []) as StockItem[];
  const productIds = Array.from(new Set(stock.map(item => item.product_id).filter(Boolean)));
  const productResult = productIds.length
    ? await hardware.from("products").select("product_id,product_code,product_description,product_category,product_family").in("product_id", productIds).eq("status", "Active")
    : { data: [], error: null };
  if (productResult.error) return errorPage("Product read failed", productResult.error.message);
  const productById = new Map(((productResult.data ?? []) as Product[]).map(product => [product.product_id, product]));
  const assets: Asset[] = stock.map(item => ({ ...item, product: productById.get(item.product_id) }));
  const client = clientResult.data as Row | null;
  const location = locationResult.data as Row | null;
  const chosen = selected.map(id => assets.find(asset => asset.stock_item_id === id)).filter((asset): asset is Asset => Boolean(asset));
  const matches = search ? assets.filter(asset => {
    const product = productFor(asset);
    return [asset.stock_item_id, asset.product_serial, asset.serial_number, product?.product_code,
      product?.product_description, product?.product_category, product?.product_family, asset.warehouse]
      .some(value => String(value ?? "").toLowerCase().includes(search));
  }).sort((a, b) => score(a, search) - score(b, search) || a.stock_item_id.localeCompare(b.stock_item_id)).slice(0, 20) : [];

  const locationName = locationMode === "existing" ? text(location?.location_name, "Not selected") : text(one(params.newLocationName), "Proposed location not named");
  const detailsHref = `/asset-management/field-installation/details?${query(params, { q: null })}`;
  const confirmationHref = `/asset-management/field-installation/confirmation?${query(params, { q: null })}`;
  const ready = chosen.length > 0 && chosen.every(asset => arrangement(params, asset.stock_item_id));

  return h("main", { className: page }, h("div", { className: wrap },
    h("nav", { className: "flex flex-wrap gap-2 text-sm" },
      h("a", { href: "/asset-management", className: "font-semibold text-slate-700 hover:underline" }, "Asset Management"), h("span", null, "/"),
      h("a", { href: "/asset-management/field-installation", className: "font-semibold text-slate-700 hover:underline" }, "Field Installation"), h("span", null, "/ Asset Selection")
    ),
    h("header", { className: "mt-4 rounded-xl bg-slate-800 p-5 text-white" },
      h("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-300" }, "Preview only"),
      h("h1", { className: "mt-1 text-2xl font-bold sm:text-3xl" }, "Select Assets"),
      h("p", { className: "mt-2 text-sm text-slate-200" }, "Choose an arrangement as each asset is added. Then continue directly to the final review.")
    ),
    h("section", { className: card },
      h("div", { className: "flex flex-wrap items-center justify-between gap-3" }, h("h2", { className: "text-lg font-bold" }, "Installation"), h("a", { href: detailsHref, className: button }, "Back / Edit Details")),
      h("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
        field("Client", text(client?.client_name, "Not selected")), field("Location", locationName), field("Date", text(one(params.installationDate))), field("Type", text(one(params.installationType), "New"))
    )),
    h("section", { className: `${card} ${chosen.length ? "border-emerald-400" : ""}`, id: "selected-assets" },
      h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
        h("div", null, h("h2", { className: "text-xl font-bold" }, "Selected assets"), h("p", { className: "mt-1 text-sm text-slate-600" }, chosen.length ? `${chosen.length} asset${chosen.length === 1 ? "" : "s"} selected` : "No assets selected yet")),
        ready ? h("a", { href: confirmationHref, className: primary }, "Continue to Final Review") : null
      ),
      chosen.length ? h("div", { className: "mt-4 grid gap-3" }, ...chosen.map(asset => {
        const remaining = selected.filter(id => id !== asset.stock_item_id);
        return h("article", { key: asset.stock_item_id, className: "rounded-lg border border-emerald-300 bg-emerald-50 p-4" },
          h("div", { className: "flex flex-col justify-between gap-3 sm:flex-row sm:items-start" },
            h("div", null, h("p", { className: "font-semibold" }, assetName(asset)), h("p", { className: "mt-1 text-sm text-slate-700" }, `Serial: ${assetSerial(asset)}`), h("p", { className: "mt-1 text-sm text-slate-600" }, `Role: ${deriveRole(productFor(asset))} | Arrangement: ${arrangement(params, asset.stock_item_id)}`)),
            h("a", { href: `/asset-management/field-installation/assets?${query(params, { selected: remaining.join(","), [`arr_${asset.stock_item_id}`]: null, q: null })}#selected-assets`, className: button }, "Remove")
          ));
      })) : h("p", { className: "mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600" }, "Search for an asset, select its arrangement, then add it."),
      chosen.length && !ready ? h("p", { className: "mt-3 text-sm font-semibold text-amber-800" }, "Every selected asset must retain a valid arrangement.") : null
    ),
    h("section", { className: card, id: "asset-search" },
      h("h2", { className: "text-xl font-bold" }, "Search or scan an asset"),
      h("p", { className: "mt-1 text-sm text-slate-600" }, "Enter a serial number, product code or product description."),
      h("form", { method: "get", className: "mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" }, ...hidden(params, ["q"]),
        h("input", { name: "q", defaultValue: searchText, autoFocus: true, autoComplete: "off", placeholder: "Example: 112617, 18730, PRD0035 or PRD0041", className: "min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base" }),
        h("button", { type: "submit", className: primary }, "Search Stock")
      ),
      searchText ? h("a", { href: `/asset-management/field-installation/assets?${query(params, { q: null })}#asset-search`, className: `${button} mt-3` }, "Clear Search") : null
    ),
    h("section", { className: card, id: "results" },
      h("h2", { className: "text-xl font-bold" }, "Matching results"),
      !searchText ? h("p", { className: "mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600" }, "No stock list is displayed until a search is entered.")
      : matches.length === 0 ? h("p", { className: "mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900" }, `No stock records matched “${searchText}”.`)
      : h("div", { className: "mt-4 grid gap-3" }, ...matches.map(asset => {
        const isSelected = selected.includes(asset.stock_item_id);
        const canSelect = available(asset) && Boolean(productFor(asset));
        const nextSelected = Array.from(new Set([...selected, asset.stock_item_id]));
        return h("article", { key: asset.stock_item_id, className: `rounded-xl border p-4 ${isSelected ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}` },
          h("div", { className: "flex flex-col justify-between gap-4 sm:flex-row" },
            h("div", { className: "min-w-0" }, h("p", { className: "font-semibold" }, assetName(asset)), h("p", { className: "mt-1 text-sm text-slate-700" }, `Serial: ${assetSerial(asset)}`), h("p", { className: "mt-1 text-sm text-slate-600" }, `Role: ${deriveRole(productFor(asset))} | ${canSelect ? "Available" : `Unavailable: ${statusText(asset)}`}`)),
            isSelected ? h("span", { className: "inline-flex min-h-11 items-center rounded-lg bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800" }, "Selected")
            : canSelect ? h("form", { method: "get", className: "grid min-w-48 gap-2" }, ...hidden(params, ["q", "selected", `arr_${asset.stock_item_id}`]),
                h("input", { type: "hidden", name: "selected", value: nextSelected.join(",") }),
                h("label", { className: "text-sm font-semibold" }, "Arrangement", h("select", { name: `arr_${asset.stock_item_id}`, required: true, defaultValue: "", className: `${input} mt-1` }, h("option", { value: "", disabled: true }, "Select arrangement"), ...ARRANGEMENTS.map(value => h("option", { key: value, value }, value)))),
                h("button", { type: "submit", className: primary }, "Add Asset"))
            : h("span", { className: "inline-flex min-h-11 items-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500" }, "Not Selectable")
          ));
      }))
    ),
    h("footer", { className: "mt-6 text-center text-xs text-slate-500" }, "Preview | Hardware Database read access only until final confirmation")
  ));
}
