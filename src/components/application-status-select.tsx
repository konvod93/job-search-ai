"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "applied", label: "Відправлено" },
  { value: "viewed", label: "Переглянуто" },
  { value: "interview", label: "Співбесіда" },
  { value: "rejected", label: "Відхилено" },
  { value: "hired", label: "Прийнято" },
] as const;

export default function ApplicationStatusSelect({
  applicationId,
  initialStatus,
}: {
  applicationId: string;
  initialStatus: (typeof STATUS_OPTIONS)[number]["value"];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(
    e: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const newStatus = e.target.value as (typeof STATUS_OPTIONS)[number]["value"];
    setStatus(newStatus);
    setIsSaving(true);

    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    setIsSaving(false);

    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={isSaving}
      className="rounded border border-neutral-300 px-2 py-1 text-sm"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
