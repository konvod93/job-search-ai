"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

type Role = "candidate" | "employer";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("candidate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const body =
      role === "candidate"
        ? { role, email, password, fullName }
        : { role, email, password, companyName };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не вдалося зареєструватись");
      setIsSubmitting(false);
      return;
    }

    // Автологін одразу після реєстрації
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsSubmitting(false);

    if (result?.error) {
      // Реєстрація пройшла, але автологін чомусь не спрацював —
      // відправляємо на звичайний логін
      router.push("/login");
      return;
    }

    router.push(`/${role}/dashboard`);
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold">Реєстрація</h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRole("candidate")}
            className={`flex-1 rounded border px-3 py-2 text-sm ${
              role === "candidate"
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300"
            }`}
          >
            Я шукаю роботу
          </button>
          <button
            type="button"
            onClick={() => setRole("employer")}
            className={`flex-1 rounded border px-3 py-2 text-sm ${
              role === "employer"
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300"
            }`}
          >
            Я наймаю
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-neutral-600">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-neutral-600">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </div>

        {role === "candidate" ? (
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
        ) : (
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
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Реєструємо..." : "Зареєструватись"}
        </button>

        <p className="text-center text-sm text-neutral-500">
          Вже є акаунт?{" "}
          <Link href="/login" className="underline">
            Увійти
          </Link>
        </p>
      </form>
    </main>
  );
}
