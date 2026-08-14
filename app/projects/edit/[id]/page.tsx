import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addProjectNote, updateProjectDetails } from "@/app/actions";

export const dynamic = "force-dynamic";

type ProjectDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Pacific/Auckland",
  }).format(new Date(value));
}

export default async function ProjectDetailsPage({
  params,
}: ProjectDetailsPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("project_cards")
    .select(
      "id, project_name, description, current_stage, project_value, next_follow_up_date, project_manager, company_name, contact_name, phone, mobile, email, quote_date, project_confirmed_date, install_planned_date, to_invoice_date"
    )
    .eq("id", id)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const { data: notes, error: notesError } = await supabase
    .from("project_notes")
    .select("id, note, created_at, created_by")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Project Details</h1>
            <p className="mt-1 text-slate-600">
              {project.company_name} | {project.contact_name}
            </p>
          </div>

          <Link
            href="/"
            className="rounded border border-slate-300 bg-white px-4 py-2 hover:bg-slate-100"
          >
            Back to Board
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <section>
            <form
              action={updateProjectDetails}
              className="space-y-5 rounded-lg border bg-white p-6 shadow-sm"
            >
              <input type="hidden" name="project_id" value={project.id} />

              <div className="rounded border border-slate-200 bg-slate-100 p-4">
  <div className="text-xl font-semibold text-slate-900">
    {project.company_name}
  </div>

  <div className="mt-1 text-lg text-slate-700">
    Contact: {project.contact_name}
  </div>

  <div className="mt-3 text-base text-slate-700">
    <div>
      <span className="font-medium">Mobile:</span> {project.mobile || "Not set"}
    </div>

    <div>
      <span className="font-medium">Email:</span> {project.email}
    </div>
  </div>
</div>

              <div>
                <label
                  htmlFor="project_name"
                  className="mb-1 block font-medium"
                >
                  Project Name *
                </label>
                <input
                  id="project_name"
                  name="project_name"
                  required
                  defaultValue={project.project_name}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-1 block font-medium"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  defaultValue={project.description || ""}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="project_manager"
                    className="mb-1 block font-medium"
                  >
                    Project Manager *
                  </label>
                  <select
                    id="project_manager"
                    name="project_manager"
                    required
                    defaultValue={project.project_manager || ""}
                    className="w-full rounded border border-slate-300 px-3 py-2"
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
                    htmlFor="current_stage"
                    className="mb-1 block font-medium"
                  >
                    Current Stage *
                  </label>
                  <select
                    id="current_stage"
                    name="current_stage"
                    required
                    defaultValue={project.current_stage}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  >
                    <option value="catchup">Meeting</option>
                    <option value="quote">Quote</option>
                    <option value="followup">Follow-up</option>
                    <option value="started">Project Confirmed</option>
                    <option value="install">Install Planned</option>
                    <option value="invoiced">To Invoice</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="project_value"
                    className="mb-1 block font-medium"
                  >
                    Estimated Project Value
                  </label>
                  <input
                    id="project_value"
                    name="project_value"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={project.project_value ?? ""}
                    className="w-full rounded border border-slate-300 px-3 py-2"
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
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex gap-3">
  <button
    type="submit"
    className="rounded bg-blue-700 px-5 py-2 font-medium text-white hover:bg-blue-800"
  >
    Save Project Details
  </button>

  <button
    type="submit"
    name="archive_project"
    value="true"
    className="rounded bg-red-700 px-5 py-2 font-medium text-white hover:bg-red-800"
  >
    Archive Project
  </button>
</div>
            </form>
          </section>

          <section className="rounded-lg border bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-2xl font-bold">Notes</h2>

            <form action={addProjectNote} className="mt-4 space-y-3">
              <input type="hidden" name="project_id" value={project.id} />

              <label htmlFor="note" className="block font-medium">
                New Note
              </label>
              <textarea
                id="note"
                name="note"
                required
                rows={4}
                placeholder="Add the latest project update..."
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
              <button
                type="submit"
                className="rounded bg-emerald-700 px-5 py-2 font-medium text-white hover:bg-emerald-800"
              >
                Add Note
              </button>
            </form>

            {notesError && (
              <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
                Unable to load notes: {notesError.message}
              </div>
            )}

            <div className="mt-5 max-h-[calc(100vh-360px)] space-y-4 overflow-y-auto pr-2">
              {!notes?.length && (
                <div className="rounded-lg border bg-slate-50 p-5 text-slate-600">
                  No notes have been added yet.
                </div>
              )}

              {notes?.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-500">
                    <span>{formatTimestamp(item.created_at)}</span>
                    <span>{item.created_by || "Authenticated user"}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-slate-800">
                    {item.note}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
