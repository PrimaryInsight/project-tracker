import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StockOption = {
  title: string;
  description: string;
  href: string;
  colour: "blue" | "amber";
  status: string;
};

const options: StockOption[] = [
  {
    title: "Receive New Stock",
    description:
      "Find an existing active product, then enter one or more new stock items for final review before receipt.",
    href: "/asset-management/stock/receive",
    colour: "blue",
    status: "Next workflow to build",
  },
  {
    title: "Search Existing Stock",
    description:
      "Search existing stock items by stock ID, product, serial number, warehouse or current position.",
    href: "/asset-management/stock/search",
    colour: "amber",
    status: "Available",
  },
];

function getCardClasses(colour: StockOption["colour"]) {
  if (colour === "blue") {
    return {
      card: "border-blue-200 bg-blue-50 hover:border-blue-400",
      title: "text-blue-900",
      text: "text-blue-800",
      button: "bg-blue-700 text-white group-hover:bg-blue-800",
      status: "text-blue-700",
    };
  }

  return {
    card: "border-amber-200 bg-amber-50 hover:border-amber-400",
    title: "text-amber-900",
    text: "text-amber-800",
    button: "bg-amber-700 text-white group-hover:bg-amber-800",
    status: "text-amber-700",
  };
}

export default async function StockHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/asset-management/stock");
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
          className: `mt-3 text-2xl font-bold ${colours.title}`,
        },
        option.title
      ),
      h(
        "p",
        {
          className: `mt-3 flex-1 leading-6 ${colours.text}`,
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
      className: "min-h-screen bg-slate-100 px-4 py-8 sm:px-6",
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
            "mb-10 flex flex-wrap items-start justify-between gap-4",
        },
        h(
          "div",
          null,
          h(
            "h1",
            {
              className: "text-3xl font-bold text-slate-900",
            },
            "Stock"
          ),
          h(
            "p",
            {
              className: "mt-2 text-sm text-slate-600",
            },
            `Signed in as ${user.email ?? ""}`
          ),
          h(
            "p",
            {
              className: "mt-3 max-w-2xl text-slate-700",
            },
            "Choose whether to receive new stock or search for an existing stock item."
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
              href: "/asset-management",
              className:
                "rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50",
            },
            "Asset Management Home"
          ),
          h(
            "a",
            {
              href: "/",
              className:
                "rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800",
            },
            "Systems Home"
          )
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
            "mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm",
        },
        h(
          "h2",
          {
            className: "font-semibold",
          },
          "Navigation-only stage"
        ),
        h(
          "p",
          {
            className: "mt-1 text-sm",
          },
          "This Stock landing page does not create, edit or remove Hardware Database records."
        )
      )
    )
  );
}
