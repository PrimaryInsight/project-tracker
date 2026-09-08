import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type CountResult = {
  tableName: string;
  label: string;
  expected: number;
  actual: number | null;
  errorMessage: string | null;
};

async function getCount(
  tableName: string,
  label: string,
  expected: number
): Promise<CountResult> {
  const hardware = createHardwareClient();

  const { count, error } = await hardware
    .from(tableName)
    .select("*", {
      count: "exact",
      head: true,
    });

  return {
    tableName,
    label,
    expected,
    actual: count,
    errorMessage: error?.message ?? null,
  };
}

export default async function HardwareConnectionTestPage() {
  const projectTracker = await createProjectTrackerClient();

  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  if (!user) {
    redirect("/login?next=/asset-management/connection-test");
  }

  const allowedEmails = (
    process.env.HARDWARE_ALLOWED_EMAILS ?? ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const signedInEmail = user.email?.toLowerCase() ?? "";

  if (
    !signedInEmail ||
    !allowedEmails.includes(signedInEmail)
  ) {
    return h(
      "main",
      {
        className: "min-h-screen bg-slate-100 px-6 py-10",
      },
      h(
        "div",
        {
          className: "mx-auto max-w-3xl",
        },
        h(
          "section",
          {
            className:
              "rounded-xl border border-red-200 bg-white p-8 shadow-sm",
          },
          h(
            "h1",
            {
              className: "text-2xl font-bold text-red-800",
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
          h(
            "a",
            {
              href: "/asset-management",
              className:
                "mt-6 inline-flex rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white",
            },
            "Return to Asset Management"
          )
        )
      )
    );
  }

  const results = await Promise.all([
    getCount("clients", "Clients", 131),
    getCount("locations", "Locations", 399),
    getCount("products", "Products", 49),
    getCount("stock_items", "Stock items", 791),
    getCount(
      "installations",
      "Installations",
      372
    ),
    getCount(
      "installation_assets",
      "Installation assets",
      661
    ),
    getCount("asset_events", "Asset events", 0),
  ]);

  const queryErrors = results.some(
    (result) => result.errorMessage !== null
  );

  const countsMatch = results.every(
    (result) =>
      result.errorMessage === null &&
      result.actual === result.expected
  );

  const overallMessage = queryErrors
    ? "The connection reached Hardware Database, but one or more table queries failed."
    : countsMatch
      ? "Hardware Database connection successful. All production counts match."
      : "Hardware Database connection successful. One or more counts have changed and should be reviewed.";

  const overallClasses = queryErrors
    ? "border-red-200 bg-red-50 text-red-900"
    : countsMatch
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  const rows = results.map((result) => {
    const status = result.errorMessage
      ? "Error"
      : result.actual === result.expected
        ? "Match"
        : "Review";

    const statusClasses = result.errorMessage
      ? "font-semibold text-red-700"
      : result.actual === result.expected
        ? "font-semibold text-emerald-700"
        : "font-semibold text-amber-700";

    return h(
      "tr",
      {
        key: result.tableName,
        className: "border-t border-slate-200",
      },
      h(
        "td",
        {
          className: "px-4 py-3 font-medium text-slate-900",
        },
        result.label
      ),
      h(
        "td",
        {
          className: "px-4 py-3 text-right",
        },
        result.expected.toLocaleString()
      ),
      h(
        "td",
        {
          className: "px-4 py-3 text-right",
        },
        result.actual === null
          ? "Not returned"
          : result.actual.toLocaleString()
      ),
      h(
        "td",
        {
          className: `px-4 py-3 text-right ${statusClasses}`,
        },
        status
      ),
      h(
        "td",
        {
          className: "px-4 py-3 text-sm text-red-700",
        },
        result.errorMessage ?? ""
      )
    );
  });

  return h(
    "main",
    {
      className:
        "min-h-screen bg-slate-100 px-4 py-8 sm:px-6",
    },
    h(
      "div",
      {
        className: "mx-auto max-w-5xl",
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
            "h1",
            {
              className:
                "text-3xl font-bold text-slate-900",
            },
            "Hardware Database Connection Test"
          ),
          h(
            "p",
            {
              className:
                "mt-2 text-sm text-slate-600",
            },
            `Signed in as ${user.email ?? ""}`
          )
        ),
        h(
          "a",
          {
            href: "/asset-management",
            className:
              "rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white",
          },
          "Return to Asset Management"
        )
      ),
      h(
        "div",
        {
          className:
            `mb-6 rounded-xl border p-5 ${overallClasses}`,
        },
        h(
          "p",
          {
            className: "font-semibold",
          },
          overallMessage
        ),
        h(
          "p",
          {
            className: "mt-2 text-sm",
          },
          "This page performs count-only read queries. No records are inserted, edited or deleted."
        )
      ),
      h(
        "section",
        {
          className:
            "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        },
        h(
          "div",
          {
            className: "overflow-x-auto",
          },
          h(
            "table",
            {
              className:
                "min-w-full border-collapse",
            },
            h(
              "thead",
              {
                className:
                  "bg-slate-800 text-white",
              },
              h(
                "tr",
                null,
                h(
                  "th",
                  {
                    className:
                      "px-4 py-3 text-left",
                  },
                  "Table"
                ),
                h(
                  "th",
                  {
                    className:
                      "px-4 py-3 text-right",
                  },
                  "Expected"
                ),
                h(
                  "th",
                  {
                    className:
                      "px-4 py-3 text-right",
                  },
                  "Actual"
                ),
                h(
                  "th",
                  {
                    className:
                      "px-4 py-3 text-right",
                  },
                  "Status"
                ),
                h(
                  "th",
                  {
                    className:
                      "px-4 py-3 text-left",
                  },
                  "Error"
                )
              )
            ),
            h("tbody", null, ...rows)
          )
        )
      ),
      h(
        "p",
        {
          className:
            "mt-5 text-sm text-slate-500",
        },
        "Expected counts are from the last reconciled production save point. A different count may be legitimate if authorised records have since been added."
      )
    )
  );
}