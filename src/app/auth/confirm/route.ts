import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const from = searchParams.get("from");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "paciente") {
        return NextResponse.redirect(`${origin}/cliente?confirmed=1`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // "from" só é enviado pelo fluxo de login com Google (signInWithGoogle),
  // para devolver o erro à mesma tela em que o login foi iniciado
  // (/login para equipe, /cliente/login para paciente).
  const errorRedirect =
    from === "/login" ? `${origin}/login?oauth_error=1` : `${origin}/cliente/login?confirm_error=1`;

  return NextResponse.redirect(errorRedirect);
}
