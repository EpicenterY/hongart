import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health"];
const STATIC_PREFIXES = ["/_next", "/favicon.ico", "/icons", "/manifest"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 자산 제외
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const session = request.cookies.get("hongart-session");
  const isAuthenticated = session?.value === "authenticated";

  // 인증된 상태에서 로그인 페이지 접근 시 홈으로 리다이렉트
  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 공개 경로는 인증 불필요
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest).*)"],
};
