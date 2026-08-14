"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-green-600 px-5 py-2 font-medium text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      {pending ? "Saving..." : "Save Project"}
    </button>
  );
}