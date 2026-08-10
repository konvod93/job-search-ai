"use client";

import { useState } from "react";

const REASONS = [
  "Схоже на МЛМ / фінансову піраміду",
  "Шахрайство (передоплата, обман)",
  "Направили на платний курс/тест замість найму",
  "Кадрове агентство вимагає оплату за 'послуги працевлаштування'",
  "На місці запропонували іншу роботу (не ту, що в оголошенні)",
  "Вакансія не відповідає опису (не той рівень, зарплата, умови)",
  "На співбесіді виявилось, що умови не відповідають опису вакансії",
  "Спам / нерелевантна вакансія",
  "Дискримінація в оголошенні",
  "Інше",
];

export default function ReportJobButton({ jobId }: { jobId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    const finalReason = reason === "Інше" ? customReason.trim() : reason;

    if (!finalReason) {
      setError("Опишіть причину");
      setIsSubmitting(false);
      return;
    }

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, reason: finalReason }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не вдалося надіслати скаргу");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm text-neutral-500">
        Дякуємо, скаргу надіслано на розгляд ✓
      </p>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-neutral-400 underline hover:text-neutral-600"
      >
        Поскаржитись на вакансію
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
      <p className="text-sm font-medium">Причина скарги</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {reason === "Інше" && (
        <input
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
          placeholder="Опишіть коротко"
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {isSubmitting ? "Надсилаємо..." : "Надіслати скаргу"}
        </button>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Скасувати
        </button>
      </div>
    </div>
  );
}
