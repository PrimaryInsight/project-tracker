"use client";
import { useFormStatus } from "react-dom";
export default function ConfirmButton(){const{pending}=useFormStatus();return <button type="submit" disabled={pending} aria-disabled={pending} className="inline-flex min-w-52 items-center justify-center rounded-md bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-400">{pending?"Confirming...":"Confirm Remove / Replace"}</button>}
