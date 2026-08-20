"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  getSubcategoriesFor,
} from "@/lib/job-options";

type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];
type Category = (typeof JOB_CATEGORIES)[number]["value"];
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
  }

  const availableSubcategories = getSubcategoriesFor(category);
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
