"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Props = {
  stockItemId: string;
  sourceInstallationId: string;
  idempotencyKey: string;
  initialName: string;
  initialRegion: string;
  initialNotes: string;
};

type Draft = {
  name: string;
  region: string;
  notes: string;
};

export default function NewLocationForm({
  stockItemId,
  sourceInstallationId,
  idempotencyKey,
  initialName,
  initialRegion,
  initialNotes,
}: Props) {
  const storageKey = useMemo(
    () =>
      `asset-management:reinstall:new-location:${sourceInstallationId}:${idempotencyKey}`,
    [sourceInstallationId, idempotencyKey],
  );

  const [name, setName] = useState(initialName);
  const [region, setRegion] = useState(initialRegion || "Canterbury");
  const [notes, setNotes] = useState(initialNotes);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<Draft>;
        if (!initialName && typeof draft.name === "string") setName(draft.name);
        if (!initialRegion && typeof draft.region === "string") setRegion(draft.region);
        if (!initialNotes && typeof draft.notes === "string") setNotes(draft.notes);
      }
    } catch {
      // A damaged or unavailable browser draft must not block the workflow.
    } finally {
      setReady(true);
    }
  }, [storageKey, initialName, initialRegion, initialNotes]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ name, region, notes } satisfies Draft),
      );
    } catch {
      // The URL remains the fallback after Save Proposed Location.
    }
  }, [ready, storageKey, name, region, notes]);

  function preserveBeforeSubmit(_event: FormEvent<HTMLFormElement>) {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ name, region, notes } satisfies Draft),
      );
    } catch {
      // Submission can continue because the form values will be placed in the URL.
    }
  }

  return (
    <form
      action="/asset-management/field-installation/reinstall/destination/new"
      method="get"
      onSubmit={preserveBeforeSubmit}
      className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <input
        type="hidden"
        name="sourceInstallationId"
        value={sourceInstallationId}
      />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="locationSaved" value="1" />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800 sm:col-span-2">
          Location name *
          <input
            name="newLocationName"
            required
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="For example, North Paddock"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
          />
        </label>

        <label className="text-sm font-semibold text-slate-800">
          Region
          <input
            name="newLocationRegion"
            maxLength={120}
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
          />
        </label>

        <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Add location notes (optional)
          </summary>
          <label className="mt-3 block text-sm font-semibold text-slate-800">
            Access or landmark notes
            <textarea
              name="newLocationNotes"
              maxLength={1000}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-normal"
            />
          </label>
        </details>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
        >
          Save Proposed Location
        </button>
        <span className="text-xs text-slate-500">
          Draft entries are retained on this device during refresh.
        </span>
      </div>
    </form>
  );
}
