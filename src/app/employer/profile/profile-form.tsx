"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EMPLOYER_TYPES, registrationNumberLabel } from "@/lib/job-options";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
type EmployerType = (typeof EMPLOYER_TYPES)[number]["value"];

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "Не подано на верифікацію (ліміт: 1 активна вакансія)",
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
    displayName: string;
    companyDescription: string;
    website: string;
    location: string;
    phone: string;
    phoneVisible: boolean;
    employerType: EmployerType | "";
    edrpou: string;
  };
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(initialValues.companyName);
  const [displayName, setDisplayName] = useState(initialValues.displayName);
  const [companyDescription, setCompanyDescription] = useState(
    initialValues.companyDescription,
  );
  const [website, setWebsite] = useState(initialValues.website);
  const [location, setLocation] = useState(initialValues.location);
  const [phone, setPhone] = useState(initialValues.phone);
  const [phoneVisible, setPhoneVisible] = useState(
    initialValues.phoneVisible,
  );
  const [employerType, setEmployerType] = useState<EmployerType | "">(
    initialValues.employerType,
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
        displayName,
        companyDescription,
        website,
        location,
        phone,
        phoneVisible,
        employerType: employerType || undefined,
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
          Юридична назва
        </label>
        <input
          id="companyName"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <p className="text-xs text-neutral-500">
          Офіційна назва, під якою зареєстровано бізнес (наприклад,
          &quot;ФОП Петренко Олена Вікторівна&quot;) — саме її звіряє адмін
          з ЄДРПОУ/ІПН при верифікації.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-sm text-neutral-600">
          Публічна назва / бренд (необов&apos;язково)
        </label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Наприклад, назва франшизи чи торгової марки"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <p className="text-xs text-neutral-500">
          Те, що бачать кандидати у вакансіях (наприклад, &quot;Kava
          Milano&quot; — якщо юридична особа працює під франшизою і ця назва
          відоміша й викликає більше довіри, ніж юридична). Якщо не
          заповнити — всюди показується юридична назва.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="companyDescription"
          className="text-sm text-neutral-600"
        >
          Опис
        </label>
        <textarea
          id="companyDescription"
          rows={5}
          value={companyDescription}
          onChange={(e) => setCompanyDescription(e.target.value)}
          placeholder="Чим займається організація, культура, переваги для співробітників..."
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

      <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
        <label htmlFor="employerType" className="text-sm text-neutral-600">
          Тип роботодавця
        </label>
        <select
          id="employerType"
          value={employerType}
          onChange={(e) =>
            setEmployerType(e.target.value as EmployerType | "")
          }
          className="rounded border border-neutral-300 px-3 py-2"
        >
          <option value="">Оберіть тип...</option>
          {EMPLOYER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label htmlFor="edrpou" className="mt-2 text-sm text-neutral-600">
          {registrationNumberLabel(employerType || null)} (необов&apos;язково)
        </label>
        <input
          id="edrpou"
          value={edrpou}
          onChange={(e) => setEdrpou(e.target.value)}
          placeholder="12345678"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <p className="text-xs text-neutral-500">
          Оберіть тип і вкажіть номер — подамо на перевірку адміну, після
          схвалення на профілі з&apos;явиться бейдж &quot;Перевірено&quot; і
          зніметься ліміт на 1 вакансію. Без верифікації публікувати теж
          можна, але лише одну вакансію.
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
