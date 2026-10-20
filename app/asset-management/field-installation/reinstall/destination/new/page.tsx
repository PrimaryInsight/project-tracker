import { createElement as h } from "react";
import { redirect } from "next/navigation";

import { createHardwareProductionClient } from "@/lib/hardware-production-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import NewLocationForm from "./new-location-form";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Params> };

type Position = {
  stock_item_id: string;
  product_description: string;
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
};

type Assignment = {
  installation_asset_id: string;
  installation_id: string;
  stock_item_id: string;
  asset_role: string | null;
  asset_arrangement: string | null;
  assignment_status: string;
  removed_at: string | null;
};

type Installation = {
  installation_id: string;
  client_id: string;
  location_id: string;
  status: string;
};

function value(params: Params, name: string) {
  const raw = params[name];
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
}

function uuidIsValid(valueToCheck: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valueToCheck,
  );
}

function allowedEmail(email: string) {
  return (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

function shown(text: string | null | undefined) {
  return text && text.trim() ? text : "Not recorded";
}

function invalidState(message: string) {
  return h(
    "main",
    { className: "min-h-screen bg-slate-100 px-4 py-6" },
    h(
      "section",
      { className: "mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5 shadow-sm" },
      h("h1", { className: "text-xl font-bold text-red-800" }, "New location cannot continue"),
      h("p", { className: "mt-2 text-sm text-slate-700" }, message),
      h("a", { href: "/asset-management/field-installation/reinstall", className: "mt-4 inline-flex rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white" }, "Start Again"),
    ),
  );
}

export default async function NewLocationPage({ searchParams }: Props) {
  const projectTracker = await createProjectTrackerClient();
  const { data: { user } } = await projectTracker.auth.getUser();
  if (!user) redirect("/login?next=/asset-management/field-installation/reinstall/destination/new");

  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email || !allowedEmail(email)) return invalidState("The signed-in email is not approved for Hardware Database access.");

  const params = await searchParams;
  const stockItemId = value(params, "stockItemId");
  const sourceInstallationId = value(params, "sourceInstallationId");
  const idempotencyKey = value(params, "idempotencyKey");

  if (!/^STK[0-9]{5}$/.test(stockItemId) || !/^INS[0-9]{5}$/.test(sourceInstallationId) || !uuidIsValid(idempotencyKey)) {
    return invalidState("The retained workflow identifiers are missing or invalid.");
  }

  const hardware = createHardwareProductionClient();
  const [positionResponse, selectedAssignmentResponse, installationResponse] = await Promise.all([
    hardware.from("vw_asset_current_position").select("stock_item_id, product_description, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name").eq("stock_item_id", stockItemId).eq("installation_id", sourceInstallationId).limit(2),
    hardware.from("installation_assets").select("installation_asset_id, installation_id, stock_item_id, asset_role, asset_arrangement, assignment_status, removed_at").eq("stock_item_id", stockItemId).eq("assignment_status", "Active").limit(2),
    hardware.from("installations").select("installation_id, client_id, location_id, status").eq("installation_id", sourceInstallationId).maybeSingle(),
  ]);

  if (positionResponse.error || selectedAssignmentResponse.error || installationResponse.error) {
    return invalidState("The retained source installation could not be revalidated safely.");
  }

  const positions = (positionResponse.data as Position[] | null) ?? [];
  const selectedAssignments = (selectedAssignmentResponse.data as Assignment[] | null) ?? [];
  const sourceInstallation = installationResponse.data as Installation | null;

  if (positions.length !== 1 || selectedAssignments.length !== 1 || !sourceInstallation) {
    return invalidState("The source installation is no longer uniquely valid.");
  }

  const position = positions[0];
  const selectedAssignment = selectedAssignments[0];
  const sourceValid =
    sourceInstallation.status === "Active" &&
    position.status === "Active" &&
    position.lifecycle_status === "Installed" &&
    position.warehouse === null &&
    position.installation_id === sourceInstallationId &&
    position.client_id === sourceInstallation.client_id &&
    position.location_id === sourceInstallation.location_id &&
    selectedAssignment.installation_id === sourceInstallationId &&
    selectedAssignment.removed_at === null &&
    selectedAssignment.asset_arrangement === position.asset_classification;

  if (!sourceValid) return invalidState("The source installation is no longer eligible.");

  const sourceAssignmentsResponse = await hardware
    .from("installation_assets")
    .select("installation_asset_id, installation_id, stock_item_id, asset_role, asset_arrangement, assignment_status, removed_at")
    .eq("installation_id", sourceInstallationId)
    .eq("assignment_status", "Active")
    .order("stock_item_id");

  if (sourceAssignmentsResponse.error) return invalidState("The grouped source assets could not be verified.");
  const sourceAssignments = (sourceAssignmentsResponse.data as Assignment[] | null) ?? [];
  if (!sourceAssignments.length || sourceAssignments.some((item) => item.removed_at !== null)) {
    return invalidState("The grouped source assets changed after selection.");
  }

  const newLocationName = value(params, "newLocationName");
  const newLocationRegion = value(params, "newLocationRegion") || "Canterbury";
  const newLocationNotes = value(params, "newLocationNotes");
  const locationSaved = value(params, "locationSaved") === "1";
  const locationValid = Boolean(
    newLocationName &&
    newLocationName.length <= 200 &&
    newLocationRegion.length <= 120 &&
    newLocationNotes.length <= 1000,
  );

  const baseQuery =
    `stockItemId=${encodeURIComponent(stockItemId)}` +
    `&sourceInstallationId=${encodeURIComponent(sourceInstallationId)}` +
    `&idempotencyKey=${encodeURIComponent(idempotencyKey)}`;
  const backUrl = `/asset-management/field-installation/reinstall/destination?${baseQuery}`;
  const detailsUrl =
    `/asset-management/field-installation/reinstall/details?${baseQuery}` +
    `&destinationMode=new` +
    `&newLocationName=${encodeURIComponent(newLocationName)}` +
    `&newLocationRegion=${encodeURIComponent(newLocationRegion)}` +
    `&newLocationNotes=${encodeURIComponent(newLocationNotes)}`;

  return h(
    "main",
    { className: "min-h-screen bg-slate-100 px-3 py-4 sm:px-5" },
    h(
      "div",
      { className: "mx-auto max-w-5xl" },
      h("header", { className: "mb-4 flex flex-wrap items-start justify-between gap-3" },
        h("div", null,
          h("p", { className: "text-xs font-semibold uppercase tracking-wide text-violet-700" }, "Preview Workflow"),
          h("h1", { className: "text-2xl font-bold text-slate-900" }, "Create New Destination Location"),
          h("p", { className: "mt-1 text-sm text-slate-700" }, "Step 2B: Retain a proposed location for this re-installation."),
        ),
        h("a", { href: backUrl, className: "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold" }, "Back to Destinations"),
      ),
      h("section", { className: "grid gap-3 sm:grid-cols-2" },
        h("div", { className: "rounded-lg border border-violet-300 bg-white p-3" },
          h("p", { className: "text-xs font-semibold uppercase text-violet-700" }, "Fixed Client"),
          h("p", { className: "mt-1 font-bold text-slate-900" }, shown(position.client_name)),
        ),
        h("div", { className: "rounded-lg border border-slate-200 bg-white p-3" },
          h("p", { className: "text-xs font-semibold uppercase text-slate-500" }, "Controlled Defaults"),
          h("p", { className: "mt-1 text-sm text-slate-800" }, "Site · Active · Provisional"),
        ),
      ),
      h(NewLocationForm, {
        stockItemId,
        sourceInstallationId,
        idempotencyKey,
        initialName: newLocationName,
        initialRegion: newLocationRegion,
        initialNotes: newLocationNotes,
      }),
      locationSaved
        ? h("section", { className: locationValid ? "mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3" : "mt-3 rounded-lg border border-red-300 bg-red-50 p-3" },
            h("h2", { className: "font-bold" }, locationValid ? "Proposed location retained" : "Location details need correction"),
            h("p", { className: "mt-1 text-sm" }, locationValid ? "The values are retained in the URL and in a browser draft. No location has been created in the database." : "Enter a location name and save again."),
            locationValid ? h("a", { href: detailsUrl, className: "mt-2 inline-flex rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white" }, "Continue to Re-installation Details") : null,
          )
        : null,
      h("section", { className: "mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900" },
        h("span", { className: "font-semibold" }, "Read-only Preview: "),
        "No location is created and neither database is changed.",
      ),
    ),
  );
}
