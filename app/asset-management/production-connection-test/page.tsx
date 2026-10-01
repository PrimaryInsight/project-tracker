import { createElement as h } from "react";
import { redirect } from "next/navigation";

import { createHardwareProductionClient } from "@/lib/hardware-production-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CheckResult = {
  label: string;
  expected: string;
  actual: string;
  passed: boolean;
  errorMessage: string | null;
};

const PROJECT_TRACKER_USER_ID =
  "c28dae03-2123-4f5b-9ccb-c2b224b2814a";
const HARDWARE_PRODUCTION_USER_ID =
  "179f69dd-9203-4428-924d-1ee2c6d36de3";
const OFFICE_EMAIL = "office@primaryinsight.co.nz";

export default async function HardwareProductionConnectionTestPage() {
  const projectTracker = await createProjectTrackerClient();
  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/asset-management/production-connection-test",
    );
  }

  const allowedEmails = (
    process.env.HARDWARE_ALLOWED_EMAILS ?? ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const signedInEmail = user.email?.trim().toLowerCase() ?? "";

  if (
    user.id !== PROJECT_TRACKER_USER_ID ||
    signedInEmail !== OFFICE_EMAIL ||
    !allowedEmails.includes(signedInEmail)
  ) {
    return h(
      "main",
      { className: "min-h-screen bg-slate-100 px-6 py-10" },
      h(
        "section",
        {
          className:
            "mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-8 shadow-sm",
        },
        h(
          "h1",
          { className: "text-2xl font-bold text-red-800" },
          "Production connection test access denied",
        ),
        h(
          "p",
          { className: "mt-3 text-slate-700" },
          "The signed-in Project Tracker identity is not the approved production test identity.",
        ),
      ),
    );
  }

  const hardware = createHardwareProductionClient();

  const [stockResult, idempotencyResult, mappingResult] =
    await Promise.all([
      hardware
        .from("stock_items")
        .select("*", { count: "exact", head: true }),
      hardware
        .from("workflow_idempotency")
        .select("*", { count: "exact", head: true })
        .eq("workflow_name", "receive_stock_item"),
      hardware
        .from("external_staff_identity_map")
        .select(
          "identity_source,external_user_id,external_email,hardware_user_id,active",
        )
        .eq("identity_source", "project_tracker")
        .eq("external_user_id", PROJECT_TRACKER_USER_ID)
        .eq("external_email", OFFICE_EMAIL)
        .eq("hardware_user_id", HARDWARE_PRODUCTION_USER_ID)
        .eq("active", true)
        .maybeSingle(),
    ]);

  const checks: CheckResult[] = [
    {
      label: "Production stock items",
      expected: "791",
      actual:
        stockResult.error || stockResult.count === null
          ? "Not returned"
          : String(stockResult.count),
      passed:
        !stockResult.error && stockResult.count === 791,
      errorMessage: stockResult.error?.message ?? null,
    },
    {
      label: "Receive Stock idempotency rows",
      expected: "0",
      actual:
        idempotencyResult.error || idempotencyResult.count === null
          ? "Not returned"
          : String(idempotencyResult.count),
      passed:
        !idempotencyResult.error && idempotencyResult.count === 0,
      errorMessage: idempotencyResult.error?.message ?? null,
    },
    {
      label: "Verified office identity mapping",
      expected: "Exact active mapping",
      actual: mappingResult.error
        ? "Not returned"
        : mappingResult.data
          ? "Exact active mapping"
          : "Missing",
      passed:
        !mappingResult.error && mappingResult.data !== null,
      errorMessage: mappingResult.error?.message ?? null,
    },
  ];

  const allPassed = checks.every((check) => check.passed);

  const rows = checks.map((check) =>
    h(
      "tr",
      { key: check.label, className: "border-t border-slate-200" },
      h(
        "td",
        { className: "px-4 py-3 font-medium text-slate-900" },
        check.label,
      ),
      h(
        "td",
        { className: "px-4 py-3 text-slate-700" },
        check.expected,
      ),
      h(
        "td",
        { className: "px-4 py-3 text-slate-700" },
        check.actual,
      ),
      h(
        "td",
        {
          className: check.passed
            ? "px-4 py-3 font-semibold text-emerald-700"
            : "px-4 py-3 font-semibold text-red-700",
        },
        check.passed ? "Passed" : "Stopped",
      ),
      h(
        "td",
        { className: "px-4 py-3 text-sm text-red-700" },
        check.errorMessage ?? "",
      ),
    ),
  );

  return h(
    "main",
    { className: "min-h-screen bg-slate-100 px-4 py-8 sm:px-6" },
    h(
      "div",
      { className: "mx-auto max-w-5xl" },
      h(
        "header",
        { className: "mb-8" },
        h(
          "p",
          {
            className:
              "mb-2 font-semibold uppercase tracking-wide text-red-700",
          },
          "Production, read-only",
        ),
        h(
          "h1",
          { className: "text-3xl font-bold text-slate-900" },
          "Hardware Production Connection Test",
        ),
        h(
          "p",
          { className: "mt-2 text-sm text-slate-600" },
          `Signed in as ${user.email ?? ""}`,
        ),
      ),
      h(
        "section",
        {
          className: allPassed
            ? "mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"
            : "mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900",
        },
        h(
          "p",
          { className: "font-semibold" },
          allPassed
            ? "The explicit server-only Hardware Production connection passed all checks."
            : "The Production connection test stopped because one or more checks did not match.",
        ),
        h(
          "p",
          { className: "mt-2 text-sm" },
          "This page performs read-only queries. It does not call the receipt bridge and cannot insert, edit or delete stock records.",
        ),
      ),
      h(
        "section",
        {
          className:
            "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        },
        h(
          "div",
          { className: "overflow-x-auto" },
          h(
            "table",
            { className: "min-w-full border-collapse" },
            h(
              "thead",
              { className: "bg-slate-800 text-white" },
              h(
                "tr",
                null,
                h("th", { className: "px-4 py-3 text-left" }, "Check"),
                h("th", { className: "px-4 py-3 text-left" }, "Expected"),
                h("th", { className: "px-4 py-3 text-left" }, "Actual"),
                h("th", { className: "px-4 py-3 text-left" }, "Status"),
                h("th", { className: "px-4 py-3 text-left" }, "Error"),
              ),
            ),
            h("tbody", null, ...rows),
          ),
        ),
      ),
      h(
        "a",
        {
          href: "/asset-management",
          className:
            "mt-6 inline-flex rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white",
        },
        "Return to Asset Management",
      ),
    ),
  );
}
