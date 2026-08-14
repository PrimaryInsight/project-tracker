import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BoardClient from "@/app/BoardClient";
import LogoutButton from "@/app/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: projects, error } = await supabase
    .from("project_cards")
    .select(
      "id, company_name, contact_name, project_name, project_manager, next_follow_up_date, current_stage"
    )
    .neq("current_stage", "completed")
    .order("updated_at", { ascending: false });

  return (
    <main className="p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Project Tracker</h1>
          <p className="mt-1 text-sm text-slate-600">
            Signed in as {user.email}
          </p>
        </div>

        <LogoutButton />
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <Link
          href="/clients/new"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + New Client
        </Link>

        <Link
          href="/projects/new"
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          + New Project
        </Link>

        <Link
          href="/archive"
          className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-800"
        >
          Archived Projects
        </Link>
      </div>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          Unable to load projects: {error.message}
        </div>
      ) : (
        <BoardClient projects={projects ?? []} />
      )}
    </main>
  );
}
