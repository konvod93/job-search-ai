"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  SERVICE_CENTER_TIERS,
  FLEET_TYPES,
  getSubcategoriesFor,
  suggestsCivilianCateringInMilitaryCategory,
} from "@/lib/job-options";

type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];
type Category = (typeof JOB_CATEGORIES)[number]["value"];
type ServiceCenterTier = (typeof SERVICE_CENTER_TIERS)[number]["value"];
type FleetType = (typeof FLEET_TYPES)[number]["value"];
type Status = "draft" | "published" | "closed";

export type JobFormValues = {
  title: string;
  description: string;
  location: string;
  category: Category;
  subcategory: string;
  crossListedCategories: Category[];
  employmentType: EmploymentType;
  salaryMin: string;
  salaryMax: string;
  skillsInput: string;
  status: Status;
  serviceCenterTier: ServiceCenterTier | "";
  fleetType: FleetType | "";
  isForeignVesselCrewing: boolean;
};

const EMPTY_VALUES: JobFormValues = {
  title: "",
  description: "",
  location: "",
  category: "other",
  subcategory: "",
  crossListedCategories: [],
  employmentType: "full_time",
  salaryMin: "",
  salaryMax: "",
  skillsInput: "",
  status: "draft",
  serviceCenterTier: "",
  fleetType: "",
  isForeignVesselCrewing: false,
};

export default function JobForm({
  jobId,
  initialValues,
}: {
  jobId?: string;
  initialValues?: JobFormValues;
}) {
  const router = useRouter();
  const isEdit = Boolean(jobId);

  const [title, setTitle] = useState(initialValues?.title ?? EMPTY_VALUES.title);
  const [description, setDescription] = useState(
    initialValues?.description ?? EMPTY_VALUES.description,
  );
  const [location, setLocation] = useState(
    initialValues?.location ?? EMPTY_VALUES.location,
  );
  const [category, setCategory] = useState<Category>(
    initialValues?.category ?? EMPTY_VALUES.category,
  );
  const [subcategory, setSubcategory] = useState(
    initialValues?.subcategory ?? EMPTY_VALUES.subcategory,
  );
  const [crossListedCategories, setCrossListedCategories] = useState<
    Category[]
  >(initialValues?.crossListedCategories ?? EMPTY_VALUES.crossListedCategories);

  function toggleCrossListed(value: Category) {
    setCrossListedCategories((prev) =>
      prev.includes(value)
        ? prev.filter((c) => c !== value)
        : prev.length < 3
          ? [...prev, value]
          : prev,
    );
  }

  function handleCategoryChange(value: Category) {
    setCategory(value);
    // Підкатегорія прив'язана до категорії — при зміні категорії стара
    // підкатегорія втрачає сенс, скидаємо.
    setSubcategory("");
    // Основна категорія не може одночасно бути й додатковою
    setCrossListedCategories((prev) => prev.filter((c) => c !== value));
    // Рівень СТО стосується лише auto_service — при зміні категорії скидаємо
    if (value !== "auto_service") {
      setServiceCenterTier("");
    }
    // Тип флоту та позначка іноземного судна стосуються лише
    // maritime_transport — при зміні категорії скидаємо
    if (value !== "maritime_transport") {
      setFleetType("");
      setIsForeignVesselCrewing(false);
    }
  }

  const availableSubcategories = getSubcategoriesFor(category);

  // Не блокуюча підказка: військова частина могла помилково вибрати
  // категорію "Військові професії" для цивільної посади харчоблоку/їдальні
  // в тиловій установі (шпиталь, навчальний заклад) — там нерідко працюють
  // вільнонаймані цивільні, а не військовослужбовці. Рішення лишається за
  // роботодавцем, це лише підказка.
  const showMilitaryCateringHint = useMemo(
    () =>
      category === "military" &&
      suggestsCivilianCateringInMilitaryCategory(title, description),
    [category, title, description],
  );
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    initialValues?.employmentType ?? EMPTY_VALUES.employmentType,
  );
  const [salaryMin, setSalaryMin] = useState(
    initialValues?.salaryMin ?? EMPTY_VALUES.salaryMin,
  );
  const [salaryMax, setSalaryMax] = useState(
    initialValues?.salaryMax ?? EMPTY_VALUES.salaryMax,
  );
  const [skillsInput, setSkillsInput] = useState(
    initialValues?.skillsInput ?? EMPTY_VALUES.skillsInput,
  );
  const [serviceCenterTier, setServiceCenterTier] = useState<
    ServiceCenterTier | ""
  >(initialValues?.serviceCenterTier ?? EMPTY_VALUES.serviceCenterTier);
  const [fleetType, setFleetType] = useState<FleetType | "">(
    initialValues?.fleetType ?? EMPTY_VALUES.fleetType,
  );
  const [isForeignVesselCrewing, setIsForeignVesselCrewing] = useState(
    initialValues?.isForeignVesselCrewing ?? EMPTY_VALUES.isForeignVesselCrewing,
  );
  const [status, setStatus] = useState<Status>(
    initialValues?.status ?? EMPTY_VALUES.status,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const skillsRequired = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch(isEdit ? `/api/jobs/${jobId}` : "/api/jobs", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        location: location || undefined,
        category,
        subcategory: subcategory || undefined,
        crossListedCategories:
          crossListedCategories.length > 0 ? crossListedCategories : undefined,
        employmentType,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        skillsRequired,
        status,
        serviceCenterTier:
          category === "auto_service" && serviceCenterTier
            ? serviceCenterTier
            : isEdit
              ? null
              : undefined,
        fleetType:
          category === "maritime_transport" && fleetType
            ? fleetType
            : isEdit
              ? null
              : undefined,
        isForeignVesselCrewing:
          category === "maritime_transport" ? isForeignVesselCrewing : false,
      }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.error ??
          (isEdit
            ? "Не вдалося зберегти зміни"
            : "Не вдалося створити вакансію"),
      );
      return;
    }

    router.push("/employer/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">
        {isEdit ? "Редагування вакансії" : "Нова вакансія"}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-sm text-neutral-600">
            Назва посади
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-sm text-neutral-600">
            Опис
          </label>
          <textarea
            id="description"
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            placeholder="Київ / Віддалено"
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="category" className="text-sm text-neutral-600">
            Категорія
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as Category)}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            {JOB_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {category === "auto_service" && (
          <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
            <span className="text-sm font-medium text-neutral-700">
              Рівень СТО (необов&apos;язково)
            </span>
            <p className="text-xs text-neutral-500">
              Допомагає кандидату одразу зрозуміти вимоги — покажеться
              бейджем на вакансії й дасть кандидатам фільтр у пошуку.
            </p>
            {SERVICE_CENTER_TIERS.map((tier) => (
              <label
                key={tier.value}
                className="flex items-start gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="serviceCenterTier"
                  value={tier.value}
                  checked={serviceCenterTier === tier.value}
                  onChange={() => setServiceCenterTier(tier.value)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{tier.label}</span>
                  <span className="block text-xs text-neutral-500">
                    {tier.hint}
                  </span>
                </span>
              </label>
            ))}
            {serviceCenterTier && (
              <button
                type="button"
                onClick={() => setServiceCenterTier("")}
                className="self-start text-xs text-neutral-500 underline"
              >
                Не вказувати
              </button>
            )}
          </div>
        )}

        {category === "maritime_transport" && (
          <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
            <span className="text-sm font-medium text-neutral-700">
              Тип флоту / район плавання (необов&apos;язково)
            </span>
            <p className="text-xs text-neutral-500">
              Та сама посада на річковому буксирі й на океанському танкері —
              по суті різні вакансії з різними вимогами до сертифікатів.
              Покажеться бейджем і дасть кандидатам фільтр у пошуку.
            </p>
            {FLEET_TYPES.map((tier) => (
              <label key={tier.value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="fleetType"
                  value={tier.value}
                  checked={fleetType === tier.value}
                  onChange={() => setFleetType(tier.value)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{tier.label}</span>
                  <span className="block text-xs text-neutral-500">
                    {tier.hint}
                  </span>
                </span>
              </label>
            ))}
            {fleetType && (
              <button
                type="button"
                onClick={() => setFleetType("")}
                className="self-start text-xs text-neutral-500 underline"
              >
                Не вказувати
              </button>
            )}

            <label className="mt-2 flex items-start gap-2 border-t border-neutral-100 pt-2 text-sm">
              <input
                type="checkbox"
                checked={isForeignVesselCrewing}
                onChange={(e) => setIsForeignVesselCrewing(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">
                  Судно під іноземним прапором (крюїнг за кордон)
                </span>
                <span className="block text-xs text-neutral-500">
                  Публікація вакансій на іноземні судна вимагає ліцензії
                  Мінекономіки на посередництво у працевлаштуванні за
                  кордоном — вкажіть номер ліцензії у своєму профілі,
                  інакше публікація буде заблокована.
                </span>
              </span>
            </label>
          </div>
        )}

        {showMilitaryCateringHint && (
          <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
            💡 Схоже, це вакансія для харчоблоку/їдальні в тиловій установі
            (шпиталь, навчальний заклад). Якщо ця посада — для
            військовослужбовця (наприклад, у складі бойового підрозділу),
            залиште категорію &quot;Військові професії&quot;. Але якщо це
            цивільна вільнонаймана посада (не військовослужбовець) — оберіть
            категорію &quot;Громадське та корпоративне харчування&quot; та
            підкатегорію &quot;Харчування у медичних та лікувальних
            закладах&quot; чи &quot;Харчування в навчальних закладах&quot;.
          </p>
        )}

        {availableSubcategories.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="subcategory" className="text-sm text-neutral-600">
              Підкатегорія
            </label>
            <select
              id="subcategory"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2"
            >
              <option value="">Не вказано</option>
              {availableSubcategories.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <p className="text-sm text-neutral-600">
            Також показувати в категоріях (до 3, необов&apos;язково)
          </p>
          <p className="text-xs text-neutral-500">
            Наприклад, вакансія кур&apos;єра зі своїм авто цікавить і тих,
            хто шукає в &quot;Логістика&quot;, і тих, хто в &quot;Водії&quot;
          </p>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-neutral-200 p-2">
            {JOB_CATEGORIES.filter((c) => c.value !== category).map((c) => (
              <label
                key={c.value}
                className="flex items-center gap-2 text-sm text-neutral-700"
              >
                <input
                  type="checkbox"
                  checked={crossListedCategories.includes(c.value)}
                  disabled={
                    !crossListedCategories.includes(c.value) &&
                    crossListedCategories.length >= 3
                  }
                  onChange={() => toggleCrossListed(c.value)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="employmentType" className="text-sm text-neutral-600">
            Тип зайнятості
          </label>
          <select
            id="employmentType"
            value={employmentType}
            onChange={(e) =>
              setEmploymentType(e.target.value as EmploymentType)
            }
            className="rounded border border-neutral-300 px-3 py-2"
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="salaryMin" className="text-sm text-neutral-600">
              Зарплата від
            </label>
            <input
              id="salaryMin"
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="salaryMax" className="text-sm text-neutral-600">
              Зарплата до
            </label>
            <input
              id="salaryMax"
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="skills" className="text-sm text-neutral-600">
            Скіли (через кому)
          </label>
          <input
            id="skills"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="React, TypeScript, Next.js"
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm text-neutral-600">
            Статус
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="draft">Чернетка</option>
            <option value="published">
              {isEdit ? "Опубліковано" : "Опублікувати одразу"}
            </option>
            <option value="closed">Закрито</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting
            ? "Зберігаємо..."
            : isEdit
              ? "Зберегти зміни"
              : "Створити вакансію"}
        </button>
      </form>
    </main>
  );
}
