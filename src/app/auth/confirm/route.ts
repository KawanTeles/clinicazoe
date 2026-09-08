import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const from = searchParams.get("from");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/confirm] exchangeCodeForSession falhou:", error.message);
    }
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      // Todo código trocado aqui vem de dois lugares: confirmação de e-mail
      // do autocadastro de paciente (sempre role paciente) ou login com
      // Google. A equipe nunca vê o botão do Google e nunca recebe link de
      // confirmação (as contas já nascem com email_confirm: true), então um
      // profile de equipe chegando aqui só pode ser o Supabase vinculando
      // automaticamente a conta Google a uma conta de senha existente com o
      // mesmo e-mail. Encerra a sessão em vez de deixar a pessoa entrar.
      // "from" só é enviado pelo fluxo de login com Google (signInWithGoogle);
      // hoje só /cliente/login usa esse botão, então esse é o default real —
      // /login e /equipe ficam como exceção explícita para uma futura tela de
      // login da equipe com Google.
      if (profile && profile.role !== "paciente") {
        await supabase.auth.signOut();
        const blockedRedirect =
          from === "/equipe" ? `${origin}/equipe?oauth_error=1` : `${origin}/cliente/login?oauth_error=1`;
        return NextResponse.redirect(blockedRedirect);
      }

      return NextResponse.redirect(`${origin}/cliente?confirmed=1`);
    }
  }

  // "from" indica qual fluxo originou o código: /login ou /equipe (equipe) ou
  // /cliente/login (paciente, inclusive Google — que é o caso mais comum
  // aqui). Só a confirmação de e-mail do autocadastro chega sem "from".
  const errorRedirect =
    from === "/login" || from === "/equipe"
      ? `${origin}${from}?oauth_error=1`
      : from
        ? `${origin}/cliente/login?oauth_error=1`
        : `${origin}/cliente/login?confirm_error=1`;

  return NextResponse.redirect(errorRedirect);
}
