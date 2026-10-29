"use server";

import { redirect } from "next/navigation";
import { createHardwareProductionClient } from "@/lib/hardware-production-supabase";
import { resolveMappedHardwareIdentity } from "@/lib/get-mapped-hardware-identity";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ID = /^CLI[0-9]{5}$/;

type CreateClientReceipt = {
  workflow?: string;
  schema_version?: number;
  idempotency_key?: string;
  created_by?: string;
  replayed?: boolean;
  client?: {
    client_id?: string;
    client_name?: string;
    status?: string;
  };
  identity_bridge?: {
    identity_source?: string;
    external_user_id?: string;
  };
};

function value(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function nullable(text: string) {
  return text.length > 0 ? text : null;
}

function fail(message: string): never {
  throw new Error(
    `Client creation stopped safely: ${message}. No client was created.`,
  );
}

function allowedEmail(email: string) {
  return (process.env.HARDWARE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export async function createClientRecord(formData: FormData) {
  if (
    [
      "externalUserId",
      "externalEmail",
      "hardwareUserId",
      "userId",
      "emailIdentity",
      "createdBy",
      "created_by",
    ].some((name) => formData.has(name))
  ) {
    fail("browser-supplied identity values are forbidden");
  }

  const idempotencyKey = value(formData, "idempotencyKey");
  const clientName = value(formData, "clientName");
  const contactName = value(formData, "contactName");
  const email = value(formData, "email").toLowerCase();
  const phone = value(formData, "phone");
  const address = value(formData, "address");
  const notes = value(formData, "notes");

  if (!UUID.test(idempotencyKey)) fail("the idempotency key is missing or invalid");
  if (!clientName || clientName.length > 250) fail("the client name is missing or too long");
  if (contactName.length > 250) fail("the contact name is too long");
  if (email.length > 320) fail("the email address is too long");
  if (phone.length > 100) fail("the phone number is too long");
  if (address.length > 1000) fail("the address is too long");
  if (notes.length > 2000) fail("the notes are too long");

  const projectTracker = await createProjectTrackerClient();
  const {
    data: { user },
    error: userError,
  } = await projectTracker.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=/asset-management/admin/clients/add/review");
  }

  const sessionEmail = user.email?.trim().toLowerCase() ?? "";
  if (!sessionEmail || !allowedEmail(sessionEmail)) {
    fail("the signed-in email is not approved");
  }

  const identity = await resolveMappedHardwareIdentity({
    userId: user.id,
    email: user.email,
  });

  const hardware = createHardwareProductionClient();
  const { data, error } = await hardware.rpc("create_client_bridge", {
    p_external_user_id: identity.externalUserId,
    p_external_email: identity.externalEmail,
    p_payload: {
      schema_version: 1,
      idempotency_key: idempotencyKey,
      client_name: clientName,
      contact_name: nullable(contactName),
      email: nullable(email),
      phone: nullable(phone),
      address: nullable(address),
      notes: nullable(notes),
    },
  });

  if (error) {
    console.error("Production create-client bridge failed safely", { code: error.code });
    fail(error.message || "the Production bridge rejected the request");
  }

  const receipt = data as CreateClientReceipt | null;
  if (!receipt || receipt.workflow !== "create_client") fail("the Production bridge returned an invalid receipt");
  if (receipt.schema_version !== 1 || receipt.idempotency_key !== idempotencyKey) fail("the Production bridge returned a mismatched receipt");
  if (!receipt.client?.client_id || !CLIENT_ID.test(receipt.client.client_id)) fail("the new client identifier was not returned");
  if (receipt.client.client_name !== clientName) fail("the receipt returned a different client name");
  if (receipt.client.status !== "Active") fail("the new client was not returned as Active");
  if (receipt.created_by !== identity.hardwareUserId) fail("the receipt Hardware identity is incorrect");
  if (
    receipt.identity_bridge?.identity_source !== "project_tracker" ||
    receipt.identity_bridge.external_user_id !== identity.externalUserId
  ) fail("the receipt identity attribution is incomplete or incorrect");

  redirect(
    `/asset-management/admin/clients?created=1` +
      `&clientId=${encodeURIComponent(receipt.client.client_id)}` +
      `&clientName=${encodeURIComponent(receipt.client.client_name)}` +
      `&replayed=${receipt.replayed ? "1" : "0"}`,
  );
}
