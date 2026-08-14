import { createClient } from "@supabase/supabase-js";

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: projects } = await supabase
    .from("projects")
    .select("*");

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-8">
        Project Tracker
      </h1>

      <div className="border rounded-lg p-4 bg-white">
        <h2 className="font-semibold mb-4">
          Initial Catch-up
        </h2>

        {projects?.map((project) => (
          <div
            key={project.id}
            className="border rounded p-3 mb-2"
          >
            <div className="font-medium">
              {project.project_name}
            </div>

            <div className="text-sm text-gray-500">
              {project.current_stage}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}