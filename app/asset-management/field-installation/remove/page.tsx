import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createHardwareClient } from "@/lib/hardware-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ q?: string }> };

type Position = {
  stock_item_id: string;
  product_description: string;
  product_serial: string;
  lifecycle_status: string;
  asset_classification: string;
  warehouse: string | null;
  status: string;
  installation_id: string | null;
  client_id: string | null;
  client_name: string | null;
  location_id: string | null;
  location_name: string | null;
};

type Assignment = {
  installation_asset_id: string;
  installation_id: string;
  stock_item_id: string;
  asset_role: string | null;
  asset_arrangement: string | null;
  assignment_status: string;
  removed_at: string | null;
};

function allowedEmail(email: string) {
  return (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

function cleanSearch(value: string) {
  return value.replaceAll(",", " ").replaceAll("(", " ").replaceAll(")", " ").trim();
}

function shown(value: string | null | undefined) {
  return value && value.trim() ? value : "Not recorded";
}

export default async function RemoveStartPage({ searchParams }: PageProps) {
  const projectTracker = await createProjectTrackerClient();
  const { data: { user } } = await projectTracker.auth.getUser();
  if (!user) redirect("/login?next=/asset-management/field-installation/remove");

  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email || !allowedEmail(email)) {
    return <main className="min-h-screen bg-slate-100 p-4"><section className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5"><h1 className="text-xl font-bold text-red-800">Hardware Database access denied</h1><p className="mt-2 text-sm">The signed-in email is not approved for Hardware Database access.</p></section></main>;
  }

  const parameters = await searchParams;
  const searchText = (parameters.q ?? "").trim();
  const safeSearch = cleanSearch(searchText);
  const hardware = createHardwareClient();
  const errors: string[] = [];
  let positions: Position[] = [];
  let assignments: Assignment[] = [];

  if (safeSearch.length >= 2) {
    const result = await hardware
      .from("vw_asset_current_position")
      .select("stock_item_id, product_description, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name")
      .ilike("product_serial", `%${safeSearch}%`)
      .order("product_serial")
      .limit(25);

    if (result.error) errors.push(`Asset search: ${result.error.message}`);
    else positions = (result.data as Position[] | null) ?? [];

    const ids = [...new Set(positions.map((position) => position.stock_item_id))];
    if (ids.length > 0) {
      const assignmentResult = await hardware
        .from("installation_assets")
        .select("installation_asset_id, installation_id, stock_item_id, asset_role, asset_arrangement, assignment_status, removed_at")
        .in("stock_item_id", ids)
        .eq("assignment_status", "Active");
      if (assignmentResult.error) errors.push(`Active assignment check: ${assignmentResult.error.message}`);
      else assignments = (assignmentResult.data as Assignment[] | null) ?? [];
    }
  }

  const results = positions.map((position) => {
    const matches = assignments.filter((assignment) => assignment.stock_item_id === position.stock_item_id);
    const assignment = matches.length === 1 ? matches[0] : null;
    const eligible = Boolean(
      assignment &&
      position.lifecycle_status === "Installed" &&
      position.status === "Active" &&
      position.warehouse === null &&
      position.installation_id &&
      position.client_id &&
      position.location_id &&
      assignment.installation_id === position.installation_id &&
      assignment.removed_at === null &&
      assignment.asset_arrangement === position.asset_classification,
    );
    return { position, assignment, eligible };
  }).sort((a, b) => Number(b.position.product_serial.toLowerCase() === safeSearch.toLowerCase()) - Number(a.position.product_serial.toLowerCase() === safeSearch.toLowerCase()));

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 sm:px-5">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Preview Workflow</p>
            <h1 className="mt-0.5 text-2xl font-bold text-slate-900">Remove / Return Assets</h1>
            <p className="mt-1 text-sm text-slate-700">Step 1: Find one installed asset by serial number to identify its current installation.</p>
          </div>
          <a href="/asset-management/field-installation" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Back to Field Installation</a>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <form action="/asset-management/field-installation/remove" method="get" className="flex flex-col gap-2 sm:flex-row">
            <input type="search" name="q" defaultValue={searchText} minLength={2} required autoFocus placeholder="Enter the asset serial number..." className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-base" />
            <button type="submit" className="rounded-md bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800">Find Asset</button>
            <a href="/asset-management/field-installation/remove" className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold">Clear</a>
          </form>
          <p className="mt-2 text-xs text-slate-500">Search starts with the serial number. Product description is shown to verify the match; internal IDs remain hidden.</p>
        </section>

        {errors.length > 0 ? <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">The search could not be completed</p><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></section> : null}

        {safeSearch.length >= 2 ? (
          <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-800 px-4 py-3 text-white"><h2 className="text-lg font-semibold">Serial results for “{safeSearch}”</h2></div>
            {results.length === 0 ? <p className="p-4 text-sm text-slate-600">No matching asset serial was found.</p> : <div className="divide-y divide-slate-200">{results.map(({ position, assignment, eligible }) => {
              const url = eligible && assignment ? `/asset-management/field-installation/remove/details?sourceInstallationId=${encodeURIComponent(assignment.installation_id)}&selectedAssetIds=${encodeURIComponent(assignment.installation_asset_id)}&idempotencyKey=${encodeURIComponent(randomUUID())}` : "";
              return <article key={position.stock_item_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{position.product_description}</h3><p className="mt-1 font-semibold text-amber-800">Serial {position.product_serial}</p></div><span className={eligible ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"}>{eligible ? "Eligible" : "Review required"}</span></div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2"><p>Client: {shown(position.client_name)}</p><p>Location: {shown(position.location_name)}</p><p>Role: {shown(assignment?.asset_role)}</p><p>Arrangement: {shown(assignment?.asset_arrangement)}</p></div>
                {eligible ? <a href={url} className="mt-4 inline-flex rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">Open This Installation</a> : <p className="mt-3 text-sm text-amber-900">This asset is not in one clear, Active and position-consistent installation assignment.</p>}
              </article>;
            })}</div>}
          </section>
        ) : null}

        <section className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900"><p className="font-semibold">Read-only Preview step</p><p className="mt-0.5">This screen performs SELECT queries only and does not change Hardware Database records.</p></section>
      </div>
    </main>
  );
}
