import { redirect } from "next/navigation";

import { runControlledAuthTest } from "../../../lib/get-mapped-hardware-identity";
import { createClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CheckRowProps = {
  label: string;
  passed: boolean;
};

function CheckRow({ label, passed }: CheckRowProps) {
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <span>{label}</span>
      <strong style={{ color: passed ? "#166534" : "#991b1b" }}>
        {passed ? "PASS" : "FAIL"}
      </strong>
    </li>
  );
}

export default async function ControlledAuthTestPage() {
  const projectTracker = await createClient();
  const {
    data: { user },
    error,
  } = await projectTracker.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const result = await runControlledAuthTest({
    userId: user.id,
    email: user.email,
  });

  return (
    <main
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "2rem 1rem 4rem",
      }}
    >
      <p style={{ marginBottom: "0.5rem", color: "#475569" }}>
        Preview only · Read-only diagnostic
      </p>
      <h1 style={{ marginTop: 0 }}>Controlled Authentication Test</h1>

      <section
        style={{
          marginTop: "1.5rem",
          padding: "1.25rem",
          border: `2px solid ${result.overallPassed ? "#16a34a" : "#dc2626"}`,
          borderRadius: "12px",
          background: result.overallPassed ? "#f0fdf4" : "#fef2f2",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          Overall result: {result.overallPassed ? "PASS" : "FAIL"}
        </h2>
        <p style={{ marginBottom: 0 }}>{result.safeMessage}</p>
      </section>

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1.5rem" }}>
        <CheckRow
          label="Project Tracker session present"
          passed={result.projectTrackerSessionPresent}
        />
        <CheckRow
          label="Verified session email present"
          passed={result.verifiedEmailPresent}
        />
        <CheckRow
          label="Exactly one active identity mapping found"
          passed={result.identityMappingFound}
        />
        <CheckRow
          label="Identity source is Project Tracker"
          passed={result.identitySourceCorrect}
        />
        <CheckRow
          label="Mapped email matches the signed-in session"
          passed={result.mappedEmailMatchesSession}
        />
        <CheckRow
          label="Hardware identity is mapped"
          passed={result.hardwareIdentityMapped}
        />
        <CheckRow
          label="Mapped Hardware Auth user exists"
          passed={result.hardwareAuthUserExists}
        />
        <CheckRow
          label="Mapped Hardware user is an active administrator"
          passed={result.activeHardwareAdministrator}
        />
      </ul>

      <section
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          border: "1px solid #cbd5e1",
          borderRadius: "10px",
          background: "#f8fafc",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Safety status</h2>
        <p>Identity values exposed: NO</p>
        <p>Workflow called: NO</p>
        <p style={{ marginBottom: 0 }}>Database writes performed: NO</p>
      </section>
    </main>
  );
}
