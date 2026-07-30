import { NextResponse } from "next/server";
import { auth } from "@/auth";

const proxy = auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;

  const isEmployerRoute = nextUrl.pathname.startsWith("/employer");
  const isCandidateRoute = nextUrl.pathname.startsWith("/candidate");
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isLoginPage = nextUrl.pathname === "/login";

  // Залогінений не повинен бачити сторінку логіну
  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Незалогінений не має доступу до приватних розділів
  if ((isEmployerRoute || isCandidateRoute || isAdminRoute) && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Чужа роль — не employer в /employer, не candidate в /candidate, не admin в /admin
  if (isEmployerRoute && role !== "employer") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }
  if (isCandidateRoute && role !== "candidate") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }
  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: ["/employer/:path*", "/candidate/:path*", "/admin/:path*", "/login"],
};
