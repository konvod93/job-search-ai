"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMPLOYER_TYPES,
  registrationNumberLabel,
  WORK_ABROAD_COUNTRIES,
} from "@/lib/job-options";

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
    businessActivity: string;
    intermediaryListDate: string;
    intermediaryCountries: string[];
    mlcCertificate: string;
    collectionRegistryNumber: string;
    medicalLicenseNumber: string;
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
  const [businessActivity, setBusinessActivity] = useState(
    initialValues.businessActivity,
  );
  const [intermediaryListDate, setIntermediaryListDate] = useState(
    initialValues.intermediaryListDate,
  );
  const [intermediaryCountries, setIntermediaryCountries] = useState<string[]>(
    initialValues.intermediaryCountries,
  );
  const [mlcCertificate, setMlcCertificate] = useState(
    initialValues.mlcCertificate,
  );

  function toggleIntermediaryCountry(code: string) {
    setIntermediaryCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }
  const [collectionRegistryNumber, setCollectionRegistryNumber] = useState(
    initialValues.collectionRegistryNumber,
  );
  const [medicalLicenseNumber, setMedicalLicenseNumber] = useState(
    initialValues.medicalLicenseNumber,
  );
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
        businessActivity,
        intermediaryListDate,
        intermediaryCountries,
        mlcCertificate,
        collectionRegistryNumber,
        medicalLicenseNumber,
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

        {employerType === "military_security" && (
          <p className="rounded bg-blue-50 px-2 py-2 text-xs text-blue-800">
            Якщо ви публікуєте вакансії від імені військової частини (не
            рекрутингового центру) — після подачі ЄДРПОУ адмін може
            попросити додатковий підтвердний документ за підписом командира
            (окремо, поза платформою — вкажіть контакт для цього в описі
            нижче). Корпоративна пошта на домені mil.gov.ua прискорює
            перевірку, але не обов&apos;язкова — Нацгвардія/ССО/Нацполіція
            цей домен не використовують.
          </p>
        )}

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

        <label
          htmlFor="businessActivity"
          className="mt-2 text-sm text-neutral-600"
        >
          Вид діяльності (за КВЕД, коротко, необов&apos;язково)
        </label>
        <input
          id="businessActivity"
          value={businessActivity}
          onChange={(e) => setBusinessActivity(e.target.value)}
          placeholder="Наприклад: фотозйомка, створення відеоконтенту"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <p className="text-xs text-neutral-500">
          Адмін звіряє це з реальним реєстром при верифікації ЄДРПОУ/ІПН.
          Для більшості вакансій це поле не впливає ні на що, але для ролей
          на кшталт моделі/акторки/танцівниці/співачки — якщо ви ФОП, і
          заявлений вид діяльності явно не пов&apos;язаний з такою роллю
          (наприклад, &quot;роздрібна торгівля&quot; наймає акторку), така
          вакансія піде на ручний розгляд адміну, а не одразу в публікацію.
          Так само для промислового рибальства (ФОП) — вид діяльності має
          підтверджувати ліцензований вилов риби (наприклад, &quot;рибальство&quot;,
          &quot;рибне господарство&quot;, &quot;аквакультура&quot;), інакше
          публікація заблокована. Зміна цього поля після верифікації знову
          переводить профіль у статус &quot;на розгляді&quot;.
        </p>

        <fieldset className="mt-2 flex flex-col gap-2 rounded border border-neutral-200 p-3">
          <legend className="px-1 text-sm font-medium text-neutral-700">
            Посередництво у працевлаштуванні за кордоном (необов&apos;язково)
          </legend>
          <p className="text-xs text-neutral-500">
            Потрібне, якщо публікуєте вакансії роботи за кордоном
            (виробництво чи будівництво в Польщі, патронажні працівниці в
            Італії чи Німеччині, готелі Туреччини, крюїнг тощо). Ліцензування
            скасоване — тепер посередник має бути в Переліку Мінекономіки й
            може відправляти людей лише в країни, зазначені в його
            декларації (за укладеними ЗЕД-договорами). Адмін звіряє дані з
            Переліком; зміна цих полів знову переводить профіль у статус
            &quot;на розгляді&quot;. Брати плату з кандидатів за
            працевлаштування заборонено.
          </p>

          <label
            htmlFor="intermediaryListDate"
            className="text-sm text-neutral-600"
          >
            Дата включення до Переліку Мінекономіки
          </label>
          <input
            id="intermediaryListDate"
            type="date"
            value={intermediaryListDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setIntermediaryListDate(e.target.value)}
            className="w-48 rounded border border-neutral-300 px-3 py-2"
          />

          <span className="mt-1 text-sm text-neutral-600">
            Країни працевлаштування з вашої декларації
          </span>
          <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded border border-neutral-100 p-2 sm:grid-cols-3">
            {WORK_ABROAD_COUNTRIES.map((c) => (
              <label key={c.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={intermediaryCountries.includes(c.value)}
                  onChange={() => toggleIntermediaryCountry(c.value)}
                />
                {c.label}
              </label>
            ))}
          </div>

          <label
            htmlFor="mlcCertificate"
            className="mt-1 text-sm text-neutral-600"
          >
            Сертифікат відповідності Конвенції MLC 2006 (необов&apos;язково,
            для крюїнгу)
          </label>
          <input
            id="mlcCertificate"
            value={mlcCertificate}
            onChange={(e) => setMlcCertificate(e.target.value)}
            placeholder="Номер сертифіката"
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <p className="text-xs text-neutral-500">
            Не обов&apos;язковий для публікації, але його наявність
            показується моряками на вакансії й підвищує довіру.
          </p>
        </fieldset>

        <label
          htmlFor="collectionRegistryNumber"
          className="mt-2 text-sm text-neutral-600"
        >
          Номер запису в реєстрі колекторських компаній НБУ
          (необов&apos;язково)
        </label>
        <input
          id="collectionRegistryNumber"
          value={collectionRegistryNumber}
          onChange={(e) => setCollectionRegistryNumber(e.target.value)}
          placeholder="Номер запису в реєстрі"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <p className="text-xs text-neutral-500">
          Для вакансій колекторів (категорія &quot;Юридичні послуги&quot;).
          Якщо ви колекторська компанія — вкажіть номер із реєстру НБУ. Якщо
          ви кредитор (банк, фінансова компанія) зі своєю службою
          стягнення — можна залишити порожнім, але тоді така вакансія піде
          на ручний розгляд адміну. Адмін звіряє номер при верифікації;
          зміна поля знову переводить профіль у статус &quot;на
          розгляді&quot;.
        </p>

        <label
          htmlFor="medicalLicenseNumber"
          className="mt-2 text-sm text-neutral-600"
        >
          Номер ліцензії на медичну практику (необов&apos;язково)
        </label>
        <input
          id="medicalLicenseNumber"
          value={medicalLicenseNumber}
          onChange={(e) => setMedicalLicenseNumber(e.target.value)}
          placeholder="Номер ліцензії"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <p className="text-xs text-neutral-500">
          Обов&apos;язковий для вакансій лікарів і медперсоналу (категорія
          &quot;Медицина&quot;): медична практика без ліцензії незаконна.
          Це стосується й підприємств зі штатним медпунктом (не аутсорс).
          Адмін звіряє номер з ліцензійним реєстром при верифікації; зміна
          поля знову переводить профіль у статус &quot;на розгляді&quot;.
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
