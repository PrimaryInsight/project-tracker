import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type StockSearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type StockResult = {
  stock_item_id: string;
  product_id: string;
  product_code: string | null;
  product_description: string;
  product_category: string;
  product_serial: string;
  lifecycle_status: string;
  asset_classification: string;
  warehouse: string | null;
  status: string;
  installation_id: string | null;
  client_id: string | null;
  client_name: string | null;
  location_id: string | null;
  location_name: string | null;
  current_position: string;
};

function displayValue(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }

  return value;
}

function stockLink(stockItemId: string) {
  return h(
    "a",
    {
      href: `/asset-management/stock/${encodeURIComponent(stockItemId)}`,
      className:
        "font-semibold text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950",
    },
    stockItemId
  );
}

export default async function StockSearchPage({
  searchParams,
}: StockSearchPageProps) {
  const projectTracker = await createProjectTrackerClient();
  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  if (!user) {
    redirect("/login?next=/asset-management/stock/search");
  }

  const allowedEmails = (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const signedInEmail = user.email?.trim().toLowerCase() ?? "";

  if (!signedInEmail || !allowedEmails.includes(signedInEmail)) {
    return h(
      "main",
      {
        className: "min-h-screen bg-slate-100 px-4 py-6",
      },
      h(
        "section",
        {
          className:
            "mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5 shadow-sm",
        },
        h(
          "h1",
          {
            className: "text-xl font-bold text-red-800",
          },
          "Hardware Database access denied"
        ),
        h(
          "p",
          {
            className: "mt-2 text-sm text-slate-700",
          },
          "The signed-in email is not in the approved Hardware Database staff list."
        ),
        h(
          "a",
          {
            href: "/asset-management/stock",
            className:
              "mt-4 inline-flex rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white",
          },
          "Return to Stock"
        )
      )
    );
  }

  const parameters = await searchParams;
  const searchText = (parameters.q ?? "").trim();
  const safeSearchText = searchText
    .replaceAll(",", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .trim();

  let stockItems: StockResult[] = [];
  let searchError = "";

  if (safeSearchText.length >= 2) {
    const hardware = createHardwareClient();
    const pattern = `%${safeSearchText}%`;

    const response = await hardware
      .from("vw_asset_current_position")
      .select(
        "stock_item_id, product_id, product_code, product_description, product_category, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name, current_position"
      )
      .or(
        `stock_item_id.ilike.${pattern},product_id.ilike.${pattern},product_code.ilike.${pattern},product_description.ilike.${pattern},product_category.ilike.${pattern},product_serial.ilike.${pattern},lifecycle_status.ilike.${pattern},asset_classification.ilike.${pattern},warehouse.ilike.${pattern},status.ilike.${pattern},current_position.ilike.${pattern}`
      )
      .order("stock_item_id")
      .limit(50);

    if (response.error) {
      searchError = response.error.message;
    } else {
      stockItems = (response.data as StockResult[] | null) ?? [];
    }
  }

  const stockCards = stockItems.map((stockItem) =>
    h(
      "article",
      {
        key:
          stockItem.installation_id === null
            ? stockItem.stock_item_id
            : `${stockItem.stock_item_id}-${stockItem.installation_id}`,
        className: "px-4 py-4",
      },
      h(
        "div",
        {
          className:
            "flex flex-wrap items-start justify-between gap-3",
        },
        h(
          "div",
          null,
          stockLink(stockItem.stock_item_id),
          h(
            "p",
            {
              className: "mt-0.5 text-sm text-slate-600",
            },
            stockItem.product_description
          )
        ),
        h(
          "span",
          {
            className:
              "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900",
          },
          stockItem.current_position
        )
      ),
      h(
        "div",
        {
          className:
            "mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4",
        },
        h("p", null, `Product code: ${displayValue(stockItem.product_code)}`),
        h("p", null, `Category: ${displayValue(stockItem.product_category)}`),
        h("p", null, `Serial: ${displayValue(stockItem.product_serial)}`),
        h("p", null, `Lifecycle: ${displayValue(stockItem.lifecycle_status)}`),
        h("p", null, `Classification: ${displayValue(stockItem.asset_classification)}`),
        h("p", null, `Warehouse: ${displayValue(stockItem.warehouse)}`),
        h("p", null, `Status: ${displayValue(stockItem.status)}`),
        h("p", null, `Current position: ${displayValue(stockItem.current_position)}`)
      )
    )
  );

  return h(
    "main",
    {
      className: "min-h-screen bg-slate-100 px-3 py-5 sm:px-5",
    },
    h(
      "div",
      {
        className: "mx-auto max-w-7xl",
      },
      h(
        "header",
        {
          className:
            "mb-5 flex flex-wrap items-start justify-between gap-3",
        },
        h(
          "div",
          null,
          h(
            "h1",
            {
              className: "text-2xl font-bold text-slate-900",
            },
            "Search Existing Stock"
          ),
          h(
            "p",
            {
              className: "mt-1 text-xs text-slate-600",
            },
            `Signed in as ${user.email ?? ""}`
          ),
          h(
            "p",
            {
              className: "mt-2 max-w-3xl text-sm text-slate-700",
            },
            "Search stock items by stock ID, product, serial number, warehouse, status or current position."
          )
        ),
        h(
          "div",
          {
            className: "flex flex-wrap gap-2",
          },
          h(
            "a",
            {
              href: "/asset-management/stock",
              className:
                "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50",
            },
            "Stock Home"
          ),
          h(
            "a",
            {
              href: "/asset-management",
              className:
                "rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800",
            },
            "Asset Management Home"
          )
        )
      ),
      h(
        "section",
        {
          className:
            "rounded-lg border border-slate-200 bg-white p-4 shadow-sm",
        },
        h(
          "form",
          {
            action: "/asset-management/stock/search",
            method: "get",
            className: "flex flex-col gap-2 sm:flex-row",
          },
          h("input", {
            type: "search",
            name: "q",
            defaultValue: searchText,
            minLength: 2,
            placeholder:
              "Stock item ID, product, serial, warehouse or current position...",
            className:
              "min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500",
          }),
          h(
            "button",
            {
              type: "submit",
              className:
                "rounded-md bg-amber-700 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-800",
            },
            "Search"
          ),
          h(
            "a",
            {
              href: "/asset-management/stock/search",
              className:
                "rounded-md border border-slate-300 bg-white px-5 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50",
            },
            "Clear"
          )
        ),
        h(
          "p",
          {
            className: "mt-2 text-xs text-slate-500",
          },
          "Enter at least two characters. Results are limited to 50 stock-position records."
        )
      ),
      searchError
        ? h(
            "section",
            {
              className:
                "mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900",
            },
            h(
              "p",
              {
                className: "font-semibold",
              },
              "The stock search could not be completed"
            ),
            h("p", { className: "mt-1" }, searchError)
          )
        : null,
      safeSearchText.length === 0
        ? h(
            "section",
            {
              className:
                "mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center",
            },
            h(
              "h2",
              {
                className: "text-lg font-semibold text-amber-900",
              },
              "Enter a stock search above"
            ),
            h(
              "p",
              {
                className: "mt-1 text-sm text-amber-800",
              },
              "Examples include a stock item ID, product code, product description, serial number or warehouse."
            )
          )
        : safeSearchText.length < 2
          ? h(
              "section",
              {
                className:
                  "mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900",
              },
              "Please enter at least two characters."
            )
          : h(
              "section",
              {
                className:
                  "mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
              },
              h(
                "div",
                {
                  className:
                    "flex items-center justify-between gap-3 bg-slate-800 px-4 py-3 text-white",
                },
                h(
                  "h2",
                  {
                    className: "text-lg font-semibold",
                  },
                  `Stock results for "${safeSearchText}"`
                ),
                h(
                  "span",
                  {
                    className:
                      "rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-800",
                  },
                  stockItems.length.toLocaleString()
                )
              ),
              stockItems.length === 0
                ? h(
                    "p",
                    {
                      className: "p-4 text-sm text-slate-600",
                    },
                    "No matching stock records found."
                  )
                : h(
                    "div",
                    {
                      className: "divide-y divide-slate-200",
                    },
                    ...stockCards
                  )
            ),
      h(
        "section",
        {
          className:
            "mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900",
        },
        h(
          "p",
          {
            className: "font-semibold",
          },
          "Read-only stock search"
        ),
        h(
          "p",
          {
            className: "mt-0.5",
          },
          "This page performs a SELECT query only. It does not create, edit, remove or change Hardware Database records."
        )
      )
    )
  );
}
