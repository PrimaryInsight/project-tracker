"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ClientOption = {
  id: string;
  company_name: string;
  contact_name: string;
};

type Props = {
  clients: ClientOption[];
};

export default function ClientSearchSelect({ clients }: Props) {
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  const matchingClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return clients;
    }

    return clients.filter((client) => {
      const company = client.company_name.toLowerCase();
      const contact = client.contact_name.toLowerCase();
      return company.includes(term) || contact.includes(term);
    });
  }, [clients, search]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="client_search" className="block font-medium">
          Client *
        </label>

        <Link
          href="/clients/new"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          + Create New Client
        </Link>
      </div>

      <input
        id="client_search"
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setSelectedClientId("");
        }}
        placeholder="Search company or contact name"
        className="mb-3 w-full rounded border border-gray-300 px-3 py-2"
      />

      <select
        id="client_id"
        name="client_id"
        required
        value={selectedClientId}
        onChange={(event) => setSelectedClientId(event.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2"
      >
        <option value="">Select a client</option>
        {matchingClients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.company_name} | {client.contact_name}
          </option>
        ))}
      </select>

      {!clients.length && (
        <p className="mt-2 text-sm text-red-600">
          No clients exist yet. Create a client before creating a project.
        </p>
      )}

      {clients.length > 0 && matchingClients.length === 0 && (
        <p className="mt-2 text-sm text-amber-700">
          No matching client found. Use Create New Client if required.
        </p>
      )}
    </div>
  );
}
