import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-url";

// Link de "esqueci minha senha" (supabase.auth.resetPasswordForEmail) aponta
// pra cá em vez de /auth/confirm: precisamos deixar a pessoa DEFINIR a nova
// senha antes de soltá-la em qualquer área logada — /auth/confirm já
// redireciona direto pro destino final, o que aqui pularia esse passo.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = SITE_URL;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/auth/nova-senha`);
    }
    console.error("[auth/reset-password] exchangeCodeForSession falhou:", error.message);
  }

  return NextResponse.redirect(`${origin}/recuperar-senha?error=1`);
}
