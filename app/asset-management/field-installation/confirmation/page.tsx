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
type Asset = { stock_item_id: string; product_id: string; product_serial?: string | null; lifecycle_status?: string | null; status?: string | null; warehouse?: string | null };
type Product = { product_id: string; product_code?: string | null; product_description?: string | null; product_category?: string | null; product_family?: string | null };
const page = "min-h-screen bg-slate-100 text-slate-900", wrap = "mx-auto max-w-5xl px-3 py-5 sm:px-5 sm:py-8", card = "mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const ARRANGEMENTS = ["Customer Owned", "Lease Item"];
function one(value: Value) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function text(value: unknown, fallback = "Not recorded") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function hidden(name: string, value: string) { return h("input", { type: "hidden", name, value }); }
function field(label: string, value: ReactNode) { return h("div", { className: "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" }, h("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500" }, label), h("div", { className: "mt-1 text-sm font-semibold" }, value)); }
function query(params: Params) { const next = new URLSearchParams(); for (const [key, raw] of Object.entries(params)) { if (key === "q") continue; for (const value of (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw])) if (value !== "") next.append(key, value); } next.set("installationStatus", "Completed"); return next.toString(); }
function deriveRole(product: Product): string { const source = [product.product_description, product.product_category, product.product_family, product.product_code].map(value => String(value ?? "").toLowerCase()).join(" "); if (source.includes("lrr")) return "LRR"; if (source.includes("dtu")) return "DTU"; if (source.includes("itu")) return "ITU"; if (source.includes("weather")) return "Weather Station"; if (source.includes("probe") || source.includes("moisture") || source.includes("sensor")) return "Probe"; if (source.includes("logger")) return "Logger"; return "Other Asset"; }
function block(message: string, href: string) { return h("main", { className: page }, h("div", { className: wrap }, h("section", { className: `${card} border-red-300 bg-red-50` }, h("h1", { className: "text-xl font-bold text-red-900" }, "Confirmation blocked"), h("p", { className: "mt-2 text-sm text-red-900" }, message), h("a", { href, className: "mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white" }, "Back / Edit")))); }

export default async function InstallationConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tracker = await createProjectTrackerClient();
  const { data: { user } } = await tracker.auth.getUser();
  if (!user) redirect("/login?next=/asset-management/field-installation/confirmation");
  const clientId = one(params.clientId).trim(), locationMode = one(params.locationMode).trim(), locationId = one(params.locationId).trim(), installationDate = one(params.installationDate).trim();
  const selectedIds = Array.from(new Set(one(params.selected).split(",").map(value => value.trim()).filter(Boolean)));
  const backHref = `/asset-management/field-installation/assets?${query(params)}#selected-assets`;
  if (locationMode !== "existing") return block("New-location workflows remain disabled for this preview test.", backHref);
  if (selectedIds.length < 1 || selectedIds.length > 25) return block("Select between 1 and 25 eligible assets.", backHref);
  const arrangements = new Map(selectedIds.map(id => [id, one(params[`arr_${id}`]).trim()]));
  if (selectedIds.some(id => !ARRANGEMENTS.includes(arrangements.get(id) ?? ""))) return block("Every selected asset must have an arrangement.", backHref);
  const hardware = createHardwareClient();
  const [clientResult, locationResult, stockResult, assignmentResult] = await Promise.all([
    hardware.from("clients").select("client_id,client_name,status").eq("client_id", clientId).eq("status", "Active").maybeSingle(),
    hardware.from("locations").select("location_id,location_name,client_id,status").eq("location_id", locationId).eq("client_id", clientId).eq("status", "Active").maybeSingle(),
    hardware.from("stock_items").select("stock_item_id,product_id,product_serial,lifecycle_status,status,warehouse").in("stock_item_id", selectedIds),
    hardware.from("installation_assets").select("stock_item_id").in("stock_item_id", selectedIds)
  ]);
  if (clientResult.error || !clientResult.data) return block("The active client could not be verified.", backHref);
  if (locationResult.error || !locationResult.data) return block("The active location could not be verified.", backHref);
  if (stockResult.error || !stockResult.data || stockResult.data.length !== selectedIds.length) return block("The selected stock items could not be verified.", backHref);
  if (assignmentResult.error || !assignmentResult.data || assignmentResult.data.length) return block("One or more selected assets already has an assignment.", backHref);
  const byId = new Map((stockResult.data as Asset[]).map(asset => [asset.stock_item_id, asset]));
  const assets = selectedIds.map(id => byId.get(id)).filter((asset): asset is Asset => Boolean(asset));
  const bad = assets.find(asset => asset.lifecycle_status !== "In Stock" || asset.status !== "Active" || !["Otago", "Canterbury"].includes(String(asset.warehouse)));
  if (bad) return block("A selected asset is no longer eligible.", backHref);
  const productIds = Array.from(new Set(assets.map(asset => asset.product_id)));
  const productResult = await hardware.from("products").select("product_id,product_code,product_description,product_category,product_family").in("product_id", productIds).eq("status", "Active");
  if (productResult.error || !productResult.data) return block("The active product definitions could not be verified.", backHref);
  const products = new Map((productResult.data as Product[]).map(product => [product.product_id, product]));
  if (assets.some(asset => !products.has(asset.product_id))) return block("A selected asset has no active product definition.", backHref);
  const key = randomUUID();
  const installationNotes = one(params.installationNotes).trim();
  return h("main", { className: page }, h("div", { className: wrap },
    h("header", { className: "rounded-xl bg-slate-800 p-5 text-white" }, h("p", { className: "text-xs font-bold uppercase tracking-wider text-amber-300" }, "Preview write test"), h("h1", { className: "mt-1 text-2xl font-bold" }, "Final Review"), h("p", { className: "mt-2 text-sm text-slate-200" }, "Review only. Use Back / Edit to make changes, or Confirm once everything is correct.")),
    h("section", { className: card },
      h("h2", { className: "text-xl font-bold" }, "Installation"),
      h("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" }, field("Client", clientResult.data.client_name), field("Location", locationResult.data.location_name), field("Date", installationDate), field("Status", "Completed"), field("Type", text(one(params.installationType), "New")), field("Crop", text(one(params.crop))), field("Logger ID", text(one(params.loggerId))), field("Logger type", text(one(params.loggerType))), field("FTP ID", text(one(params.ftpId)))),
      installationNotes ? h("div", { className: "mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" }, h("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500" }, "Installation notes"), h("p", { className: "mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-900" }, installationNotes)) : null
    ),
    h("form", { action: confirmPreviewExistingLocationInstallation, className: `${card} border-2 border-emerald-400` },
      hidden("idempotencyKey", key), hidden("clientId", clientId), hidden("locationMode", locationMode), hidden("locationId", locationId), hidden("installationStatus", "Completed"), hidden("installationDate", installationDate), hidden("installationType", one(params.installationType)), hidden("crop", one(params.crop)), hidden("ftpId", one(params.ftpId)), hidden("loggerId", one(params.loggerId)), hidden("loggerType", one(params.loggerType)), hidden("simCard", one(params.simCard)), hidden("otherSensors", one(params.otherSensors)), hidden("installationNotes", one(params.installationNotes)), hidden("assetCount", String(assets.length)),
      h("h2", { className: "text-xl font-bold" }, "Selected assets"),
      ...assets.map((asset, index) => { const product = products.get(asset.product_id)!; return h("article", { key: asset.stock_item_id, className: "mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4" }, hidden(`stockItemId_${index}`, asset.stock_item_id), hidden(`assetArrangement_${index}`, arrangements.get(asset.stock_item_id)!), h("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" }, field("Product", text(product.product_description, product.product_code ?? "Product not recorded")), field("Serial", text(asset.product_serial)), field("Role", deriveRole(product)), field("Arrangement", arrangements.get(asset.stock_item_id)!))); }),
      h("div", { className: "mt-5 flex flex-wrap gap-2" }, h("a", { href: backHref, className: "inline-flex min-h-12 items-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800" }, "Back / Edit"), h("button", { type: "submit", className: "inline-flex min-h-12 items-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white" }, `Confirm Installation with ${assets.length} Asset${assets.length === 1 ? "" : "s"}`))
    )
  ));
}
