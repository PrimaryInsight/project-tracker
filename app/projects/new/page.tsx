import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createProjectRecord } from "@/app/actions";
import ClientSearchSelect from "./ClientSearchSelect";
import SubmitButton from "./SubmitButton";

export const dynamic = "force-dynamic";

type ClientOption = {
  id: string;
  company_name: string;
  contact_name: string;
};

export default async function NewProjectPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, contact_name")
    .order("company_name");

  const clients = (data ?? []) as ClientOption[];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">New Project</h1>

          <Link
            href="/"
            className="rounded border border-gray-300 bg-white px-4 py-2 hover:bg-gray-100"
          >
            Back to Board
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
            Unable to load clients: {error.message}
          </div>
        )}

        <form
          action={createProjectRecord}
          className="space-y-5 rounded-lg border bg-white p-6 shadow-sm"
        >
          <ClientSearchSelect clients={clients} />

          <div>
            <label htmlFor="project_name" className="mb-1 block font-medium">
              Project Name *
            </label>
            <input
              id="project_name"
              name="project_name"
              type="text"
              required
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
              defaultValue=""
              required
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
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="current_stage" className="mb-1 block font-medium">
              Current Stage *
            </label>
            <select
              id="current_stage"
              name="current_stage"
              defaultValue="catchup"
              required
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="catchup">Meeting</option>
              <option value="quote">Quote</option>
              <option value="followup">Follow-up</option>
              <option value="started">Project Confirmed</option>
              <option value="install">Install Planned</option>
              <option value="invoiced">To Invoice</option>
              <option value="completed">Project Archived</option>
            </select>
          </div>

          <div className="flex gap-3">
            <SubmitButton />

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
