"use client";

import { useFormStatus } from "react-dom";

export default function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex min-w-44 items-center justify-center rounded-md bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-violet-400"
    >
      {pending ? "Confirming..." : "Confirm Re-installation"}
    </button>
  );
}
