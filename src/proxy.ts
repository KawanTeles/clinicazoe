import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site-url";

const STAFF_ROUTES = [
  "/dashboard",
  "/requests",
  "/appointments",
  "/financial",
  "/team",
  "/users",
  "/audit",
  "/evolutions",
  "/settings",
  "/specialties",
  "/insurances",
  "/my-schedule",
  "/my-patients",
  "/reports",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Obter a role do usuário a partir dos dados do Supabase se autenticado
  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  // 1. Proteger rotas da equipe (Admin, Recepção, Profissional, Coordenação)
  const isStaffRoute = STAFF_ROUTES.some((route) => pathname.startsWith(route));
  if (isStaffRoute && !user) {
    const redirectUrl = new URL("/equipe", SITE_URL);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Redirecionamento amigável de login para quem já está autenticado
  if (pathname === "/equipe" && user) {
    if (["admin", "recepcionista", "profissional", "coordenacao"].includes(role ?? "")) {
      return NextResponse.redirect(new URL("/dashboard", SITE_URL));
    }
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/dashboard", SITE_URL));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
