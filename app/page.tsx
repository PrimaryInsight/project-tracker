import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const systemCard = (
    href: string,
    title: string,
    description: string,
    colour: "blue" | "emerald"
  ) => {
    const cardClasses =
      colour === "blue"
        ? "group rounded-xl border border-blue-200 bg-blue-50 p-6 transition hover:border-blue-400 hover:shadow-md"
        : "group rounded-xl border border-emerald-200 bg-emerald-50 p-6 transition hover:border-emerald-400 hover:shadow-md";

    const titleClasses =
      colour === "blue"
        ? "text-2xl font-bold text-blue-900"
        : "text-2xl font-bold text-emerald-900";

    const descriptionClasses =
      colour === "blue"
        ? "mt-3 text-blue-800"
        : "mt-3 text-emerald-800";

    const buttonClasses =
      colour === "blue"
        ? "mt-8 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white group-hover:bg-blue-800"
        : "mt-8 inline-flex rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white group-hover:bg-emerald-800";

    return h(
      "a",
      {
        href,
        className: cardClasses,
      },
      h("h3", { className: titleClasses }, title),
      h("p", { className: descriptionClasses }, description),
      h("span", { className: buttonClasses }, `Open ${title}`)
    );
  };

  return h(
    "main",
    {
      className: "min-h-screen bg-slate-100 px-6 py-10",
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
            "mb-10 flex flex-wrap items-center justify-between gap-4",
        },
        h(
          "div",
          null,
          h(
            "h1",
            {
              className: "text-3xl font-bold text-slate-900",
            },
            "Primary Insight Systems"
          ),
          h(
            "p",
            {
              className: "mt-2 text-sm text-slate-600",
            },
            `Signed in as ${user.email ?? ""}`
          )
        ),
        h(LogoutButton)
      ),
      h(
        "section",
        {
          className:
            "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
        },
        h(
          "div",
          {
            className: "mb-8 text-center",
          },
          h(
            "h2",
            {
              className: "text-2xl font-semibold text-slate-900",
            },
            "Choose a system"
          ),
          h(
            "p",
            {
              className: "mt-2 text-slate-600",
            },
            "Select the area you would like to open."
          )
        ),
        h(
          "div",
          {
            className: "grid gap-6 md:grid-cols-2",
          },
          systemCard(
            "/tracker",
            "Project Tracker",
            "Manage clients, projects, follow-ups and project stages.",
            "blue"
          ),
          systemCard(
            "/asset-management",
            "Asset Management",
            "Manage equipment, stock, installations, locations and asset history.",
            "emerald"
          )
        )
      )
    )
  );
}