import { createElement as h, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { createHardwareClient } from "@/lib/hardware-supabase";

export const dynamic = "force-dynamic";

type Value = string | string[] | undefined;
type Params = Record<string, Value>;
type PageProps = { searchParams: Promise<Params> };
type ClientRecord = {
  client_id: string;
  client_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
};
type LocationRecord = {
  location_id: string;
  client_id: string;
  location_name: string;
  location_type: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  verification_status: string;
};

const page = "min-h-screen bg-slate-100 px-3 py-5 text-slate-900 sm:px-5";
const wrap = "mx-auto max-w-5xl";
const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const input = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50";
const primary = "inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900";

function one(value: Value): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function displayValue(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "Not recorded" : String(value);
}
function detailField(label: string, content: ReactNode) {
  return h("div", { className: "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" },
    h("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-slate-500" }, label),
    h("div", { className: "mt-0.5 break-words text-sm font-semibold leading-5 text-slate-900" }, content || "Not recorded")
  );
}
function navigationButton(href: string, text: string, isPrimary = false) {
  return h("a", { href, className: isPrimary ? primary : button }, text);
}
function hidden(name: string, value: string, key?: string) {
  return h("input", { key: key ?? name, type: "hidden", name, value });
}
function preservedState(params: Params, omit: string[] = []) {
  const nodes: ReactNode[] = [];
  for (const [name, raw] of Object.entries(params)) {
    if (omit.includes(name) || name === "installationStatus" || name === "review") continue;
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    values.forEach((value, index) => nodes.push(hidden(name, value, `${name}-${index}`)));
  }
  nodes.push(hidden("installationStatus", "Completed"));
  return nodes;
}
function textInput(label: string, name: string, defaultValue: string, placeholder: string, required = false, type = "text") {
  return h("label", { className: "text-sm font-semibold text-slate-700" },
    label, required ? " *" : "",
    h("input", { type, name, required, defaultValue, placeholder, className: input })
  );
}
function loggerTypeInput(defaultValue: string) {
  return h("label", { className: "text-sm font-semibold text-slate-700" },
    "Logger type",
    h("select", { name: "loggerType", defaultValue, className: input },
      h("option", { value: "" }, "Select logger type"),
      h("option", { value: "Sentek" }, "Sentek"),
      h("option", { value: "Harvest" }, "Harvest")
    )
  );
}
function buildLocationReturnUrl(params: Params) {
  const clientId = one(params.clientId).trim();
  const locationMode = one(params.locationMode).trim();
  const next = new URLSearchParams();
  next.set("clientId", clientId);
  if (locationMode === "existing") {
    next.set("locationId", one(params.locationId).trim());
    next.set("mode", "existing");
  } else {
    next.set("mode", "new");
    next.set("reviewNew", "yes");
    next.set("newLocationName", one(params.newLocationName));
    next.set("newLocationType", one(params.newLocationType));
    next.set("newRegion", one(params.newRegion));
    next.set("newLatitude", one(params.newLatitude));
    next.set("newLongitude", one(params.newLongitude));
    next.set("newNotes", one(params.newLocationNotes));
  }
  return `/asset-management/field-installation?${next.toString()}`;
}
function errorPage(title: string, message: string, href = "/asset-management/field-installation") {
  return h("main", { className: page }, h("div", { className: wrap },
    h("section", { className: `${card} border-red-200` },
      h("h1", { className: "text-2xl font-bold" }, title),
      h("p", { className: "mt-3 text-sm text-red-800" }, message),
      h("div", { className: "mt-4" }, navigationButton(href, "Return to Field Installation", true))
    )
  ));
}

export default async function InstallationDetailsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tracker = await createProjectTrackerClient();
  const { data: { user } } = await tracker.auth.getUser();
  if (!user) redirect("/login?next=/asset-management/field-installation/details");

  const allowedEmails = (process.env.HARDWARE_ALLOWED_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  const signedInEmail = user.email?.trim().toLowerCase() ?? "";
  if (!signedInEmail || !allowedEmails.includes(signedInEmail)) {
    return errorPage("Hardware Database access denied", "The signed-in email is not in the approved Hardware Database staff list.", "/asset-management");
  }

  const clientId = one(params.clientId).trim();
  const locationMode = one(params.locationMode).trim();
  const locationId = one(params.locationId).trim();
  if (!clientId || !["existing", "new"].includes(locationMode)) {
    return errorPage("Client or Location Not Selected", "Select a client and location before entering installation details.");
  }

  const hardware = createHardwareClient();
  const clientResponse = await hardware.from("clients")
    .select("client_id,client_name,contact_name,email,phone,address,status")
    .eq("client_id", clientId).maybeSingle();
  if (clientResponse.error || !clientResponse.data) {
    return errorPage("Client could not be loaded", "Return to Field Installation and select the client again.");
  }
  const client = clientResponse.data as ClientRecord;

  let location: LocationRecord | null = null;
  if (locationMode === "existing") {
    const locationResponse = await hardware.from("locations")
      .select("location_id,client_id,location_name,location_type,region,latitude,longitude,status,verification_status")
      .eq("location_id", locationId).eq("client_id", clientId).maybeSingle();
    if (locationResponse.error || !locationResponse.data) {
      return errorPage("Location could not be loaded", "Return to Field Installation and select the location again.");
    }
    location = locationResponse.data as LocationRecord;
  }

  const locationName = locationMode === "existing" ? location!.location_name : one(params.newLocationName).trim();
  if (!locationName) return errorPage("Location name is missing", "Return to Field Installation and select or enter the location again.");

  const locationReturnUrl = buildLocationReturnUrl(params);
  const selectedCount = Array.from(new Set(one(params.selected).split(",").map(value => value.trim()).filter(Boolean))).length;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const installationDate = one(params.installationDate).trim();
  const dateError = installationDate && installationDate > today ? "A completed installation cannot use a future date." : "";

  return h("main", { className: page }, h("div", { className: wrap },
    h("header", { className: "rounded-xl bg-slate-800 p-5 text-white" },
      h("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-300" }, "Preview only"),
      h("h1", { className: "mt-1 text-2xl font-bold sm:text-3xl" }, "Installation Details"),
      h("p", { className: "mt-2 text-sm text-slate-200" }, "Enter the details once, then continue directly to asset selection. Final Review is the only review screen.")
    ),

    h("section", { className: `${card} mt-4` },
      h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
        h("h2", { className: "text-xl font-bold" }, "Selected site"),
        navigationButton(locationReturnUrl, "Back to Location")
      ),
      h("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
        detailField("Client", client.client_name),
        detailField("Location", locationName),
        detailField("Location type", displayValue(locationMode === "existing" ? location!.location_type : one(params.newLocationType))),
        detailField("Region", displayValue(locationMode === "existing" ? location!.region : one(params.newRegion)))
      )
    ),

    selectedCount > 0 ? h("section", { className: "mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" },
      h("p", { className: "font-bold" }, `${selectedCount} selected asset${selectedCount === 1 ? "" : "s"} retained`),
      h("p", { className: "mt-1" }, "The selected assets and their arrangements will return to Asset Selection after these details are saved.")
    ) : null,

    h("section", { className: `${card} mt-4` },
      h("div", { className: "flex flex-wrap items-start justify-between gap-3" },
        h("div", null,
          h("h2", { className: "text-xl font-bold" }, "Create New Installation"),
          h("p", { className: "mt-1 text-sm text-slate-600" }, "Status is fixed as Completed for this field workflow.")
        ),
        h("span", { className: "rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800" }, "Completed")
      ),
      dateError ? h("p", { className: "mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900" }, dateError) : null,
      h("form", { action: "/asset-management/field-installation/assets", method: "get", className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" },
        ...preservedState(params, ["installationDate", "installationType", "crop", "loggerId", "loggerType", "ftpId", "simCard", "otherSensors", "installationNotes", "q"]),
        textInput("Installation date", "installationDate", installationDate, "", true, "date"),
        textInput("Installation type", "installationType", one(params.installationType), "New, seasonal, temporary..."),
        textInput("Crop", "crop", one(params.crop), "Grass, grape, apple..."),
        textInput("Logger ID", "loggerId", one(params.loggerId), "Logger identifier"),
        loggerTypeInput(one(params.loggerType)),
        textInput("FTP ID", "ftpId", one(params.ftpId), "FTP identifier"),
        textInput("SIM card", "simCard", one(params.simCard), "SIM identifier"),
        textInput("Other sensors", "otherSensors", one(params.otherSensors), "Optional additional sensors"),
        h("label", { className: "text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3" },
          "Installation notes",
          h("textarea", { name: "installationNotes", defaultValue: one(params.installationNotes), rows: 4, placeholder: "Optional installation notes", className: `${input} min-h-24` })
        ),
        h("div", { className: "flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3" },
          h("button", { type: "submit", disabled: Boolean(dateError), className: `${primary} disabled:cursor-not-allowed disabled:bg-slate-400` }, selectedCount ? "Save Details and Return to Assets" : "Continue to Asset Selection"),
          navigationButton(locationReturnUrl, "Back to Location")
        )
      )
    ),

    h("section", { className: "mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" },
      h("p", { className: "font-bold" }, "No database write on this page"),
      h("p", { className: "mt-1" }, "Details, selected assets and arrangements are carried in the page address until Final Review. The Hardware Database is changed only after the final Confirm button is intentionally selected.")
    )
  ));
}
