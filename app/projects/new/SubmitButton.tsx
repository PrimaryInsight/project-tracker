"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
    >
      {pending ? "Saving..." : "Save Project"}
    </button>
  );
}