import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { updateProjectRecord } from "@/app/actions";

export const dynamic = "force-dynamic";

type EditProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProjectPage({
  params,
}: EditProjectPageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: project, error } = await supabase
    .from("project_cards")
    .select(
      "id, project_name, description, estimated_project_value, next_follow_up_date, project_manager, company_name, contact_name"
    )
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Edit Project</h1>

          <Link
            href="/"
            className="rounded border border-gray-300 bg-white px-4 py-2 hover:bg-gray-100"
          >
            Back to Board
          </Link>
        </div>

        <form
          action={updateProjectRecord}
          className="space-y-5 rounded-lg border bg-white p-6 shadow-sm"
        >
          <input type="hidden" name="project_id" value={project.id} />

          <div>
            <div className="mb-1 block font-medium">Client</div>
            <div className="rounded border border-gray-200 bg-gray-100 px-3 py-2 text-gray-700">
              {project.company_name} | {project.contact_name}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              The client relationship is read-only on this page.
            </p>
          </div>

          <div>
            <label htmlFor="project_name" className="mb-1 block font-medium">
              Project Name *
            </label>
            <input
              id="project_name"
              name="project_name"
              type="text"
              required
              defaultValue={project.project_name}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={project.description || ""}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="project_manager" className="mb-1 block font-medium">
              Project Manager *
            </label>
            <select
              id="project_manager"
              name="project_manager"
              required
              defaultValue={project.project_manager || ""}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="" disabled>
                Select a project manager
              </option>
              <option value="Andrew Curtis">Andrew Curtis</option>
              <option value="Melissa Sullivan">Melissa Sullivan</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="estimated_project_value"
              className="mb-1 block font-medium"
            >
              Estimated Project Value
            </label>
            <input
              id="estimated_project_value"
              name="estimated_project_value"
              type="number"
              min="0"
              step="0.01"
              defaultValue={project.estimated_project_value ?? ""}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="next_follow_up_date"
              className="mb-1 block font-medium"
            >
              Next Follow-up Date
            </label>
            <input
              id="next_follow_up_date"
              name="next_follow_up_date"
              type="date"
              defaultValue={project.next_follow_up_date || ""}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
            >
              Save Changes
            </button>

            <Link
              href="/"
              className="rounded border border-gray-300 px-5 py-2 hover:bg-gray-100"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
