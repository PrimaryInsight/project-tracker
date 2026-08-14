import Link from "next/link";
import { createClientRecord } from "@/app/actions";

export default function NewClientPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">New Client</h1>

          <Link
            href="/"
            className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100"
          >
            Back to Board
          </Link>
        </div>

        <form
          action={createClientRecord}
          className="space-y-4 rounded border bg-white p-6"
        >
          <div>
            <label className="block mb-1 font-medium">
              Company Name
            </label>
            <input
              type="text"
              name="company_name"
              required
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Contact Name
            </label>
            <input
              type="text"
              name="contact_name"
              required
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Mobile</label>
            <input
              type="text"
              name="mobile"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Save Client
          </button>
        </form>
      </div>
    </main>
  );
}
