import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import BoardClient from "@/app/BoardClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: projects, error } = await supabase
    .from("project_cards")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <main className="p-8">
      <h1 className="mb-8 text-3xl font-bold">Project Tracker</h1>

      <div className="mb-6 flex gap-4">
        <Link
          href="/clients/new"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + New Client
        </Link>
        <Link
          href="/projects/new"
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          + New Project
        </Link>
      </div>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          Unable to load projects: {error.message}
        </div>
      ) : (
        <BoardClient projects={projects ?? []} />
      )}
    </main>
  );
}
