"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BanButton({
  employerId,
  suggestedReason,
}: {
  employerId: string;
  suggestedReason: string;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleBan() {
    setIsSubmitting(true);
    await fetch(`/api/admin/employers/${employerId}/ban`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ban", reason: suggestedReason }),
    });
    setIsSubmitting(false);
    router.refresh();
  }

  if (isConfirming) {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleBan}
          disabled={isSubmitting}
          className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {isSubmitting ? "Баню..." : "Так, забанити"}
        </button>
        <button
          onClick={() => setIsConfirming(false)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Скасувати
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="rounded bg-red-700 px-3 py-1.5 text-sm text-white"
    >
      Забанити
    </button>
  );
}

export function UnbanButton({ employerId }: { employerId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleUnban() {
    setIsSubmitting(true);
    await fetch(`/api/admin/employers/${employerId}/ban`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unban" }),
    });
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleUnban}
      disabled={isSubmitting}
      className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
    >
      {isSubmitting ? "..." : "Розбанити"}
    </button>
  );
}
