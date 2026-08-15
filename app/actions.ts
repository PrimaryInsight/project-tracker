"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const validStages = [
  "catchup",
  "quote",
  "followup",
  "started",
  "install",
  "invoiced",
  "completed",
];

const validManagers = ["Andrew Curtis", "Melissa Sullivan"];

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return { supabase, user };
}

function milestoneDateForStage(stage: string) {
  const today = new Date().toISOString().slice(0, 10);

  if (stage === "quote") return { quote_date: today };
  if (stage === "started") return { project_confirmed_date: today };
  if (stage === "install") return { install_planned_date: today };
  if (stage === "invoiced") return { to_invoice_date: today };
  if (stage === "completed") return { archived_date: today };

  return {};
}

export async function createClientRecord(formData: FormData) {
  const { supabase } = await getAuthenticatedSupabase();

  const companyName = String(formData.get("company_name") || "").trim();
  const contactName = String(formData.get("contact_name") || "").trim();
  const mobile = String(formData.get("mobile") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!companyName || !contactName || !mobile || !email) {
    throw new Error(
      "Company name, contact name, mobile and email are required."
    );
  }

  const { error } = await supabase.from("clients").insert({
    company_name: companyName,
    contact_name: contactName,
    phone: null,
    mobile,
    email,
  });

  if (error?.code === "23505") {
    throw new Error(`A client named "${companyName}" already exists.`);
  }

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
  const projectManager = String(
    formData.get("project_manager") || ""
  ).trim();
  const currentStage = String(
    formData.get("current_stage") || "catchup"
  ).trim();
  const valueText = String(formData.get("project_value") || "").trim();

  if (!clientId || !projectName || !projectManager) {
    throw new Error(
      "Client, project name and project manager are required."
    );
  }

  if (!validManagers.includes(projectManager)) {
    throw new Error("The selected project manager is invalid.");
  }

  if (!validStages.includes(currentStage) || currentStage === "completed") {
    throw new Error("The selected project stage is invalid.");
  }

  const projectValue = valueText === "" ? null : Number(valueText);

  if (projectValue !== null && Number.isNaN(projectValue)) {
    throw new Error("Project value must be a valid number.");
  }

  const { error } = await supabase.from("projects").insert({
    client_id: clientId,
    project_name: projectName,
    description: description || null,
    project_manager: projectManager,
    current_stage: currentStage,
    project_value: projectValue,
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
  const projectManager = String(
    formData.get("project_manager") || ""
  ).trim();
  const currentStage = String(formData.get("current_stage") || "").trim();
  const valueText = String(formData.get("project_value") || "").trim();
  const followUpDate = String(
    formData.get("next_follow_up_date") || ""
  ).trim();
  const archiveProject =
    String(formData.get("archive_project") || "") === "true";

  if (!projectId || !projectName || !projectManager || !currentStage) {
    throw new Error(
      "Project name, manager and current stage are required."
    );
  }

  if (!validManagers.includes(projectManager)) {
    throw new Error("The selected project manager is invalid.");
  }

  if (!validStages.includes(currentStage)) {
    throw new Error("The selected project stage is invalid.");
  }

  const projectValue = valueText === "" ? null : Number(valueText);

  if (projectValue !== null && Number.isNaN(projectValue)) {
    throw new Error("Project value must be a valid number.");
  }

  const { data: existing, error: readError } = await supabase
    .from("projects")
    .select(`
      current_stage,
      quote_date,
      project_confirmed_date,
      install_planned_date,
      to_invoice_date,
      archived_date
    `)
    .eq("id", projectId)
    .single();

  if (readError || !existing) {
    throw new Error(readError?.message || "Project could not be found.");
  }

  const today = new Date().toISOString().slice(0, 10);

  if (archiveProject) {
    const { error: archiveError } = await supabase
      .from("projects")
      .update({
        current_stage: "completed",
        archived_date: existing.archived_date || today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (archiveError) throw new Error(archiveError.message);

    if (existing.current_stage !== "completed") {
      const { error: historyError } = await supabase
        .from("stage_history")
        .insert({
          project_id: projectId,
          from_stage: existing.current_stage,
          to_stage: "completed",
        });

      if (historyError) {
        console.error(
          "Archive stage history was not saved:",
          historyError.message
        );
      }
    }

    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath(`/projects/edit/${projectId}`);
    redirect("/");
  }

  const updateValues: Record<string, string | number | null> = {
    project_name: projectName,
    description: description || null,
    project_manager: projectManager,
    current_stage: currentStage,
    project_value: projectValue,
    next_follow_up_date: followUpDate || null,
    updated_at: new Date().toISOString(),
  };

  if (currentStage === "quote" && !existing.quote_date) {
    updateValues.quote_date = today;
  }

  if (currentStage === "started" && !existing.project_confirmed_date) {
    updateValues.project_confirmed_date = today;
  }

  if (currentStage === "install" && !existing.install_planned_date) {
    updateValues.install_planned_date = today;
  }

  if (currentStage === "invoiced" && !existing.to_invoice_date) {
    updateValues.to_invoice_date = today;
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update(updateValues)
    .eq("id", projectId);

  if (updateError) throw new Error(updateError.message);

  if (existing.current_stage !== currentStage) {
    const { error: historyError } = await supabase
      .from("stage_history")
      .insert({
        project_id: projectId,
        from_stage: existing.current_stage,
        to_stage: currentStage,
      });

    if (historyError) {
      console.error("Stage history was not saved:", historyError.message);
    }
  }

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/projects/edit/${projectId}`);
  redirect(`/projects/edit/${projectId}`);
}

export async function addProjectNote(formData: FormData) {
  const { supabase, user } = await getAuthenticatedSupabase();

  const projectId = String(formData.get("project_id") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!projectId || !note) {
    throw new Error("Project and note are required.");
  }

  const { error } = await supabase.from("project_notes").insert({
    project_id: projectId,
    note,
    created_by: user.email || "Authenticated user",
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/projects/edit/${projectId}`);
  redirect(`/projects/edit/${projectId}`);
}
export async function restoreProject(formData: FormData) {
  const { supabase } = await getAuthenticatedSupabase();

  const projectId = String(formData.get("project_id") || "").trim();

  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  const { data: existing, error: readError } = await supabase
    .from("projects")
    .select("current_stage")
    .eq("id", projectId)
    .single();

  if (readError || !existing) {
    throw new Error(readError?.message || "Project could not be found.");
  }

  const { error: restoreError } = await supabase
    .from("projects")
    .update({
      current_stage: "catchup",
      archived_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (restoreError) {
    throw new Error(restoreError.message);
  }

  if (existing.current_stage !== "followup") {
    const { error: historyError } = await supabase
      .from("stage_history")
      .insert({
        project_id: projectId,
        from_stage: existing.current_stage,
        to_stage: "followup",
      });

    if (historyError) {
      console.error(
        "Restore stage history was not saved:",
        historyError.message
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/projects/edit/${projectId}`);
  redirect("/archive");
}
