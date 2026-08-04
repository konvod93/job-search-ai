"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(action: "accept" | "dismiss") {
    setIsSubmitting(true);
    await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => submit("accept")}
        disabled={isSubmitting}
        className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Прийняти (зняти вакансію)
      </button>
      <button
        onClick={() => submit("dismiss")}
        disabled={isSubmitting}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        Відхилити скаргу
      </button>
    </div>
  );
}
