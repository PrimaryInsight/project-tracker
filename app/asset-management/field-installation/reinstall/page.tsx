import { randomUUID } from "node:crypto";
import { createElement as h } from "react";
import { redirect } from "next/navigation";

import { createHardwareClient } from "@/lib/hardware-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
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

type ActiveAssignment = {
  installation_asset_id: string;
  installation_id: string;
  stock_item_id: string;
  asset_role: string | null;
  asset_arrangement: string | null;
  assignment_status: string;
  removed_at: string | null;
};

function allowedEmail(email: string) {
  return (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

function cleanSearch(value: string) {
  return value.replaceAll(",", " ").replaceAll("(", " ").replaceAll(")", " ").trim();
}

function display(value: string | null | undefined) {
  return value && value.trim() ? value : "Not recorded";
}

export default async function ReinstallationStartPage({ searchParams }: PageProps) {
  const projectTracker = await createProjectTrackerClient();
  const { data: { user } } = await projectTracker.auth.getUser();

  if (!user) {
    redirect("/login?next=/asset-management/field-installation/reinstall");
  }

  const signedInEmail = user.email?.trim().toLowerCase() ?? "";
  if (!signedInEmail || !allowedEmail(signedInEmail)) {
    return h(
      "main",
      { className: "min-h-screen bg-slate-100 px-4 py-6" },
      h(
        "section",
        { className: "mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5 shadow-sm" },
        h("h1", { className: "text-xl font-bold text-red-800" }, "Hardware Database access denied"),
        h("p", { className: "mt-2 text-sm text-slate-700" }, "The signed-in email is not in the approved Hardware Database staff list."),
      ),
    );
  }

  const parameters = await searchParams;
  const searchText = (parameters.q ?? "").trim();
  const safeSearchText = cleanSearch(searchText);
  const hardware = createHardwareClient();
  const errors: string[] = [];
  let positions: AssetPosition[] = [];
  let assignments: ActiveAssignment[] = [];

  if (safeSearchText.length >= 2) {
    const positionResponse = await hardware
      .from("vw_asset_current_position")
      .select("stock_item_id, product_description, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name")
      .ilike("product_serial", `%${safeSearchText}%`)
      .order("product_serial")
      .limit(25);

    if (positionResponse.error) {
      errors.push(`Asset search: ${positionResponse.error.message}`);
    } else {
      positions = (positionResponse.data as AssetPosition[] | null) ?? [];
    }

    const stockItemIds = [...new Set(positions.map((row) => row.stock_item_id))];
    if (stockItemIds.length > 0) {
      const assignmentResponse = await hardware
        .from("installation_assets")
        .select("installation_asset_id, installation_id, stock_item_id, asset_role, asset_arrangement, assignment_status, removed_at")
        .in("stock_item_id", stockItemIds)
        .eq("assignment_status", "Active");

      if (assignmentResponse.error) {
        errors.push(`Active assignment check: ${assignmentResponse.error.message}`);
      } else {
        assignments = (assignmentResponse.data as ActiveAssignment[] | null) ?? [];
      }
    }
  }

  const eligible = positions
    .filter((position) => {
      const matchingAssignments = assignments.filter(
        (assignment) => assignment.stock_item_id === position.stock_item_id,
      );
      if (matchingAssignments.length !== 1) return true;
      return matchingAssignments[0].installation_id === position.installation_id;
    })
    .map((position) => {
      const matchingAssignments = assignments.filter(
        (assignment) => assignment.stock_item_id === position.stock_item_id,
      );
      const assignment = matchingAssignments.length === 1 ? matchingAssignments[0] : null;
      const isEligible =
        position.lifecycle_status === "Installed" &&
        position.status === "Active" &&
        position.warehouse === null &&
        Boolean(position.installation_id) &&
        Boolean(position.client_id) &&
        Boolean(position.location_id) &&
        assignment !== null &&
        assignment.removed_at === null &&
        assignment.installation_id === position.installation_id &&
        assignment.asset_arrangement === position.asset_classification;

      return { position, assignment, isEligible };
    })
    .sort((left, right) => {
      const leftExact = left.position.product_serial.toLowerCase() === safeSearchText.toLowerCase();
      const rightExact = right.position.product_serial.toLowerCase() === safeSearchText.toLowerCase();
      return Number(rightExact) - Number(leftExact);
    });

  return h(
    "main",
    { className: "min-h-screen bg-slate-100 px-3 py-5 sm:px-5" },
    h(
      "div",
      { className: "mx-auto max-w-5xl" },
      h(
        "header",
        { className: "mb-5 flex flex-wrap items-start justify-between gap-3" },
        h(
          "div",
          null,
          h("p", { className: "text-xs font-semibold uppercase tracking-wide text-violet-700" }, "Preview Workflow"),
          h("h1", { className: "mt-0.5 text-2xl font-bold text-slate-900" }, "Re-install Current Assets"),
          h("p", { className: "mt-1 text-sm text-slate-700" }, "Step 1: Find an installed asset by serial number to identify its current installation."),
        ),
        h("a", { href: "/asset-management/field-installation", className: "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" }, "Back to Field Installation"),
      ),
      h(
        "section",
        { className: "rounded-lg border border-slate-200 bg-white p-4 shadow-sm" },
        h("form", { action: "/asset-management/field-installation/reinstall", method: "get", className: "flex flex-col gap-2 sm:flex-row" },
          h("input", { type: "search", name: "q", defaultValue: searchText, minLength: 2, required: true, autoFocus: true, placeholder: "Enter the asset serial number...", className: "min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900" }),
          h("button", { type: "submit", className: "rounded-md bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800" }, "Find Asset"),
          h("a", { href: "/asset-management/field-installation/reinstall", className: "rounded-md border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" }, "Clear"),
        ),
        h("p", { className: "mt-2 text-xs text-slate-500" }, "Product description and serial number are shown for verification. Internal record IDs remain hidden from the operator view."),
      ),
      errors.length > 0
        ? h("section", { className: "mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900" }, h("p", { className: "font-semibold" }, "The asset search could not be completed"), h("ul", { className: "mt-2 list-disc pl-5" }, ...errors.map((error) => h("li", { key: error }, error))))
        : null,
      safeSearchText.length >= 2
        ? h(
            "section",
            { className: "mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" },
            h("div", { className: "bg-slate-800 px-4 py-3 text-white" }, h("h2", { className: "text-lg font-semibold" }, `Serial results for “${safeSearchText}”`)),
            eligible.length === 0
              ? h("p", { className: "p-4 text-sm text-slate-600" }, "No matching asset serial was found.")
              : h("div", { className: "divide-y divide-slate-200" }, ...eligible.map(({ position, assignment, isEligible }) => {
                  const workflowKey = randomUUID();
                  const destinationUrl = assignment
                    ? "/asset-management/field-installation/reinstall/destination" +
                      `?stockItemId=${encodeURIComponent(position.stock_item_id)}` +
                      `&sourceInstallationId=${encodeURIComponent(assignment.installation_id)}` +
                      `&idempotencyKey=${encodeURIComponent(workflowKey)}`
                    : "";
                  return h(
                    "article",
                    { key: position.stock_item_id, className: "p-4" },
                    h("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                      h("div", null,
                        h("h3", { className: "text-lg font-bold text-slate-900" }, position.product_description),
                        h("p", { className: "mt-1 text-base font-semibold text-violet-800" }, `Serial ${position.product_serial}`),
                      ),
                      h("span", { className: isEligible ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900" }, isEligible ? "Eligible" : "Review required"),
                    ),
                    h("div", { className: "mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2" },
                      h("p", null, `Current client: ${display(position.client_name)}`),
                      h("p", null, `Current location: ${display(position.location_name)}`),
                      h("p", null, `Role: ${display(assignment?.asset_role)}`),
                      h("p", null, `Arrangement: ${display(assignment?.asset_arrangement)}`),
                    ),
                    isEligible
                      ? h("a", { href: destinationUrl, className: "mt-4 inline-flex rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800" }, "Use This Installation")
                      : h("p", { className: "mt-3 text-sm text-amber-900" }, "This record is not in one clear Installed, Active and position-consistent assignment. No re-installation can be started from this result."),
                  );
                })),
          )
        : null,
      h("section", { className: "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900" }, h("p", { className: "font-semibold" }, "Read-only Preview step"), h("p", { className: "mt-0.5" }, "This screen performs SELECT queries only. It does not call the re-installation bridge or change Hardware Database records.")),
    ),
  );
}
