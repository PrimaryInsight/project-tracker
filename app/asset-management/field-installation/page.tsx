import {
  createElement as h,
  type ReactNode,
} from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type FieldInstallationPageProps = {
  searchParams: Promise<{
    q?: string;
    clientId?: string;
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
        ? "rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        : "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50",
    },
    text
  );
}

function clientDetailLink(
  clientId: string,
  clientName: string
) {
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

function locationDetailLink(
  locationId: string,
  locationName: string
) {
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

export default async function FieldInstallationPage({
  searchParams,
}: FieldInstallationPageProps) {
  const projectTracker =
    await createProjectTrackerClient();

  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/asset-management/field-installation"
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

  const parameters = await searchParams;

  const searchText = (
    parameters.q ?? ""
  ).trim();

  const selectedClientId = (
    parameters.clientId ?? ""
  ).trim();

  const safeSearchText = searchText
    .replaceAll(",", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .trim();

  const hardware = createHardwareClient();

  let clients: ClientRecord[] = [];
  let selectedClient: ClientRecord | null = null;
  let locations: LocationRecord[] = [];

  const errors: string[] = [];

  if (safeSearchText.length >= 2) {
    const pattern = `%${safeSearchText}%`;

    const clientSearchResponse = await hardware
      .from("clients")
      .select(
        "client_id, client_name, contact_name, email, phone, address, status, notes"
      )
      .or(
        `client_id.ilike.${pattern},client_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
      )
      .order("client_name")
      .limit(25);

    if (clientSearchResponse.error) {
      errors.push(
        `Client search: ${clientSearchResponse.error.message}`
      );
    } else {
      clients =
        (clientSearchResponse.data as
          | ClientRecord[]
          | null) ?? [];
    }
  }

  if (selectedClientId) {
    const [
      selectedClientResponse,
      locationsResponse,
    ] = await Promise.all([
      hardware
        .from("clients")
        .select(
          "client_id, client_name, contact_name, email, phone, address, status, notes"
        )
        .eq("client_id", selectedClientId)
        .maybeSingle(),

      hardware
        .from("locations")
        .select(
          "location_id, client_id, location_name, location_type, region, latitude, longitude, status, verification_status"
        )
        .eq("client_id", selectedClientId)
        .order("location_name"),
    ]);

    if (selectedClientResponse.error) {
      errors.push(
        `Selected client: ${selectedClientResponse.error.message}`
      );
    } else {
      selectedClient =
        selectedClientResponse.data as
          | ClientRecord
          | null;
    }

    if (locationsResponse.error) {
      errors.push(
        `Client locations: ${locationsResponse.error.message}`
      );
    } else {
      locations =
        (locationsResponse.data as
          | LocationRecord[]
          | null) ?? [];
    }
  }

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
            {
              className:
                "text-base font-bold text-slate-900",
            },
            clientDetailLink(
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
              client.status.toLowerCase() === "active"
                ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700",
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
      ),
      h(
        "div",
        {
          className:
            "mt-3 flex flex-wrap gap-2",
        },
        h(
          "a",
          {
            href: `/asset-management/field-installation?clientId=${encodeURIComponent(
              client.client_id
            )}`,
            className:
              "rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800",
          },
          "Select Client"
        ),
        h(
          "a",
          {
            href: `/asset-management/client/${encodeURIComponent(
              client.client_id
            )}`,
            className:
              "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50",
          },
          "View Client Details"
        )
      )
    )
  );

  const locationCards = locations.map(
    (location) => {
      const coordinateText =
        location.latitude !== null &&
        location.longitude !== null
          ? `${location.latitude}, ${location.longitude}`
          : "Not recorded";

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
              locationDetailLink(
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
                location.status.toLowerCase() ===
                "active"
                  ? "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800"
                  : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700",
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
            displayValue(location.location_type)
          ),
          detailField(
            "Region",
            displayValue(location.region)
          ),
          detailField(
            "Coordinates",
            coordinateText
          ),
          detailField(
            "Verification",
            location.verification_status
          )
        ),
        h(
          "div",
          {
            className:
              "mt-3 flex flex-wrap gap-2",
          },
          h(
            "span",
            {
              className:
                "cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600",
              title:
                "Location selection will be enabled in the next preview stage.",
            },
            "Select Location: Next Stage"
          ),
          h(
            "a",
            {
              href: `/asset-management/location/${encodeURIComponent(
                location.location_id
              )}`,
              className:
                "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50",
            },
            "View Location Details"
          )
        )
      );
    }
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
            "Preview Workflow"
          ),
          h(
            "h1",
            {
              className:
                "mt-0.5 text-2xl font-bold text-slate-900",
            },
            "Field Installation"
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-sm text-slate-700",
            },
            "Step 1 of 5: Select the Hardware Database client."
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
            "/asset-management",
            "Asset Management Home"
          ),
          navigationButton(
            "/",
            "Systems Home",
            true
          )
        )
      ),

      h(
        "section",
        {
          className:
            "mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900",
        },
        h(
          "p",
          {
            className: "font-semibold",
          },
          "Preview mode"
        ),
        h(
          "p",
          {
            className: "mt-0.5",
          },
          "This workflow currently reads existing client and location information only. It cannot create an installation or change database records."
        )
      ),

      h(
        "section",
        {
          className:
            "rounded-lg border border-slate-200 bg-white p-4 shadow-sm",
        },
        h(
          "h2",
          {
            className:
              "text-lg font-bold text-slate-900",
          },
          "Search for a client"
        ),
        h(
          "p",
          {
            className:
              "mt-1 text-sm text-slate-600",
          },
          "Search by client name, client ID, contact name, phone, or email."
        ),
        h(
          "form",
          {
            action:
              "/asset-management/field-installation",
            method: "get",
            className:
              "mt-3 flex flex-col gap-2 sm:flex-row",
          },
          h("input", {
            type: "search",
            name: "q",
            defaultValue: searchText,
            minLength: 2,
            placeholder:
              "Enter client name or client ID...",
            className:
              "min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500",
          }),
          h(
            "button",
            {
              type: "submit",
              className:
                "rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800",
            },
            "Search Clients"
          ),
          h(
            "a",
            {
              href:
                "/asset-management/field-installation",
              className:
                "rounded-md border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50",
            },
            "Clear"
          )
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
              "One or more records could not be loaded"
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

      selectedClient
        ? h(
            "section",
            {
              className:
                "mt-4 rounded-lg border border-emerald-300 bg-white p-4 shadow-sm",
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
                  "p",
                  {
                    className:
                      "text-xs font-semibold uppercase tracking-wide text-emerald-700",
                  },
                  "Selected Client"
                ),
                h(
                  "h2",
                  {
                    className:
                      "mt-0.5 text-xl font-bold text-slate-900",
                  },
                  clientDetailLink(
                    selectedClient.client_id,
                    selectedClient.client_name
                  )
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-1 text-xs text-slate-500",
                  },
                  `Client ID: ${selectedClient.client_id}`
                )
              ),
              h(
                "span",
                {
                  className:
                    "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800",
                },
                selectedClient.status
              )
            ),
            h(
              "div",
              {
                className:
                  "mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
              },
              detailField(
                "Contact",
                displayValue(
                  selectedClient.contact_name
                )
              ),
              detailField(
                "Phone",
                displayValue(selectedClient.phone)
              ),
              detailField(
                "Email",
                displayValue(selectedClient.email)
              ),
              detailField(
                "Address",
                displayValue(
                  selectedClient.address
                )
              )
            ),
            h(
              "div",
              {
                className:
                  "mt-3 flex flex-wrap gap-2",
              },
              h(
                "a",
                {
                  href:
                    "/asset-management/field-installation",
                  className:
                    "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50",
                },
                "Change Client"
              ),
              navigationButton(
                `/asset-management/client/${encodeURIComponent(
                  selectedClient.client_id
                )}`,
                "View Client Details"
              )
            )
          )
        : null,

      selectedClient
        ? h(
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
                "div",
                null,
                h(
                  "h2",
                  {
                    className:
                      "text-lg font-semibold",
                  },
                  "Existing Client Locations"
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-0.5 text-xs text-slate-300",
                  },
                  "Review the available locations before continuing."
                )
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
                    "No locations are currently recorded for this client."
                  ),
                  h(
                    "p",
                    {
                      className:
                        "mt-1 text-xs text-slate-600",
                    },
                    "The Add Location preview will be introduced in the next workflow stage."
                  )
                )
              : h(
                  "div",
                  {
                    className:
                      "divide-y divide-slate-200",
                  },
                  ...locationCards
                )
          )
        : safeSearchText.length >= 2
          ? h(
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
                  `Client Results for "${safeSearchText}"`
                ),
                h(
                  "span",
                  {
                    className:
                      "rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-800",
                  },
                  clients.length.toLocaleString()
                )
              ),
              clients.length === 0
                ? h(
                    "p",
                    {
                      className:
                        "p-4 text-sm text-slate-600",
                    },
                    "No matching Hardware Database clients were found."
                  )
                : h(
                    "div",
                    {
                      className:
                        "divide-y divide-slate-200",
                    },
                    ...clientCards
                  )
            )
          : h(
              "section",
              {
                className:
                  "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center",
              },
              h(
                "h2",
                {
                  className:
                    "text-lg font-semibold text-emerald-900",
                },
                "Begin by finding the client"
              ),
              h(
                "p",
                {
                  className:
                    "mt-1 text-sm text-emerald-800",
                },
                "The selected client will remain visible throughout the installation workflow."
              )
            ),

      h(
        "section",
        {
          className:
            "mt-4 rounded-lg border border-slate-300 bg-slate-200 px-4 py-3 text-sm text-slate-700",
        },
        h(
          "p",
          {
            className: "font-semibold",
          },
          "Next preview stage"
        ),
        h(
          "p",
          {
            className: "mt-0.5",
          },
          "The next stage will enable selecting an existing location or preparing a new location without saving it to the database."
        )
      )
    )
  );
}