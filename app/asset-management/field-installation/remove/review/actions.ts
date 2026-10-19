"use server";
import { redirect } from "next/navigation";
import { createHardwareClient } from "@/lib/hardware-supabase";
import { resolvePreviewHardwareIdentity } from "@/lib/resolve-preview-hardware-identity";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INS=/^INS[0-9]{5}$/; const INA=/^INA[0-9]{6}$/; const STK=/^STK[0-9]{5}$/; const DATE=/^\d{4}-\d{2}-\d{2}$/;
const OUTCOMES=new Set(["Return to Stock","Return for Assessment","Faulty / Broken"]);
const DESTINATIONS=new Set(["Canterbury","Otago","Disposed of"]);
type Receipt={workflow?:string;schema_version?:number;idempotency_key?:string;source_installation_id?:string;removal_count?:number;replacement_count?:number;installation_status_after?:string;confirmed_by?:string;replayed?:boolean;assets?:unknown[]};
function value(f:FormData,n:string){return String(f.get(n)??"").trim()}
function nullable(v:string){return v||null}
function fail(m:string):never{throw new Error(`Remove / Replace confirmation stopped safely: ${m}. No further action was taken.`)}
function allowed(e:string){return(process.env.HARDWARE_ALLOWED_EMAILS??"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean).includes(e)}
export async function confirmRemovalReplacement(formData:FormData){
 if(["externalUserId","externalEmail","hardwareUserId","userId","email","createdBy","created_by"].some(n=>formData.has(n)))fail("browser-supplied identity values are forbidden");
 const sourceInstallationId=value(formData,"sourceInstallationId"),idempotencyKey=value(formData,"idempotencyKey"),effectiveDate=value(formData,"effectiveDate"),reason=value(formData,"reason"),notes=value(formData,"notes"),outcome=value(formData,"outcome"),destination=value(formData,"destination"),rawCount=value(formData,"removalCount");
 if(!INS.test(sourceInstallationId))fail("the source installation is invalid"); if(!UUID.test(idempotencyKey))fail("the idempotency key is missing or invalid"); if(!DATE.test(effectiveDate))fail("the effective date is missing or invalid"); if(!reason||reason.length>200)fail("the reason is missing or too long"); if(notes.length>1000)fail("the notes are too long"); if(!OUTCOMES.has(outcome)||!DESTINATIONS.has(destination)||(destination==="Disposed of"&&outcome!=="Faulty / Broken"))fail("the outcome and destination combination is invalid");
 if(!/^[1-9][0-9]*$/.test(rawCount))fail("the removal count is invalid"); const count=Number(rawCount); if(count<1||count>25)fail("between 1 and 25 removals are required");
 const removals=Array.from({length:count},(_,i)=>({installation_asset_id:value(formData,`installationAssetId_${i}`),outcome,destination,replacement_stock_item_id:nullable(value(formData,`replacementStockItemId_${i}`))}));
 if(removals.some(r=>!INA.test(r.installation_asset_id)))fail("one or more assignment identifiers are invalid"); if(new Set(removals.map(r=>r.installation_asset_id)).size!==removals.length)fail("duplicate assignments are not allowed");
 const replacements=removals.map(r=>r.replacement_stock_item_id).filter((x):x is string=>Boolean(x)); if(replacements.some(x=>!STK.test(x)))fail("one or more replacement identifiers are invalid"); if(new Set(replacements).size!==replacements.length)fail("a replacement stock item may be used only once");
 const pt=await createProjectTrackerClient(); const{data:{user},error:userError}=await pt.auth.getUser(); if(userError||!user)redirect("/login?next=/asset-management/field-installation/remove/review"); const email=user.email?.trim().toLowerCase()??""; if(!email||!allowed(email))fail("the signed-in email is not approved");
 const identity=await resolvePreviewHardwareIdentity({userId:user.id,email:user.email}); const hardware=createHardwareClient();
 const payload={schema_version:1,idempotency_key:idempotencyKey,source_installation_id:sourceInstallationId,effective_date:effectiveDate,reason,notes:nullable(notes),removals};
 const{data,error}=await hardware.rpc("confirm_removal_replacement_bridge",{p_external_user_id:identity.externalUserId,p_external_email:identity.externalEmail,p_payload:payload}); if(error){console.error("Preview removal/replacement bridge failed safely",{code:error.code});fail(error.message||"the Preview bridge rejected the request")}
 const receipt=data as Receipt|null; if(!receipt||receipt.workflow!=="confirm_removal_replacement"||receipt.schema_version!==1)fail("the Preview bridge returned an invalid receipt"); if(receipt.idempotency_key!==idempotencyKey||receipt.source_installation_id!==sourceInstallationId)fail("the Preview bridge returned a mismatched receipt"); if(receipt.removal_count!==count||receipt.replacement_count!==replacements.length||!Array.isArray(receipt.assets)||receipt.assets.length!==count)fail("the receipt counts do not match the confirmed workflow"); if(receipt.confirmed_by!==identity.hardwareUserId)fail("the receipt Hardware identity is incorrect"); if(!["Active","Closed"].includes(receipt.installation_status_after??""))fail("the resulting installation status is invalid");
 redirect(`/asset-management/installation/${encodeURIComponent(sourceInstallationId)}?previewRemovalReplacement=success&replayed=${receipt.replayed?"1":"0"}&removed=${count}&replaced=${replacements.length}&idempotencyKey=${encodeURIComponent(idempotencyKey)}`);
}
