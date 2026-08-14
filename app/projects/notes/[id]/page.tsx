import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addProjectNote } from "@/app/actions";

export const dynamic = "force-dynamic";

type ProjectNotesPageProps = {
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

export default async function ProjectNotesPage({ params }: ProjectNotesPageProps) {
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
    .select("id, project_name, company_name, contact_name")
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
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Project Notes</h1>
            <p className="mt-1 text-slate-600">
              {project.project_name} | {project.company_name}
            </p>
            <p className="text-sm text-slate-500">{project.contact_name}</p>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/projects/edit/${project.id}`}
              className="rounded border border-blue-600 bg-white px-4 py-2 font-medium text-blue-700 hover:bg-blue-50"
            >
              Edit Project
            </Link>
            <Link
              href="/"
              className="rounded border border-slate-300 bg-white px-4 py-2 hover:bg-slate-100"
            >
              Back to Board
            </Link>
          </div>
        </div>

        <form
          action={addProjectNote}
          className="mb-6 space-y-3 rounded-lg border bg-white p-5 shadow-sm"
        >
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
            className="rounded bg-blue-700 px-5 py-2 font-medium text-white hover:bg-blue-800"
          >
            Add Note
          </button>
        </form>

        {notesError && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
            Unable to load notes: {notesError.message}
          </div>
        )}

        <div className="space-y-4">
          {!notes?.length && (
            <div className="rounded-lg border bg-white p-5 text-slate-600">
              No notes have been added yet.
            </div>
          )}

          {notes?.map((item) => (
            <article key={item.id} className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-500">
                <span>{formatTimestamp(item.created_at)}</span>
                <span>{item.created_by || "Authenticated user"}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-slate-800">{item.note}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
