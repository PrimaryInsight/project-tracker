import { createElement as h } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AssetManagementHome() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const heading = h(
    "h1",
    { className: "text-3xl font-bold text-slate-900" },
    "Asset Management"
  );

  const signedIn = h(
    "p",
    { className: "mt-2 text-sm text-slate-600" },
    `Signed in as ${user.email ?? ""}`
  );

  const header = h(
    "header",
    {
      className: "mb-10 flex items-center justify-between gap-4"
    },
    h("div", null, heading, signedIn),
    h(LogoutButton)
  );

  const title = h(
    "h2",
    { className: "text-2xl font-semibold text-emerald-900" },
    "Asset Management system"
  );

  const message = h(
    "p",
    { className: "mt-3 text-slate-700" },
    "The Asset Management application will be built here."
  );

  const homeButton = h(
    "a",
    {
      href: "/",
      className:
        "mt-8 inline-flex rounded-lg bg-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-800"
    },
    "Return to Systems Home"
  );

  const content = h(
    "section",
    {
      className:
        "rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm"
    },
    title,
    message,
    homeButton
  );

  return h(
    "main",
    { className: "min-h-screen bg-slate-100 px-6 py-10" },
    h(
      "div",
      { className: "mx-auto max-w-5xl" },
      header,
      content
    )
  );
}