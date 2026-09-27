import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedAdminEmail } from "@/lib/auth/allowlist";

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/r/");
}

function withSessionCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || !process.env.ADMIN_EMAIL?.trim()) {
    if (isPublicPath(pathname)) return response;
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("error", "config");
    return NextResponse.redirect(login);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const allowed = isAllowedAdminEmail(user?.email);

  if (user && !allowed) {
    await supabase.auth.signOut();
  }

  if (!user || !allowed) {
    if (isPublicPath(pathname)) return response;
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    const next = pathname + request.nextUrl.search;
    if (next !== "/") login.searchParams.set("next", next);
    return withSessionCookies(response, NextResponse.redirect(login));
  }

  if (pathname === "/login") {
    return withSessionCookies(response, NextResponse.redirect(new URL("/", request.url)));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
