import { auth } from "@/auth";

export default async function EmployerDashboard() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Кабінет роботодавця</h1>
      <p className="text-neutral-600">{session?.user?.email}</p>
      <p className="text-sm text-neutral-400">
        Ця сторінка доступна лише ролі employer
      </p>
    </main>
  );
}
