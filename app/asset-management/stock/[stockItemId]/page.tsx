import {
  createElement as h,
  type ReactNode,
} from "react";
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
  from_client_id: string | null;
  from_client_name: string | null;
  from_location_id: string | null;
  from_location_name: string | null;
  to_installation_id: string | null;
  to_client_id: string | null;
  to_client_name: string | null;
  to_location_id: string | null;
  to_location_name: string | null;
  from_warehouse: string | null;
  to_warehouse: string | null;
  reason: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
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

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-NZ");
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-NZ");
}

function detailField(
  label: string,
  content: ReactNode
) {
  const displayedContent =
    content === null ||
    content === undefined ||
    content === ""
      ? "Not recorded"
      : content;

  return h(
    "div",
    {
      className:
        "rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5",
    },
    h(
      "p",
      {
        className:
          "text-[10px] font-semibold uppercase tracking-wide text-slate-500",
      },
      label
    ),
    h(
      "div",
      {
        className:
          "mt-0.5 break-words text-sm font-medium leading-5 text-slate-900",
      },
      displayedContent
    )
  );
}

function navigationButton(
  href: string,
  text: string,
  primary = false
) {
  return h(
    "a",
    {
      href,
      className: primary
        ? "rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
        : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50",
    },
    text
  );
}

function clientLink(
  clientId: string | null,
  clientName: string | null
) {
  if (!clientId || !clientName) {
    return h(
      "span",
      {
        className: "text-slate-500",
      },
      "Not recorded"
    );
  }

  return h(
    "a",
    {
      href: `/asset-management/client/${encodeURIComponent(
        clientId
      )}`,
      className:
        "font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950",
    },
    clientName
  );
}

function locationLink(
  locationId: string | null,
  locationName: string | null
) {
  if (!locationId || !locationName) {
    return h(
      "span",
      {
        className: "text-slate-500",
      },
      "Not recorded"
    );
  }

  return h(
    "a",
    {
      href: `/asset-management/location/${encodeURIComponent(
        locationId
      )}`,
      className:
        "font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-950",
    },
    locationName
  );
}

function installationLink(
  installationId: string | null
) {
  if (!installationId) {
    return h(
      "span",
      {
        className: "text-slate-500",
      },
      "Not recorded"
    );
  }

  return h(
    "a",
    {
      href: `/asset-management/installation/${encodeURIComponent(
        installationId
      )}`,
      className:
        "font-semibold text-violet-700 underline decoration-violet-300 underline-offset-4 hover:text-violet-950",
    },
    installationId
  );
}

function sectionHeader(
  title: string,
  count: number
) {
  return h(
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
      title
    ),
    h(
      "span",
      {
        className:
          "rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-800",
      },
      count.toLocaleString()
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
          "min-h-screen bg-slate-100 px-4 py-5",
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
            className:
              "text-xl font-bold text-red-800",
          },
          "Hardware Database access denied"
        ),
        h(
          "p",
          {
            className:
              "mt-2 text-sm text-slate-700",
          },
          "The signed-in email is not in the approved Hardware Database staff list."
        ),
        h(
          "div",
          {
            className: "mt-4",
          },
          navigationButton(
            "/asset-management",
            "Return to Asset Management",
            true
          )
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
        "asset_event_id, event_date, event_type, stock_item_id, product_serial, product_id, product_description, previous_lifecycle_status, new_lifecycle_status, previous_asset_classification, new_asset_classification, from_installation_id, from_client_id, from_client_name, from_location_id, from_location_name, to_installation_id, to_client_id, to_client_name, to_location_id, to_location_name, from_warehouse, to_warehouse, reason, notes, created_by_name, created_at, source"
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
          "min-h-screen bg-slate-100 px-4 py-5",
      },
      h(
        "section",
        {
          className:
            "mx-auto max-w-4xl rounded-lg border border-amber-200 bg-white p-5 shadow-sm",
        },
        h(
          "h1",
          {
            className:
              "text-xl font-bold text-slate-900",
          },
          "Stock item not found"
        ),
        h(
          "p",
          {
            className:
              "mt-2 text-sm text-slate-700",
          },
          positionError ??
            `No stock item was found with ID ${stockItemId}.`
        ),
        h(
          "div",
          {
            className:
              "mt-4 flex flex-wrap gap-2",
          },
          navigationButton(
            "/asset-management/search",
            "Return to Search"
          ),
          navigationButton(
            "/asset-management",
            "Asset Management Home",
            true
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
          className: "px-4 py-3",
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
            h(
              "h3",
              {
                className:
                  "text-base font-bold text-slate-900",
              },
              position.current_position
            ),
            h(
              "p",
              {
                className:
                  "mt-0.5 text-xs text-slate-500",
              },
              position.installation_id
                ? h(
                    "span",
                    null,
                    "Installation ",
                    installationLink(
                      position.installation_id
                    )
                  )
                : "Not currently assigned to an installation"
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900",
            },
            position.lifecycle_status
          )
        ),
        h(
          "div",
          {
            className:
              "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
          },
          detailField(
            "Client",
            clientLink(
              position.client_id,
              position.client_name
            )
          ),
          detailField(
            "Location",
            locationLink(
              position.location_id,
              position.location_name
            )
          ),
          detailField(
            "Warehouse",
            displayValue(position.warehouse)
          ),
          detailField(
            "Installed at",
            formatDate(position.installed_at)
          ),
          detailField(
            "Asset role",
            displayValue(position.asset_role)
          ),
          detailField(
            "Arrangement",
            displayValue(
              position.asset_arrangement
            )
          ),
          detailField(
            "Installation ID",
            installationLink(
              position.installation_id
            )
          ),
          detailField(
            "Assignment ID",
            displayValue(
              position.installation_asset_id
            )
          )
        )
      )
  );

  const historyCards = history.map((event) =>
    h(
      "article",
      {
        key: event.asset_event_id,
        className: "px-4 py-3",
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
          h(
            "h3",
            {
              className:
                "text-base font-bold text-slate-900",
            },
            event.event_type
          ),
          h(
            "p",
            {
              className:
                "mt-0.5 text-xs text-slate-500",
            },
            formatDateTime(event.event_date)
          )
        ),
        h(
          "span",
          {
            className:
              "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800",
          },
          event.source
        )
      ),
      h(
        "div",
        {
          className:
            "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
        },
        detailField(
          "Previous lifecycle",
          displayValue(
            event.previous_lifecycle_status
          )
        ),
        detailField(
          "New lifecycle",
          displayValue(event.new_lifecycle_status)
        ),
        detailField(
          "From warehouse",
          displayValue(event.from_warehouse)
        ),
        detailField(
          "To warehouse",
          displayValue(event.to_warehouse)
        ),
        detailField(
          "From installation",
          installationLink(
            event.from_installation_id
          )
        ),
        detailField(
          "To installation",
          installationLink(
            event.to_installation_id
          )
        ),
        detailField(
          "From client",
          clientLink(
            event.from_client_id,
            event.from_client_name
          )
        ),
        detailField(
          "From location",
          locationLink(
            event.from_location_id,
            event.from_location_name
          )
        ),
        detailField(
          "To client",
          clientLink(
            event.to_client_id,
            event.to_client_name
          )
        ),
        detailField(
          "To location",
          locationLink(
            event.to_location_id,
            event.to_location_name
          )
        )
      ),
      event.reason ||
        event.notes ||
        event.created_by_name
        ? h(
            "div",
            {
              className:
                "mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700",
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
                className: "mt-0.5",
              },
              `Notes: ${displayValue(
                event.notes
              )}`
            ),
            h(
              "p",
              {
                className: "mt-0.5",
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
        "min-h-screen bg-slate-100 px-3 py-5 sm:px-5",
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
            "p",
            {
              className:
                "text-xs font-semibold uppercase tracking-wide text-amber-700",
            },
            "Stock Item Detail"
          ),
          h(
            "h1",
            {
              className:
                "mt-0.5 text-2xl font-bold text-slate-900",
            },
            current.stock_item_id
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-base text-slate-700",
            },
            current.product_description
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-xs text-slate-500",
            },
            `Signed in as ${user.email ?? ""}`
          )
        ),
        h(
          "div",
          {
            className: "flex flex-wrap gap-2",
          },
          navigationButton(
            `/asset-management/search?q=${encodeURIComponent(
              current.stock_item_id
            )}`,
            "Return to Search"
          ),
          navigationButton(
            "/asset-management",
            "Asset Management Home",
            true
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
          "div",
          {
            className:
              "flex flex-wrap items-start justify-between gap-3",
          },
          h(
            "div",
            null,
            h(
              "h2",
              {
                className:
                  "text-lg font-bold text-slate-900",
              },
              "Current stock record"
            ),
            h(
              "p",
              {
                className:
                  "mt-0.5 text-sm text-slate-600",
              },
              current.current_position
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900",
            },
            current.lifecycle_status
          )
        ),

        h(
          "div",
          {
            className:
              "mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6",
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
            displayValue(current.product_code)
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
            "Lifecycle",
            current.lifecycle_status
          ),
          detailField(
            "Classification",
            current.asset_classification
          ),
          detailField(
            "Record status",
            current.status
          ),
          detailField(
            "Warehouse",
            displayValue(current.warehouse)
          ),
          detailField(
            "Client",
            clientLink(
              current.client_id,
              current.client_name
            )
          ),
          detailField(
            "Location",
            locationLink(
              current.location_id,
              current.location_name
            )
          ),
          detailField(
            "Installation",
            installationLink(
              current.installation_id
            )
          )
        ),

        current.notes
          ? h(
              "div",
              {
                className:
                  "mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2",
              },
              h(
                "p",
                {
                  className:
                    "text-[10px] font-semibold uppercase tracking-wide text-slate-500",
                },
                "Notes"
              ),
              h(
                "p",
                {
                  className:
                    "mt-0.5 whitespace-pre-wrap text-sm text-slate-800",
                },
                current.notes
              )
            )
          : null
      ),

      h(
        "section",
        {
          className:
            "mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        },
        sectionHeader(
          "Current Position and Assignments",
          positions.length
        ),
        h(
          "div",
          {
            className:
              "divide-y divide-slate-200",
          },
          ...positionCards
        )
      ),

      h(
        "section",
        {
          className:
            "mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        },
        sectionHeader(
          "Asset Event History",
          history.length
        ),
        historyError
          ? h(
              "p",
              {
                className:
                  "p-4 text-sm text-red-700",
              },
              `History could not be loaded: ${historyError}`
            )
          : history.length === 0
            ? h(
                "div",
                {
                  className: "p-4",
                },
                h(
                  "p",
                  {
                    className:
                      "text-sm font-medium text-slate-800",
                  },
                  "No post-go-live asset events have been recorded."
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-1 text-xs text-slate-600",
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
            "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900",
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
            className: "mt-0.5",
          },
          "This screen retrieves current position and event-history information only. It does not create, edit or change the stock item."
        )
      )
    )
  );
}