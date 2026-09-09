import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type ClientResult = {
  client_id: string;
  client_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

type LocationResult = {
  location_id: string;
  client_id: string;
  location_name: string;
  location_type: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
};

type InstallationResult = {
  installation_id: string;
  client_id: string;
  location_id: string;
  installation_date: string | null;
  installation_type: string | null;
  ftp_id: string | null;
  logger_id: string | null;
  logger_type: string | null;
  status: string;
  closed_at: string | null;
};

type AssetResult = {
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

function stockLink(stockItemId: string) {
  return h(
    "a",
    {
      href: `/asset-management/stock/${encodeURIComponent(
        stockItemId
      )}`,
      className:
        "font-semibold text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950",
    },
    stockItemId
  );
}

function resultSection(
  title: string,
  count: number,
  children: ReturnType<typeof h>[]
) {
  return h(
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
    ),
    count === 0
      ? h(
          "p",
          {
            className: "p-4 text-sm text-slate-600",
          },
          "No matching records found."
        )
      : h(
          "div",
          {
            className: "divide-y divide-slate-200",
          },
          ...children
        )
  );
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const projectTracker =
    await createProjectTrackerClient();

  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/asset-management/search"
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
          "min-h-screen bg-slate-100 px-4 py-6",
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
          "a",
          {
            href: "/asset-management",
            className:
              "mt-4 inline-flex rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white",
          },
          "Return to Asset Management"
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

  let clients: ClientResult[] = [];
  let locations: LocationResult[] = [];
  let installations: InstallationResult[] = [];
  let assets: AssetResult[] = [];

  const errors: string[] = [];

  if (safeSearchText.length >= 2) {
    const hardware = createHardwareClient();
    const pattern = `%${safeSearchText}%`;

    const [
      clientResponse,
      locationResponse,
      installationResponse,
      assetResponse,
    ] = await Promise.all([
      hardware
        .from("clients")
        .select(
          "client_id, client_name, contact_name, email, phone, status"
        )
        .or(
          `client_id.ilike.${pattern},client_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
        )
        .order("client_name")
        .limit(25),

      hardware
        .from("locations")
        .select(
          "location_id, client_id, location_name, location_type, region, latitude, longitude, status"
        )
        .or(
          `location_id.ilike.${pattern},client_id.ilike.${pattern},location_name.ilike.${pattern},location_type.ilike.${pattern},region.ilike.${pattern}`
        )
        .order("location_name")
        .limit(25),

      hardware
        .from("installations")
        .select(
          "installation_id, client_id, location_id, installation_date, installation_type, ftp_id, logger_id, logger_type, status, closed_at"
        )
        .or(
          `installation_id.ilike.${pattern},client_id.ilike.${pattern},location_id.ilike.${pattern},installation_type.ilike.${pattern},ftp_id.ilike.${pattern},logger_id.ilike.${pattern},logger_type.ilike.${pattern},status.ilike.${pattern}`
        )
        .order("installation_date", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(25),

      hardware
        .from("vw_asset_current_position")
        .select(
          "stock_item_id, product_id, product_code, product_description, product_category, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name, current_position"
        )
        .or(
          `stock_item_id.ilike.${pattern},product_id.ilike.${pattern},product_code.ilike.${pattern},product_description.ilike.${pattern},product_category.ilike.${pattern},product_serial.ilike.${pattern},lifecycle_status.ilike.${pattern},asset_classification.ilike.${pattern},warehouse.ilike.${pattern},status.ilike.${pattern},installation_id.ilike.${pattern},client_id.ilike.${pattern},client_name.ilike.${pattern},location_id.ilike.${pattern},location_name.ilike.${pattern},current_position.ilike.${pattern}`
        )
        .order("stock_item_id")
        .limit(50),
    ]);

    if (clientResponse.error) {
      errors.push(
        `Client search: ${clientResponse.error.message}`
      );
    } else {
      clients =
        (clientResponse.data as
          | ClientResult[]
          | null) ?? [];
    }

    if (locationResponse.error) {
      errors.push(
        `Location search: ${locationResponse.error.message}`
      );
    } else {
      locations =
        (locationResponse.data as
          | LocationResult[]
          | null) ?? [];
    }

    if (installationResponse.error) {
      errors.push(
        `Installation search: ${installationResponse.error.message}`
      );
    } else {
      installations =
        (installationResponse.data as
          | InstallationResult[]
          | null) ?? [];
    }

    if (assetResponse.error) {
      errors.push(
        `Asset search: ${assetResponse.error.message}`
      );
    } else {
      assets =
        (assetResponse.data as
          | AssetResult[]
          | null) ?? [];
    }
  }

  const assetCards = assets.map((asset) =>
    h(
      "article",
      {
        key:
          asset.installation_id === null
            ? asset.stock_item_id
            : `${asset.stock_item_id}-${asset.installation_id}`,
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
          stockLink(asset.stock_item_id),
          h(
            "p",
            {
              className:
                "mt-0.5 text-sm text-slate-600",
            },
            asset.product_description
          )
        ),
        h(
          "span",
          {
            className:
              "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900",
          },
          asset.current_position
        )
      ),
      h(
        "div",
        {
          className:
            "mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4",
        },
        h(
          "p",
          null,
          `Product code: ${displayValue(
            asset.product_code
          )}`
        ),
        h(
          "p",
          null,
          `Serial: ${displayValue(
            asset.product_serial
          )}`
        ),
        h(
          "p",
          null,
          `Lifecycle: ${asset.lifecycle_status}`
        ),
        h(
          "p",
          null,
          `Classification: ${asset.asset_classification}`
        ),
        h(
          "p",
          null,
          `Warehouse: ${displayValue(
            asset.warehouse
          )}`
        ),
        h(
          "p",
          null,
          "Client: ",
          clientLink(
            asset.client_id,
            asset.client_name
          )
        ),
        h(
          "p",
          null,
          "Location: ",
          locationLink(
            asset.location_id,
            asset.location_name
          )
        ),
        h(
          "p",
          null,
          "Installation: ",
          installationLink(asset.installation_id)
        )
      )
    )
  );

  const clientCards = clients.map((client) =>
    h(
      "article",
      {
        key: client.client_id,
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
            null,
            clientLink(
              client.client_id,
              client.client_name
            )
          ),
          h(
            "p",
            {
              className:
                "mt-0.5 text-xs text-slate-500",
            },
            `Client ID: ${client.client_id}`
          )
        ),
        h(
          "span",
          {
            className:
              "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800",
          },
          client.status
        )
      ),
      h(
        "div",
        {
          className:
            "mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3",
        },
        h(
          "p",
          null,
          `Contact: ${displayValue(
            client.contact_name
          )}`
        ),
        h(
          "p",
          null,
          `Phone: ${displayValue(client.phone)}`
        ),
        h(
          "p",
          null,
          `Email: ${displayValue(client.email)}`
        )
      )
    )
  );

  const locationCards = locations.map(
    (location) =>
      h(
        "article",
        {
          key: location.location_id,
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
              null,
              locationLink(
                location.location_id,
                location.location_name
              )
            ),
            h(
              "p",
              {
                className:
                  "mt-0.5 text-xs text-slate-500",
              },
              `Location ID: ${location.location_id}`
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800",
            },
            location.status
          )
        ),
        h(
          "div",
          {
            className:
              "mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4",
          },
          h(
            "p",
            null,
            `Client ID: ${location.client_id}`
          ),
          h(
            "p",
            null,
            `Type: ${displayValue(
              location.location_type
            )}`
          ),
          h(
            "p",
            null,
            `Region: ${displayValue(
              location.region
            )}`
          ),
          h(
            "p",
            null,
            `Coordinates: ${displayValue(
              location.latitude
            )}, ${displayValue(
              location.longitude
            )}`
          )
        )
      )
  );

  const installationCards = installations.map(
    (installation) =>
      h(
        "article",
        {
          key: installation.installation_id,
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
            installationLink(
              installation.installation_id
            ),
            h(
              "p",
              {
                className:
                  "mt-0.5 text-xs text-slate-500",
              },
              `Client ${installation.client_id} | Location ${installation.location_id}`
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800",
            },
            installation.status
          )
        ),
        h(
          "div",
          {
            className:
              "mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4",
          },
          h(
            "p",
            null,
            `Date: ${displayValue(
              installation.installation_date
            )}`
          ),
          h(
            "p",
            null,
            `Type: ${displayValue(
              installation.installation_type
            )}`
          ),
          h(
            "p",
            null,
            `Logger: ${displayValue(
              installation.logger_id
            )}`
          ),
          h(
            "p",
            null,
            `FTP ID: ${displayValue(
              installation.ftp_id
            )}`
          )
        )
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
            "h1",
            {
              className:
                "text-2xl font-bold text-slate-900",
            },
            "Search / Find"
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-xs text-slate-600",
            },
            `Signed in as ${user.email ?? ""}`
          ),
          h(
            "p",
            {
              className:
                "mt-2 max-w-3xl text-sm text-slate-700",
            },
            "Search for clients, locations, installations, stock items, products and serial numbers."
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
              href: "/asset-management",
              className:
                "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50",
            },
            "Asset Management Home"
          ),
          h(
            "a",
            {
              href: "/",
              className:
                "rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800",
            },
            "Systems Home"
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
            action: "/asset-management/search",
            method: "get",
            className:
              "flex flex-col gap-2 sm:flex-row",
          },
          h("input", {
            type: "search",
            name: "q",
            defaultValue: searchText,
            minLength: 2,
            placeholder:
              "Client, location, asset ID, serial, product, logger or installation...",
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
              href: "/asset-management/search",
              className:
                "rounded-md border border-slate-300 bg-white px-5 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50",
            },
            "Clear"
          )
        ),
        h(
          "p",
          {
            className:
              "mt-2 text-xs text-slate-500",
          },
          "Enter at least two characters. Results are limited to 25 clients, locations and installations, and 50 asset-position records."
        )
      ),

      errors.length > 0
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
              "One or more searches could not be completed"
            ),
            h(
              "ul",
              {
                className:
                  "mt-2 list-disc space-y-1 pl-5",
              },
              ...errors.map((error) =>
                h(
                  "li",
                  {
                    key: error,
                  },
                  error
                )
              )
            )
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
                className:
                  "text-lg font-semibold text-amber-900",
              },
              "Enter a search above"
            ),
            h(
              "p",
              {
                className:
                  "mt-1 text-sm text-amber-800",
              },
              "Examples include a client, location, stock item, serial, product code, logger or installation ID."
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
              "div",
              null,
              h(
                "p",
                {
                  className:
                    "mt-4 text-xs font-semibold text-slate-700",
                },
                `Results for "${safeSearchText}"`
              ),
              resultSection(
                "Assets and Current Position",
                assets.length,
                assetCards
              ),
              resultSection(
                "Clients",
                clients.length,
                clientCards
              ),
              resultSection(
                "Locations",
                locations.length,
                locationCards
              ),
              resultSection(
                "Installations",
                installations.length,
                installationCards
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
          "Read-only screen"
        ),
        h(
          "p",
          {
            className: "mt-0.5",
          },
          "This page performs SELECT queries only. It does not create, edit, remove or change any Hardware Database records."
        )
      )
    )
  );
}