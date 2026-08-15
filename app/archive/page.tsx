import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ArchiveClient, { ArchivedProject } from "./ArchiveClient";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      id,
      project_name,
      project_manager,
      archived_date,
      clients (
        company_name,
        contact_name
      )
    `)
    .eq("current_stage", "completed")
    .order("archived_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Archived Projects
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Search, review or restore archived projects.
            </p>
          </div>

          <Link
            href="/"
            className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to Board
          </Link>
        </div>

        <ArchiveClient projects={(projects ?? []) as ArchivedProject[]} />
      </div>
    </main>
  );
}
