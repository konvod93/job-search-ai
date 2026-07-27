import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Захист другого рівня для серверних компонентів сторінок.
 *
 * Не покладаємось лише на proxy.ts (Next.js middleware): у липні 2026
 * була критична вразливість (CVE-2026-64642), яка дозволяла обходити
 * middleware/proxy-автентифікацію в App Router-застосунках на Turbopack.
 * Тому кожна приватна сторінка додатково перевіряє сесію й роль сама.
 */
export async function requireRole(role: "candidate" | "employer" | "admin") {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== role) {
    redirect("/");
  }

  return session;
}
