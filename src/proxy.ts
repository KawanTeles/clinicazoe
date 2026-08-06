import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  "/book",
];

const PATIENT_PROTECTED_ROUTES = ["/cliente/agendar"];

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

  // 1. Proteger rotas da equipe (Admin, Recepção, Profissional)
  const isStaffRoute = STAFF_ROUTES.some((route) => pathname.startsWith(route));
  if (isStaffRoute) {
    if (!user) {
      const redirectUrl = new URL("/equipe", request.url);
      return NextResponse.redirect(redirectUrl);
    }
    // Se o usuário logado for paciente, proibir acesso ao painel da equipe
    if (role === "paciente") {
      return NextResponse.redirect(new URL("/cliente", request.url));
    }
  }

  // 2. Proteger área restrita do paciente
  const isPatientRoute = PATIENT_PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (isPatientRoute && !user) {
    return NextResponse.redirect(new URL("/cliente/login", request.url));
  }

  // 3. Redirecionamento amigável de login para rotas certas por papel
  if (pathname === "/equipe" && user) {
    if (["admin", "recepcionista", "profissional"].includes(role ?? "")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname === "/login" && user) {
    if (role === "paciente") {
      return NextResponse.redirect(new URL("/cliente", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
