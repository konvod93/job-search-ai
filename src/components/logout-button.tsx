"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
    >
      Вийти
    </button>
  );
}
