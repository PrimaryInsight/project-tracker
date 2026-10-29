import ReviewClientForm from "./review-client-form";

export default function ReviewClientPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-5">
      <div className="mb-4">
        <p className="text-sm font-medium text-blue-700">Step 2 of 2</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Review Client
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Check the details before creating the Production client record.
        </p>
      </div>

      <ReviewClientForm />
    </main>
  );
}
