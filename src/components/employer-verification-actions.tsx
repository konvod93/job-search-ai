"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmployerVerificationActions({
  employerId,
}: {
  employerId: string;
}) {
  const router = useRouter();
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(action: "approve" | "reject") {
    setIsSubmitting(true);
    await fetch(`/api/admin/employers/${employerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        note: action === "reject" ? rejectNote : undefined,
      }),
    });
    setIsSubmitting(false);
    router.refresh();
  }

  if (showRejectInput) {
    return (
      <div className="flex flex-col gap-2">
        <input
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Причина відхилення"
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => submit("reject")}
            disabled={isSubmitting || !rejectNote.trim()}
            className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Підтвердити відхилення
          </button>
          <button
            onClick={() => setShowRejectInput(false)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            Скасувати
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => submit("approve")}
        disabled={isSubmitting}
        className="rounded bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Верифікувати
      </button>
      <button
        onClick={() => setShowRejectInput(true)}
        disabled={isSubmitting}
        className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Відхилити
      </button>
    </div>
  );
}
