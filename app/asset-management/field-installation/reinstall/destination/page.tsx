import { createElement as h } from "react";
import { redirect } from "next/navigation";

import { createHardwareClient } from "@/lib/hardware-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    stockItemId?: string;
    sourceInstallationId?: string;
    destinationLocationId?: string;
    idempotencyKey?: string;
  }>;
};

type AssetPosition = {
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

type Location = {
  location_id: string;
  client_id: string;
  location_name: string;
  location_type: string | null;
  region: string | null;
  status: string;
  verification_status: string;
};

function uuidIsValid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function allowedEmail(email: string) {
  return (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

function display(value: string | null | undefined) {
  return value && value.trim() ? value : "Not recorded";
}

function invalidState(message: string) {
  return h(
    "main",
    { className: "min-h-screen bg-slate-100 px-4 py-6" },
    h(
      "section",
      { className: "mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5 shadow-sm" },
      h("h1", { className: "text-xl font-bold text-red-800" }, "Re-installation cannot continue"),
      h("p", { className: "mt-2 text-sm text-slate-700" }, message),
      h("a", { href: "/asset-management/field-installation/reinstall", className: "mt-4 inline-flex rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white" }, "Start Again"),
    ),
  );
}

export default async function ReinstallationDestinationPage({ searchParams }: PageProps) {
  const projectTracker = await createProjectTrackerClient();
  const { data: { user } } = await projectTracker.auth.getUser();

  if (!user) {
    redirect("/login?next=/asset-management/field-installation/reinstall");
  }

  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email || !allowedEmail(email)) {
    return invalidState("The signed-in email is not approved for Hardware Database access.");
  }

  const parameters = await searchParams;
  const stockItemId = (parameters.stockItemId ?? "").trim();
  const sourceInstallationId = (parameters.sourceInstallationId ?? "").trim();
  const destinationLocationId = (parameters.destinationLocationId ?? "").trim();
  const idempotencyKey = (parameters.idempotencyKey ?? "").trim();

  if (
    !/^STK[0-9]{5}$/.test(stockItemId) ||
    !/^INS[0-9]{5}$/.test(sourceInstallationId) ||
    !uuidIsValid(idempotencyKey)
  ) {
    return invalidState("The retained workflow identifiers are missing or invalid.");
  }

  const hardware = createHardwareClient();
  const [positionResponse, assignmentResponse, installationResponse] = await Promise.all([
    hardware
      .from("vw_asset_current_position")
      .select("stock_item_id, product_description, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name")
      .eq("stock_item_id", stockItemId)
      .eq("installation_id", sourceInstallationId)
      .limit(2),
    hardware
      .from("installation_assets")
      .select("installation_asset_id, installation_id, stock_item_id, asset_role, asset_arrangement, assignment_status, removed_at")
      .eq("stock_item_id", stockItemId)
      .eq("assignment_status", "Active")
      .limit(2),
    hardware
      .from("installations")
      .select("installation_id, client_id, location_id, status")
      .eq("installation_id", sourceInstallationId)
      .maybeSingle(),
  ]);

  if (positionResponse.error || assignmentResponse.error || installationResponse.error) {
    return invalidState("The current source position could not be verified safely.");
  }

  const positions = (positionResponse.data as AssetPosition[] | null) ?? [];
  const assignments = (assignmentResponse.data as Assignment[] | null) ?? [];
  const sourceInstallation = installationResponse.data as Installation | null;

  if (positions.length !== 1 || assignments.length !== 1 || !sourceInstallation) {
    return invalidState("Exactly one current asset position, Active assignment and source installation are required.");
  }

  const position = positions[0];
  const assignment = assignments[0];
  const sourceIsValid =
    position.installation_id === sourceInstallationId &&
    assignment.installation_id === sourceInstallationId &&
    sourceInstallation.status === "Active" &&
    sourceInstallation.client_id === position.client_id &&
    sourceInstallation.location_id === position.location_id &&
    position.lifecycle_status === "Installed" &&
    position.status === "Active" &&
    position.warehouse === null &&
    assignment.removed_at === null &&
    assignment.asset_arrangement === position.asset_classification;

  if (!sourceIsValid || !sourceInstallation.client_id) {
    return invalidState("The source asset is no longer in an eligible and position-consistent Active installation.");
  }

  const sourceAssignmentsResponse = await hardware
    .from("installation_assets")
    .select("installation_asset_id, installation_id, stock_item_id, asset_role, asset_arrangement, assignment_status, removed_at")
    .eq("installation_id", sourceInstallationId)
    .eq("assignment_status", "Active")
    .order("stock_item_id");

  if (sourceAssignmentsResponse.error) {
    return invalidState("The complete set of Active source assignments could not be verified.");
  }

  const sourceAssignments =
    (sourceAssignmentsResponse.data as Assignment[] | null) ?? [];
  if (sourceAssignments.length < 1 || sourceAssignments.some((row) => row.removed_at !== null)) {
    return invalidState("The source installation has no complete set of eligible Active assignments.");
  }

  const sourceStockIds = sourceAssignments.map((row) => row.stock_item_id);
  const sourcePositionsResponse = await hardware
    .from("vw_asset_current_position")
    .select("stock_item_id, product_description, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name")
    .in("stock_item_id", sourceStockIds)
    .eq("installation_id", sourceInstallationId);

  if (sourcePositionsResponse.error) {
    return invalidState("The complete current source position could not be verified.");
  }

  const sourcePositions =
    (sourcePositionsResponse.data as AssetPosition[] | null) ?? [];
  const allSourceAssetsValid = sourceAssignments.every((sourceAssignment) => {
    const matches = sourcePositions.filter(
      (row) => row.stock_item_id === sourceAssignment.stock_item_id,
    );
    const sourcePosition = matches.length === 1 ? matches[0] : null;
    return Boolean(
      sourcePosition &&
      sourcePosition.installation_id === sourceInstallationId &&
      sourcePosition.client_id === sourceInstallation.client_id &&
      sourcePosition.location_id === sourceInstallation.location_id &&
      sourcePosition.lifecycle_status === "Installed" &&
      sourcePosition.status === "Active" &&
      sourcePosition.warehouse === null &&
      sourcePosition.asset_classification === sourceAssignment.asset_arrangement,
    );
  });

  if (!allSourceAssetsValid || sourcePositions.length !== sourceAssignments.length) {
    return invalidState("Not every Active source asset is eligible and position-consistent.");
  }

  const [locationsResponse, activeInstallationsResponse] = await Promise.all([
    hardware
      .from("locations")
      .select("location_id, client_id, location_name, location_type, region, status, verification_status")
      .eq("client_id", sourceInstallation.client_id)
      .eq("status", "Active")
      .order("location_name"),
    hardware
      .from("installations")
      .select("installation_id, client_id, location_id, status")
      .eq("client_id", sourceInstallation.client_id)
      .eq("status", "Active"),
  ]);

  if (locationsResponse.error || activeInstallationsResponse.error) {
    return invalidState("The destination locations could not be verified safely.");
  }

  const locations = (locationsResponse.data as Location[] | null) ?? [];
  const activeInstallations = (activeInstallationsResponse.data as Installation[] | null) ?? [];
  const eligibleLocations = locations.filter((location) =>
    location.location_id !== sourceInstallation.location_id &&
    !activeInstallations.some(
      (installation) => installation.location_id === location.location_id,
    ),
  );
  const selectedDestination = eligibleLocations.find(
    (location) => location.location_id === destinationLocationId,
  ) ?? null;

  const backUrl = `/asset-management/field-installation/reinstall?q=${encodeURIComponent(position.product_serial)}`;

  return h(
    "main",
    { className: "min-h-screen bg-slate-100 px-3 py-5 sm:px-5" },
    h(
      "div",
      { className: "mx-auto max-w-5xl" },
      h(
        "header",
        { className: "mb-5 flex flex-wrap items-start justify-between gap-3" },
        h("div", null,
          h("p", { className: "text-xs font-semibold uppercase tracking-wide text-violet-700" }, "Preview Workflow"),
          h("h1", { className: "mt-0.5 text-2xl font-bold text-slate-900" }, "Select Re-installation Destination"),
          h("p", { className: "mt-1 text-sm text-slate-700" }, "Step 2: Select an Active location belonging to the same client."),
        ),
        h("a", { href: backUrl, className: "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" }, "Back to Asset Search"),
      ),
      h("section", { className: "rounded-lg border border-violet-300 bg-white p-4 shadow-sm" },
        h("p", { className: "text-xs font-semibold uppercase tracking-wide text-violet-700" }, "Verified Source Asset"),
        h("h2", { className: "mt-1 text-xl font-bold text-slate-900" }, position.product_description),
        h("p", { className: "mt-1 text-base font-semibold text-violet-800" }, `Serial ${position.product_serial}`),
        h("div", { className: "mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2" },
          h("p", null, `Client: ${display(position.client_name)}`),
          h("p", null, `Current location: ${display(position.location_name)}`),
          h("p", null, `Matched role: ${display(assignment.asset_role)}`),
          h("p", null, `Matched arrangement: ${display(assignment.asset_arrangement)}`),
        ),
        h("div", { className: "mt-4 rounded-md border border-amber-200 bg-amber-50 p-3" },
          h("p", { className: "font-semibold text-amber-950" }, `${sourceAssignments.length} Active asset${sourceAssignments.length === 1 ? "" : "s"} will move with this installation`),
          h("p", { className: "mt-1 text-xs text-amber-900" }, "The proven bridge moves every Active assignment on the source installation, not only the serial used to find it."),
          h("ul", { className: "mt-2 space-y-2" }, ...sourceAssignments.map((sourceAssignment) => {
            const sourceAsset = sourcePositions.find((row) => row.stock_item_id === sourceAssignment.stock_item_id);
            return h("li", { key: sourceAssignment.installation_asset_id, className: "rounded bg-white px-3 py-2 text-sm text-slate-800" },
              h("span", { className: "font-semibold" }, sourceAsset?.product_description ?? "Product not recorded"),
              h("span", { className: "ml-2" }, `Serial ${sourceAsset?.product_serial ?? "Not recorded"}`),
              h("span", { className: "ml-2 text-slate-600" }, `${display(sourceAssignment.asset_role)} · ${display(sourceAssignment.asset_arrangement)}`),
            );
          })),
        ),
      ),
      h("section", { className: "mt-4 rounded-lg border border-violet-300 bg-violet-50 p-4" },
        h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
          h("div", null,
            h("h2", { className: "text-lg font-bold text-violet-950" }, "Moving to a new paddock or site?"),
            h("p", { className: "mt-1 text-sm text-violet-900" }, "Create and retain a proposed new location for Final Review. This Preview step does not write it to the database."),
          ),
          h("a", {
            href: "/asset-management/field-installation/reinstall/destination/new" +
              `?stockItemId=${encodeURIComponent(stockItemId)}` +
              `&sourceInstallationId=${encodeURIComponent(sourceInstallationId)}` +
              `&idempotencyKey=${encodeURIComponent(idempotencyKey)}`,
            className: "rounded-md bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800",
          }, "Create New Location"),
        ),
      ),
      h("section", { className: "mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" },
        h("div", { className: "bg-slate-800 px-4 py-3 text-white" }, h("h2", { className: "text-lg font-semibold" }, "Eligible Active Locations"), h("p", { className: "mt-0.5 text-xs text-slate-300" }, "The current source location and locations with an Active installation are excluded.")),
        eligibleLocations.length === 0
          ? h("p", { className: "p-4 text-sm text-slate-600" }, "No eligible destination location is currently available for this client.")
          : h("div", { className: "divide-y divide-slate-200" }, ...eligibleLocations.map((location) => {
              const selectUrl = "/asset-management/field-installation/reinstall/destination" +
                `?stockItemId=${encodeURIComponent(stockItemId)}` +
                `&sourceInstallationId=${encodeURIComponent(sourceInstallationId)}` +
                `&destinationLocationId=${encodeURIComponent(location.location_id)}` +
                `&idempotencyKey=${encodeURIComponent(idempotencyKey)}`;
              const selected = location.location_id === destinationLocationId;
              return h("article", { key: location.location_id, className: selected ? "bg-violet-50 p-4" : "p-4" },
                h("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                  h("div", null,
                    h("h3", { className: "text-base font-bold text-slate-900" }, location.location_name),
                    h("p", { className: "mt-1 text-sm text-slate-600" }, `${display(location.location_type)} · ${display(location.region)}`),
                    h("p", { className: "mt-1 text-xs text-slate-500" }, `Verification: ${display(location.verification_status)}`),
                  ),
                  selected
                    ? h("span", { className: "rounded-full bg-violet-700 px-3 py-1 text-xs font-semibold text-white" }, "Selected")
                    : h("a", { href: selectUrl, className: "rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800" }, "Select Location"),
                ),
              );
            })),
      ),
      selectedDestination
        ? h("section", { className: "mt-4 rounded-lg border border-violet-300 bg-violet-50 p-4 text-sm text-violet-950" },
            h("p", { className: "font-semibold" }, `Selected destination: ${selectedDestination.location_name}`),
            h("p", { className: "mt-1" }, "The source, destination, grouped assets and workflow key will be revalidated on the details screen."),
            h("a", {
              href: "/asset-management/field-installation/reinstall/details" +
                `?stockItemId=${encodeURIComponent(stockItemId)}` +
                `&sourceInstallationId=${encodeURIComponent(sourceInstallationId)}` +
                `&destinationLocationId=${encodeURIComponent(selectedDestination.location_id)}` +
                `&idempotencyKey=${encodeURIComponent(idempotencyKey)}`,
              className: "mt-3 inline-flex rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800",
            }, "Continue to Re-installation Details"),
          )
        : null,
      h("section", { className: "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900" }, h("p", { className: "font-semibold" }, "Read-only Preview step"), h("p", { className: "mt-0.5" }, "This screen performs SELECT queries only. It does not call the re-installation bridge or change installations, assignments, stock items, events, workflow rows or identity claims.")),
    ),
  );
}
