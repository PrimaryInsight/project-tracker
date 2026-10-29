"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DRAFT_STORAGE_KEY = "asset-management:create-client:draft";

type ClientRow = {
  client_id: string;
  client_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
};

type SuccessDetails = {
  clientId: string;
  clientName: string;
  replayed: boolean;
};

type ClientManagementProps = {
  clients: ClientRow[];
  success: SuccessDetails | null;
};

function clientMatches(client: ClientRow, search: string) {
  if (!search) return true;

  const searchable = [
    client.client_id,
    client.client_name,
    client.contact_name ?? "",
    client.email ?? "",
    client.phone ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(search);
}

export default function ClientManagement({
  clients,
  success,
}: ClientManagementProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");

  useEffect(() => {
    if (success) {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [success]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return clients.filter(
      (client) =>
        (status === "All" || client.status === status) &&
        clientMatches(client, normalizedSearch),
    );
  }, [clients, search, status]);

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Client Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Search Production clients or create a new client.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/asset-management"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300"
          >
            Asset Management Home
          </Link>
          <Link
            href="/asset-management/admin"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Administration
          </Link>
        </div>
      </div>

      {success ? (
        <section className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-950">
            {success.replayed ? "Client request confirmed" : "Client created successfully"}
          </h2>
          <p className="mt-1 text-sm text-emerald-900">
            <span className="font-semibold">{success.clientId}</span>
            {" · "}
            {success.clientName}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/asset-management/admin/clients/add"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Add Another Client
            </Link>
            <Link
              href={`/asset-management/client/${encodeURIComponent(success.clientId)}`}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              View Created Client
            </Link>
            <Link
              href="/asset-management/admin/clients"
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              Dismiss
            </Link>
          </div>
        </section>
      ) : (
        <div className="mb-4 flex justify-end">
          <Link
            href="/asset-management/admin/clients/add"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Add Client
          </Link>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label
              htmlFor="client-search"
              className="mb-1 block text-sm font-medium text-slate-800"
            >
              Search clients
            </label>
            <input
              id="client-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, client ID, contact, email or phone"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label
              htmlFor="client-status"
              className="mb-1 block text-sm font-medium text-slate-800"
            >
              Status
            </label>
            <select
              id="client-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:w-36"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="All">All</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            Showing {filteredClients.length} of {clients.length} clients
          </span>
          {(search || status !== "Active") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("Active");
              }}
              className="font-medium text-blue-700 hover:text-blue-900"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {filteredClients.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-600">
            No clients match the current search and status filter.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filteredClients.map((client) => (
              <li key={client.client_id} className="p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words font-semibold text-slate-950">
                        {client.client_name}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          client.status === "Active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {client.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {client.client_id}
                    </p>
                    {(client.contact_name || client.email || client.phone) && (
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {[client.contact_name, client.email, client.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/asset-management/client/${encodeURIComponent(client.client_id)}`}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
                  >
                    View Client
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
