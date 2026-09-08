import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/LogoutButton";

export const dynamic = "force-dynamic";

type HomeOption = {
  title: string;
  description: string;
  href: string;
  colour: "blue" | "emerald" | "amber" | "slate";
  status: string;
};

const options: HomeOption[] = [
  {
    title: "Stock Receipt / Create Product",
    description:
      "Receive stock, scan or enter equipment, and create products when required.",
    href: "/asset-management/stock-receipt",
    colour: "blue",
    status: "To be built",
  },
  {
    title: "Field Installation",
    description:
      "Create, move, replace, remove, close or retire field installations.",
    href: "/asset-management/field-installation",
    colour: "emerald",
    status: "To be built",
  },
  {
    title: "Search / Find",
    description:
      "Find clients, locations, installations, assets and current stock status.",
    href: "/asset-management/search",
    colour: "amber",
    status: "Next screen to build",
  },
  {
    title: "Admin",
    description:
      "Manage clients, locations, products, stock, installations and history.",
    href: "/asset-management/admin",
    colour: "slate",
    status: "To be built",
  },
];

function getCardClasses(colour: HomeOption["colour"]) {
  if (colour === "blue") {
    return {
      card: "border-blue-200 bg-blue-50 hover:border-blue-400",
      title: "text-blue-900",
      text: "text-blue-800",
      button:
        "bg-blue-700 text-white group-hover:bg-blue-800",
      status: "text-blue-700",
    };
  }

  if (colour === "emerald") {
    return {
      card:
        "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
      title: "text-emerald-900",
      text: "text-emerald-800",
      button:
        "bg-emerald-700 text-white group-hover:bg-emerald-800",
      status: "text-emerald-700",
    };
  }

  if (colour === "amber") {
    return {
      card:
        "border-amber-200 bg-amber-50 hover:border-amber-400",
      title: "text-amber-900",
      text: "text-amber-800",
      button:
        "bg-amber-700 text-white group-hover:bg-amber-800",
      status: "text-amber-700",
    };
  }

  return {
    card:
      "border-slate-300 bg-slate-50 hover:border-slate-500",
    title: "text-slate-900",
    text: "text-slate-700",
    button:
      "bg-slate-700 text-white group-hover:bg-slate-800",
    status: "text-slate-600",
  };
}

export default async function AssetManagementHome() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/asset-management");
  }

  const cards = options.map((option) => {
    const colours = getCardClasses(option.colour);

    return h(
      "a",
      {
        key: option.title,
        href: option.href,
        className:
          `group flex min-h-64 flex-col rounded-2xl border p-6 shadow-sm ` +
          `transition hover:-translate-y-1 hover:shadow-md ${colours.card}`,
      },
      h(
        "p",
        {
          className:
            `text-sm font-semibold uppercase tracking-wide ` +
            `${colours.status}`,
        },
        option.status
      ),
      h(
        "h2",
        {
          className:
            `mt-3 text-2xl font-bold ${colours.title}`,
        },
        option.title
      ),
      h(
        "p",
        {
          className:
            `mt-3 flex-1 leading-6 ${colours.text}`,
        },
        option.description
      ),
      h(
        "span",
        {
          className:
            `mt-6 inline-flex w-fit rounded-lg px-5 py-3 ` +
            `font-semibold transition ${colours.button}`,
        },
        "Open"
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
        className: "mx-auto max-w-6xl",
      },
      h(
        "header",
        {
          className:
            "mb-10 flex flex-wrap items-start justify-between gap-4",
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
            "Asset Management"
          ),
          h(
            "p",
            {
              className:
                "mt-2 text-sm text-slate-600",
            },
            `Signed in as ${user.email ?? ""}`
          ),
          h(
            "p",
            {
              className:
                "mt-3 max-w-2xl text-slate-700",
            },
            "Choose the task you want to complete."
          )
        ),
        h(
          "div",
          {
            className: "flex flex-wrap gap-3",
          },
          h(
            "a",
            {
              href: "/",
              className:
                "rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50",
            },
            "Systems Home"
          ),
          h(LogoutButton)
        )
      ),
      h(
        "section",
        {
          className: "grid gap-6 sm:grid-cols-2",
        },
        ...cards
      ),
      h(
        "section",
        {
          className:
            "mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        },
        h(
          "div",
          null,
          h(
            "h2",
            {
              className:
                "font-semibold text-slate-900",
            },
            "Hardware Database connection"
          ),
          h(
            "p",
            {
              className:
                "mt-1 text-sm text-slate-600",
            },
            "Use the connection test to confirm the current production totals."
          )
        ),
        h(
          "a",
          {
            href: "/asset-management/connection-test",
            className:
              "rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800",
          },
          "Open Connection Test"
        )
      )
    )
  );
}
``