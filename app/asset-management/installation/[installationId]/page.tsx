import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type InstallationDetailPageProps = {
  params: Promise<{
    installationId: string;
  }>;
};

type InstallationRecord = {
  installation_id: string;
  client_id: string;
  location_id: string;
  installation_date: string | null;
  installation_type: string | null;
  crop: string | null;
  ftp_id: string | null;
  logger_id: string | null;
  logger_type: string | null;
  sim_card: string | null;
  other_sensors: string | null;
  status: string;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

type InstallationAssetRecord = {
  installation_asset_id: string;
  installation_id: string;
  installation_date: string | null;
  client_id: string;
  client_name: string;
  location_id: string;
  location_name: string;
  stock_item_id: string;
  product_id: string;
  product_code: string | null;
  product_description: string;
  product_category: string;
  product_serial: string;
  asset_role: string;
  asset_arrangement: string;
  installed_at: string | null;
  lifecycle_status: string;
  stock_record_status: string;
};

type InstallationEventRecord = {
  asset_event_id: string;
  stock_item_id: string;
  event_type: string;
  event_date: string;
  previous_lifecycle_status: string | null;
  new_lifecycle_status: string;
  from_installation_id: string | null;
  to_installation_id: string | null;
  from_warehouse: string | null;
  to_warehouse: string | null;
  reason: string | null;
  notes: string | null;
  created_by: string;
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
        ? "rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800"
        : "rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50",
    },
    text
  );
}

export default async function InstallationDetailPage({
  params,
}: InstallationDetailPageProps) {
  const projectTracker =
    await createProjectTrackerClient();

  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  const routeParameters = await params;

  const installationId = decodeURIComponent(
    routeParameters.installationId
  ).trim();

  if (!user) {
    redirect(
      `/login?next=/asset-management/installation/${encodeURIComponent(
        installationId
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
        ),
        navigationButton(
          "/asset-management",
          "Return to Asset Management",
          true
        )
      )
    );
  }

  const hardware = createHardwareClient();

  const installationResponse = await hardware
    .from("installations")
    .select(
      "installation_id, client_id, location_id, installation_date, installation_type, crop, ftp_id, logger_id, logger_type, sim_card, other_sensors, status, closed_at, notes, created_at, updated_at"
    )
    .eq("installation_id", installationId)
    .maybeSingle();

  const installationError =
    installationResponse.error?.message ?? null;

  const installation =
    installationResponse.data as
      | InstallationRecord
      | null;

  if (installationError || !installation) {
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
          "section",
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
            "Installation not found"
          ),
          h(
            "p",
            {
              className: "mt-3 text-slate-700",
            },
            installationError ??
              `No installation was found with ID ${installationId}.`
          ),
          h(
            "div",
            {
              className: "mt-6 flex flex-wrap gap-3",
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
      )
    );
  }

  const [
    clientResponse,
    locationResponse,
    assetsResponse,
    eventsResponse,
  ] = await Promise.all([
    hardware
      .from("clients")
      .select(
        "client_id, client_name, contact_name, email, phone, address, status, notes"
      )
      .eq("client_id", installation.client_id)
      .maybeSingle(),

    hardware
      .from("locations")
      .select(
        "location_id, client_id, location_name, location_type, region, latitude, longitude, status, verification_status, notes"
      )
      .eq("location_id", installation.location_id)
      .maybeSingle(),

    hardware
      .from("vw_current_installation_assets")
      .select(
        "installation_asset_id, installation_id, installation_date, client_id, client_name, location_id, location_name, stock_item_id, product_id, product_code, product_description, product_category, product_serial, asset_role, asset_arrangement, installed_at, lifecycle_status, stock_record_status"
      )
      .eq("installation_id", installationId)
      .order("asset_role")
      .order("stock_item_id"),

    hardware
      .from("asset_events")
      .select(
        "asset_event_id, stock_item_id, event_type, event_date, previous_lifecycle_status, new_lifecycle_status, from_installation_id, to_installation_id, from_warehouse, to_warehouse, reason, notes, created_by, created_at, source"
      )
      .or(
        `from_installation_id.eq.${installationId},to_installation_id.eq.${installationId}`
      )
      .order("event_date", {
        ascending: false,
      }),
  ]);

  const client =
    clientResponse.data as ClientRecord | null;

  const location =
    locationResponse.data as LocationRecord | null;

  const assets =
    (assetsResponse.data as
      | InstallationAssetRecord[]
      | null) ?? [];

  const events =
    (eventsResponse.data as
      | InstallationEventRecord[]
      | null) ?? [];

  const loadErrors: string[] = [];

  if (clientResponse.error) {
    loadErrors.push(
      `Client details: ${clientResponse.error.message}`
    );
  }

  if (locationResponse.error) {
    loadErrors.push(
      `Location details: ${locationResponse.error.message}`
    );
  }

  if (assetsResponse.error) {
    loadErrors.push(
      `Installation assets: ${assetsResponse.error.message}`
    );
  }

  if (eventsResponse.error) {
    loadErrors.push(
      `Installation events: ${eventsResponse.error.message}`
    );
  }

  const coordinateText =
    location?.latitude !== null &&
    location?.latitude !== undefined &&
    location?.longitude !== null &&
    location?.longitude !== undefined
      ? `${location.latitude}, ${location.longitude}`
      : "Not recorded";

  const assetCards = assets.map((asset) =>
    h(
      "article",
      {
        key: asset.installation_asset_id,
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
            null,
            h(
              "a",
              {
                href: `/asset-management/stock/${encodeURIComponent(
                  asset.stock_item_id
                )}`,
                className:
                  "text-lg font-bold text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950",
              },
              asset.stock_item_id
            )
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-sm text-slate-600",
            },
            asset.product_description
          )
        ),
        h(
          "span",
          {
            className:
              "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800",
          },
          asset.lifecycle_status
        )
      ),
      h(
        "div",
        {
          className:
            "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
        },
        detailField(
          "Product code",
          asset.product_code
        ),
        detailField(
          "Product serial",
          asset.product_serial
        ),
        detailField(
          "Product category",
          asset.product_category
        ),
        detailField(
          "Asset role",
          asset.asset_role
        ),
        detailField(
          "Arrangement",
          asset.asset_arrangement
        ),
        detailField(
          "Installed at",
          formatDate(asset.installed_at)
        ),
        detailField(
          "Stock record status",
          asset.stock_record_status
        ),
        detailField(
          "Installation asset ID",
          asset.installation_asset_id
        )
      )
    )
  );

  const eventCards = events.map((event) =>
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
            formatDateTime(event.event_date)
          )
        ),
        h(
          "span",
          {
            className:
              "rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800",
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
          "Stock item",
          event.stock_item_id
        ),
        detailField(
          "Previous lifecycle",
          event.previous_lifecycle_status
        ),
        detailField(
          "New lifecycle",
          event.new_lifecycle_status
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
          "From warehouse",
          event.from_warehouse
        ),
        detailField(
          "To warehouse",
          event.to_warehouse
        ),
        detailField(
          "Recorded at",
          formatDateTime(event.created_at)
        )
      ),
      event.reason || event.notes
        ? h(
            "div",
            {
              className:
                "mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700",
            },
            h(
              "p",
              null,
              `Reason: ${displayValue(event.reason)}`
            ),
            h(
              "p",
              {
                className: "mt-1",
              },
              `Notes: ${displayValue(event.notes)}`
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
                "text-sm font-semibold uppercase tracking-wide text-violet-700",
            },
            "Installation Detail"
          ),
          h(
            "h1",
            {
              className:
                "mt-1 text-3xl font-bold text-slate-900",
            },
            installation.installation_id
          ),
          h(
            "p",
            {
              className:
                "mt-2 text-lg text-slate-700",
            },
            `${displayValue(
              client?.client_name
            )} / ${displayValue(
              location?.location_name
            )}`
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
          navigationButton(
            `/asset-management/search?q=${encodeURIComponent(
              installation.installation_id
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
                "mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900",
            },
            h(
              "h2",
              {
                className: "font-semibold",
              },
              "Some related information could not be loaded"
            ),
            h(
              "ul",
              {
                className:
                  "mt-3 list-disc space-y-1 pl-5 text-sm",
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
              "Installation record"
            ),
            h(
              "p",
              {
                className:
                  "mt-1 text-slate-600",
              },
              `${displayValue(
                client?.client_name
              )} / ${displayValue(
                location?.location_name
              )}`
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-violet-100 px-4 py-2 font-semibold text-violet-800",
            },
            installation.status
          )
        ),
        h(
          "div",
          {
            className:
              "mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
          },
          detailField(
            "Installation ID",
            installation.installation_id
          ),
          detailField(
            "Installation date",
            formatDate(
              installation.installation_date
            )
          ),
          detailField(
            "Installation type",
            installation.installation_type
          ),
          detailField(
            "Status",
            installation.status
          ),
          detailField(
            "Client ID",
            installation.client_id
          ),
          detailField(
            "Client name",
            client?.client_name
          ),
          detailField(
            "Location ID",
            installation.location_id
          ),
          detailField(
            "Location name",
            location?.location_name
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
            "SIM card",
            installation.sim_card
          ),
          detailField(
            "Other sensors",
            installation.other_sensors
          ),
          detailField(
            "Closed at",
            formatDate(installation.closed_at)
          ),
          detailField(
            "Last updated",
            formatDateTime(
              installation.updated_at
            )
          )
        ),
        installation.notes
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
                "Installation notes"
              ),
              h(
                "p",
                {
                  className:
                    "mt-1 whitespace-pre-wrap text-slate-800",
                },
                installation.notes
              )
            )
          : null
      ),

      h(
        "section",
        {
          className:
            "mt-8 grid gap-6 lg:grid-cols-2",
        },
        h(
          "article",
          {
            className:
              "rounded-xl border border-slate-200 bg-white p-6 shadow-sm",
          },
          h(
            "h2",
            {
              className:
                "text-xl font-bold text-slate-900",
            },
            "Client"
          ),
          h(
            "div",
            {
              className:
                "mt-4 grid gap-3 sm:grid-cols-2",
            },
            detailField(
              "Client name",
              client?.client_name
            ),
            detailField(
              "Client status",
              client?.status
            ),
            detailField(
              "Contact",
              client?.contact_name
            ),
            detailField(
              "Phone",
              client?.phone
            ),
            detailField(
              "Email",
              client?.email
            ),
            detailField(
              "Address",
              client?.address
            )
          )
        ),
        h(
          "article",
          {
            className:
              "rounded-xl border border-slate-200 bg-white p-6 shadow-sm",
          },
          h(
            "h2",
            {
              className:
                "text-xl font-bold text-slate-900",
            },
            "Location"
          ),
          h(
            "div",
            {
              className:
                "mt-4 grid gap-3 sm:grid-cols-2",
            },
            detailField(
              "Location name",
              location?.location_name
            ),
            detailField(
              "Location type",
              location?.location_type
            ),
            detailField(
              "Region",
              location?.region
            ),
            detailField(
              "Coordinates",
              coordinateText
            ),
            detailField(
              "Location status",
              location?.status
            ),
            detailField(
              "Verification status",
              location?.verification_status
            )
          )
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
            "Assigned Assets"
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800",
            },
            assets.length.toLocaleString()
          )
        ),
        assets.length === 0
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
                "No current assets were returned for this installation."
              ),
              h(
                "p",
                {
                  className:
                    "mt-2 text-sm text-slate-600",
                },
                "The current-installation-assets view returns active current assignments only."
              )
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
            "Installation Event History"
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800",
            },
            events.length.toLocaleString()
          )
        ),
        events.length === 0
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
                "No post-go-live installation events have been recorded."
              ),
              h(
                "p",
                {
                  className:
                    "mt-2 text-sm text-slate-600",
                },
                "Legacy installation history remains in the existing business spreadsheet."
              )
            )
          : h(
              "div",
              {
                className:
                  "divide-y divide-slate-200",
              },
              ...eventCards
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
          "Read-only installation detail"
        ),
        h(
          "p",
          {
            className: "mt-1",
          },
          "This page retrieves installation, client, location, assigned-asset and event information only. It does not create, edit, move, replace, remove or close any records."
        )
      )
    )
  );
}