import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function allowedEmail(email: string) {
  return (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

function WorkflowCard({
  title,
  description,
  action,
  href,
  colour,
}: {
  title: string;
  description: string;
  action: string;
  href: string;
  colour: "emerald" | "violet" | "amber";
}) {
  const styles = {
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-950",
    violet: "border-violet-300 bg-violet-50 text-violet-950",
    amber: "border-amber-300 bg-amber-50 text-amber-950",
  };
  const buttonStyles = {
    emerald: "bg-emerald-700 hover:bg-emerald-800",
    violet: "bg-violet-700 hover:bg-violet-800",
    amber: "bg-amber-700 hover:bg-amber-800",
  };

  return (
    <article className={`flex h-full flex-col rounded-xl border p-5 shadow-sm ${styles[colour]}`}>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-6">{description}</p>
      <a
        href={href}
        className={`mt-5 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white ${buttonStyles[colour]}`}
      >
        {action}
      </a>
    </article>
  );
}

export default async function FieldInstallationWorkflowPage() {
  const projectTracker = await createProjectTrackerClient();
  const {
    data: { user },
  } = await projectTracker.auth.getUser();

  if (!user) {
    redirect("/login?next=/asset-management/field-installation");
  }

  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email || !allowedEmail(email)) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <section className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-red-800">Hardware Database access denied</h1>
          <p className="mt-2 text-sm text-slate-700">
            The signed-in email is not in the approved Hardware Database staff list.
          </p>
          <a
            href="/asset-management"
            className="mt-4 inline-flex rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Return to Asset Management
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Field Installation</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">What do you want to do?</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-700">
              Choose the workflow that matches the field task. Each workflow applies its own checks and preserves the complete asset history.
            </p>
            <p className="mt-1 text-xs text-slate-500">Signed in as {user.email ?? ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/asset-management" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Asset Management Home
            </a>
            <a href="/" className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Systems Home
            </a>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <WorkflowCard
            title="New Installation"
            description="Create a new installation for a client at an existing location or a proposed new location, then enter installation details and assign received stock."
            action="Start New Installation"
            href="/asset-management/field-installation/new"
            colour="emerald"
          />
          <WorkflowCard
            title="Re-install / Move Current Assets"
            description="Find an installed asset by serial number, load the complete current installation group, and move the group to an existing or proposed new destination."
            action="Start Re-install / Move"
            href="/asset-management/field-installation/reinstall"
            colour="violet"
          />
          <WorkflowCard
            title="Remove / Return Assets"
            description="Find an installation by asset serial, select only the assets being removed, and record whether each item is returned to stock, returned for assessment, or faulty / broken."
            action="Start Remove / Return"
            href="/asset-management/field-installation/remove"
            colour="amber"
          />
        </section>

        <section className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">Preview workflows</p>
          <p className="mt-1">
            Re-install / Move uses the guarded Preview bridge. Remove / Return is currently a read-only Preview workflow through Final Review while its guarded confirmation bridge is completed. Production remains disconnected.
          </p>
        </section>
      </div>
    </main>
  );
}
