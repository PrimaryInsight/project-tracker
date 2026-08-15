"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { restoreProject } from "@/app/actions";

type ClientDetails = {
  company_name: string | null;
  contact_name: string | null;
};

export type ArchivedProject = {
  id: string;
  project_name: string;
  project_manager: string | null;
  archived_date: string | null;
  clients: ClientDetails | ClientDetails[] | null;
};

function getClient(project: ArchivedProject): ClientDetails | null {
  if (Array.isArray(project.clients)) {
    return project.clients[0] ?? null;
  }

  return project.clients;
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  const dateOnly = value.slice(0, 10);

  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00Z`));
}

export default function ArchiveClient({
  projects,
}: {
  projects: ArchivedProject[];
}) {
  const [search, setSearch] = useState("");

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return projects;

    return projects.filter((project) => {
      const client = getClient(project);

      return [
        client?.company_name || "",
        client?.contact_name || "",
        project.project_name,
        project.project_manager || "",
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [projects, search]);

  return (
    <>
      <div className="mb-6 max-w-xl">
        <label
          htmlFor="archive_search"
          className="mb-1 block font-medium text-slate-800"
        >
          Search archived projects
        </label>

        <input
          id="archive_search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Client, contact, project or manager"
          className="w-full rounded border border-slate-300 bg-white px-3 py-2"
        />

        <p className="mt-2 text-sm text-slate-600">
          Showing {filteredProjects.length} of {projects.length} archived projects
        </p>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-slate-600">
          No archived projects match the search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b bg-slate-100">
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left">Project</th>
                <th className="p-3 text-left">Manager</th>
                <th className="p-3 text-left">Archived</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProjects.map((project) => {
                const client = getClient(project);

                return (
                  <tr key={project.id} className="border-b last:border-b-0">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">
                        {client?.company_name || "No client"}
                      </div>
                      <div className="text-sm text-slate-500">
                        {client?.contact_name || "No contact"}
                      </div>
                    </td>

                    <td className="p-3 text-slate-900">
                      {project.project_name}
                    </td>

                    <td className="p-3 text-slate-700">
                      {project.project_manager || "Not assigned"}
                    </td>

                    <td className="p-3 text-slate-700">
                      {formatDate(project.archived_date)}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/projects/edit/${project.id}`}
                          className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                        >
                          Details
                        </Link>

                        <form action={restoreProject}>
                          <input
                            type="hidden"
                            name="project_id"
                            value={project.id}
                          />

                          <button
                            type="submit"
                            className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                          >
                            Restore
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
