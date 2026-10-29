"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClientRecord } from "./actions";

const STORAGE_KEY = "asset-management:create-client:draft";

type ClientDraft = {
  clientName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-10 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
    >
      {pending ? "Creating Client..." : "Confirm Create Client"}
    </button>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 py-2 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-950">
        {value || "Not supplied"}
      </dd>
    </div>
  );
}

export default function ReviewClientForm() {
  const [draft, setDraft] = useState<ClientDraft | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as ClientDraft;
      if (!parsed.clientName?.trim()) return;
      setDraft(parsed);
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  if (!draft) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-semibold text-amber-900">No client draft found</h2>
        <p className="mt-1 text-sm text-amber-800">
          Return to Add Client and enter the proposed details again.
        </p>
        <Link
          href="/asset-management/admin/clients/add"
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Return to Add Client
        </Link>
      </section>
    );
  }

  return (
    <form
      action={createClientRecord}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="clientName" value={draft.clientName} />
      <input type="hidden" name="contactName" value={draft.contactName} />
      <input type="hidden" name="phone" value={draft.phone} />
      <input type="hidden" name="email" value={draft.email} />
      <input type="hidden" name="address" value={draft.address} />
      <input type="hidden" name="notes" value={draft.notes} />

      <dl>
        <ReviewRow label="Client Name" value={draft.clientName} />
        <div className="grid sm:grid-cols-2 sm:gap-4">
          <ReviewRow label="Contact Name" value={draft.contactName} />
          <ReviewRow label="Phone" value={draft.phone} />
        </div>
        <ReviewRow label="Email" value={draft.email} />
        <ReviewRow label="Address" value={draft.address} />
        <ReviewRow label="Notes" value={draft.notes} />
        <ReviewRow label="Status" value="Active" />
      </dl>

      <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        No Production change occurs until Confirm Create Client is selected.
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <Link
          href="/asset-management/admin/clients/add"
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300"
        >
          Back to Edit
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
