import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "candidate" | "employer" | "admin";
    } & DefaultSession["user"];
  }

  interface User {
    role: "candidate" | "employer" | "admin";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "candidate" | "employer" | "admin";
  }
}
