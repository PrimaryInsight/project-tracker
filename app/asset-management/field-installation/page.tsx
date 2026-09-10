import {
  createElement as h,
  type ReactNode,
} from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    clientId?: string;
    locationId?: string;
    mode?: string;
    reviewNew?: string;
    newLocationName?: string;
    newLocationType?: string;
    newRegion?: string;
    newLatitude?: string;
    newLongitude?: string;
    newNotes?: string;
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
  notes: string | null;
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

function clientLink(
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

function locationLink(
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

function hiddenInput(
  name: string,
  value: string
) {
  return h("input", {
    type: "hidden",
    name,
    value,
  });
}

function textInput(
  label: string,
  name: string,
  defaultValue: string,
  placeholder: string,
  required = false
) {
  return h(
    "label",
    {
      className:
        "text-sm font-semibold text-slate-700",
    },
    label,
    required ? " *" : "",
    h("input", {
      name,
      required,
      defaultValue,
      placeholder,
      className:
        "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500",
    })
  );
}

function sectionHeader(
  title: string,
  subtitle: string,
  count?: number
) {
  return h(
    "div",
    {
      className:
        "flex flex-wrap items-center justify-between gap-3 bg-slate-800 px-4 py-3 text-white",
    },
    h(
      "div",
      null,
      h(
        "h2",
        {
          className: "text-lg font-semibold",
        },
        title
      ),
      h(
        "p",
        {
          className:
            "mt-0.5 text-xs text-slate-300",
        },
        subtitle
      )
    ),
    count === undefined
      ? null
      : h(
          "span",
          {
            className:
              "rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-800",
          },
          count.toLocaleString()
        )
  );
}

function parseCoordinate(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export default async function FieldInstallationPage({
  searchParams,
}: PageProps) {
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
    .map((email: string) =>
      email.trim().toLowerCase()
    )
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

  const selectedLocationId = (
    parameters.locationId ?? ""
  ).trim();

  const mode = (
    parameters.mode ?? ""
  ).trim();

  const reviewNew =
    parameters.reviewNew === "yes";

  const safeSearchText = searchText
    .replaceAll(",", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .trim();

  const newLocationName = (
    parameters.newLocationName ?? ""
  ).trim();

  const newLocationType = (
    parameters.newLocationType ?? ""
  ).trim();

  const newRegion = (
    parameters.newRegion ?? ""
  ).trim();

  const newLatitudeText = (
    parameters.newLatitude ?? ""
  ).trim();

  const newLongitudeText = (
    parameters.newLongitude ?? ""
  ).trim();

  const newNotes = (
    parameters.newNotes ?? ""
  ).trim();

  const hardware = createHardwareClient();

  let clients: ClientRecord[] = [];
  let selectedClient: ClientRecord | null =
    null;
  let locations: LocationRecord[] = [];
  let selectedLocation: LocationRecord | null =
    null;

  const errors: string[] = [];

  if (
    safeSearchText.length >= 2 &&
    !selectedClientId
  ) {
    const pattern = `%${safeSearchText}%`;

    const response = await hardware
      .from("clients")
      .select(
        "client_id, client_name, contact_name, email, phone, address, status, notes"
      )
      .or(
        `client_id.ilike.${pattern},client_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
      )
      .order("client_name")
      .limit(25);

    if (response.error) {
      errors.push(
        `Client search: ${response.error.message}`
      );
    } else {
      clients =
        (response.data as
          | ClientRecord[]
          | null) ?? [];
    }
  }

  if (selectedClientId) {
    const [
      clientResponse,
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
          "location_id, client_id, location_name, location_type, region, latitude, longitude, status, verification_status, notes"
        )
        .eq("client_id", selectedClientId)
        .order("location_name"),
    ]);

    if (clientResponse.error) {
      errors.push(
        `Selected client: ${clientResponse.error.message}`
      );
    } else {
      selectedClient =
        clientResponse.data as
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

  if (
    selectedClientId &&
    selectedLocationId
  ) {
    const response = await hardware
      .from("locations")
      .select(
        "location_id, client_id, location_name, location_type, region, latitude, longitude, status, verification_status, notes"
      )
      .eq(
        "location_id",
        selectedLocationId
      )
      .eq("client_id", selectedClientId)
      .maybeSingle();

    if (response.error) {
      errors.push(
        `Selected location: ${response.error.message}`
      );
    } else {
      selectedLocation =
        response.data as
          | LocationRecord
          | null;
    }
  }

  const latitude = parseCoordinate(
    newLatitudeText
  );

  const longitude = parseCoordinate(
    newLongitudeText
  );

  const newLocationSubmitted =
    mode === "new" &&
    reviewNew &&
    newLocationName.length > 0;

  const latitudeInvalid =
    newLatitudeText.length > 0 &&
    latitude === null;

  const longitudeInvalid =
    newLongitudeText.length > 0 &&
    longitude === null;

  const latitudeOutOfRange =
    latitude !== null &&
    (latitude < -90 || latitude > 90);

  const longitudeOutOfRange =
    longitude !== null &&
    (longitude < -180 ||
      longitude > 180);

  const newLocationValid =
    newLocationSubmitted &&
    !latitudeInvalid &&
    !longitudeInvalid &&
    !latitudeOutOfRange &&
    !longitudeOutOfRange;

  const showingExistingChoices =
    selectedClient !== null &&
    !selectedLocation &&
    mode !== "new";

  const showingNewLocationForm =
    selectedClient !== null &&
    mode === "new" &&
    !newLocationValid;

  const showingExistingReview =
    selectedClient !== null &&
    selectedLocation !== null &&
    mode === "existing";

  const showingNewLocationReview =
    selectedClient !== null &&
    newLocationValid;

  const clientCards = clients.map(
    (client) =>
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
                  "text-base font-bold",
              },
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
            `Phone: ${displayValue(
              client.phone
            )}`
          ),
          h(
            "p",
            null,
            `Email: ${displayValue(
              client.email
            )}`
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
          navigationButton(
            `/asset-management/client/${encodeURIComponent(
              client.client_id
            )}`,
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
                  "text-base font-bold",
              },
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
              "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
          },
          detailField(
            "Location type",
            displayValue(
              location.location_type
            )
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
            "a",
            {
              href: `/asset-management/field-installation?clientId=${encodeURIComponent(
                selectedClientId
              )}&locationId=${encodeURIComponent(
                location.location_id
              )}&mode=existing`,
              className:
                "rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800",
            },
            "Select Location"
          ),
          navigationButton(
            `/asset-management/location/${encodeURIComponent(
              location.location_id
            )}`,
            "View Location Details"
          )
        )
      );
    }
  );

  const coordinateErrors: ReactNode[] = [];

  if (latitudeInvalid) {
    coordinateErrors.push(
      h(
        "li",
        {
          key: "latitude-invalid",
        },
        "Latitude must be a number."
      )
    );
  }

  if (longitudeInvalid) {
    coordinateErrors.push(
      h(
        "li",
        {
          key: "longitude-invalid",
        },
        "Longitude must be a number."
      )
    );
  }

  if (latitudeOutOfRange) {
    coordinateErrors.push(
      h(
        "li",
        {
          key: "latitude-range",
        },
        "Latitude must be between -90 and 90."
      )
    );
  }

  if (longitudeOutOfRange) {
    coordinateErrors.push(
      h(
        "li",
        {
          key: "longitude-range",
        },
        "Longitude must be between -180 and 180."
      )
    );
  }

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
            selectedClient
              ? "Step 2 of 5: Select or prepare the installation location."
              : "Step 1 of 5: Select the Hardware Database client."
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
          "Client and location selections are held in the page address only. No database records can be created or changed."
        )
      ),

      !selectedClient
        ? h(
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
              "Search for a Client"
            ),
            h(
              "p",
              {
                className:
                  "mt-1 text-sm text-slate-600",
              },
              "Search by client name, ID, contact, phone, or email."
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
                  "min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900",
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
              navigationButton(
                "/asset-management/field-installation",
                "Clear"
              )
            )
          )
        : null,

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

      !selectedClient &&
      safeSearchText.length >= 2
        ? h(
            "section",
            {
              className:
                "mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
            },
            sectionHeader(
              `Client Results for "${safeSearchText}"`,
              "Select the correct Hardware Database client.",
              clients.length
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
                      "mt-0.5 text-xl font-bold",
                  },
                  clientLink(
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
                displayValue(
                  selectedClient.phone
                )
              ),
              detailField(
                "Email",
                displayValue(
                  selectedClient.email
                )
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
              navigationButton(
                "/asset-management/field-installation",
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

      showingExistingReview &&
      selectedLocation
        ? h(
            "section",
            {
              className:
                "mt-4 rounded-lg border border-blue-300 bg-white p-4 shadow-sm",
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
                      "text-xs font-semibold uppercase tracking-wide text-blue-700",
                  },
                  "Selected Existing Location"
                ),
                h(
                  "h2",
                  {
                    className:
                      "mt-0.5 text-xl font-bold",
                  },
                  locationLink(
                    selectedLocation.location_id,
                    selectedLocation.location_name
                  )
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-1 text-xs text-slate-500",
                  },
                  `Location ID: ${selectedLocation.location_id}`
                )
              ),
              h(
                "span",
                {
                  className:
                    "rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800",
                },
                selectedLocation.status
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
                displayValue(
                  selectedLocation.location_type
                )
              ),
              detailField(
                "Region",
                displayValue(
                  selectedLocation.region
                )
              ),
              detailField(
                "Coordinates",
                selectedLocation.latitude !==
                  null &&
                  selectedLocation.longitude !==
                    null
                  ? `${selectedLocation.latitude}, ${selectedLocation.longitude}`
                  : "Not recorded"
              ),
              detailField(
                "Verification",
                selectedLocation.verification_status
              )
            ),
            h(
              "div",
              {
                className:
                  "mt-4 flex flex-wrap gap-2",
              },
              h(
                "span",
                {
                  className:
                    "inline-flex cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600",
                },
                "Continue to Installation Details: Next Stage"
              ),
              navigationButton(
                `/asset-management/field-installation?clientId=${encodeURIComponent(
                  selectedClientId
                )}`,
                "Change Location"
              ),
              navigationButton(
                `/asset-management/field-installation?clientId=${encodeURIComponent(
                  selectedClientId
                )}&mode=new`,
                "Prepare New Location Instead"
              )
            )
          )
        : null,

      showingNewLocationReview
        ? h(
            "section",
            {
              className:
                "mt-4 rounded-lg border border-amber-300 bg-white p-4 shadow-sm",
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
                      "text-xs font-semibold uppercase tracking-wide text-amber-700",
                  },
                  "Proposed New Location"
                ),
                h(
                  "h2",
                  {
                    className:
                      "mt-0.5 text-xl font-bold text-slate-900",
                  },
                  newLocationName
                )
              ),
              h(
                "span",
                {
                  className:
                    "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900",
                },
                "Preview only"
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
                displayValue(newLocationType)
              ),
              detailField(
                "Region",
                displayValue(newRegion)
              ),
              detailField(
                "Latitude",
                displayValue(latitude)
              ),
              detailField(
                "Longitude",
                displayValue(longitude)
              ),
              detailField(
                "Notes",
                displayValue(newNotes)
              )
            ),
            h(
              "p",
              {
                className:
                  "mt-3 text-sm text-amber-900",
              },
              "This proposed location exists only in the page address and has not been added to the Hardware Database."
            ),
            h(
              "div",
              {
                className:
                  "mt-4 flex flex-wrap gap-2",
              },
              h(
                "span",
                {
                  className:
                    "inline-flex cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600",
                },
                "Continue to Installation Details: Next Stage"
              ),
              h(
                "a",
                {
                  href: `/asset-management/field-installation?clientId=${encodeURIComponent(
                    selectedClientId
                  )}&mode=new&newLocationName=${encodeURIComponent(
                    newLocationName
                  )}&newLocationType=${encodeURIComponent(
                    newLocationType
                  )}&newRegion=${encodeURIComponent(
                    newRegion
                  )}&newLatitude=${encodeURIComponent(
                    newLatitudeText
                  )}&newLongitude=${encodeURIComponent(
                    newLongitudeText
                  )}&newNotes=${encodeURIComponent(
                    newNotes
                  )}`,
                  className:
                    "rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100",
                },
                "Edit Proposed Location"
              ),
              navigationButton(
                `/asset-management/field-installation?clientId=${encodeURIComponent(
                  selectedClientId
                )}`,
                "Choose Existing Location Instead"
              )
            )
          )
        : null,

      showingExistingChoices
        ? h(
            "div",
            null,
            h(
              "section",
              {
                className:
                  "mt-4 grid gap-3 sm:grid-cols-2",
              },
              h(
                "article",
                {
                  className:
                    "rounded-lg border border-blue-300 bg-blue-50 p-4",
                },
                h(
                  "h2",
                  {
                    className:
                      "text-lg font-bold text-blue-900",
                  },
                  "Choose Existing Location"
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-1 text-sm text-blue-800",
                  },
                  "Select from the locations already recorded for this client."
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-3 text-sm font-semibold text-blue-900",
                  },
                  `${locations.length} existing locations`
                )
              ),
              h(
                "a",
                {
                  href: `/asset-management/field-installation?clientId=${encodeURIComponent(
                    selectedClientId
                  )}&mode=new`,
                  className:
                    "rounded-lg border border-amber-300 bg-amber-50 p-4 hover:bg-amber-100",
                },
                h(
                  "h2",
                  {
                    className:
                      "text-lg font-bold text-amber-900",
                  },
                  "Prepare New Location"
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-1 text-sm text-amber-800",
                  },
                  "Prepare and review a location that is not yet in the Hardware Database."
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-3 text-sm font-semibold text-amber-900",
                  },
                  "Open preview form"
                )
              )
            ),
            h(
              "section",
              {
                className:
                  "mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
              },
              sectionHeader(
                "Existing Locations",
                "Select the installation location.",
                locations.length
              ),
              locations.length === 0
                ? h(
                    "p",
                    {
                      className:
                        "p-4 text-sm text-slate-600",
                    },
                    "No existing locations are recorded for this client. Use Prepare New Location."
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
          )
        : null,

      showingNewLocationForm
        ? h(
            "section",
            {
              className:
                "mt-4 rounded-lg border border-amber-300 bg-white p-4 shadow-sm",
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
                  "Prepare New Location"
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-1 text-sm text-slate-600",
                  },
                  "Enter proposed details for review. Nothing will be saved."
                )
              ),
              h(
                "span",
                {
                  className:
                    "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900",
                },
                "Preview only"
              )
            ),
            h(
              "form",
              {
                action:
                  "/asset-management/field-installation",
                method: "get",
                className:
                  "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
              },
              hiddenInput(
                "clientId",
                selectedClientId
              ),
              hiddenInput("mode", "new"),
              hiddenInput("reviewNew", "yes"),
              textInput(
                "Location name",
                "newLocationName",
                newLocationName,
                "Example: North Block Row 4",
                true
              ),
              textInput(
                "Location type",
                "newLocationType",
                newLocationType,
                "Site, block, orchard..."
              ),
              textInput(
                "Region",
                "newRegion",
                newRegion,
                "Otago, Canterbury..."
              ),
              textInput(
                "Latitude",
                "newLatitude",
                newLatitudeText,
                "-44.941734"
              ),
              textInput(
                "Longitude",
                "newLongitude",
                newLongitudeText,
                "169.269501"
              ),
              h(
                "label",
                {
                  className:
                    "text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3",
                },
                "Notes",
                h("textarea", {
                  name: "newNotes",
                  defaultValue: newNotes,
                  rows: 3,
                  placeholder:
                    "Optional preview notes",
                  className:
                    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900",
                })
              ),
              h(
                "div",
                {
                  className:
                    "flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3",
                },
                h(
                  "button",
                  {
                    type: "submit",
                    className:
                      "rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800",
                  },
                  "Review New Location"
                ),
                navigationButton(
                  `/asset-management/field-installation?clientId=${encodeURIComponent(
                    selectedClientId
                  )}`,
                  "Choose Existing Location Instead"
                )
              )
            )
          )
        : null,

      coordinateErrors.length > 0
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
              "Review the proposed coordinates"
            ),
            h(
              "ul",
              {
                className:
                  "mt-2 list-disc space-y-1 pl-5",
              },
              ...coordinateErrors
            )
          )
        : null,

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
          "Read-only preview"
        ),
        h(
          "p",
          {
            className: "mt-0.5",
          },
          "Stage 2 reads clients and locations and carries preview selections in the URL. It does not create clients, locations, installations, asset assignments, or asset events."
        )
      )
    )
  );
}