import { Skeleton } from "@/components/ui/Skeleton";

// Sem este arquivo, o App Router não tem Suspense boundary dentro do grupo
// (admin): ao navegar entre rotas do painel (dashboard -> pacientes -> etc.)
// a tela anterior fica parada, sem nenhum feedback visual, até os dados da
// rota nova chegarem do servidor — é o que o usuário descreveu como "parece
// travado" ao abrir telas. Medição (Parte 1) apontou isso como a maior causa
// de lentidão percebida, já que o tempo real de execução das queries no
// Postgres é sub-milissegundo (banco pequeno, já bem indexado).
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>

      <Skeleton className="h-96 w-full" />
    </div>
  );
}
