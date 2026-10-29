import { redirect } from "next/navigation";
import { createHardwareProductionClient } from "@/lib/hardware-production-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import ClientManagement from "./client-management";

type ClientRow = {
  client_id: string;
  client_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
};

type ClientsPageProps = {
  searchParams: Promise<{
    created?: string;
    clientId?: string;
    clientName?: string;
    replayed?: string;
  }>;
};

function allowedEmail(email: string) {
  return (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const projectTracker = await createProjectTrackerClient();
  const {
    data: { user },
    error: userError,
  } = await projectTracker.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=/asset-management/admin/clients");
  }

  const sessionEmail = user.email?.trim().toLowerCase() ?? "";
  if (!sessionEmail || !allowedEmail(sessionEmail)) {
    throw new Error("Client Management access stopped safely: the signed-in email is not approved.");
  }

  const hardware = createHardwareProductionClient();
  const { data, error } = await hardware
    .from("clients")
    .select(
      "client_id,client_name,contact_name,email,phone,status,created_at",
    )
    .order("client_name", { ascending: true });

  if (error) {
    console.error("Production client list failed safely", { code: error.code });
    throw new Error(
      "Client Management stopped safely: the Production client list could not be loaded.",
    );
  }

  const params = await searchParams;
  const created = params.created === "1";
  const createdClientId = created ? params.clientId?.trim() ?? "" : "";
  const createdClientName = created ? params.clientName?.trim() ?? "" : "";
  const replayed = params.replayed === "1";

  const validSuccess =
    created &&
    /^CLI[0-9]{5}$/.test(createdClientId) &&
    createdClientName.length > 0;

  return (
    <ClientManagement
      clients={(data ?? []) as ClientRow[]}
      success={
        validSuccess
          ? {
              clientId: createdClientId,
              clientName: createdClientName,
              replayed,
            }
          : null
      }
    />
  );
}
