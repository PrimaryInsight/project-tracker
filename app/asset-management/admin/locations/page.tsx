import Link from "next/link";

export default function LocationsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Location Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Location management will be connected next.
          </p>
        </div>

        <Link
          href="/asset-management/admin"
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Back to Administration
        </Link>
      </div>
    </main>
  );
}
