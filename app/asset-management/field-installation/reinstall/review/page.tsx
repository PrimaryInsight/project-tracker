import { redirect } from "next/navigation";
import { createHardwareProductionClient } from "@/lib/hardware-production-supabase";
import { createClient as createProjectTrackerClient } from "@/lib/supabase/server";
import { confirmReinstallation } from "./actions";
import ConfirmButton from "./confirm-button";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Params> };
type Position = { stock_item_id:string; product_description:string; product_serial:string; lifecycle_status:string; asset_classification:string; warehouse:string|null; status:string; installation_id:string|null; client_id:string|null; client_name:string|null; location_id:string|null; location_name:string|null };
type Assignment = { installation_asset_id:string; installation_id:string; stock_item_id:string; asset_role:string|null; asset_arrangement:string|null; assignment_status:string; removed_at:string|null };
type Installation = { installation_id:string; client_id:string; location_id:string; status:string };
type Location = { location_id:string; client_id:string; location_name:string; location_type:string|null; region:string|null; status:string };
type SourceContext = { selected:Position; assignments:Assignment[]; positions:Position[]; source:Installation };
type Destination = { mode:"existing"; location:Location } | { mode:"new"; name:string; locationType:"Site"; region:string; notes:string };

function value(p:Params,name:string){const v=p[name];return (Array.isArray(v)?v[0]:v??"").trim();}
function shown(v:string|null|undefined){return v&&v.trim()?v:"Not recorded";}
function uuidOk(v:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);}
function allowed(email:string){return (process.env.HARDWARE_ALLOWED_EMAILS??"").split(",").map((v:string)=>v.trim().toLowerCase()).filter(Boolean).includes(email);}
function invalid(message:string){return <main className="min-h-screen bg-slate-100 px-4 py-6"><section className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5 shadow-sm"><h1 className="text-xl font-bold text-red-800">Re-installation cannot continue</h1><p className="mt-2 text-sm text-slate-700">{message}</p><a href="/asset-management/field-installation/reinstall" className="mt-4 inline-flex rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white">Start Again</a></section></main>;}

async function authorised(next:string){const pt=await createProjectTrackerClient();const {data:{user}}=await pt.auth.getUser();if(!user)redirect(`/login?next=${encodeURIComponent(next)}`);const email=user.email?.trim().toLowerCase()??"";return Boolean(email&&allowed(email));}

async function loadSource(stockItemId:string,sourceInstallationId:string):Promise<{source?:SourceContext;error?:string}>{
 const hw=createHardwareProductionClient();
 const [selectedR,oneR,sourceR]=await Promise.all([
  hw.from("vw_asset_current_position").select("stock_item_id, product_description, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name").eq("stock_item_id",stockItemId).eq("installation_id",sourceInstallationId).limit(2),
  hw.from("installation_assets").select("installation_asset_id, installation_id, stock_item_id, asset_role, asset_arrangement, assignment_status, removed_at").eq("stock_item_id",stockItemId).eq("assignment_status","Active").limit(2),
  hw.from("installations").select("installation_id, client_id, location_id, status").eq("installation_id",sourceInstallationId).maybeSingle(),
 ]);
 if(selectedR.error||oneR.error||sourceR.error)return{error:"The retained source could not be revalidated safely."};
 const selectedRows=(selectedR.data as Position[]|null)??[],oneRows=(oneR.data as Assignment[]|null)??[],source=sourceR.data as Installation|null;
 if(selectedRows.length!==1||oneRows.length!==1||!source)return{error:"The source is no longer uniquely valid."};
 const selected=selectedRows[0],one=oneRows[0];
 if(source.status!=="Active"||selected.status!=="Active"||selected.lifecycle_status!=="Installed"||selected.warehouse!==null||selected.installation_id!==sourceInstallationId||selected.location_id!==source.location_id||selected.client_id!==source.client_id||one.installation_id!==sourceInstallationId||one.removed_at!==null||one.asset_arrangement!==selected.asset_classification)return{error:"The source is no longer eligible."};
 const assignmentsR=await hw.from("installation_assets").select("installation_asset_id, installation_id, stock_item_id, asset_role, asset_arrangement, assignment_status, removed_at").eq("installation_id",sourceInstallationId).eq("assignment_status","Active").order("stock_item_id");
 if(assignmentsR.error)return{error:"The grouped source assets could not be verified."};
 const assignments=(assignmentsR.data as Assignment[]|null)??[];
 if(!assignments.length||assignments.some(a=>a.removed_at!==null))return{error:"The grouped source assets changed after selection."};
 const positionsR=await hw.from("vw_asset_current_position").select("stock_item_id, product_description, product_serial, lifecycle_status, asset_classification, warehouse, status, installation_id, client_id, client_name, location_id, location_name").in("stock_item_id",assignments.map(a=>a.stock_item_id)).eq("installation_id",sourceInstallationId);
 if(positionsR.error)return{error:"The grouped source positions could not be verified."};
 const positions=(positionsR.data as Position[]|null)??[];
 const ok=assignments.every(a=>{const m=positions.filter(x=>x.stock_item_id===a.stock_item_id);const x=m.length===1?m[0]:null;return Boolean(x&&x.installation_id===sourceInstallationId&&x.location_id===source.location_id&&x.client_id===source.client_id&&x.status==="Active"&&x.lifecycle_status==="Installed"&&x.warehouse===null&&x.asset_classification===a.asset_arrangement);});
 if(!ok||positions.length!==assignments.length)return{error:"Not every Active source asset remains position-consistent."};
 return{source:{selected,assignments,positions,source}};
}

async function loadDestination(p:Params,source:SourceContext):Promise<{destination?:Destination;error?:string}>{
 const mode=value(p,"destinationMode")==="new"?"new":"existing";
 if(mode==="new"){
  const name=value(p,"newLocationName"),region=value(p,"newLocationRegion")||"Canterbury",notes=value(p,"newLocationNotes");
  if(!name||name.length>200)return{error:"The proposed new location name is missing or invalid."};
  if(region.length>120||notes.length>1000)return{error:"The proposed new location details are too long."};
  return{destination:{mode:"new",name,locationType:"Site",region,notes}};
 }
 const id=value(p,"destinationLocationId");if(!/^LOC[0-9]{5}$/.test(id))return{error:"The existing destination identifier is missing or invalid."};
 const hw=createHardwareProductionClient();const [locationR,activeR]=await Promise.all([
  hw.from("locations").select("location_id, client_id, location_name, location_type, region, status").eq("location_id",id).maybeSingle(),
  hw.from("installations").select("installation_id").eq("location_id",id).eq("status","Active"),
 ]);
 if(locationR.error||activeR.error)return{error:"The existing destination could not be revalidated safely."};
 const location=locationR.data as Location|null;const active=(activeR.data as {installation_id:string}[]|null)??[];
 if(!location||location.status!=="Active"||location.client_id!==source.source.client_id||location.location_id===source.source.location_id||active.length>0)return{error:"The existing destination is no longer eligible."};
 return{destination:{mode:"existing",location}};
}

function Assets({context}:{context:SourceContext}){return <ul className="mt-3 space-y-2">{context.assignments.map(a=>{const x=context.positions.find(p=>p.stock_item_id===a.stock_item_id);return <li key={a.installation_asset_id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><p className="font-semibold">{x?.product_description??"Product not recorded"}</p><p>Serial {x?.product_serial??"Not recorded"}</p><p className="text-xs text-slate-500">{shown(a.asset_role)} · {shown(a.asset_arrangement)}</p></li>;})}</ul>;}
function Item({label,val}:{label:string;val:string}){return <div className="rounded-md border bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium">{shown(val)}</dd></div>;}
function Hidden({name,value}:{name:string;value:string}){return <input type="hidden" name={name} value={value}/>;}

export default async function ReviewPage({searchParams}:Props){
 const route="/asset-management/field-installation/reinstall/review";if(!await authorised(route))return invalid("The signed-in email is not approved for Hardware Database access.");
 const p=await searchParams,stockItemId=value(p,"stockItemId"),sourceInstallationId=value(p,"sourceInstallationId"),idempotencyKey=value(p,"idempotencyKey");
 if(!/^STK[0-9]{5}$/.test(stockItemId)||!/^INS[0-9]{5}$/.test(sourceInstallationId)||!uuidOk(idempotencyKey))return invalid("The retained workflow identifiers are missing or invalid.");
 const loaded=await loadSource(stockItemId,sourceInstallationId);if(!loaded.source)return invalid(loaded.error??"The source could not be verified.");const c=loaded.source;
 const dLoaded=await loadDestination(p,c);if(!dLoaded.destination)return invalid(dLoaded.error??"The destination could not be verified.");const d=dLoaded.destination;
 const f={effectiveDate:value(p,"effectiveDate"),reason:value(p,"reason"),crop:value(p,"crop"),ftpId:value(p,"ftpId"),loggerId:value(p,"loggerId"),loggerType:value(p,"loggerType"),simCard:value(p,"simCard"),otherSensors:value(p,"otherSensors"),notes:value(p,"notes")};
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(f.effectiveDate)&&f.reason.length>0&&f.reason.length<=200&&f.crop.length<=120&&f.ftpId.length<=120&&f.loggerId.length<=120&&["","Harvest","Sentek"].includes(f.loggerType)&&f.simCard.length<=120&&f.otherSensors.length<=500&&f.notes.length<=1000;if(!valid)return invalid("The retained details are missing or invalid.");
 const commonQuery=`stockItemId=${encodeURIComponent(stockItemId)}&sourceInstallationId=${encodeURIComponent(sourceInstallationId)}&idempotencyKey=${encodeURIComponent(idempotencyKey)}`;
 const destinationQuery=d.mode==="existing"?`destinationMode=existing&destinationLocationId=${encodeURIComponent(d.location.location_id)}`:`destinationMode=new&newLocationName=${encodeURIComponent(d.name)}&newLocationRegion=${encodeURIComponent(d.region)}&newLocationNotes=${encodeURIComponent(d.notes)}`;
 const edit=`/asset-management/field-installation/reinstall/details?${commonQuery}&${destinationQuery}&detailsSaved=1&effectiveDate=${encodeURIComponent(f.effectiveDate)}&reason=${encodeURIComponent(f.reason)}&crop=${encodeURIComponent(f.crop)}&ftpId=${encodeURIComponent(f.ftpId)}&loggerId=${encodeURIComponent(f.loggerId)}&loggerType=${encodeURIComponent(f.loggerType)}&simCard=${encodeURIComponent(f.simCard)}&otherSensors=${encodeURIComponent(f.otherSensors)}&notes=${encodeURIComponent(f.notes)}`;
 const destinationName=d.mode==="existing"?d.location.location_name:`${d.name} (new location)`;

 return <main className="min-h-screen bg-slate-100 px-3 py-5"><div className="mx-auto max-w-5xl">
  <header className="mb-5 flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-violet-700">Preview Workflow</p><h1 className="text-2xl font-bold">Final Review</h1><p className="mt-1 text-sm">Step 4: Review the complete move, then confirm once.</p></div><a href={edit} className="rounded-md border bg-white px-3 py-2 text-sm font-semibold">Back / Edit Details</a></header>

  <section className="rounded-lg border border-violet-300 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Verified Move</p><h2 className="mt-1 text-lg font-bold">{shown(c.selected.client_name)}: {shown(c.selected.location_name)} to {destinationName}</h2><p className="mt-2 text-sm">{c.assignments.length} Active asset{c.assignments.length===1?"":"s"} will move together.</p><Assets context={c}/></section>

  {d.mode==="new"?<section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4"><h2 className="font-bold">New location to be created</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2"><Item label="Client" val={shown(c.selected.client_name)}/><Item label="Location name" val={d.name}/><Item label="Location type" val="Site"/><Item label="Region" val={d.region}/><Item label="Status" val="Active"/><Item label="Verification" val="Provisional"/><div className="sm:col-span-2"><Item label="Location notes" val={d.notes}/></div></dl></section>:<section className="mt-4 rounded-lg border bg-white p-4"><h2 className="font-bold">Existing destination location</h2><p className="mt-1 text-sm">{d.location.location_name} · {shown(d.location.location_type)} · {shown(d.location.region)}</p></section>}

  <section className="mt-4 rounded-lg border bg-white p-4 shadow-sm"><div className="flex justify-between gap-2"><h2 className="text-lg font-bold">Installation Details</h2><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">Reinstallation</span></div><dl className="mt-4 grid gap-3 sm:grid-cols-2"><Item label="Effective date" val={f.effectiveDate}/><Item label="Reason" val={f.reason}/><Item label="Crop" val={f.crop}/><Item label="FTP ID" val={f.ftpId}/><Item label="Logger ID" val={f.loggerId}/><Item label="Logger type" val={f.loggerType}/><Item label="SIM card" val={f.simCard}/><Item label="Other sensors" val={f.otherSensors}/><div className="sm:col-span-2"><Item label="Notes" val={f.notes}/></div></dl></section>

  <section className="mt-4 rounded-lg border border-violet-300 bg-violet-50 p-4"><h2 className="font-bold text-violet-950">Confirm this re-installation</h2><p className="mt-1 text-sm text-violet-900">Confirmation writes to the Hardware Database Preview only. The same workflow key is retained for safe replay if the request is repeated.</p>
   <form action={confirmReinstallation} className="mt-4">
    <Hidden name="sourceInstallationId" value={sourceInstallationId}/><Hidden name="destinationClientId" value={c.source.client_id}/><Hidden name="destinationMode" value={d.mode}/><Hidden name="idempotencyKey" value={idempotencyKey}/><Hidden name="effectiveDate" value={f.effectiveDate}/><Hidden name="reason" value={f.reason}/><Hidden name="notes" value={f.notes}/><Hidden name="crop" value={f.crop}/><Hidden name="ftpId" value={f.ftpId}/><Hidden name="loggerId" value={f.loggerId}/><Hidden name="loggerType" value={f.loggerType}/><Hidden name="simCard" value={f.simCard}/><Hidden name="otherSensors" value={f.otherSensors}/>
    {d.mode==="existing"?<Hidden name="destinationLocationId" value={d.location.location_id}/>:<><Hidden name="newLocationName" value={d.name}/><Hidden name="newLocationRegion" value={d.region}/><Hidden name="newLocationNotes" value={d.notes}/></>}
    <div className="flex flex-wrap items-center gap-3"><ConfirmButton/><a href={edit} className="rounded-md border bg-white px-4 py-2.5 text-sm font-semibold">Back / Edit Details</a></div>
   </form>
  </section>

  <section className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><p className="font-semibold">Preview confirmation enabled</p><p>The server action uses the authenticated Project Tracker identity and calls the guarded Preview bridge. Production remains disconnected.</p></section>
 </div></main>;
}
