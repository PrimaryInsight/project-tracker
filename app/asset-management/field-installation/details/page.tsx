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
    clientId?: string;
    locationMode?: string;
    locationId?: string;

    newLocationName?: string;
    newLocationType?: string;
    newRegion?: string;
    newLatitude?: string;
    newLongitude?: string;
    newLocationNotes?: string;

    review?: string;
    installationStatus?: string;
    installationDate?: string;
    installationType?: string;
    crop?: string;
    loggerId?: string;
    loggerType?: string;
    ftpId?: string;
    simCard?: string;
    otherSensors?: string;
    installationNotes?: string;
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

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "Not recorded";
  }

  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
  required = false,
  type = "text"
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
      type,
      name,
      required,
      defaultValue,
      placeholder,
      className:
        "mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500",
    })
  );
}

function selectInput(
  label: string,
  name: string,
  defaultValue: string
) {
  return h(
    "label",
    {
      className:
        "text-sm font-semibold text-slate-700",
    },
    label,
    " *",
    h(
      "select",
      {
        name,
        required: true,
        defaultValue,
        className:
          "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500",
      },
      h(
        "option",
        {
          value: "Planned",
        },
        "Planned"
      ),
      h(
        "option",
        {
          value: "Completed",
        },
        "Completed"
      )
    )
  );
}

function parseCoordinate(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function buildLocationReturnUrl(
  clientId: string,
  locationMode: string,
  locationId: string,
  newLocationName: string,
  newLocationType: string,
  newRegion: string,
  newLatitude: string,
  newLongitude: string,
  newLocationNotes: string
) {
  if (locationMode === "existing") {
    return (
      "/asset-management/field-installation" +
      `?clientId=${encodeURIComponent(
        clientId
      )}` +
      `&locationId=${encodeURIComponent(
        locationId
      )}` +
      "&mode=existing"
    );
  }

  return (
    "/asset-management/field-installation" +
    `?clientId=${encodeURIComponent(
      clientId
    )}` +
    "&mode=new" +
    "&reviewNew=yes" +
    `&newLocationName=${encodeURIComponent(
      newLocationName
    )}` +
    `&newLocationType=${encodeURIComponent(
      newLocationType
    )}` +
    `&newRegion=${encodeURIComponent(
      newRegion
    )}` +
    `&newLatitude=${encodeURIComponent(
      newLatitude
    )}` +
    `&newLongitude=${encodeURIComponent(
      newLongitude
    )}` +
    `&newNotes=${encodeURIComponent(
      newLocationNotes
    )}`
  );
}

export default async function InstallationDetailsPage({
  searchParams,
}: PageProps) {
  const projectTracker =
    await createProjectTrackerClient();

  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/asset-management/field-installation/details"
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

  const clientId = (
    parameters.clientId ?? ""
  ).trim();

  const locationMode = (
    parameters.locationMode ?? ""
  ).trim();

  const locationId = (
    parameters.locationId ?? ""
  ).trim();

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

  const newLocationNotes = (
    parameters.newLocationNotes ?? ""
  ).trim();

  const reviewRequested =
    parameters.review === "yes";

  const installationStatus = (
    parameters.installationStatus ??
    "Planned"
  ).trim();

  const installationDate = (
    parameters.installationDate ?? ""
  ).trim();

  const installationType = (
    parameters.installationType ?? ""
  ).trim();

  const crop = (
    parameters.crop ?? ""
  ).trim();

  const loggerId = (
    parameters.loggerId ?? ""
  ).trim();

  const loggerType = (
    parameters.loggerType ?? ""
  ).trim();

  const ftpId = (
    parameters.ftpId ?? ""
  ).trim();

  const simCard = (
    parameters.simCard ?? ""
  ).trim();

  const otherSensors = (
    parameters.otherSensors ?? ""
  ).trim();

  const installationNotes = (
    parameters.installationNotes ?? ""
  ).trim();

  if (
    !clientId ||
    (
      locationMode !== "existing" &&
      locationMode !== "new"
    )
  ) {
    return h(
      "main",
      {
        className:
          "min-h-screen bg-slate-100 px-3 py-5 sm:px-5",
      },
      h(
        "section",
        {
          className:
            "mx-auto max-w-4xl rounded-lg border border-amber-300 bg-white p-5 shadow-sm",
        },
        h(
          "p",
          {
            className:
              "text-xs font-semibold uppercase tracking-wide text-amber-700",
          },
          "Preview Workflow"
        ),
        h(
          "h1",
          {
            className:
              "mt-1 text-2xl font-bold text-slate-900",
          },
          "Client or Location Not Selected"
        ),
        h(
          "p",
          {
            className:
              "mt-2 text-sm text-slate-700",
          },
          "Return to Field Installation and select a client and location before entering installation details."
        ),
        h(
          "div",
          {
            className:
              "mt-4 flex flex-wrap gap-2",
          },
          navigationButton(
            "/asset-management/field-installation",
            "Return to Field Installation",
            true
          ),
          navigationButton(
            "/asset-management",
            "Asset Management Home"
          )
        )
      )
    );
  }

  const hardware = createHardwareClient();

  const clientResponse = await hardware
    .from("clients")
    .select(
      "client_id, client_name, contact_name, email, phone, address, status"
    )
    .eq("client_id", clientId)
    .maybeSingle();

  const selectedClient =
    clientResponse.data as
      | ClientRecord
      | null;

  let selectedLocation: LocationRecord | null =
    null;

  let locationError: string | null = null;

  if (
    locationMode === "existing" &&
    locationId
  ) {
    const response = await hardware
      .from("locations")
      .select(
        "location_id, client_id, location_name, location_type, region, latitude, longitude, status, verification_status"
      )
      .eq("location_id", locationId)
      .eq("client_id", clientId)
      .maybeSingle();

    selectedLocation =
      response.data as
        | LocationRecord
        | null;

    locationError =
      response.error?.message ?? null;
  }

  const proposedLatitude = parseCoordinate(
    newLatitudeText
  );

  const proposedLongitude = parseCoordinate(
    newLongitudeText
  );

  const validExistingLocation =
    locationMode === "existing" &&
    selectedLocation !== null;

  const validNewLocation =
    locationMode === "new" &&
    newLocationName.length > 0 &&
    (
      newLatitudeText.length === 0 ||
      proposedLatitude !== null
    ) &&
    (
      newLongitudeText.length === 0 ||
      proposedLongitude !== null
    ) &&
    (
      proposedLatitude === null ||
      (
        proposedLatitude >= -90 &&
        proposedLatitude <= 90
      )
    ) &&
    (
      proposedLongitude === null ||
      (
        proposedLongitude >= -180 &&
        proposedLongitude <= 180
      )
    );

  if (
    clientResponse.error ||
    !selectedClient ||
    locationError ||
    (
      !validExistingLocation &&
      !validNewLocation
    )
  ) {
    return h(
      "main",
      {
        className:
          "min-h-screen bg-slate-100 px-3 py-5 sm:px-5",
      },
      h(
        "section",
        {
          className:
            "mx-auto max-w-4xl rounded-lg border border-red-200 bg-white p-5 shadow-sm",
        },
        h(
          "p",
          {
            className:
              "text-xs font-semibold uppercase tracking-wide text-red-700",
          },
          "Preview Workflow"
        ),
        h(
          "h1",
          {
            className:
              "mt-1 text-2xl font-bold text-slate-900",
          },
          "Selected Records Could Not Be Loaded"
        ),
        h(
          "p",
          {
            className:
              "mt-2 text-sm text-slate-700",
          },
          "Return to Field Installation and select the client and location again."
        ),
        h(
          "div",
          {
            className:
              "mt-4 flex flex-wrap gap-2",
          },
          navigationButton(
            "/asset-management/field-installation",
            "Return to Field Installation",
            true
          ),
          navigationButton(
            "/asset-management",
            "Asset Management Home"
          )
        )
      )
    );
  }

  const confirmedClient =
    selectedClient as ClientRecord;

  const locationReturnUrl =
    buildLocationReturnUrl(
      clientId,
      locationMode,
      locationId,
      newLocationName,
      newLocationType,
      newRegion,
      newLatitudeText,
      newLongitudeText,
      newLocationNotes
    );

  const assetSelectionParameters = new URLSearchParams({
    clientId,
    locationMode,
    locationId,
    newLocationName,
    newLocationType,
    newRegion,
    newLatitude: newLatitudeText,
    newLongitude: newLongitudeText,
    newLocationNotes,
    installationStatus,
    installationDate,
    installationType,
    crop,
    loggerId,
    loggerType,
    ftpId,
    simCard,
    otherSensors,
    installationNotes,
  });
  const assetSelectionUrl =
    "/asset-management/field-installation/assets?" +
    assetSelectionParameters.toString();
  const locationName =
    locationMode === "existing"
      ? selectedLocation?.location_name ??
        "Not recorded"
      : newLocationName;

  const locationType =
    locationMode === "existing"
      ? selectedLocation?.location_type
      : newLocationType;

  const locationRegion =
    locationMode === "existing"
      ? selectedLocation?.region
      : newRegion;

  const locationCoordinates =
    locationMode === "existing"
      ? selectedLocation?.latitude !== null &&
        selectedLocation?.latitude !==
          undefined &&
        selectedLocation?.longitude !==
          null &&
        selectedLocation?.longitude !==
          undefined
        ? `${selectedLocation.latitude}, ${selectedLocation.longitude}`
        : "Not recorded"
      : newLatitudeText ||
          newLongitudeText
        ? `${displayValue(
            proposedLatitude
          )}, ${displayValue(
            proposedLongitude
          )}`
        : "Not recorded";

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const validationErrors: string[] = [];

  if (reviewRequested) {
    if (
      installationStatus !== "Planned" &&
      installationStatus !== "Completed"
    ) {
      validationErrors.push(
        "Installation status must be Planned or Completed."
      );
    }

    if (!installationDate) {
      validationErrors.push(
        "Installation date is required."
      );
    }

    if (
      installationStatus === "Completed" &&
      installationDate &&
      installationDate > today
    ) {
      validationErrors.push(
        "A completed installation cannot use a future date."
      );
    }
  }

  const reviewIsValid =
    reviewRequested &&
    validationErrors.length === 0;

  const hiddenValues: ReactNode[] = [
    hiddenInput("clientId", clientId),
    hiddenInput(
      "locationMode",
      locationMode
    ),
    hiddenInput("locationId", locationId),
    hiddenInput(
      "newLocationName",
      newLocationName
    ),
    hiddenInput(
      "newLocationType",
      newLocationType
    ),
    hiddenInput("newRegion", newRegion),
    hiddenInput(
      "newLatitude",
      newLatitudeText
    ),
    hiddenInput(
      "newLongitude",
      newLongitudeText
    ),
    hiddenInput(
      "newLocationNotes",
      newLocationNotes
    ),
    hiddenInput("review", "yes"),
  ];

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
                "text-xs font-semibold uppercase tracking-wide text-violet-700",
            },
            "Preview Workflow"
          ),
          h(
            "h1",
            {
              className:
                "mt-0.5 text-2xl font-bold text-slate-900",
            },
            "Installation Details"
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-sm text-slate-700",
            },
            "Step 3 of 5: Enter and review the proposed installation details."
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
            locationReturnUrl,
            "Back to Location"
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
          "The installation information is held in the page address for review only. No database records will be created or changed."
        )
      ),

      h(
        "section",
        {
          className:
            "grid gap-4 lg:grid-cols-2",
        },

        h(
          "article",
          {
            className:
              "rounded-lg border border-emerald-300 bg-white p-4 shadow-sm",
          },
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
              confirmedClient.client_id,
              confirmedClient.client_name
            )
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-xs text-slate-500",
            },
            `Client ID: ${confirmedClient.client_id}`
          ),
          h(
            "div",
            {
              className:
                "mt-3 grid gap-2 sm:grid-cols-2",
            },
            detailField(
              "Contact",
              displayValue(
                confirmedClient.contact_name
              )
            ),
            detailField(
              "Phone",
              displayValue(
                confirmedClient.phone
              )
            ),
            detailField(
              "Email",
              displayValue(
                confirmedClient.email
              )
            ),
            detailField(
              "Address",
              displayValue(
                confirmedClient.address
              )
            )
          )
        ),

        h(
          "article",
          {
            className:
              locationMode === "existing"
                ? "rounded-lg border border-blue-300 bg-white p-4 shadow-sm"
                : "rounded-lg border border-amber-300 bg-white p-4 shadow-sm",
          },
          h(
            "p",
            {
              className:
                locationMode === "existing"
                  ? "text-xs font-semibold uppercase tracking-wide text-blue-700"
                  : "text-xs font-semibold uppercase tracking-wide text-amber-700",
            },
            locationMode === "existing"
              ? "Selected Existing Location"
              : "Proposed New Location"
          ),
          h(
            "h2",
            {
              className:
                "mt-0.5 text-xl font-bold",
            },
            locationMode === "existing" &&
              selectedLocation
              ? locationLink(
                  selectedLocation.location_id,
                  selectedLocation.location_name
                )
              : locationName
          ),
          h(
            "div",
            {
              className:
                "mt-3 grid gap-2 sm:grid-cols-2",
            },
            detailField(
              "Location type",
              displayValue(locationType)
            ),
            detailField(
              "Region",
              displayValue(locationRegion)
            ),
            detailField(
              "Coordinates",
              locationCoordinates
            ),
            detailField(
              "Location source",
              locationMode === "existing"
                ? "Existing location"
                : "Proposed new location"
            )
          )
        )
      ),

      h(
        "section",
        {
          className:
            "mt-4 rounded-lg border border-violet-300 bg-white p-4 shadow-sm",
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
              "Create New Installation"
            ),
            h(
              "p",
              {
                className:
                  "mt-1 text-sm text-slate-600",
              },
              "Enter the installation information and review it before selecting assets."
            )
          ),
          h(
            "span",
            {
              className:
                "rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800",
            },
            "Preview only"
          )
        ),

        h(
          "form",
          {
            action:
              "/asset-management/field-installation/details",
            method: "get",
            className:
              "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
          },

          ...hiddenValues,

          selectInput(
            "Installation status",
            "installationStatus",
            installationStatus
          ),

          textInput(
            "Installation date",
            "installationDate",
            installationDate,
            "",
            true,
            "date"
          ),

          textInput(
            "Installation type",
            "installationType",
            installationType,
            "Standard, seasonal, temporary..."
          ),

          textInput(
            "Crop",
            "crop",
            crop,
            "Cherry, grape, apple..."
          ),

          textInput(
            "Logger ID",
            "loggerId",
            loggerId,
            "Logger identifier"
          ),

          textInput(
            "Logger type",
            "loggerType",
            loggerType,
            "Logger model or type"
          ),

          textInput(
            "FTP ID",
            "ftpId",
            ftpId,
            "FTP identifier"
          ),

          textInput(
            "SIM card",
            "simCard",
            simCard,
            "SIM identifier"
          ),

          textInput(
            "Other sensors",
            "otherSensors",
            otherSensors,
            "Optional additional sensors"
          ),

          h(
            "label",
            {
              className:
                "text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3",
            },
            "Installation notes",
            h("textarea", {
              name: "installationNotes",
              defaultValue:
                installationNotes,
              rows: 4,
              placeholder:
                "Optional installation notes",
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
                  "rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800",
              },
              "Review Installation Details"
            ),
            navigationButton(
              locationReturnUrl,
              "Back to Location"
            )
          )
        )
      ),

      validationErrors.length > 0
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
              "Review the installation details"
            ),
            h(
              "ul",
              {
                className:
                  "mt-2 list-disc space-y-1 pl-5",
              },
              ...validationErrors.map(
                (error) =>
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

      reviewIsValid
        ? h(
            "section",
            {
              className:
                "mt-4 rounded-lg border border-violet-300 bg-white p-4 shadow-sm",
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
                      "text-xs font-semibold uppercase tracking-wide text-violet-700",
                  },
                  "Installation Details Review"
                ),
                h(
                  "h2",
                  {
                    className:
                      "mt-0.5 text-xl font-bold",
                  },
                  installationStatus ===
                    "Completed"
                    ? "Completed Installation"
                    : "Planned Installation"
                ),
                h(
                  "p",
                  {
                    className:
                      "mt-1 text-sm text-slate-600",
                  },
                  `${confirmedClient.client_name} / ${locationName}`
                )
              ),
              h(
                "span",
                {
                  className:
                    installationStatus ===
                    "Completed"
                      ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800"
                      : "rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900",
                },
                installationStatus
              )
            ),

            h(
              "div",
              {
                className:
                  "mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4",
              },
              detailField(
                "Client",
                confirmedClient.client_name
              ),
              detailField(
                "Location",
                locationName
              ),
              detailField(
                "Location source",
                locationMode === "existing"
                  ? "Existing location"
                  : "Proposed new location"
              ),
              detailField(
                "Status",
                installationStatus
              ),
              detailField(
                "Installation date",
                formatDate(
                  installationDate
                )
              ),
              detailField(
                "Installation type",
                displayValue(
                  installationType
                )
              ),
              detailField(
                "Crop",
                displayValue(crop)
              ),
              detailField(
                "Logger ID",
                displayValue(loggerId)
              ),
              detailField(
                "Logger type",
                displayValue(loggerType)
              ),
              detailField(
                "FTP ID",
                displayValue(ftpId)
              ),
              detailField(
                "SIM card",
                displayValue(simCard)
              ),
              detailField(
                "Other sensors",
                displayValue(otherSensors)
              )
            ),

            installationNotes
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
                    "Installation notes"
                  ),
                  h(
                    "p",
                    {
                      className:
                        "mt-0.5 whitespace-pre-wrap text-sm text-slate-800",
                    },
                    installationNotes
                  )
                )
              : null,

            locationMode === "new"
              ? h(
                  "p",
                  {
                    className:
                      "mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900",
                  },
                  "The proposed location would need to be created before the installation. Nothing has been saved."
                )
              : null,

            h(
              "div",
              {
                className:
                  "mt-4 flex flex-wrap gap-2",
              },
              navigationButton(
                assetSelectionUrl,
                "Continue to Asset Selection",
                true
              ),
              navigationButton(
                locationReturnUrl,
                "Back to Location"
              )
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
          "Stage 3 reads the selected client and existing location where applicable. Installation details are previewed only. No Hardware Database records are created or changed."
        )
      )
    )
  );
}