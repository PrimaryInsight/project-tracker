"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const validStages = ["catchup", "quote", "followup", "started", "install", "invoiced", "completed"];
const validManagers = ["Andrew Curtis", "Melissa Sullivan"];

async function getAuthenticatedSupabase() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function milestoneDateForStage(stage: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (stage === "quote") return { quoted_date: today };
  if (stage === "started") return { project_start_date: today };
  if (stage === "install") return { install_date: today };
  if (stage === "invoiced") return { invoice_date: today };
  return {};
}

export async function createClientRecord(formData: FormData) {
  const { supabase } = await getAuthenticatedSupabase();
  const companyName = String(formData.get("company_name") || "").trim();
  const contactName = String(formData.get("contact_name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const mobile = String(formData.get("mobile") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!companyName || !contactName || !phone || !email) {
    throw new Error("Company name, contact name, phone and email are required.");
  }

  const { error } = await supabase.from("clients").insert({
    company_name: companyName,
    contact_name: contactName,
    phone,
    mobile: mobile || null,
    email,
  });

  if (error?.code === "23505") throw new Error(`A client named "${companyName}" already exists.`);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/projects/new");
  redirect("/");
}

export async function createProjectRecord(formData: FormData) {
  const { supabase } = await getAuthenticatedSupabase();
  const clientId = String(formData.get("client_id") || "").trim();
  const projectName = String(formData.get("project_name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const projectManager = String(formData.get("project_manager") || "").trim();
  const currentStage = String(formData.get("current_stage") || "catchup").trim();
  const valueText = String(formData.get("estimated_project_value") || "").trim();

  if (!clientId || !projectName || !projectManager) throw new Error("Client, project name and project manager are required.");
  if (!validManagers.includes(projectManager)) throw new Error("The selected project manager is invalid.");
  if (!validStages.includes(currentStage)) throw new Error("The selected project stage is invalid.");

  const estimatedProjectValue = valueText === "" ? null : Number(valueText);
  if (estimatedProjectValue !== null && Number.isNaN(estimatedProjectValue)) {
    throw new Error("Estimated project value must be a valid number.");
  }

  const { error } = await supabase.from("projects").insert({
    client_id: clientId,
    project_name: projectName,
    description: description || null,
    project_manager: projectManager,
    current_stage: currentStage,
    estimated_project_value: estimatedProjectValue,
    ...milestoneDateForStage(currentStage),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}

export async function updateProjectDetails(formData: FormData) {
  const { supabase } = await getAuthenticatedSupabase();
  const projectId = String(formData.get("project_id") || "").trim();
  const projectName = String(formData.get("project_name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const projectManager = String(formData.get("project_manager") || "").trim();
  const currentStage = String(formData.get("current_stage") || "").trim();
  const valueText = String(formData.get("estimated_project_value") || "").trim();
  const followUpDate = String(formData.get("next_follow_up_date") || "").trim();

  if (!projectId || !projectName || !projectManager || !currentStage) {
    throw new Error("Project name, manager and current stage are required.");
  }
  if (!validManagers.includes(projectManager)) throw new Error("The selected project manager is invalid.");
  if (!validStages.includes(currentStage)) throw new Error("The selected project stage is invalid.");

  const estimatedProjectValue = valueText === "" ? null : Number(valueText);
  if (estimatedProjectValue !== null && Number.isNaN(estimatedProjectValue)) {
    throw new Error("Estimated project value must be a valid number.");
  }

  const { data: existing, error: readError } = await supabase
    .from("projects")
    .select("current_stage, quoted_date, project_start_date, install_date, invoice_date")
    .eq("id", projectId)
    .single();
  if (readError || !existing) throw new Error(readError?.message || "Project could not be found.");

  const updateValues: Record<string, string | number | null> = {
    project_name: projectName,
    description: description || null,
    project_manager: projectManager,
    current_stage: currentStage,
    estimated_project_value: estimatedProjectValue,
    next_follow_up_date: followUpDate || null,
    updated_at: new Date().toISOString(),
  };

  const today = new Date().toISOString().slice(0, 10);
  if (currentStage === "quote" && !existing.quoted_date) updateValues.quoted_date = today;
  if (currentStage === "started" && !existing.project_start_date) updateValues.project_start_date = today;
  if (currentStage === "install" && !existing.install_date) updateValues.install_date = today;
  if (currentStage === "invoiced" && !existing.invoice_date) updateValues.invoice_date = today;

  const { error: updateError } = await supabase.from("projects").update(updateValues).eq("id", projectId);
  if (updateError) throw new Error(updateError.message);

  if (existing.current_stage !== currentStage) {
    const { error: historyError } = await supabase.from("stage_history").insert({
      project_id: projectId,
      from_stage: existing.current_stage,
      to_stage: currentStage,
    });
    if (historyError) console.error("Stage history was not saved:", historyError.message);
  }

  revalidatePath("/");
  revalidatePath(`/projects/edit/${projectId}`);
  redirect(`/projects/edit/${projectId}`);
}

export async function addProjectNote(formData: FormData) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const projectId = String(formData.get("project_id") || "").trim();
  const note = String(formData.get("note") || "").trim();
  if (!projectId || !note) throw new Error("Project and note are required.");

  const { error } = await supabase.from("project_notes").insert({
    project_id: projectId,
    note,
    created_by: user.email || "Authenticated user",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/projects/edit/${projectId}`);
  redirect(`/projects/edit/${projectId}`);
}
