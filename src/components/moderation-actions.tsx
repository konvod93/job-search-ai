"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ModerationActions({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setIsSubmitting(true);
    await fetch(`/api/admin/jobs/${jobId}`, {
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
        onClick={() => handleAction("approve")}
        disabled={isSubmitting}
        className="rounded bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Схвалити
      </button>
      <button
        onClick={() => handleAction("reject")}
        disabled={isSubmitting}
        className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Відхилити
      </button>
    </div>
  );
}
