"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JOB_CATEGORIES, getSubcategoriesFor } from "@/lib/job-options";

type Category = (typeof JOB_CATEGORIES)[number]["value"];

type Initial = {
  fullName: string;
  headline: string;
  location: string;
  preferredCategory: Category | null;
  preferredSubcategory: string | null;
  experienceYears: number | null;
  skills: string[];
  resumeText: string;
};

export default function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initial.fullName);
  const [headline, setHeadline] = useState(initial.headline);
  const [location, setLocation] = useState(initial.location);
  const [preferredCategory, setPreferredCategory] = useState<Category | "">(
    initial.preferredCategory ?? "",
  );
  const [preferredSubcategory, setPreferredSubcategory] = useState(
    initial.preferredSubcategory ?? "",
  );

  function handleCategoryChange(value: Category | "") {
    setPreferredCategory(value);
    setPreferredSubcategory("");
  }

  const availableSubcategories = preferredCategory
    ? getSubcategoriesFor(preferredCategory)
    : [];
  const [experienceYears, setExperienceYears] = useState(
    initial.experienceYears?.toString() ?? "",
  );
  const [skillsInput, setSkillsInput] = useState(initial.skills.join(", "));
  const [resumeText, setResumeText] = useState(initial.resumeText);
  const [summaryPreview, setSummaryPreview] = useState<string | null>(null);

  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleParse() {
    setError(null);
    setSaved(false);
    setIsParsing(true);

    const res = await fetch("/api/candidate/parse-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText }),
    });

    setIsParsing(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не вдалося розпізнати резюме");
      return;
    }

    const data = await res.json();
    setHeadline(data.headline ?? headline);
    setSkillsInput((data.skills ?? []).join(", "));
    if (typeof data.experienceYears === "number") {
      setExperienceYears(String(data.experienceYears));
    }
    setSummaryPreview(data.summary ?? null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);

    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/candidate/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        headline: headline || undefined,
        location: location || undefined,
        preferredCategory: preferredCategory || null,
        preferredSubcategory: preferredSubcategory || null,
        experienceYears: experienceYears ? Number(experienceYears) : undefined,
        skills,
        resumeText: resumeText || undefined,
      }),
    });

    setIsSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не вдалося зберегти профіль");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded border border-neutral-200 p-4">
        <label htmlFor="resumeText" className="text-sm font-medium">
          Текст резюме
        </label>
        <p className="text-xs text-neutral-500">
          Вставте текст вашого резюме — AI спробує автоматично витягнути
          посаду, скіли та досвід.
        </p>
        <textarea
          id="resumeText"
          rows={8}
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <button
          type="button"
          onClick={handleParse}
          disabled={isParsing || resumeText.trim().length < 50}
          className="self-start rounded border border-neutral-900 px-4 py-2 text-sm disabled:opacity-50"
        >
          {isParsing ? "Аналізуємо..." : "Розпізнати з AI"}
        </button>
        {summaryPreview && (
          <p className="rounded bg-neutral-50 p-3 text-sm text-neutral-600">
            <strong>AI побачив:</strong> {summaryPreview}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="fullName" className="text-sm text-neutral-600">
          Ім&apos;я та прізвище
        </label>
        <input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="headline" className="text-sm text-neutral-600">
          Посада / headline
        </label>
        <input
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="preferredCategory" className="text-sm text-neutral-600">
          Бажана сфера роботи
        </label>
        <select
          id="preferredCategory"
          value={preferredCategory}
          onChange={(e) =>
            handleCategoryChange(e.target.value as Category | "")
          }
          className="rounded border border-neutral-300 px-3 py-2"
        >
          <option value="">Не вказано (рекомендації по всіх сферах)</option>
          {JOB_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {availableSubcategories.length > 0 && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="preferredSubcategory"
            className="text-sm text-neutral-600"
          >
            Підкатегорія
          </label>
          <select
            id="preferredSubcategory"
            value={preferredSubcategory}
            onChange={(e) => setPreferredSubcategory(e.target.value)}
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

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="location" className="text-sm text-neutral-600">
            Локація
          </label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div className="flex w-40 flex-col gap-1">
          <label
            htmlFor="experienceYears"
            className="text-sm text-neutral-600"
          >
            Досвід (років)
          </label>
          <input
            id="experienceYears"
            type="number"
            min={0}
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
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
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && (
        <p className="text-sm text-green-700">Профіль збережено ✓</p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isSaving ? "Зберігаємо..." : "Зберегти профіль"}
      </button>
    </form>
  );
}
