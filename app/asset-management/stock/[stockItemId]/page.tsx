import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type StockDetailPageProps = {
  params: Promise<{
    stockItemId: string;
  }>;
};

type PositionRecord = {
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
  installation_asset_id: string | null;
  asset_role: string | null;
  asset_arrangement: string | null;
  installed_at: string | null;
  installation_id: string | null;
  client_id: string | null;
  client_name: string | null;
  location_id: string | null;
  location_name: string | null;
  current_position: string;
  notes: string | null;
};

type HistoryRecord = {
  asset_event_id: string;
  event_date: string;
  event_type: string;
  stock_item_id: string;
  product_serial: string | null;
  product_id: string | null;
  product_description: string | null;
  previous_lifecycle_status: string | null;
  new_lifecycle_status: string;
  previous_asset_classification: string | null;
  new_asset_classification: string;
  from_installation_id: string | null;
  from_client_name: string | null;
  from_location_name: string | null;
  to_installation_id: string | null;
  to_client_name: string | null;
  to_location_name: string | null;
  from_warehouse: string | null;
  to_warehouse: string | null;
  reason: string | null;
  notes: string | null;
  created_by_name: string | null;
  source: string;
};

function displayValue(
  value: string | number | null | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not recorded";
  }

  return String(value);
}

function detailField(
  label: string,
  value: string | number | null | undefined
) {
  return h(
    "div",
    {
      className:
        "rounded-lg border border-slate-200 bg-slate-50 p-4",
    },
    h(
      "p",
      {
        className:
          "text-xs font-semibold uppercase tracking-wide text-slate-500",
      },
      label
    ),
    h(
      "p",
      {
        className:
          "mt-1 break-words font-medium text-slate-900",
      },
      displayValue(value)
    )
  );
}

export default async function StockDetailPage({
  params,
}: StockDetailPageProps) {
  const projectTracker =
    await createProjectTrackerClient();

  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  const routeParameters = await params;

  const stockItemId = decodeURIComponent(
    routeParameters.stockItemId
  ).trim();

  if (!user) {
    redirect(
      `/login?next=/asset-management/stock/${encodeURIComponent(
        stockItemId
      )}`
    );
  }

  const allowedEmails = (
    process.env.HARDWARE_ALLOWED_EMAILS ?? ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const signedInEmail =
    user.email?.trim().toLowerCase() ?? "";

  if (
    !signedInEmail ||
    !allowedEmails.includes(signedInEmail)
  ) {
    return h(
      "main",
      {
        className:
          "min-h-screen bg-slate-100 px-4 py-8 sm:px-6",
      },
      h(
        "section",
        {
          className:
            "mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-8 shadow-sm",
        },
        h(
          "h1",
          {
            className:
              "text-2xl font-bold text-red-800",
          },
          "Hardware Database access denied"
        ),
        h(
          "p",
          {
            className: "mt-3 text-slate-700",
          },
          "The signed-in email is not in the approved Hardware Database staff list."
        )
      )
    );
  }

  const hardware = createHardwareClient();

  const [
    positionResponse,
    historyResponse,
  ] = await Promise.all([
    hardware
      .from("vw_asset_current_position")
      .select(
        "stock_item_id, product_id, product_code, product_description, product_category, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_asset_id, asset_role, asset_arrangement, installed_at, installation_id, client_id, client_name, location_id, location_name, current_position, notes"
      )
      .eq("stock_item_id", stockItemId)
      .order("installation_id"),

    hardware
      .from("vw_asset_history")
      .select(
        "asset_event_id, event_date, event_type, stock_item_id, product_serial, product_id, product_description, previous_lifecycle_status, new_lifecycle_status, previous_asset_classification, new_asset_classification, from_installation_id, from_client_name, from_location_name, to_installation_id, to_client_name, to_location_name, from_warehouse, to_warehouse, reason, notes, created_by_name, source"
      )
      .eq("stock_item_id", stockItemId)
      .order("event_date", {
        ascending: false,
      }),
  ]);

  const positionError =
    positionResponse.error?.message ?? null;

  const historyError =
    historyResponse.error?.message ?? null;

  const positions =
    (positionResponse.data as
      | PositionRecord[]
      | null) ?? [];

  const history =
    (historyResponse.data as
      | HistoryRecord[]
      | null) ?? [];

  if (positionError || positions.length === 0) {
    return h(
      "main",
      {
        className:
          "min-h-screen bg-slate-100 px-4 py-8 sm:px-6",
      },
      h(
        "div",
        {
          className: "mx-auto max-w-4xl",
        },
        h(
          "div",
          {
            className:
              "rounded-xl border border-amber-200 bg-white p-8 shadow-sm",
          },
          h(
            "h1",
            {
              className:
                "text-2xl font-bold text-slate-900",
            },
            "Stock item not found"
          ),
          h(
            "p",
            {
              className: "mt-3 text-slate-700",
            },
            positionError ??
              `No stock item was found with ID ${stockItemId}.`
          ),
          h(
            "a",
            {
              href: "/asset-management/search",
              className:
                "mt-6 inline-flex rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800",
            },
            "Return to Search"
          )
        )
      )
    );
  }

  const current = positions[0];

  const positionCards = positions.map(
    (position, index) =>
      h(
        "article",
        {
          key:
            position.installation_asset_id ??
            `${position.stock_item_id}-${index}`,
          className:
            "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        },
        h(
          "div",
          {
            className:
              "flex flex-wrap items-start justify-between gap-4",
          },
          h(
            "div",
            null,
            h(
              "h3",
              {
                className:
                  "text-lg font-bold text-slate-900",
              },
              position.current_position
            ),
            h(
              "p",
              {
                className:
                  "mt-1 text-sm text-slate-500",
              },
              position.installation_id
                ? `Installation ${position.installation_id}`
                : "Not currently assigned to an installation"
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900",
            },
            position.lifecycle_status
          )
        ),
        h(
          "div",
          {
            className:
              "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
          },
          detailField(
            "Client",
            position.client_name
          ),
          detailField(
            "Location",
            position.location_name
          ),
          detailField(
            "Warehouse",
            position.warehouse
          ),
          detailField(
            "Installed at",
            position.installed_at
          ),
          detailField(
            "Asset role",
            position.asset_role
          ),
          detailField(
            "Arrangement",
            position.asset_arrangement
          ),
          detailField(
            "Installation ID",
            position.installation_id
          ),
          detailField(
            "Installation asset ID",
            position.installation_asset_id
          )
        )
      )
  );

  const historyCards = history.map((event) =>
    h(
      "article",
      {
        key: event.asset_event_id,
        className: "p-5",
      },
      h(
        "div",
        {
          className:
            "flex flex-wrap items-start justify-between gap-4",
        },
        h(
          "div",
          null,
          h(
            "h3",
            {
              className:
                "text-lg font-bold text-slate-900",
            },
            event.event_type
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-sm text-slate-500",
            },
            new Date(
              event.event_date
            ).toLocaleString("en-NZ")
          )
        ),
        h(
          "span",
          {
            className:
              "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800",
          },
          event.source
        )
      ),
      h(
        "div",
        {
          className:
            "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
        },
        detailField(
          "Previous lifecycle",
          event.previous_lifecycle_status
        ),
        detailField(
          "New lifecycle",
          event.new_lifecycle_status
        ),
        detailField(
          "From warehouse",
          event.from_warehouse
        ),
        detailField(
          "To warehouse",
          event.to_warehouse
        ),
        detailField(
          "From installation",
          event.from_installation_id
        ),
        detailField(
          "To installation",
          event.to_installation_id
        ),
        detailField(
          "From client / location",
          [
            event.from_client_name,
            event.from_location_name,
          ]
            .filter(Boolean)
            .join(" / ") || null
        ),
        detailField(
          "To client / location",
          [
            event.to_client_name,
            event.to_location_name,
          ]
            .filter(Boolean)
            .join(" / ") || null
        )
      ),
      event.reason ||
        event.notes ||
        event.created_by_name
        ? h(
            "div",
            {
              className:
                "mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700",
            },
            h(
              "p",
              null,
              `Reason: ${displayValue(
                event.reason
              )}`
            ),
            h(
              "p",
              {
                className: "mt-1",
              },
              `Notes: ${displayValue(
                event.notes
              )}`
            ),
            h(
              "p",
              {
                className: "mt-1",
              },
              `Recorded by: ${displayValue(
                event.created_by_name
              )}`
            )
          )
        : null
    )
  );

  return h(
    "main",
    {
      className:
        "min-h-screen bg-slate-100 px-4 py-8 sm:px-6",
    },
    h(
      "div",
      {
        className: "mx-auto max-w-6xl",
      },
      h(
        "header",
        {
          className:
            "mb-8 flex flex-wrap items-start justify-between gap-4",
        },
        h(
          "div",
          null,
          h(
            "p",
            {
              className:
                "text-sm font-semibold uppercase tracking-wide text-amber-700",
            },
            "Stock Item Detail"
          ),
          h(
            "h1",
            {
              className:
                "mt-1 text-3xl font-bold text-slate-900",
            },
            current.stock_item_id
          ),
          h(
            "p",
            {
              className:
                "mt-2 text-lg text-slate-700",
            },
            current.product_description
          ),
          h(
            "p",
            {
              className:
                "mt-2 text-sm text-slate-500",
            },
            `Signed in as ${user.email ?? ""}`
          )
        ),
        h(
          "div",
          {
            className: "flex flex-wrap gap-3",
          },
          h(
            "a",
            {
              href: `/asset-management/search?q=${encodeURIComponent(
                current.stock_item_id
              )}`,
              className:
                "rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50",
            },
            "Return to Search"
          ),
          h(
            "a",
            {
              href: "/asset-management",
              className:
                "rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800",
            },
            "Asset Management Home"
          )
        )
      ),
      h(
        "section",
        {
          className:
            "rounded-xl border border-slate-200 bg-white p-6 shadow-sm",
        },
        h(
          "div",
          {
            className:
              "flex flex-wrap items-start justify-between gap-4",
          },
          h(
            "div",
            null,
            h(
              "h2",
              {
                className:
                  "text-xl font-bold text-slate-900",
              },
              "Current stock record"
            ),
            h(
              "p",
              {
                className:
                  "mt-1 text-slate-600",
              },
              current.current_position
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-amber-100 px-4 py-2 font-semibold text-amber-900",
            },
            current.lifecycle_status
          )
        ),
        h(
          "div",
          {
            className:
              "mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
          },
          detailField(
            "Stock item ID",
            current.stock_item_id
          ),
          detailField(
            "Product ID",
            current.product_id
          ),
          detailField(
            "Product code",
            current.product_code
          ),
          detailField(
            "Product category",
            current.product_category
          ),
          detailField(
            "Product serial",
            current.product_serial
          ),
          detailField(
            "Lifecycle status",
            current.lifecycle_status
          ),
          detailField(
            "Asset classification",
            current.asset_classification
          ),
          detailField(
            "Record status",
            current.status
          ),
          detailField(
            "Warehouse",
            current.warehouse
          ),
          detailField(
            "Client",
            current.client_name
          ),
          detailField(
            "Location",
            current.location_name
          ),
          detailField(
            "Installation",
            current.installation_id
          )
        ),
        current.notes
          ? h(
              "div",
              {
                className:
                  "mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4",
              },
              h(
                "p",
                {
                  className:
                    "text-xs font-semibold uppercase tracking-wide text-slate-500",
                },
                "Notes"
              ),
              h(
                "p",
                {
                  className:
                    "mt-1 whitespace-pre-wrap text-slate-800",
                },
                current.notes
              )
            )
          : null
      ),
      h(
        "section",
        {
          className: "mt-8",
        },
        h(
          "div",
          {
            className:
              "mb-4 flex items-center justify-between gap-4",
          },
          h(
            "h2",
            {
              className:
                "text-2xl font-bold text-slate-900",
            },
            "Current Position and Assignments"
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-white",
            },
            positions.length.toLocaleString()
          )
        ),
        h(
          "div",
          {
            className: "space-y-4",
          },
          ...positionCards
        )
      ),
      h(
        "section",
        {
          className:
            "mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        },
        h(
          "div",
          {
            className:
              "flex items-center justify-between gap-4 bg-slate-800 px-5 py-4 text-white",
          },
          h(
            "h2",
            {
              className:
                "text-xl font-semibold",
            },
            "Asset Event History"
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800",
            },
            history.length.toLocaleString()
          )
        ),
        historyError
          ? h(
              "p",
              {
                className:
                  "p-5 text-red-700",
              },
              `History could not be loaded: ${historyError}`
            )
          : history.length === 0
            ? h(
                "div",
                {
                  className: "p-5",
                },
                h(
                  "p",
                  {
                    className:
                      "font-medium text-slate-800",
                  },
                  "No post-go-live asset events have been recorded."
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-2 text-sm text-slate-600",
                  },
                  "Legacy asset history remains in the existing business spreadsheet."
                )
              )
            : h(
                "div",
                {
                  className:
                    "divide-y divide-slate-200",
                },
                ...historyCards
              )
      ),
      h(
        "section",
        {
          className:
            "mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900",
        },
        h(
          "p",
          {
            className: "font-semibold",
          },
          "Read-only stock detail"
        ),
        h(
          "p",
          {
            className: "mt-1",
          },
          "This screen retrieves current position and event-history information only. It does not create, edit or change the stock item."
        )
      )
    )
  );
}