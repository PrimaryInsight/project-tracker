import Link from "next/link";

type AdminSection = {
  title: string;
  description: string;
  colour: "blue" | "emerald";
  actions: {
    label: string;
    href: string;
    primary?: boolean;
  }[];
};

const sections: AdminSection[] = [
  {
    title: "Client Management",
    description: "Create, view and maintain client records.",
    colour: "blue",
    actions: [
      {
        label: "View Clients",
        href: "/asset-management/admin/clients",
      },
      {
        label: "Add Client",
        href: "/asset-management/admin/clients/add",
        primary: true,
      },
    ],
  },
  {
    title: "Location Management",
    description: "Create, view and maintain installation locations.",
    colour: "emerald",
    actions: [
      {
        label: "View Locations",
        href: "/asset-management/admin/locations",
      },
      {
        label: "Add Location",
        href: "/asset-management/admin/locations/add",
        primary: true,
      },
    ],
  },
];

function getSectionClasses(colour: AdminSection["colour"]) {
  if (colour === "blue") {
    return {
      card: "border-blue-200 bg-blue-50",
      title: "text-blue-900",
      text: "text-blue-800",
      secondary:
        "border border-blue-300 bg-white text-blue-800 hover:bg-blue-100",
      primary: "bg-blue-700 text-white hover:bg-blue-800",
    };
  }

  return {
    card: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-900",
    text: "text-emerald-800",
    secondary:
      "border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100",
    primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  };
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Administration
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage Asset Management clients and locations.
          </p>
        </div>

        <Link
          href="/asset-management"
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Asset Management Home
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const styles = getSectionClasses(section.colour);

          return (
            <section
              key={section.title}
              className={`rounded-lg border p-4 ${styles.card}`}
            >
              <h2 className={`text-lg font-semibold ${styles.title}`}>
                {section.title}
              </h2>

              <p className={`mt-1 text-sm ${styles.text}`}>
                {section.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {section.actions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`inline-flex min-h-10 items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${
                      action.primary ? styles.primary : styles.secondary
                    }`}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-base font-semibold text-slate-900">
          Planned Later
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Reporting, product administration, user administration and audit reporting.
        </p>
      </section>
    </main>
  );
}
