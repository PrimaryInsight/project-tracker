import Link from "next/link";
import AddClientForm from "./add-client-form";

export default function AddClientPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Add Client
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create a client record for Asset Management.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/asset-management/admin"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300"
          >
            Administration
          </Link>
          <Link
            href="/asset-management/admin/clients"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to Clients
          </Link>
        </div>
      </div>

      <AddClientForm />
    </main>
  );
}
