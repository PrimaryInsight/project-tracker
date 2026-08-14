import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data, error } = await supabase
    .from("projects")
    .select("*");

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Project Tracker
      </h1>

      {error && (
        <pre className="text-red-600">
          {JSON.stringify(error, null, 2)}
        </pre>
     )}

      <pre>
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}