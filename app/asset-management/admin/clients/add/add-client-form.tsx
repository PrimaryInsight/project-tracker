"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const STORAGE_KEY = "asset-management:create-client:draft";

type ClientDraft = {
  clientName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

const emptyDraft: ClientDraft = {
  clientName: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function AddClientForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ClientDraft>;
        setDraft({
          clientName: parsed.clientName ?? "",
          contactName: parsed.contactName ?? "",
          phone: parsed.phone ?? "",
          email: parsed.email ?? "",
          address: parsed.address ?? "",
          notes: parsed.notes ?? "",
        });
      }
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  function update(field: keyof ClientDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function reviewClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleaned: ClientDraft = {
      clientName: draft.clientName.trim(),
      contactName: draft.contactName.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim().toLowerCase(),
      address: draft.address.trim(),
      notes: draft.notes.trim(),
    };

    if (!cleaned.clientName) return;

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    router.push("/asset-management/admin/clients/add/review");
  }

  const inputClasses =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200";
  const textareaClasses =
    "w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200";
  const labelClasses = "mb-1 block text-sm font-medium text-slate-800";

  return (
    <form
      onSubmit={reviewClient}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <label htmlFor="client-name" className={labelClasses}>
          Client Name <span className="text-red-600">*</span>
        </label>
        <input
          id="client-name"
          type="text"
          required
          maxLength={250}
          autoComplete="organization"
          className={inputClasses}
          placeholder="Enter client name"
          value={draft.clientName}
          onChange={(event) => update("clientName", event.target.value)}
          disabled={!ready}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={labelClasses}>
            Contact Name
          </label>
          <input
            id="contact-name"
            type="text"
            maxLength={250}
            autoComplete="name"
            className={inputClasses}
            placeholder="Contact person"
            value={draft.contactName}
            onChange={(event) => update("contactName", event.target.value)}
            disabled={!ready}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClasses}>
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            maxLength={100}
            autoComplete="tel"
            className={inputClasses}
            placeholder="Phone number"
            value={draft.phone}
            onChange={(event) => update("phone", event.target.value)}
            disabled={!ready}
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className={labelClasses}>
          Email
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          maxLength={320}
          autoComplete="email"
          className={inputClasses}
          placeholder="name@example.com"
          value={draft.email}
          onChange={(event) => update("email", event.target.value)}
          disabled={!ready}
        />
      </div>

      <div>
        <label htmlFor="address" className={labelClasses}>
          Address
        </label>
        <textarea
          id="address"
          rows={2}
          maxLength={1000}
          autoComplete="street-address"
          className={textareaClasses}
          placeholder="Client address"
          value={draft.address}
          onChange={(event) => update("address", event.target.value)}
          disabled={!ready}
        />
      </div>

      <div>
        <label htmlFor="notes" className={labelClasses}>
          Notes
        </label>
        <textarea
          id="notes"
          rows={2}
          maxLength={2000}
          className={textareaClasses}
          placeholder="Additional notes"
          value={draft.notes}
          onChange={(event) => update("notes", event.target.value)}
          disabled={!ready}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <Link
          href="/asset-management/admin/clients"
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!ready}
          className="min-h-10 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          Review Client
        </button>
      </div>
    </form>
  );
}
