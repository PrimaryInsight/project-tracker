"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const stages = [
  { code: "catchup", label: "Initial Catch-up" },
  { code: "quote", label: "Quote Sent" },
  { code: "followup", label: "Follow-up" },
  { code: "started", label: "Project Started" },
  { code: "install", label: "Install" },
  { code: "invoiced", label: "Invoiced" },
  { code: "completed", label: "Completed" },
];

type ProjectCard = {
  id: string;
  company_name: string;
  contact_name: string;
  project_name: string;
  project_manager: string | null;
  next_follow_up_date: string | null;
  current_stage: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function BoardClient({ projects }: { projects: ProjectCard[] }) {
  const [search, setSearch] = useState("");
  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) =>
      [project.company_name, project.contact_name, project.project_name, project.project_manager || ""]
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [projects, search]);

  return (
    <>
      <div className="mb-6 max-w-md">
        <label htmlFor="board_search" className="mb-1 block font-medium">Search cards</label>
        <input
          id="board_search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Client, contact, project or manager"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {stages.map((stage) => {
          const stageProjects = filteredProjects.filter((project) => project.current_stage === stage.code);
          return (
            <section key={stage.code} className="min-h-[420px] rounded-lg border bg-white p-3">
              <h2 className="mb-4 font-semibold">{stage.label} ({stageProjects.length})</h2>

              {stageProjects.map((project) => (
                <article key={project.id} className="mb-3 rounded-lg border bg-gray-50 p-3 shadow-sm">
                  <div className="font-semibold text-slate-900">{project.company_name}</div>
                  <div className="mt-2 text-sm font-medium text-slate-800">{project.project_name}</div>
                  <div className="mt-3 text-sm text-slate-600">
                    <span className="font-medium">Next follow-up:</span><br />
                    {formatDate(project.next_follow_up_date)}
                  </div>

                  <Link
                    href={`/projects/edit/${project.id}`}
                    className="mt-4 block w-full rounded bg-blue-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-800"
                  >
                    Details
                  </Link>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
