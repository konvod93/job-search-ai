import Link from "next/link";
import { auth } from "@/auth";
import LogoutButton from "@/components/logout-button";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">JobSearch AI</h1>

      {session?.user ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-neutral-600">
            Ви увійшли як <strong>{session.user.email}</strong> (
            {session.user.role})
          </p>
          <LogoutButton />
        </div>
      ) : (
        <Link
          href="/login"
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          Увійти
        </Link>
      )}
    </main>
  );
}
