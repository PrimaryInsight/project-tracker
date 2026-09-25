import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type Value = string | string[] | undefined;
type PageProps = { searchParams: Promise<Record<string, Value>> };

type StockItem = {
  stock_item_id: string;
  product_id: string;
  product_serial: string | null;
  lifecycle_status: string | null;
  warehouse: string | null;
  status: string | null;
};

type Product = {
  product_id: string;
  product_description: string | null;
  manufacturer: string | null;
  product_category: string | null;
  status: string;
};

type Match = StockItem & { product: Product | null };

const page = "min-h-screen bg-slate-100 text-slate-900";
const wrap = "mx-auto max-w-5xl px-3 py-5 sm:px-5 sm:py-8";
const card = "mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50";
const primary = "inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800";
const WAREHOUSES = ["Canterbury", "Otago"] as const;

function one(value: Value) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function text(value: string | null | undefined, fallback = "Not recorded") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function productName(product: Product | null) {
  return text(product?.product_description, "Product description not recorded");
}

function normaliseSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function productMatchesSearch(product: Product, search: string) {
  const description = normaliseSearch(product.product_description ?? "");
  const terms = search.trim().split(/\s+/).map(normaliseSearch).filter(Boolean);
  return terms.length > 0 && terms.every((term) => description.includes(term));
}

function isSelectableProduct(product: Product) {
  const description = (product.product_description ?? "").toLowerCase();
  const manufacturer = (product.manufacturer ?? "").toLowerCase();
  const category = (product.product_category ?? "").toLowerCase();
  return product.product_id !== "PRD9001"
    && manufacturer !== "synthetic"
    && category !== "test equipment"
    && !description.includes("preview test")
    && !description.includes("synthetic test");
}

function receiveUrl(values: Record<string, string | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/asset-management/stock/receive?${query}` : "/asset-management/stock/receive";
}

export default async function ReceiveStockPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const serial = one(params.serial).trim();
  const checked = one(params.checked) === "1";
  const productSearch = one(params.productSearch).trim();
  const selectedProductId = one(params.productId).trim();
  const requestedWarehouse = one(params.warehouse).trim();
  const selectedWarehouse = WAREHOUSES.includes(
    requestedWarehouse as (typeof WAREHOUSES)[number]
  )
    ? requestedWarehouse
    : "";
  const reviewRequested = one(params.review) === "1";

  const tracker = await createProjectTrackerClient();
  const { data: { user } } = await tracker.auth.getUser();
  if (!user) redirect("/login?next=/asset-management/stock/receive");

  const allowedEmails = (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const signedInEmail = user.email?.trim().toLowerCase() ?? "";

  if (!signedInEmail || !allowedEmails.includes(signedInEmail)) {
    return h("main", { className: page }, h("div", { className: wrap },
      h("section", { className: "rounded-xl border border-red-200 bg-white p-5 shadow-sm" },
        h("h1", { className: "text-2xl font-bold text-red-800" }, "Hardware Database access denied"),
        h("p", { className: "mt-3 text-sm text-slate-700" }, "The signed-in email is not in the approved Hardware Database staff list."),
        h("a", { href: "/asset-management/stock", className: `${button} mt-5` }, "Return to Stock")
      )
    ));
  }

  const hardware = createHardwareClient();
  let matches: Match[] = [];
  let serialError = "";
  let products: Product[] = [];
  let productError = "";
  let selectedProduct: Product | null = null;

  if (checked && serial) {
    const stockResult = await hardware
      .from("stock_items")
      .select("stock_item_id,product_id,product_serial,lifecycle_status,warehouse,status")
      .eq("product_serial", serial)
      .limit(20);

    if (stockResult.error) {
      serialError = stockResult.error.message;
    } else {
      const stock = (stockResult.data as StockItem[] | null) ?? [];
      const productIds = Array.from(new Set(stock.map((item) => item.product_id).filter(Boolean)));
      let productById = new Map<string, Product>();

      if (productIds.length > 0) {
        const productResult = await hardware
          .from("products")
          .select("product_id,product_description,manufacturer,product_category,status")
          .in("product_id", productIds);

        if (productResult.error) {
          serialError = productResult.error.message;
        } else {
          productById = new Map(
            (((productResult.data as Product[] | null) ?? []).map((product) => [product.product_id, product]))
          );
        }
      }

      if (!serialError) {
        matches = stock.map((item) => ({
          ...item,
          product: productById.get(item.product_id) ?? null,
        }));
      }
    }
  }

  const serialChecked = checked && Boolean(serial) && !serialError;

  if (serialChecked && productSearch.length >= 2) {
    const result = await hardware
      .from("products")
      .select("product_id,product_description,manufacturer,product_category,status")
      .eq("status", "Active")
      .order("product_description", { ascending: true, nullsFirst: false })
      .limit(100);
    if (result.error) {
      productError = result.error.message;
    } else {
      products = ((result.data as Product[] | null) ?? [])
        .filter(isSelectableProduct)
        .filter((product) => productMatchesSearch(product, productSearch))
        .slice(0, 30);
    }
  }

  if (serialChecked && selectedProductId) {
    const result = await hardware
      .from("products")
      .select("product_id,product_description,manufacturer,product_category,status")
      .eq("product_id", selectedProductId)
      .eq("status", "Active")
      .maybeSingle();

    if (result.error) {
      productError = result.error.message;
    } else {
      const candidate = (result.data as Product | null) ?? null;
      selectedProduct = candidate && isSelectableProduct(candidate) ? candidate : null;
    }
  }

  const exactMatches = selectedProduct
    ? matches.filter((item) => item.product_id === selectedProduct.product_id)
    : [];
  const differentMatches = selectedProduct
    ? matches.filter((item) => item.product_id !== selectedProduct.product_id)
    : matches;
  const exactDuplicate = exactMatches.length > 0;
  const finalReview = reviewRequested
    && serialChecked
    && Boolean(selectedProduct)
    && Boolean(selectedWarehouse)
    && !exactDuplicate;

  if (finalReview && selectedProduct) {
    return h("main", { className: page }, h("div", { className: wrap },
      h("nav", { className: "flex flex-wrap gap-2 text-sm" },
        h("a", { href: "/asset-management", className: "font-semibold text-slate-700 hover:underline" }, "Asset Management"),
        h("span", null, "/"),
        h("a", { href: "/asset-management/stock", className: "font-semibold text-slate-700 hover:underline" }, "Stock"),
        h("span", null, "/ Receive New Stock / Final Review")
      ),
      h("header", { className: "mt-4 rounded-xl bg-slate-800 p-5 text-white" },
        h("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-300" }, "Read-only prototype"),
        h("h1", { className: "mt-1 text-2xl font-bold sm:text-3xl" }, "Final Review"),
        h("p", { className: "mt-2 text-sm text-slate-200" }, "Check the physical item, serial number and receiving warehouse before confirmation.")
      ),
      h("section", { className: card },
        h("p", { className: "text-xs font-bold uppercase tracking-wide text-blue-700" }, "Receive New Stock"),
        h("h2", { className: "mt-1 text-xl font-bold" }, "Review item details"),
        h("dl", { className: "mt-5 grid gap-4 sm:grid-cols-2" },
          h("div", { className: "rounded-lg bg-slate-50 p-4" },
            h("dt", { className: "text-xs font-bold uppercase tracking-wide text-slate-500" }, "Serial number"),
            h("dd", { className: "mt-1 text-lg font-bold text-slate-900" }, serial)
          ),
          h("div", { className: "rounded-lg bg-slate-50 p-4" },
            h("dt", { className: "text-xs font-bold uppercase tracking-wide text-slate-500" }, "Physical item"),
            h("dd", { className: "mt-1 text-lg font-bold text-slate-900" }, productName(selectedProduct))
          ),
          h("div", { className: "rounded-lg bg-slate-50 p-4" },
            h("dt", { className: "text-xs font-bold uppercase tracking-wide text-slate-500" }, "Receiving warehouse"),
            h("dd", { className: "mt-1 text-lg font-bold text-slate-900" }, selectedWarehouse)
          ),
          h("div", { className: "rounded-lg bg-slate-50 p-4" },
            h("dt", { className: "text-xs font-bold uppercase tracking-wide text-slate-500" }, "New stock status"),
            h("dd", { className: "mt-1 text-lg font-bold text-slate-900" }, "In Stock / Active")
          )
        ),
        differentMatches.length > 0 ? h("div", { className: "mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950" },
          h("p", { className: "font-bold" }, "Serial number warning"),
          h("p", { className: "mt-1 text-sm" }, "This serial number is already used by a different controlled product type. The selected physical item is different, so receipt may continue after the item is checked.")
        ) : null,
        h("div", { className: "mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between" },
          h("a", {
            href: `${receiveUrl({ serial, checked: "1", productSearch: productSearch || null, productId: selectedProduct.product_id, warehouse: selectedWarehouse })}#selected-product`,
            className: button
          }, "Back / Edit"),
          h("span", {
            className: "inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg bg-slate-300 px-4 py-2 text-sm font-bold text-slate-600",
            "aria-disabled": "true"
          }, "Confirm Receipt - Next step")
        )
      ),
      h("footer", { className: "mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900" },
        h("p", { className: "font-semibold" }, "Read-only Final Review"),
        h("p", { className: "mt-0.5" }, "No stock item, receipt or stock event has been created. Confirm Receipt remains disabled until the controlled write stage is implemented and tested.")
      )
    ));
  }

  return h("main", { className: page }, h("div", { className: wrap },
    h("nav", { className: "flex flex-wrap gap-2 text-sm" },
      h("a", { href: "/asset-management", className: "font-semibold text-slate-700 hover:underline" }, "Asset Management"),
      h("span", null, "/"),
      h("a", { href: "/asset-management/stock", className: "font-semibold text-slate-700 hover:underline" }, "Stock"),
      h("span", null, "/ Receive New Stock")
    ),

    h("header", { className: "mt-4 rounded-xl bg-slate-800 p-5 text-white" },
      h("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-300" }, "Read-only prototype"),
      h("h1", { className: "mt-1 text-2xl font-bold sm:text-3xl" }, "Receive New Stock"),
      h("p", { className: "mt-2 text-sm text-slate-200" }, "Enter the physical item's serial, then select its controlled product type from the Xero-aligned catalogue.")
    ),

    h("section", { className: card },
      h("div", { className: "flex flex-wrap items-start justify-between gap-3" },
        h("div", null,
          h("p", { className: "text-xs font-bold uppercase tracking-wide text-blue-700" }, "Step 1"),
          h("h2", { className: "mt-1 text-xl font-bold" }, "Enter or scan serial number"),
          h("p", { className: "mt-1 text-sm text-slate-600" }, "The system checks for matching serials before the controlled product type is selected.")
        ),
        h("a", { href: "/asset-management/stock", className: button }, "Back to Stock")
      ),
      h("form", { method: "get", className: "mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" },
        h("input", { type: "hidden", name: "checked", value: "1" }),
        h("input", { name: "serial", type: "search", defaultValue: serial, required: true, autoFocus: !checked, autoComplete: "off", placeholder: "Scan or enter serial number...", className: "min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base" }),
        h("button", { type: "submit", className: primary }, "Check Serial Number")
      ),
      checked ? h("a", { href: "/asset-management/stock/receive", className: `${button} mt-3` }, "Check Another Serial") : null
    ),

    serialError ? h("section", { className: "mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" },
      h("p", { className: "font-semibold" }, "The serial check could not be completed"),
      h("p", { className: "mt-1" }, "Please try again. No stock information has been changed."),
      h("details", { className: "mt-3" },
        h("summary", { className: "cursor-pointer font-semibold" }, "Technical details"),
        h("p", { className: "mt-2 break-words" }, serialError)
      )
    ) : null,

    serialChecked && matches.length > 0 ? h("section", { className: "mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5" },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-amber-800" }, "Serial match found"),
      h("h2", { className: "mt-1 text-xl font-bold text-amber-950" }, `Serial ${serial} is already used by ${matches.length} existing item${matches.length === 1 ? "" : "s"}.`),
      h("p", { className: "mt-2 text-sm text-amber-900" }, "This is only a warning. Select the product type below. Receipt is blocked only when the same product type and serial combination already exists."),
      h("div", { className: "mt-4 grid gap-3" }, ...matches.map((item) =>
        h("article", { key: item.stock_item_id, className: "rounded-lg border border-amber-200 bg-white p-4" },
          h("h3", { className: "font-bold" }, productName(item.product)),
          h("p", { className: "mt-1 text-sm text-slate-700" }, `Serial: ${serial} | Category: ${text(item.product?.product_category)} | Warehouse: ${text(item.warehouse)}`),
          h("a", { href: `/asset-management/stock/${encodeURIComponent(item.stock_item_id)}`, className: `${button} mt-3` }, "View Existing Stock Item")
        )
      ))
    ) : null,

    serialChecked && matches.length === 0 ? h("section", { className: "mt-4 rounded-xl border border-emerald-400 bg-emerald-50 p-4 shadow-sm sm:p-5" },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-emerald-700" }, "No matches"),
      h("h2", { className: "mt-1 text-xl font-bold text-emerald-950" }, serial),
      h("p", { className: "mt-2 text-sm text-emerald-900" }, "No existing stock item uses this serial. Continue below to select the product type.")
    ) : null,

    serialChecked ? h("section", { className: card },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-blue-700" }, "Step 2"),
      h("h2", { className: "mt-1 text-xl font-bold" }, "Select controlled product type"),
      h("p", { className: "mt-1 text-sm text-slate-600" }, "Search by the physical description on the item. Try LRR, 30, SDI, moisture, Bluetooth or Harvest."),
      h("form", { method: "get", className: "mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" },
        h("input", { type: "hidden", name: "serial", value: serial }),
        h("input", { type: "hidden", name: "checked", value: "1" }),
        h("input", { name: "productSearch", type: "search", defaultValue: productSearch, minLength: 2, autoComplete: "off", placeholder: "Example: LRR, 30, SDI 60 or Harvest...", className: "min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base" }),
        h("button", { type: "submit", className: primary }, "Search Products")
      ),
      productSearch ? h("a", { href: receiveUrl({ serial, checked: "1" }), className: `${button} mt-3` }, "Clear Product Search") : null
    ) : null,

    productError ? h("section", { className: "mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" },
      h("p", { className: "font-semibold" }, "The product search could not be completed"),
      h("p", { className: "mt-1" }, "Please try again. No stock information has been changed."),
      h("details", { className: "mt-3" },
        h("summary", { className: "cursor-pointer font-semibold" }, "Technical details"),
        h("p", { className: "mt-2 break-words" }, productError)
      )
    ) : null,

    selectedProduct ? h("section", { id: "selected-product", className: exactDuplicate ? "mt-4 rounded-xl border border-red-400 bg-red-50 p-4 shadow-sm sm:p-5" : "mt-4 rounded-xl border border-emerald-400 bg-emerald-50 p-4 shadow-sm sm:p-5" },
      h("p", { className: exactDuplicate ? "text-xs font-bold uppercase tracking-wide text-red-700" : "text-xs font-bold uppercase tracking-wide text-emerald-700" }, exactDuplicate ? "Duplicate product and serial" : "Selected controlled product type"),
      h("h2", { className: "mt-1 text-xl font-bold" }, productName(selectedProduct)),
      h("p", { className: "mt-2 text-sm text-slate-700" }, `Serial: ${serial}`),
      exactDuplicate ? h("div", { className: "mt-4 rounded-lg border border-red-300 bg-white p-4" },
        h("p", { className: "font-bold text-red-950" }, "This product type and serial-number combination is already recorded."),
        h("p", { className: "mt-1 text-sm text-red-900" }, "The item cannot be received as new stock."),
        h("div", { className: "mt-3 flex flex-wrap gap-2" }, ...exactMatches.map((item) =>
          h("a", { key: item.stock_item_id, href: `/asset-management/stock/${encodeURIComponent(item.stock_item_id)}`, className: button }, "View Existing Stock Item")
        ))
      ) : h("div", { className: "mt-4 rounded-lg border border-emerald-300 bg-white p-4" },
        h("p", { className: "font-semibold text-emerald-950" }, differentMatches.length > 0 ? "Different product type confirmed" : "Product and serial combination is available"),
        h("p", { className: "mt-1 text-sm text-slate-700" }, differentMatches.length > 0 ? "The serial is used by another product type, but the selected product type is different. Receipt may continue and this warning will remain visible at Final Review." : "No existing item has this product type and serial-number combination.")
      ),
      h("a", { href: receiveUrl({ serial, checked: "1", productSearch: productSearch || null }), className: `${button} mt-4` }, "Change Product"),
      !exactDuplicate ? h("section", { className: "mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4" },
        h("p", { className: "text-xs font-bold uppercase tracking-wide text-blue-700" }, "Step 3"),
        h("h3", { className: "mt-1 text-xl font-bold text-slate-900" }, "Select receiving warehouse"),
        h("p", { className: "mt-1 text-sm text-slate-700" }, "Choose where the physical item will be held and available as stock."),
        h("form", { method: "get", className: "mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" },
          h("input", { type: "hidden", name: "serial", value: serial }),
          h("input", { type: "hidden", name: "checked", value: "1" }),
          h("input", { type: "hidden", name: "productSearch", value: productSearch }),
          h("input", { type: "hidden", name: "productId", value: selectedProduct.product_id }),
          h("select", { name: "warehouse", required: true, defaultValue: selectedWarehouse, className: "min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base" },
            h("option", { value: "", disabled: true }, "Select warehouse"),
            ...WAREHOUSES.map((warehouse) => h("option", { key: warehouse, value: warehouse }, warehouse))
          ),
          h("button", { type: "submit", className: primary }, "Confirm Warehouse")
        ),
        selectedWarehouse ? h("div", { className: "mt-4 rounded-lg border border-emerald-300 bg-white p-4" },
          h("p", { className: "font-semibold text-emerald-950" }, "Warehouse details ready"),
          h("div", { className: "mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2" },
            h("p", null, `Warehouse: ${selectedWarehouse}`),
            h("p", null, "Lifecycle status: In Stock"),
            h("p", null, "Operational status: Active"),
            h("p", null, "Current position: Selected warehouse")
          ),
          differentMatches.length > 0 ? h("p", { className: "mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900" }, "Warning retained: this serial is already used by a different controlled product type.") : null,
          h("p", { className: "mt-3 text-sm text-slate-600" }, "Continue to the single read-only Final Review. No stock item has been created."),
          h("a", {
            href: receiveUrl({
              serial,
              checked: "1",
              productSearch: productSearch || null,
              productId: selectedProduct.product_id,
              warehouse: selectedWarehouse,
              review: "1",
            }),
            className: `${primary} mt-3`
          }, "Continue to Final Review")
        ) : null
      ) : null
    ) : null,

    serialChecked ? h("section", { className: card },
      h("h2", { className: "text-xl font-bold" }, "Matching physical items"),
      !productSearch ? h("p", { className: "mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600" }, "Enter part of the physical item description above to continue.")
      : productSearch.length < 2 ? h("p", { className: "mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900" }, "Please enter at least two characters.")
      : products.length === 0 && !productError ? h("div", { className: "mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950" },
          h("p", { className: "font-semibold" }, `No active product types matched “${productSearch}”.`),
          h("p", { className: "mt-1 text-sm" }, "Try another physical detail such as LRR, 30, SDI, moisture, Bluetooth or Harvest.")
        )
      : h("div", { className: "mt-4 grid gap-3" }, ...products.map((product) => {
          const selected = product.product_id === selectedProductId;
          return h("article", { key: product.product_id, className: `rounded-xl border p-4 ${selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}` },
            h("div", { className: "flex flex-col justify-between gap-4 sm:flex-row sm:items-start" },
              h("div", null,
                h("h3", { className: "font-semibold" }, productName(product))
              ),
              selected ? h("span", { className: "inline-flex min-h-11 items-center rounded-lg bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800" }, "Selected")
              : h("a", { href: `${receiveUrl({ serial, checked: "1", productSearch, productId: product.product_id })}#selected-product`, className: primary }, "Select Product")
            )
          );
        }))
    ) : null,

    h("footer", { className: "mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900" },
      h("p", { className: "font-semibold" }, "Read-only prototype"),
      h("p", { className: "mt-0.5" }, "This page performs SELECT queries only. It does not create product types, stock items, receipts or stock events.")
    )
  ));
}
