import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ArchivePage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      *,
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
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">
            Archived Projects
          </h1>

          <Link
            href="/"
            className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to Board
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-100">
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left">Project</th>
                <th className="p-3 text-left">Manager</th>
                <th className="p-3 text-left">Archived</th>
                <th className="p-3"></th>
              </tr>
            </thead>

            <tbody>
              {projects?.map((project) => (
                <tr key={project.id} className="border-b">
                  <td className="p-3">
                    {project.clients?.company_name}
                  </td>

                  <td className="p-3">
                    {project.project_name}
                  </td>

                  <td className="p-3">
                    {project.project_manager}
                  </td>

                  <td className="p-3">
                    {project.archived_date || "-"}
                  </td>

                  <td className="p-3">
                    <Link
                      href={`/projects/edit/${project.id}`}
                      className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
