export function AIDisclaimerNotice({ className }: { className?: string }) {
  return (
    <p
      className={
        "rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-[11px] font-medium leading-relaxed text-text-secondary " +
        (className ?? "")
      }
    >
      ⚠️ Este conteúdo foi gerado com auxílio de Inteligência Artificial e deve ser revisado e
      validado pelo profissional responsável antes de ser salvo, assinado ou utilizado para fins
      clínicos.
    </p>
  );
}
