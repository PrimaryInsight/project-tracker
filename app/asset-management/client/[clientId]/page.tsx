import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type ClientDetailPageProps = {
  params: Promise<{
    clientId: string;
  }>;
};

type ClientRecord = {
  client_id: string;
  client_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LocationRecord = {
  location_id: string;
  client_id: string;
  location_name: string;
  location_type: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  verification_status: string;
  notes: string | null;
};

type InstallationRecord = {
  installation_id: string;
  client_id: string;
  location_id: string;
  installation_date: string | null;
  installation_type: string | null;
  crop: string | null;
  logger_id: string | null;
  logger_type: string | null;
  ftp_id: string | null;
  status: string;
  closed_at: string | null;
};

type AssetRecord = {
  installation_asset_id: string | null;
  installation_id: string | null;
  stock_item_id: string;
  product_code: string | null;
  product_description: string;
  product_serial: string;
  lifecycle_status: string;
  asset_classification: string;
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
  value: string | number | null | undefined
) {
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
      "p",
      {
        className:
          "mt-0.5 break-words text-sm font-medium leading-5 text-slate-900",
      },
      displayValue(value)
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

function installationLink(
  installationId: string
) {
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

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const projectTracker =
    await createProjectTrackerClient();

  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  const routeParameters = await params;

  const clientId = decodeURIComponent(
    routeParameters.clientId
  ).trim();

  if (!user) {
    redirect(
      `/login?next=/asset-management/client/${encodeURIComponent(
        clientId
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

  const clientResponse = await hardware
    .from("clients")
    .select(
      "client_id, client_name, contact_name, email, phone, address, status, notes, created_at, updated_at"
    )
    .eq("client_id", clientId)
    .maybeSingle();

  const clientError =
    clientResponse.error?.message ?? null;

  const client =
    clientResponse.data as ClientRecord | null;

  if (clientError || !client) {
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
          "Client not found"
        ),
        h(
          "p",
          {
            className:
              "mt-2 text-sm text-slate-700",
          },
          clientError ??
            `No client was found with ID ${clientId}.`
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

  const [
    locationsResponse,
    installationsResponse,
    assetsResponse,
  ] = await Promise.all([
    hardware
      .from("locations")
      .select(
        "location_id, client_id, location_name, location_type, region, latitude, longitude, status, verification_status, notes"
      )
      .eq("client_id", clientId)
      .order("location_name"),

    hardware
      .from("installations")
      .select(
        "installation_id, client_id, location_id, installation_date, installation_type, crop, logger_id, logger_type, ftp_id, status, closed_at"
      )
      .eq("client_id", clientId)
      .order("installation_date", {
        ascending: false,
        nullsFirst: false,
      }),

    hardware
      .from("vw_asset_current_position")
      .select(
        "installation_asset_id, installation_id, stock_item_id, product_code, product_description, product_serial, lifecycle_status, asset_classification, client_id, client_name, location_id, location_name, current_position"
      )
      .eq("client_id", clientId)
      .order("location_name")
      .order("stock_item_id"),
  ]);

  const locations =
    (locationsResponse.data as
      | LocationRecord[]
      | null) ?? [];

  const installations =
    (installationsResponse.data as
      | InstallationRecord[]
      | null) ?? [];

  const assets =
    (assetsResponse.data as
      | AssetRecord[]
      | null) ?? [];

  const loadErrors: string[] = [];

  if (locationsResponse.error) {
    loadErrors.push(
      `Locations: ${locationsResponse.error.message}`
    );
  }

  if (installationsResponse.error) {
    loadErrors.push(
      `Installations: ${installationsResponse.error.message}`
    );
  }

  if (assetsResponse.error) {
    loadErrors.push(
      `Installed assets: ${assetsResponse.error.message}`
    );
  }

  const activeInstallations =
    installations.filter(
      (installation) =>
        installation.status.toLowerCase() ===
        "active"
    );

  const locationCards = locations.map(
    (location) => {
      const coordinateText =
        location.latitude !== null &&
        location.longitude !== null
          ? `${location.latitude}, ${location.longitude}`
          : "Not recorded";

      const locationInstallations =
        installations.filter(
          (installation) =>
            installation.location_id ===
            location.location_id
        );

      const locationAssets = assets.filter(
        (asset) =>
          asset.location_id === location.location_id
      );

      return h(
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
              {
                className:
                  "text-base font-bold text-slate-900",
              },
              location.location_name
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
              "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
          },
          detailField(
            "Location type",
            location.location_type
          ),
          detailField(
            "Region",
            location.region
          ),
          detailField(
            "Coordinates",
            coordinateText
          ),
          detailField(
            "Verification",
            location.verification_status
          ),
          detailField(
            "Installations",
            locationInstallations.length
          ),
          detailField(
            "Current assets",
            locationAssets.length
          )
        ),
        location.notes
          ? h(
              "p",
              {
                className:
                  "mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700",
              },
              location.notes
            )
          : null
      );
    }
  );

  const installationCards =
    installations.map((installation) =>
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
              `Location ${installation.location_id}`
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
              "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
          },
          detailField(
            "Date",
            formatDate(
              installation.installation_date
            )
          ),
          detailField(
            "Type",
            installation.installation_type
          ),
          detailField(
            "Crop",
            installation.crop
          ),
          detailField(
            "Logger ID",
            installation.logger_id
          ),
          detailField(
            "Logger type",
            installation.logger_type
          ),
          detailField(
            "FTP ID",
            installation.ftp_id
          ),
          detailField(
            "Closed",
            formatDate(installation.closed_at)
          )
        )
      )
    );

  const assetCards = assets.map((asset) =>
    h(
      "article",
      {
        key:
          asset.installation_asset_id ??
          `${asset.stock_item_id}-${asset.installation_id}`,
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
          asset.lifecycle_status
        )
      ),
      h(
        "div",
        {
          className:
            "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
        },
        detailField(
          "Product code",
          asset.product_code
        ),
        detailField(
          "Serial",
          asset.product_serial
        ),
        detailField(
          "Classification",
          asset.asset_classification
        ),
        detailField(
          "Location",
          asset.location_name
        ),
        h(
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
            "Installation"
          ),
          h(
            "p",
            {
              className:
                "mt-0.5 text-sm leading-5",
            },
            asset.installation_id
              ? installationLink(
                  asset.installation_id
                )
              : "Not recorded"
          )
        ),
        detailField(
          "Current position",
          asset.current_position
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
            "p",
            {
              className:
                "text-xs font-semibold uppercase tracking-wide text-emerald-700",
            },
            "Client Detail"
          ),
          h(
            "h1",
            {
              className:
                "mt-0.5 text-2xl font-bold text-slate-900",
            },
            client.client_name
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-xs text-slate-500",
            },
            `Client ID: ${client.client_id}`
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
              client.client_name
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

      loadErrors.length > 0
        ? h(
            "section",
            {
              className:
                "mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900",
            },
            h(
              "p",
              {
                className: "font-semibold",
              },
              "Some related information could not be loaded"
            ),
            h(
              "ul",
              {
                className:
                  "mt-2 list-disc space-y-1 pl-5",
              },
              ...loadErrors.map((error) =>
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
              "Client record"
            ),
            h(
              "p",
              {
                className:
                  "mt-0.5 text-sm text-slate-600",
              },
              `${locations.length} locations, ${installations.length} installations, ${assets.length} currently assigned assets`
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800",
            },
            client.status
          )
        ),
        h(
          "div",
          {
            className:
              "mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6",
          },
          detailField(
            "Client ID",
            client.client_id
          ),
          detailField(
            "Client name",
            client.client_name
          ),
          detailField(
            "Status",
            client.status
          ),
          detailField(
            "Contact",
            client.contact_name
          ),
          detailField(
            "Phone",
            client.phone
          ),
          detailField(
            "Email",
            client.email
          ),
          detailField(
            "Address",
            client.address
          ),
          detailField(
            "Locations",
            locations.length
          ),
          detailField(
            "Installations",
            installations.length
          ),
          detailField(
            "Active installations",
            activeInstallations.length
          ),
          detailField(
            "Current assets",
            assets.length
          ),
          detailField(
            "Updated",
            formatDateTime(client.updated_at)
          )
        ),
        client.notes
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
                "Client notes"
              ),
              h(
                "p",
                {
                  className:
                    "mt-0.5 whitespace-pre-wrap text-sm text-slate-800",
                },
                client.notes
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
        h(
          "div",
          {
            className:
              "flex items-center justify-between gap-3 bg-slate-800 px-4 py-3 text-white",
          },
          h(
            "h2",
            {
              className:
                "text-lg font-semibold",
            },
            "Locations"
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-800",
            },
            locations.length.toLocaleString()
          )
        ),
        locations.length === 0
          ? h(
              "p",
              {
                className:
                  "p-4 text-sm text-slate-600",
              },
              "No locations are recorded for this client."
            )
          : h(
              "div",
              {
                className:
                  "divide-y divide-slate-200",
              },
              ...locationCards
            )
      ),

      h(
        "section",
        {
          className:
            "mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
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
              className:
                "text-lg font-semibold",
            },
            "Installations"
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-800",
            },
            installations.length.toLocaleString()
          )
        ),
        installations.length === 0
          ? h(
              "p",
              {
                className:
                  "p-4 text-sm text-slate-600",
              },
              "No installations are recorded for this client."
            )
          : h(
              "div",
              {
                className:
                  "divide-y divide-slate-200",
              },
              ...installationCards
            )
      ),

      h(
        "section",
        {
          className:
            "mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
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
              className:
                "text-lg font-semibold",
            },
            "Currently Assigned Assets"
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-800",
            },
            assets.length.toLocaleString()
          )
        ),
        assets.length === 0
          ? h(
              "p",
              {
                className:
                  "p-4 text-sm text-slate-600",
              },
              "No current asset assignments were returned for this client."
            )
          : h(
              "div",
              {
                className:
                  "divide-y divide-slate-200",
              },
              ...assetCards
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
          "Read-only client detail"
        ),
        h(
          "p",
          {
            className: "mt-0.5",
          },
          "This page retrieves client, location, installation and current asset information only. It does not create, edit or change any Hardware Database records."
        )
      )
    )
  );
}