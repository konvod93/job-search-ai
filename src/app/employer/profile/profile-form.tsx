"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "Не подано на верифікацію",
  pending: "На розгляді в адміна",
  verified: "Перевірено ✓",
  rejected: "Відхилено",
};

export default function EmployerProfileForm({
  initialValues,
  verificationStatus,
  verificationNote,
}: {
  initialValues: {
    companyName: string;
    companyDescription: string;
    website: string;
    location: string;
    phone: string;
    phoneVisible: boolean;
    edrpou: string;
  };
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(initialValues.companyName);
  const [companyDescription, setCompanyDescription] = useState(
    initialValues.companyDescription,
  );
  const [website, setWebsite] = useState(initialValues.website);
  const [location, setLocation] = useState(initialValues.location);
  const [phone, setPhone] = useState(initialValues.phone);
  const [phoneVisible, setPhoneVisible] = useState(
    initialValues.phoneVisible,
  );
  const [edrpou, setEdrpou] = useState(initialValues.edrpou);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const res = await fetch("/api/employer/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        companyDescription,
        website,
        location,
        phone,
        phoneVisible,
        edrpou,
      }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не вдалося зберегти профіль");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="companyName" className="text-sm text-neutral-600">
          Назва компанії
        </label>
        <input
          id="companyName"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="companyDescription"
          className="text-sm text-neutral-600"
        >
          Опис компанії
        </label>
        <textarea
          id="companyDescription"
          rows={5}
          value={companyDescription}
          onChange={(e) => setCompanyDescription(e.target.value)}
          placeholder="Чим займається компанія, культура, переваги для співробітників..."
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="website" className="text-sm text-neutral-600">
          Сайт (необов&apos;язково)
        </label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="location" className="text-sm text-neutral-600">
          Локація
        </label>
        <input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Київ"
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm text-neutral-600">
          Телефон
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+380..."
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <label className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={phoneVisible}
            onChange={(e) => setPhoneVisible(e.target.checked)}
          />
          Показувати телефон кандидатам на сторінці вакансії
        </label>
      </div>

      <div className="flex flex-col gap-1 rounded border border-neutral-200 p-3">
        <label htmlFor="edrpou" className="text-sm text-neutral-600">
          ЄДРПОУ / РНОКПП (необов&apos;язково)
        </label>
        <input
          id="edrpou"
          value={edrpou}
          onChange={(e) => setEdrpou(e.target.value)}
          placeholder="12345678"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <p className="text-xs text-neutral-500">
          Якщо вкажете — подамо на перевірку адміну, після схвалення на
          профілі з&apos;явиться бейдж &quot;Перевірено&quot;. Без ЄДРПОУ
          публікувати вакансії теж можна, просто без бейджа.
        </p>
        <p
          className={`text-sm font-medium ${
            verificationStatus === "verified"
              ? "text-green-700"
              : verificationStatus === "rejected"
                ? "text-red-700"
                : "text-neutral-500"
          }`}
        >
          Статус: {VERIFICATION_LABELS[verificationStatus]}
        </p>
        {verificationStatus === "rejected" && verificationNote && (
          <p className="text-sm text-red-700">Причина: {verificationNote}</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && (
        <p className="text-sm text-green-700">Профіль збережено ✓</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Зберігаємо..." : "Зберегти"}
      </button>
    </form>
  );
}
