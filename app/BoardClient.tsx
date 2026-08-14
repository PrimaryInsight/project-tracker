"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { moveProjectStage } from "@/app/actions";

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
  phone: string | null;
  mobile: string | null;
  email: string;
  project_name: string;
  description: string | null;
  estimated_project_value: number | null;
  next_follow_up_date: string | null;
  project_manager: string | null;
  current_stage: string;
};

function formatCurrency(value: number | null) {
  if (value === null) return "Not set";

  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

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
      [
        project.company_name,
        project.contact_name,
        project.project_name,
        project.project_manager || "",
      ].some((value) => value.toLowerCase().includes(term))
    );
  }, [projects, search]);

  return (
    <>
      <div className="mb-6 max-w-md">
        <label htmlFor="board_search" className="mb-1 block font-medium">
          Search cards
        </label>
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
          const stageProjects = filteredProjects.filter(
            (project) => project.current_stage === stage.code
          );

          return (
            <div
              key={stage.code}
              className="min-h-[500px] rounded-lg border bg-white p-3"
            >
              <h2 className="mb-4 font-semibold">
                {stage.label} ({stageProjects.length})
              </h2>

              {stageProjects.map((project) => (
                <div
                  key={project.id}
                  className="mb-3 rounded-lg border bg-gray-50 p-3 shadow-sm"
                >
                  <div className="font-medium">{project.company_name}</div>
                  <div className="text-sm">{project.contact_name}</div>
                  <div className="text-sm">{project.mobile || project.phone}</div>
                  <div className="break-all text-sm">{project.email}</div>

                  <div className="mt-3 border-t pt-3">
                    <div className="font-semibold">{project.project_name}</div>

                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">Description:</span>{" "}
                      {project.description || "Not set"}
                    </div>

                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">Estimated value:</span>{" "}
                      {formatCurrency(project.estimated_project_value)}
                    </div>

                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">Next follow-up:</span>{" "}
                      {formatDate(project.next_follow_up_date)}
                    </div>

                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">Manager:</span>{" "}
                      {project.project_manager || "Not assigned"}
                    </div>
                  </div>

                  <Link
                    href={`/projects/edit/${project.id}`}
                    className="mt-3 block w-full rounded border border-blue-600 px-3 py-1.5 text-center text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    Edit Project
                  </Link>

                  <form action={moveProjectStage} className="mt-2 space-y-2">
                    <input type="hidden" name="project_id" value={project.id} />
                    <select
                      name="to_stage"
                      defaultValue={project.current_stage}
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      {stages.map((destination) => (
                        <option key={destination.code} value={destination.code}>
                          {destination.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="w-full rounded bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Move Card
                    </button>
                  </form>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
